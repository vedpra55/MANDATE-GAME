import { create } from 'zustand';
import { aiPromises, aiReadCall, aiReadStatement, aiVoices } from '../ai/client.ts';
import { voiceFacts } from '../ai/facts.ts';
import { applyAction, attachVoices, newGame } from '../engine/engine.ts';
import type {
  Action,
  ActionError,
  Address,
  Channel,
  FaultLineId,
  GameState,
  TolaId,
} from '../engine/types.ts';

export type OverlayId =
  'phone' | 'ledger' | 'newspaper' | 'files' | 'writingPad' | 'diary' | 'cash' | 'booths';
export type SceneId = 'title' | 'desk' | 'map' | 'counting';

const SAVE_KEY = 'mandate.save.v1';

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 ? s : null;
  } catch {
    return null;
  }
}

function readAutoEnd(): boolean {
  try {
    return localStorage.getItem('mandate.autoEndDay') !== '0';
  } catch {
    return true;
  }
}

function writeSave(s: GameState | null): void {
  try {
    if (s && s.phase !== 'ended') localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the game simply doesn't autosave.
  }
}

type GameStore = {
  game: GameState | null;
  scene: SceneId;
  overlay: OverlayId | null;
  selectedTola: TolaId | null;
  lastError: ActionError | null;
  phoneSeen: boolean;
  hasSave: boolean;
  /** True while the AI is reading the player's words. */
  thinking: boolean;
  /** End the day automatically when no slots are left and nothing is waiting. */
  autoEndDay: boolean;
  setAutoEndDay: (on: boolean) => void;
  /** Whether the last AI call worked: shown in settings; the game plays either way. */
  aiStatus: 'unknown' | 'on' | 'offline';
  startNewGame: (name: string, address: Address) => void;
  continueGame: () => void;
  quitToTitle: () => void;
  /** Apply an engine action. Returns true if it was accepted. */
  dispatch: (action: Action) => boolean;
  /** Say something (statement, visit, answer, declaration): AI reading first, offline fallback. */
  say: (action: Extract<Action, { text: string }>) => Promise<boolean>;
  open: (overlay: OverlayId) => void;
  close: () => void;
  goTo: (scene: SceneId) => void;
  selectTola: (tola: TolaId | null) => void;
};

/**
 * UI store: holds the engine's GameState and the UI's own state (scene, open overlay).
 * All game rules live in the engine; this file only calls it and saves the result.
 */
export const useGame = create<GameStore>((set, get) => ({
  game: null,
  scene: 'title',
  overlay: null,
  selectedTola: null,
  lastError: null,
  phoneSeen: false,
  hasSave: loadSave() !== null,
  thinking: false,
  autoEndDay: readAutoEnd(),
  setAutoEndDay: (on) => {
    try {
      localStorage.setItem('mandate.autoEndDay', on ? '1' : '0');
    } catch {
      // ignore
    }
    set({ autoEndDay: on });
  },
  aiStatus: 'unknown',

  startNewGame: (name, address) => {
    const game = newGame({ seed: Math.floor(Math.random() * 2 ** 31), name, address });
    writeSave(game);
    set({
      game,
      scene: 'desk',
      overlay: null,
      selectedTola: null,
      lastError: null,
      phoneSeen: false,
      hasSave: true,
    });
  },
  continueGame: () => {
    const game = loadSave();
    if (game)
      set({
        game,
        scene: game.phase === 'counting' ? 'counting' : 'desk',
        overlay: null,
        lastError: null,
      });
  },
  quitToTitle: () =>
    set({ scene: 'title', overlay: null, selectedTola: null, hasSave: loadSave() !== null }),

  dispatch: (action) => {
    const { game } = get();
    if (!game) return false;
    const { state, error } = applyAction(game, action);
    if (error) {
      set({ lastError: error });
      return false;
    }
    writeSave(state);
    // A new morning with a question or a call waiting: Pintu hands you the phone.
    const ringing =
      action.type === 'endDay' &&
      state.phase === 'campaign' &&
      (state.pending.call || state.pending.question?.askedDay === state.clock.day);
    set(
      ringing
        ? {
            game: state,
            lastError: null,
            scene: 'desk',
            selectedTola: null,
            overlay: 'phone',
            phoneSeen: true,
          }
        : { game: state, lastError: null },
    );
    return true;
  },

  say: async (action) => {
    const { game } = get();
    if (!game || get().thinking) return false;
    const { state: checked, error } = applyAction(game, action); // validate cheaply first
    if (error) {
      set({ lastError: error });
      return false;
    }
    void checked;
    set({ thinking: true, lastError: null });
    try {
      if (action.type === 'answerCall') {
        const callReading = await aiReadCall(action.text);
        const r = applyAction(get().game!, action, { callReading: callReading ?? undefined });
        writeSave(r.state);
        set({ game: r.state, aiStatus: callReading ? 'on' : 'offline' });
        return true;
      }
      const channel: Channel =
        action.type === 'declare'
          ? 'declaration'
          : action.type === 'visit'
            ? 'visit'
            : action.type === 'answer'
              ? 'answer'
              : 'pad';
      const tola: TolaId | null = action.type === 'visit' ? action.tola : null;
      const forced: FaultLineId | null =
        action.type === 'answer' ? (game.pending.question?.faultLine ?? null) : null;
      const ai = await aiReadStatement(game, action.text, channel, tola, forced);
      const promises =
        ai && channel !== 'declaration' && ai.reading.containsPromise >= 0.5 && !ai.flagged
          ? await aiPromises(game, action.text, tola)
          : undefined;
      const notesBefore = get().game!.paNotes.length;
      const r = applyAction(get().game!, action, { reading: ai?.reading, promises });
      if (r.error) {
        set({ lastError: r.error });
        return false;
      }
      writeSave(r.state);
      set({ game: r.state, aiStatus: ai ? 'on' : 'offline' });
      // Voices arrive a moment later and never block play.
      const st = r.state.statements.at(-1);
      if (ai && st && st.text === action.text) {
        void aiVoices(voiceFacts(r.state, st, ai.flagged, notesBefore)).then((voices) => {
          const current = get().game;
          if (!voices || !current) return;
          const next = attachVoices(current, st.id, { pa: voices.pa, quotes: voices.quotes });
          writeSave(next);
          set({ game: next });
        });
      }
      return true;
    } finally {
      set({ thinking: false });
    }
  },

  open: (overlay) =>
    set(
      overlay === 'phone'
        ? { overlay, phoneSeen: true, lastError: null }
        : { overlay, lastError: null },
    ),
  close: () => set({ overlay: null, lastError: null }),
  goTo: (scene) => set({ scene, overlay: null, selectedTola: null, lastError: null }),
  selectTola: (tola) => set({ selectedTola: tola, lastError: null }),
}));

// Dev-only handle for inspecting and seeding state from the browser console or test scripts.
if (import.meta.env.DEV) {
  (window as unknown as { __game: typeof useGame }).__game = useGame;
}
