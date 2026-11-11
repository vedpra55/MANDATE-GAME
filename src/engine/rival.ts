/**
 * The rival (the dynast): a utility AI (ENGINE.md §9). Every night it lists the moves it could
 * make, scores each by how much it improves its expected margin in the engine's own vote model,
 * and picks one with a softmax. In E5 a Decide "personality" probability multiplies these weights.
 */
import { record } from './state.ts';
import {
  GROUPS,
  TOLAS,
  type Effect,
  type GameState,
  type GroupId,
  type IssueId,
  type PaNote,
  type RivalMove,
  type TolaId,
} from './types.ts';
import type { Rng } from './rng.ts';
import { computeCells, margin, totals } from './vote.ts';
import { allGroups, applyEffect } from './state.ts';
import { openBigPromises } from './statements.ts';

type Candidate = {
  move: RivalMove;
  tola?: TolaId;
  issue?: IssueId;
  promiseId?: number;
  effect: Effect;
};

function topPlayerIssue(s: GameState): IssueId | null {
  let best: IssueId | null = null;
  let n = 1; // needs at least 2 statements on an issue before the rival copies it
  for (const [issue, count] of Object.entries(s.rival.memory.issueFocus) as [IssueId, number][]) {
    if (count > n) {
      best = issue;
      n = count;
    }
  }
  return best;
}

function candidates(s: GameState): Candidate[] {
  const list: Candidate[] = [{ move: 'lieLow', effect: {} }];
  for (const t of TOLAS) {
    list.push({ move: 'doorToDoor', tola: t, effect: { rivalMood: { [t]: 4 } } });
    if (s.rival.cash >= 5000) {
      list.push({ move: 'sweets', tola: t, effect: { rivalMood: { [t]: 6 }, rivalCash: -5000 } });
    }
  }
  const issue = topPlayerIssue(s);
  if (issue) {
    const rivalTrust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS) rivalTrust[g] = 6 * (s.groups[g].issueWeights[issue] ?? 0);
    list.push({ move: 'counterIssue', issue, effect: { rivalTrust } });
  }
  for (const p of s.promises) {
    if (p.status !== 'broken' || s.rival.attackedPromiseIds.includes(p.id)) continue;
    const trust: Partial<Record<GroupId, number>> = {};
    for (const g of p.beneficiaries) trust[g] = -4;
    list.push({
      move: 'attackPromise',
      issue: p.issue,
      promiseId: p.id,
      effect: { trust, reputation: -2 },
    });
  }
  const big = openBigPromises(s);
  if (big >= 6 && s.clock.day - s.rival.lastMockDay >= 3) {
    // "Itna paisa kahan se aayega?" The rival mocks a candidate who promises everything.
    list.push({
      move: 'mockPromises',
      effect: { trust: allGroups(-Math.min(6, (big - 5) * 0.8)), reputation: -3 },
    });
  }
  if (!s.rival.rallyDone && s.clock.day >= 10 && s.rival.cash >= 8000) {
    const rivalTrust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS)
      rivalTrust[g] = g.startsWith('elders') || g.startsWith('farmers') ? 4 : 2;
    list.push({ move: 'rally', effect: { rivalTrust, rivalCash: -8000 } });
  }
  return list;
}

/** Expected rival margin (rival − player share of votes), in percentage points. */
function rivalMargin(s: GameState): number {
  return -margin(totals(computeCells(s))) * 100;
}

function utility(s: GameState, c: Candidate): number {
  const before = rivalMargin(s);
  // Only what the vote model reads is copied: much cheaper than cloning the whole game.
  const trial: GameState = {
    ...s,
    groups: structuredClone(s.groups),
    tolas: structuredClone(s.tolas),
    rival: { ...s.rival },
  };
  applyEffect(trial, c.effect);
  const cost = c.move === 'sweets' ? 0.15 : c.move === 'rally' ? 0.2 : 0; // money is not free
  return rivalMargin(trial) - before - cost;
}

const KIND = {
  doorToDoor: 'rivalDoorToDoor',
  sweets: 'rivalSweets',
  counterIssue: 'rivalCounterIssue',
  attackPromise: 'rivalAttack',
  rally: 'rivalRally',
  mockPromises: 'rivalMock',
  lastNight: 'rivalLastNight',
} as const;

export function rivalTurn(s: GameState, rng: Rng): PaNote[] {
  const notes: PaNote[] = [];
  const day = s.clock.day;
  if (s.clock.daysToPoll === 1 && s.flags.lastNightTola) {
    const t = s.flags.lastNightTola;
    const spend = Math.min(10000, s.rival.cash);
    record(s, {
      actor: 'rival',
      kind: 'rivalLastNight',
      tola: t,
      amount: spend,
      effect: { rivalMood: { [t]: 6 + spend / 1000 }, rivalCash: -spend },
    });
    s.rival.heat += 5;
    return notes;
  }
  const moves = day >= 12 ? 2 : 1;
  for (let i = 0; i < moves; i++) {
    const list = candidates(s);
    const weights = list.map((c) => Math.exp(utility(s, c) / 0.5));
    const pick = list[rng.weightedIndex(weights)]!;
    if (pick.move === 'lieLow') continue;
    if (pick.move === 'rally') s.rival.rallyDone = true;
    if (pick.move === 'attackPromise' && pick.promiseId !== undefined)
      s.rival.attackedPromiseIds.push(pick.promiseId);
    if (pick.move === 'sweets') s.rival.heat += 2;
    if (pick.move === 'mockPromises') s.rival.lastMockDay = day;
    record(s, {
      actor: 'rival',
      kind: KIND[pick.move],
      tola: pick.tola,
      issue: pick.issue,
      effect: pick.effect,
    });
    notes.push({ day, kind: 'rivalMove', move: pick.move, tola: pick.tola, issue: pick.issue });
  }
  return notes;
}

/** The tola where the rival's expected lead is smallest: where he will spend on the last night. */
export function rivalWeakestTola(s: GameState): TolaId {
  const cells = computeCells(s);
  let worst: TolaId = TOLAS[0];
  let worstMargin = Infinity;
  for (const t of TOLAS) {
    const m = -margin(totals(cells, t));
    if (m < worstMargin) {
      worstMargin = m;
      worst = t;
    }
  }
  return worst;
}
