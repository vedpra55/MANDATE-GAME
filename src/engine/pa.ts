/**
 * What the PA notices, as structured notes (the UI turns them into words).
 * Numbers become bands: the player never sees trust values (ENGINE.md §10.1).
 */
import { GROUPS, type Band, type GameState, type TolaId } from './types.ts';

export function bandOfTrust(v: number): Band {
  if (v <= -50) return 'veryAngry';
  if (v <= -15) return 'unhappy';
  if (v < 15) return 'waiting';
  if (v <= 50) return 'with';
  return 'solid';
}

/** How a tola feels about the player: group trust weighted by who lives there, plus local mood. */
export function tolaAppeal(s: GameState, t: TolaId): number {
  const tola = s.tolas[t];
  let sum = 0;
  let n = 0;
  for (const g of GROUPS) {
    sum += s.groups[g].trust * tola.voters[g];
    n += tola.voters[g];
  }
  return (n ? sum / n : 0) + 0.5 * tola.mood;
}

export function bandOfTola(s: GameState, t: TolaId): Band {
  return bandOfTrust(tolaAppeal(s, t));
}
