import { create } from 'zustand';
import { applyAction, newGame } from '../engine/engine.ts';
import type { Action, ActionError, Address, GameState, TolaId } from '../engine/types.ts';

export type OverlayId =
  'phone' | 'ledger' | 'newspaper' | 'files' | 'writingPad' | 'diary' | 'cash';
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
  startNewGame: (name: string, address: Address) => void;
  continueGame: () => void;
  quitToTitle: () => void;
  /** Apply an engine action. Returns true if it was accepted. */
  dispatch: (action: Action) => boolean;
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
    set({ game: state, lastError: null });
    return true;
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
