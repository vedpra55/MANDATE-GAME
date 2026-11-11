/**
 * Non-speech player actions: public works, gifts (vote-buying) and recruiting workers.
 */
import { beneficiariesOf, promisesFulfilledBy, worksCost } from './promises.ts';
import { clamp, record, totalVoters } from './state.ts';
import {
  GROUPS,
  type GameState,
  type GroupId,
  type IssueId,
  type PaNote,
  type TolaId,
} from './types.ts';
import type { Rng } from './rng.ts';
import { bandOfTola } from './pa.ts';

export function publicWorks(s: GameState, tola: TolaId, issue: IssueId): PaNote[] {
  const day = s.clock.day;
  const cost = worksCost(issue)!;
  const grievance = s.tolas[tola].grievances[issue] ?? 0;
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS) trust[g] = 8 * (s.groups[g].issueWeights[issue] ?? 0) * grievance;
  s.tolas[tola].grievances[issue] = Math.max(0, grievance - 0.7);
  record(s, {
    actor: 'player',
    kind: 'publicWorks',
    tola,
    issue,
    amount: cost,
    effect: { cash: -cost, mood: { [tola]: 4 + 12 * grievance }, trust, reputation: 1 },
  });

  const notes: PaNote[] = [{ day, kind: 'tolaShift', tola, band: bandOfTola(s, tola), up: true }];
  for (const p of promisesFulfilledBy(s, issue, tola)) {
    p.status = 'kept';
    const t: Partial<Record<GroupId, number>> = {};
    for (const g of p.beneficiaries) t[g] = 4;
    record(s, {
      actor: 'player',
      kind: 'promiseKept',
      tola,
      issue,
      promiseId: p.id,
      effect: { credibility: 0.05, trust: t, mood: { [tola]: 3 } },
    });
    notes.push({ day, kind: 'promiseKept', issue, tola });
  }
  return notes;
}

export function giftsFilmingChance(s: GameState): number {
  const lastDay = s.clock.daysToPoll === 1;
  return clamp((0.12 + s.legalHeat / 250) * (lastDay ? 2 : 1), 0, 0.9);
}

export function gifts(s: GameState, tola: TolaId, amount: number): PaNote[] {
  s.flags.giftsTotal += amount;
  record(s, {
    actor: 'player',
    kind: 'gifts',
    tola,
    amount,
    effect: {
      cash: -amount,
      mood: { [tola]: Math.min(20, 9 * Math.log2(1 + amount / 2000)) },
      heat: 4 + amount / 1000,
    },
  });
  s.flags.pendingFilming.push({ tola, chance: giftsFilmingChance(s) });
  return [{ day: s.clock.day, kind: 'tolaShift', tola, band: bandOfTola(s, tola), up: true }];
}

export function recruit(s: GameState, rng: Rng, tola: TolaId, strongman: boolean): PaNote[] {
  const added = strongman ? 8 : rng.int(3, 6);
  const newSize = s.cadre.size + added;
  s.cadre.loyalty = Math.round(
    (s.cadre.loyalty * s.cadre.size + (strongman ? 75 : 60) * added) / newSize,
  );
  s.cadre.size = newSize;
  s.tolas[tola].cadreCoverage = clamp(s.tolas[tola].cadreCoverage + (strongman ? 0.3 : 0.15), 0, 1);
  if (strongman) s.cadre.strongmen += 1;
  record(s, {
    actor: 'player',
    kind: 'recruit',
    tola,
    amount: added,
    effect: strongman ? { heat: 3, reputation: -2, mood: { [tola]: -2 } } : {},
  });
  return [];
}

/** Effect of a broken promise (end of day, ENGINE.md §7.5). */
export function breakPromise(s: GameState, promiseId: number): PaNote {
  const p = s.promises.find((pr) => pr.id === promiseId)!;
  p.status = 'broken';
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of p.beneficiaries) trust[g] = -6;
  record(s, {
    actor: 'player',
    kind: 'promiseBroken',
    tola: p.tola ?? undefined,
    issue: p.issue,
    promiseId: p.id,
    effect: {
      credibility: -0.08,
      trust,
      reputation: -3,
      ...(p.tola ? { mood: { [p.tola]: -6 } } : {}),
    },
  });
  return { day: s.clock.day, kind: 'promiseBroken', issue: p.issue, tola: p.tola };
}

/** Share of a group's voters living in a tola. */
export function shareIn(s: GameState, g: GroupId, t: TolaId): number {
  return s.tolas[t].voters[g] / Math.max(1, totalVoters(s, g));
}

export { beneficiariesOf };
