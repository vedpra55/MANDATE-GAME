/**
 * The PA's tallies: a range per tola, never an exact number (ENGINE.md §10.2).
 * Noise is fixed per day (hash of seed, day, tola) so the range does not jump while you look.
 */
import { createRng, hashSeed } from './rng.ts';
import { TOLAS, type GameState, type TolaId } from './types.ts';
import { computeCells, playerShare, totals } from './vote.ts';

export type PollRange = { low: number; high: number }; // percent of votes cast, whole numbers

/** Range width in points: wide where Pintu knows little, narrower with workers. */
export function pollWidth(s: GameState, t?: TolaId): number {
  const level = t ? s.known.level[t] : avgLevel(s);
  return Math.max(4, 6 + 10 * (1 - level) - 4 * Math.min(1, s.cadre.size / 30));
}

function avgLevel(s: GameState): number {
  return TOLAS.reduce((a, t) => a + s.known.level[t], 0) / TOLAS.length;
}

/**
 * Pintu's tally per tola. Where he knows little he can be confidently wrong: a per-tola bias
 * (fixed for the game) that shrinks as you learn the tola, plus daily noise.
 */
export function pollRanges(s: GameState): Record<TolaId | 'village', PollRange> {
  const cells = computeCells(s);
  const out = {} as Record<TolaId | 'village', PollRange>;
  for (const key of [...TOLAS, 'village'] as const) {
    const share = playerShare(key === 'village' ? totals(cells) : totals(cells, key)) * 100;
    const level = key === 'village' ? avgLevel(s) : s.known.level[key];
    const bias = key === 'village' ? 0 : s.pollBias[key] * (1 - level);
    const width = pollWidth(s, key === 'village' ? undefined : key);
    const noise =
      createRng(hashSeed(s.seed, s.clock.day, key)).normal() * (width / 3) * (1 - 0.6 * level);
    const centre = share + bias + noise;
    out[key] = {
      low: Math.max(0, Math.round(centre - width / 2)),
      high: Math.min(100, Math.round(centre + width / 2)),
    };
  }
  return out;
}
