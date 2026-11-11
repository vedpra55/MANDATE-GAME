import { create } from 'zustand';
import { canAct, createClock, endDay, isPollDay, spendSlot, type Clock } from '../engine/clock.ts';
import { headlines, openingMessages, paNotesByDay } from '../ui/content.ts';

export type OverlayId =
  'phone' | 'ledger' | 'newspaper' | 'files' | 'writingPad' | 'diary' | 'cash';
export type SceneId = 'desk' | 'map';

export type PhoneMessage = { id: number; from: string; text: string; day: number };
export type Statement = { id: number; day: number; slot: number; text: string };

type GameStore = {
  clock: Clock;
  cash: number;
  scene: SceneId;
  overlay: OverlayId | null;
  messages: PhoneMessage[];
  unread: number;
  statements: Statement[];
  paNotes: string[];
  open: (overlay: OverlayId) => void;
  close: () => void;
  goTo: (scene: SceneId) => void;
  tearCalendarPage: () => void;
  submitStatement: (text: string) => boolean;
};

let nextId = 1;

/**
 * UI-facing store. The engine owns the rules (clock); this binds them to React.
 * Step 5 replaces the loose fields with the engine's GameState.
 */
export const useGame = create<GameStore>((set, get) => ({
  clock: createClock(),
  cash: 15_000,
  scene: 'desk',
  overlay: null,
  messages: openingMessages.map((m) => ({ ...m, id: nextId++, day: 1 })),
  unread: openingMessages.length,
  statements: [],
  paNotes: [paNotesByDay[0]!],

  open: (overlay) => set(overlay === 'phone' ? { overlay, unread: 0 } : { overlay }),
  close: () => set({ overlay: null }),
  goTo: (scene) => set({ scene, overlay: null }),

  tearCalendarPage: () => {
    const { clock, paNotes } = get();
    if (isPollDay(clock)) return;
    const next = endDay(clock);
    const note = paNotesByDay[(next.day - 1) % paNotesByDay.length]!;
    set({ clock: next, paNotes: [...paNotes, note] });
  },

  submitStatement: (text) => {
    const { clock, statements } = get();
    const trimmed = text.trim();
    if (!trimmed || !canAct(clock)) return false;
    const slot = 3 - clock.slotsLeftToday;
    set({
      clock: spendSlot(clock),
      statements: [...statements, { id: nextId++, day: clock.day, slot, text: trimmed }],
    });
    return true;
  },
}));

export function headlineFor(day: number): string {
  return headlines[(day - 1) % headlines.length]!;
}
