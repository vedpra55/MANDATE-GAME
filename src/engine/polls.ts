/**
 * The PA's tallies: a range per tola, never an exact number (ENGINE.md §10.2).
 * Noise is fixed per day (hash of seed, day, tola) so the range does not jump while you look.
 */
import { createRng, hashSeed } from './rng.ts';
import { TOLAS, type GameState, type TolaId } from './types.ts';
import { computeCells, playerShare, totals } from './vote.ts';

export type PollRange = { low: number; high: number }; // percent of votes cast, whole numbers

export function pollWidth(s: GameState): number {
  return 12 - 8 * Math.min(1, s.cadre.size / 30); // percentage points
}

export function pollRanges(s: GameState): Record<TolaId | 'village', PollRange> {
  const cells = computeCells(s);
  const width = pollWidth(s);
  const out = {} as Record<TolaId | 'village', PollRange>;
  for (const key of [...TOLAS, 'village'] as const) {
    const share = playerShare(key === 'village' ? totals(cells) : totals(cells, key)) * 100;
    const noise = createRng(hashSeed(s.seed, s.clock.day, key)).normal() * (width / 2.5);
    const centre = share + noise;
    out[key] = {
      low: Math.max(0, Math.round(centre - width / 2)),
      high: Math.min(100, Math.round(centre + width / 2)),
    };
  }
  return out;
}
