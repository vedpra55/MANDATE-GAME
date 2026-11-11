/**
 * Small helpers that mutate a *draft* GameState. The public engine API (engine.ts) always clones
 * the state first, so from the outside every engine call is pure.
 */
import {
  GROUPS,
  TOLAS,
  type Effect,
  type GameState,
  type GroupId,
  type LogEntry,
  type TolaId,
} from './types.ts';

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function slotIndex(s: GameState): number {
  return 3 - s.clock.slotsLeftToday;
}

/** Apply an effect with every clamp the rules require. */
export function applyEffect(s: GameState, e: Effect): void {
  for (const [g, d] of Object.entries(e.trust ?? {}) as [GroupId, number][]) {
    const grp = s.groups[g];
    grp.trust = clamp(grp.trust + d, -100, Math.min(100, grp.trustCap));
  }
  for (const [g, d] of Object.entries(e.rivalTrust ?? {}) as [GroupId, number][]) {
    s.groups[g].rivalTrust = clamp(s.groups[g].rivalTrust + d, -100, 100);
  }
  for (const [t, d] of Object.entries(e.mood ?? {}) as [TolaId, number][]) {
    s.tolas[t].mood = clamp(s.tolas[t].mood + d, -100, 100);
  }
  for (const [t, d] of Object.entries(e.rivalMood ?? {}) as [TolaId, number][]) {
    s.tolas[t].rivalMood = clamp(s.tolas[t].rivalMood + d, -100, 100);
  }
  if (e.heat) s.legalHeat = clamp(s.legalHeat + e.heat, 0, 100);
  if (e.reputation) s.reputation = clamp(s.reputation + e.reputation, -100, 100);
  if (e.rivalReputation)
    s.rival.reputation = clamp(s.rival.reputation + e.rivalReputation, -100, 100);
  if (e.credibility) s.credibility = clamp(s.credibility + e.credibility, 0.3, 1.2);
  if (e.cash) s.cash = Math.max(0, s.cash + e.cash);
  if (e.rivalCash) s.rival.cash = Math.max(0, s.rival.cash + e.rivalCash);
}

/** Apply an effect and record it in the log (the log feeds the end card's "what decided it"). */
export function record(s: GameState, entry: Omit<LogEntry, 'id' | 'day' | 'slot'>): LogEntry {
  applyEffect(s, entry.effect);
  const full: LogEntry = { id: s.nextId++, day: s.clock.day, slot: slotIndex(s), ...entry };
  s.log.push(full);
  return full;
}

export function totalVoters(s: GameState, g: GroupId): number {
  return TOLAS.reduce((sum, t) => sum + s.tolas[t].voters[g], 0);
}

export function tolaVoters(s: GameState, t: TolaId): number {
  return GROUPS.reduce((sum, g) => sum + s.tolas[t].voters[g], 0);
}

/** Effect touching every group by the same amount. */
export function allGroups(d: number): Partial<Record<GroupId, number>> {
  return Object.fromEntries(GROUPS.map((g) => [g, d]));
}
