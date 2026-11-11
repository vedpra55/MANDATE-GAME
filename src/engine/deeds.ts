/**
 * Non-speech player actions: public works, gifts (vote-buying) and recruiting workers.
 */
import { beneficiariesOf, promisesFulfilledBy, worksCost } from './promises.ts';
import { clamp, record, totalVoters } from './state.ts';
import {
  GROUPS,
  type FaultLineId,
  type GameState,
  type GroupId,
  type IssueId,
  type PaNote,
  type TolaId,
} from './types.ts';
import { FAULT_LINE_DATA, sideWeight } from './world.ts';
import { homeTola } from './faultlines.ts';
import { learnTola } from './knowledge.ts';
import type { Rng } from './rng.ts';
import { bandOfTola } from './pa.ts';

/**
 * Public works are projects: paid up front, finished in 2–3 days, and one in four runs late
 * (docs/CHALLENGE.md §3.5). The real effect arrives on completion (see completeProjects).
 */
export function publicWorks(s: GameState, rng: Rng, tola: TolaId, issue: IssueId): PaNote[] {
  const cost = worksCost(issue)!;
  return [startProject(s, rng, { tola, issue, faultLine: null, cost, days: rng.int(2, 3) })];
}

/** Carry out a win-win you promised: a bigger project in the fault line's home tola. */
export function deliverSolution(s: GameState, rng: Rng, fl: FaultLineId): PaNote[] {
  const p = s.promises.find((pr) => pr.faultLine === fl && pr.status === 'open')!;
  return [
    startProject(s, rng, {
      tola: homeTola(fl),
      issue: null,
      faultLine: fl,
      cost: p.cost,
      days: rng.int(3, 4),
    }),
  ];
}

function startProject(
  s: GameState,
  rng: Rng,
  p: {
    tola: TolaId;
    issue: IssueId | null;
    faultLine: FaultLineId | null;
    cost: number;
    days: number;
  },
): PaNote {
  const day = s.clock.day;
  const dueDay = day + p.days;
  const doneDay = dueDay + (rng.chance(0.25) ? 2 : 0);
  s.projects.push({
    id: s.nextId++,
    tola: p.tola,
    issue: p.issue,
    faultLine: p.faultLine,
    cost: p.cost,
    startDay: day,
    dueDay,
    doneDay,
    status: 'building',
  });
  record(s, {
    actor: 'player',
    kind: 'worksStarted',
    tola: p.tola,
    issue: p.issue ?? undefined,
    faultLine: p.faultLine ?? undefined,
    amount: p.cost,
    effect: { cash: -p.cost, mood: { [p.tola]: 2 } },
  });
  return { day, kind: 'worksStarted', tola: p.tola, dueDay };
}

/** End of day: finish projects that are done, flag the ones running late. */
export function completeProjects(s: GameState): PaNote[] {
  const day = s.clock.day;
  const notes: PaNote[] = [];
  for (const pr of s.projects) {
    if (pr.status !== 'building') continue;
    if (day < pr.doneDay) {
      if (day === pr.dueDay) notes.push({ day, kind: 'worksLate', tola: pr.tola });
      continue;
    }
    pr.status = 'done';
    if (pr.issue) notes.push(...finishWorks(s, pr.tola, pr.issue));
    if (pr.faultLine) notes.push(...finishSolution(s, pr.faultLine, pr.tola));
    notes.push({ day, kind: 'worksDone', tola: pr.tola, issue: pr.issue, faultLine: pr.faultLine });
  }
  return notes;
}

function finishWorks(s: GameState, tola: TolaId, issue: IssueId): PaNote[] {
  const day = s.clock.day;
  const grievance = s.tolas[tola].grievances[issue] ?? 0;
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS) trust[g] = 8 * (s.groups[g].issueWeights[issue] ?? 0) * grievance;
  s.tolas[tola].grievances[issue] = Math.max(0, grievance - 0.7);
  record(s, {
    actor: 'player',
    kind: 'publicWorks',
    tola,
    issue,
    effect: { mood: { [tola]: 4 + 12 * grievance }, trust, reputation: 1 },
  });
  const notes: PaNote[] = [];
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

function finishSolution(s: GameState, fl: FaultLineId, tola: TolaId): PaNote[] {
  const day = s.clock.day;
  const d = FAULT_LINE_DATA[fl];
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS)
    trust[g] = 1.5 * (sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g));
  const mood: Partial<Record<TolaId, number>> = {};
  for (const t of Object.keys(d.hot) as TolaId[]) {
    mood[t] = 3;
    s.tolas[t].grievances[d.issue] = Math.max(0, (s.tolas[t].grievances[d.issue] ?? 0) - 0.5);
  }
  const p = s.promises.find((pr) => pr.faultLine === fl && pr.status === 'open');
  if (p) p.status = 'kept';
  record(s, {
    actor: 'player',
    kind: 'solutionDelivered',
    tola,
    faultLine: fl,
    promiseId: p?.id,
    effect: { trust, mood, credibility: 0.05, reputation: 2 },
  });
  return [{ day, kind: 'promiseKept', issue: d.issue, tola }];
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
  const learned = learnTola(s, tola, 'workers');
  return learned ? [learned] : [];
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
