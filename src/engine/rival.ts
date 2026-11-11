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
  type FaultLineId,
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
import { archetypeOf, sideWeight } from './world.ts';
import {
  rivalPromise,
  rivalPromiseIssue,
  rivalPromiseMood,
  rivalPromisesOn,
} from './rivalPromises.ts';

type Candidate = {
  move: RivalMove;
  tola?: TolaId;
  issue?: IssueId;
  promiseId?: number;
  faultLine?: FaultLineId;
  effect: Effect;
  /** A visit where he will also promise this (its mood is included in effect for the utility). */
  promise?: { issue: IssueId; mood: number; base: number };
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
    const issue = rivalPromiseIssue(s, t);
    const pm = issue ? rivalPromiseMood(s, issue, t) : 0;
    const promise = (base: number) => (issue ? { issue, mood: pm, base } : undefined);
    list.push({
      move: 'doorToDoor',
      tola: t,
      effect: { rivalMood: { [t]: 3.5 + pm } },
      promise: promise(3.5),
    });
    if (s.rival.cash >= 5000) {
      list.push({
        move: 'sweets',
        tola: t,
        effect: { rivalMood: { [t]: 6.5 + pm }, rivalCash: -5000 },
        promise: promise(6.5),
      });
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
  if (big >= archetypeOf(s).mockThreshold && s.clock.day - s.rival.lastMockDay >= 4) {
    // "Itna paisa kahan se aayega?" The rival mocks a candidate who promises everything.
    list.push({
      move: 'mockPromises',
      effect: {
        trust: allGroups(-Math.min(2, 0.5 * (big - archetypeOf(s).mockThreshold + 1))),
        reputation: -1,
      },
    });
  }
  // A dodge, a silence or a disbelieved compromise: "he still won't say".
  for (const [fl, w] of Object.entries(s.publicWord) as [
    FaultLineId,
    NonNullable<GameState['publicWord'][FaultLineId]>,
  ][]) {
    if (
      !['evasive', 'silent', 'win_win_doubted'].includes(w.word) ||
      s.rival.attackedDodges.includes(fl)
    )
      continue;
    const trust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS)
      trust[g] = -1.5 * (sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g));
    list.push({ move: 'attackDodge', faultLine: fl, effect: { trust, reputation: -1 } });
  }
  // A win-win announced but not yet delivered: "Kab hoga? Sab hawa hai."
  for (const p of s.promises) {
    if (!p.faultLine || p.status !== 'open' || s.clock.day - p.day < 3) continue;
    if (s.projects.some((pr) => pr.faultLine === p.faultLine)) continue;
    if (s.rival.attackedPromiseIds.includes(p.id)) continue;
    const trust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS)
      trust[g] =
        -2.5 * (sideWeight(p.faultLine, 'side_a', g) + sideWeight(p.faultLine, 'side_b', g));
    list.push({
      move: 'doubtSolution',
      issue: p.issue,
      promiseId: p.id,
      effect: { trust, credibility: -0.03 },
    });
  }
  // You out-bid him: he raises his own offer (bigger, and for the firebrand vaguer too).
  for (const o of s.rival.outbidBy) {
    if (s.clock.day - o.day > 3) continue;
    if (rivalPromisesOn(s, o.issue, o.tola).length === 0) continue;
    const mood = o.tola ? { [o.tola]: 4 } : Object.fromEntries(TOLAS.map((t) => [t, 2]));
    list.push({
      move: 'raiseOffer',
      tola: o.tola ?? undefined,
      issue: o.issue,
      effect: { rivalMood: mood },
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
  doubtSolution: 'rivalDoubt',
  attackDodge: 'rivalAttackDodge',
  raiseOffer: 'rivalRaise',
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
  const moves = day >= 10 ? 2 : 1;
  for (let i = 0; i < moves; i++) {
    const list = candidates(s);
    const bias = archetypeOf(s).moveBias;
    const weights = list.map((c) => Math.exp(utility(s, c) / 0.5) * (bias[c.move] ?? 1));
    const pick = list[rng.weightedIndex(weights)]!;
    if (pick.move === 'lieLow') continue;
    if (pick.move === 'rally') s.rival.rallyDone = true;
    if (pick.move === 'attackPromise' && pick.promiseId !== undefined)
      s.rival.attackedPromiseIds.push(pick.promiseId);
    if (pick.move === 'sweets') s.rival.heat += 2;
    if (pick.tola && (pick.move === 'doorToDoor' || pick.move === 'sweets'))
      s.tolas[pick.tola].rivalLastVisit = day;
    if (pick.move === 'mockPromises') s.rival.lastMockDay = day;
    if (pick.move === 'attackDodge' && pick.faultLine) s.rival.attackedDodges.push(pick.faultLine);
    if (pick.move === 'raiseOffer' && pick.issue) raiseOffer(s, pick.issue, pick.tola ?? null);
    // He campaigns like a person: where he goes, he promises something (its mood is logged apart).
    const effect =
      pick.promise && pick.tola
        ? { ...pick.effect, rivalMood: { [pick.tola]: pick.promise.base } }
        : pick.effect;
    record(s, {
      actor: 'rival',
      kind: KIND[pick.move],
      tola: pick.tola,
      issue: pick.issue,
      faultLine: pick.faultLine,
      effect,
    });
    let promised: IssueId | undefined;
    if (pick.promise && pick.tola) {
      rivalPromise(s, pick.promise.issue, pick.tola);
      promised = pick.promise.issue;
    }
    if (pick.move === 'counterIssue' && pick.issue) {
      if (!s.rival.promises.some((p) => p.issue === pick.issue && p.tola === null)) {
        rivalPromise(s, pick.issue, null);
        promised = pick.issue;
      }
    }
    notes.push({
      day,
      kind: 'rivalMove',
      move: pick.move,
      tola: pick.tola,
      issue: pick.issue,
      faultLine: pick.faultLine,
      promised,
    });
  }
  s.rival.outbidBy = s.rival.outbidBy.filter((o) => s.clock.day - o.day <= 3);
  return notes;
}

function raiseOffer(s: GameState, issue: IssueId, tola: TolaId | null): void {
  for (const p of rivalPromisesOn(s, issue, tola)) {
    p.raised += 1;
    if (archetypeOf(s).promiseLevel < 3) p.level = Math.min(3, p.level + 1) as 1 | 2 | 3;
    p.day = s.clock.day;
  }
  s.rival.outbidBy = s.rival.outbidBy.filter((o) => !(o.issue === issue && o.tola === tola));
  // Out-bidding the out-bidder: his own promise inflation.
  const raises = s.rival.promises.reduce((a, p) => a + p.raised, 0);
  if (raises >= 3) s.rival.reputation -= 1;
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
