/**
 * Counting day (ENGINE.md §12.2): booths are counted one tola at a time. Actual votes vary
 * around the vote model's expectation with a village-wide swing and local noise, so a lead
 * can flip during counting. An exact tie is decided by draw of lots.
 */
import type { Rng } from './rng.ts';
import type { CountingRound, CountingState, GameState, TolaId } from './types.ts';
import { computeCells, totals } from './vote.ts';
import region from '../data/regions/bihar-village.json';

const ORDER = region.countingOrder as TolaId[];

export function buildCounting(s: GameState, rng: Rng): CountingState {
  const cells = computeCells(s);
  const swing = rng.normal() * 0.015;
  const rounds: CountingRound[] = ORDER.map((tola) => {
    const t = totals(cells, tola);
    const cast = t.player + t.rival + t.other;
    const local = rng.normal() * 0.02;
    const turnoutNoise = 1 + rng.normal() * 0.03;
    let sp = Math.max(0.01, t.player / cast + swing + local);
    let sr = Math.max(0.01, t.rival / cast - swing - local);
    let so = t.other / cast;
    const norm = sp + sr + so;
    sp /= norm;
    sr /= norm;
    so /= norm;
    const n = cast * turnoutNoise;
    return {
      tola,
      player: Math.round(n * sp),
      rival: Math.round(n * sr),
      others: Math.round(n * so),
    };
  });
  const player = rounds.reduce((a, r) => a + r.player, 0);
  const rival = rounds.reduce((a, r) => a + r.rival, 0);
  const tie = player === rival;
  const winner = tie ? (rng.chance(0.5) ? 'player' : 'rival') : player > rival ? 'player' : 'rival';
  return { rounds, revealed: 0, tieBrokenByLots: tie, winner };
}
