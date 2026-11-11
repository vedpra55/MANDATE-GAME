/**
 * The opponent you can see (PLAN-v1.1 §C). The rival makes promises of his own, and voters compare
 * you with him: "Sonu Bhaiya bhi yahi bole the." A generic me-too counts for little; going further
 * (a date, a cost, a how) or proof (works already built) counts in full, and the first to promise
 * an issue in a tola gets a small edge. Fault-line positions are not compared here.
 */
import { record } from './state.ts';
import type {
  GameState,
  IssueId,
  PaNote,
  Reading,
  RivalPromise,
  Statement,
  TolaId,
} from './types.ts';
import { archetypeOf } from './world.ts';

export const ME_TOO = 0.4;
export const OUTBID = 1.15;
export const FIRST = 1.1;
export const PROOF = 1.1;
/** Rival mood gained in a tola when he promises there (less when you promised it first). */
const RIVAL_PROMISE_MOOD = 2.5;

/** Rival promises that reach this audience: a visit hears the tola's and the village-wide ones. */
export function rivalPromisesOn(s: GameState, issue: IssueId, tola: TolaId | null): RivalPromise[] {
  return s.rival.promises.filter(
    (p) => p.issue === issue && (tola === null || p.tola === null || p.tola === tola),
  );
}

function playerPromisedBefore(s: GameState, issue: IssueId, tola: TolaId | null): boolean {
  return s.promises.some(
    (p) =>
      p.issue === issue &&
      p.status !== 'broken' &&
      (tola === null || p.tola === null || p.tola === tola),
  );
}

function hasProof(s: GameState, issue: IssueId, tola: TolaId | null): boolean {
  return s.projects.some(
    (p) => p.status === 'done' && p.issue === issue && (tola === null || p.tola === tola),
  );
}

/** Without the AI: how far beyond the rival, from the statement's own specificity. */
export function beyondRivalFallback(s: GameState, reading: Reading): number {
  return Math.max(0, Math.min(3, reading.specificity - (archetypeOf(s).promiseLevel - 1)));
}

export type Comparison = {
  mult: number;
  meToo: IssueId[];
  outbid: IssueId[];
  proof: IssueId[];
  first: IssueId[];
};

/**
 * Compare the issue promises in this statement with the rival's. Returns a multiplier on the
 * statement's positive effect, weighted by how much each issue mattered in the statement.
 */
export function compareWithRival(s: GameState, reading: Reading, tola: TolaId | null): Comparison {
  const out: Comparison = { mult: 1, meToo: [], outbid: [], proof: [], first: [] };
  if (reading.containsPromise < 0.5) return out;
  let num = 0;
  let den = 0;
  for (const [issue, score] of Object.entries(reading.issues) as [IssueId, number][]) {
    if (score < 1) continue;
    let m = 1;
    if (score >= 2) {
      if (hasProof(s, issue, tola)) {
        m = PROOF;
        out.proof.push(issue);
      } else if (rivalPromisesOn(s, issue, tola).length > 0) {
        const beyond = reading.beyondRival ?? beyondRivalFallback(s, reading);
        if (beyond >= 2) {
          m = OUTBID;
          out.outbid.push(issue);
        } else {
          m = ME_TOO;
          out.meToo.push(issue);
        }
      } else if (!playerPromisedBefore(s, issue, tola)) {
        m = FIRST;
        out.first.push(issue);
      }
    }
    num += score * m;
    den += score;
  }
  out.mult = den > 0 ? num / den : 1;
  return out;
}

/** After the statement: notes for Pintu, and out-bids the rival may answer. */
export function afterComparison(
  s: GameState,
  cmp: Comparison,
  tola: TolaId | null,
  statement: Statement,
): PaNote[] {
  const day = s.clock.day;
  const notes: PaNote[] = [];
  if (cmp.meToo.length + cmp.outbid.length + cmp.proof.length + cmp.first.length > 0)
    statement.compare = {
      meToo: cmp.meToo,
      outbid: cmp.outbid,
      proof: cmp.proof,
      first: cmp.first,
    };
  for (const issue of cmp.meToo) notes.push({ day, kind: 'meToo', issue });
  for (const issue of cmp.outbid) {
    notes.push({ day, kind: 'outbid', issue });
    s.rival.outbidBy.push({ tola, issue, day });
  }
  for (const issue of cmp.proof)
    if (rivalPromisesOn(s, issue, tola).length > 0)
      notes.push({ day, kind: 'proofBeatsPromise', issue });
  return notes;
}

/** The issue the rival promises when he visits a tola: its worst grievance he hasn't promised. */
export function rivalPromiseIssue(s: GameState, tola: TolaId): IssueId | null {
  const already = new Set(
    s.rival.promises.filter((p) => p.tola === tola || p.tola === null).map((p) => p.issue),
  );
  let best: IssueId | null = null;
  let worst = 0.25;
  for (const [issue, g] of Object.entries(s.tolas[tola].grievances) as [IssueId, number][]) {
    if (g > worst && !already.has(issue)) {
      best = issue;
      worst = g;
    }
  }
  return best;
}

/** Mood the rival gains in a tola by promising this issue there. */
export function rivalPromiseMood(s: GameState, issue: IssueId, tola: TolaId | null): number {
  return RIVAL_PROMISE_MOOD * (playerPromisedBefore(s, issue, tola) ? ME_TOO : 1);
}

/** The rival promises something. If you were there first, it is his me-too and counts less. */
export function rivalPromise(s: GameState, issue: IssueId, tola: TolaId | null): RivalPromise {
  const meToo = playerPromisedBefore(s, issue, tola);
  const p: RivalPromise = {
    id: s.nextId++,
    day: s.clock.day,
    tola,
    issue,
    level: archetypeOf(s).promiseLevel,
    raised: 0,
    meToo,
  };
  s.rival.promises.push(p);
  const mood = rivalPromiseMood(s, issue, tola);
  record(s, {
    actor: 'rival',
    kind: 'rivalPromise',
    tola: tola ?? undefined,
    issue,
    effect: tola
      ? { rivalMood: { [tola]: mood } }
      : {
          rivalMood: {
            purvi: mood / 2,
            paschim: mood / 2,
            bazaar: mood / 2,
            pokhar: mood / 2,
            naya: mood / 2,
          },
        },
  });
  return p;
}
