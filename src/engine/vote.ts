/**
 * The vote model (docs/ENGINE.md §12.1). Per cell (tola × group): appeal of each option,
 * softmax into shares, turnout, expected votes. Used by polls, the rival AI, counting and attribution.
 */
import { GROUPS, TOLAS, type GameState, type GroupId, type TolaId } from './types.ts';
import { clamp } from './state.ts';

export const TAU = 25;
const A_OTHER = -20;

export type Cell = {
  tola: TolaId;
  group: GroupId;
  voters: number;
  turnout: number;
  pPlayer: number;
  pRival: number;
  pOther: number;
  votesPlayer: number;
  votesRival: number;
  votesOther: number;
};

export function computeCells(s: GameState): Cell[] {
  const cells: Cell[] = [];
  for (const t of TOLAS) {
    const tola = s.tolas[t];
    for (const g of GROUPS) {
      const grp = s.groups[g];
      const aP = grp.trust + 0.5 * tola.mood + 0.2 * s.reputation + 5 * tola.cadreCoverage;
      const aR =
        grp.rivalTrust + 0.5 * tola.rivalMood + 0.2 * s.rival.reputation + 5 * tola.rivalCoverage;
      const m = Math.max(aP, aR, A_OTHER);
      const eP = Math.exp((aP - m) / TAU);
      const eR = Math.exp((aR - m) / TAU);
      const eO = Math.exp((A_OTHER - m) / TAU);
      const sum = eP + eR + eO;
      const turnout = clamp(
        grp.baseTurnout + 0.002 * Math.max(aP, aR) - grp.turnoutPenalty,
        0.3,
        0.9,
      );
      const voters = tola.voters[g];
      const pPlayer = eP / sum;
      const pRival = eR / sum;
      const pOther = eO / sum;
      // Workers bring their own supporters out; the old family's machine does the same.
      const mobP = 0.1 * tola.cadreCoverage * (s.cadre.loyalty / 100);
      const mobR = 0.08 * tola.rivalCoverage;
      cells.push({
        tola: t,
        group: g,
        voters,
        turnout,
        pPlayer,
        pRival,
        pOther,
        votesPlayer: voters * Math.min(0.95, turnout + mobP) * pPlayer,
        votesRival: voters * Math.min(0.95, turnout + mobR) * pRival,
        votesOther: voters * turnout * pOther,
      });
    }
  }
  return cells;
}

export type Totals = { player: number; rival: number; other: number };

export function totals(cells: Cell[], tola?: TolaId): Totals {
  const t = { player: 0, rival: 0, other: 0 };
  for (const c of cells) {
    if (tola && c.tola !== tola) continue;
    t.player += c.votesPlayer;
    t.rival += c.votesRival;
    t.other += c.votesOther;
  }
  return t;
}

/** Player share of votes cast, 0..1. */
export function playerShare(t: Totals): number {
  const all = t.player + t.rival + t.other;
  return all > 0 ? t.player / all : 0;
}

/** (player − rival) / votes cast: positive means the player leads. */
export function margin(t: Totals): number {
  const all = t.player + t.rival + t.other;
  return all > 0 ? (t.player - t.rival) / all : 0;
}
