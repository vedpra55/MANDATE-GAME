/**
 * End of day (ENGINE.md §5): filming rolls, tension, promise deadlines, cadre upkeep, the rival's
 * turn, drift, word of mouth, legal heat, tomorrow's newspaper, then the new day.
 */
import { breakPromise, completeProjects } from './deeds.ts';
import {
  donorCalls,
  donorDemands,
  expireCall,
  neglect,
  punishSilence,
  rivalWedge,
  rollLeaks,
} from './interrupts.ts';
import { promisesDue } from './promises.ts';
import { rivalTurn, rivalWeakestTola } from './rival.ts';
import { allGroups, record } from './state.ts';
import { endDay } from './clock.ts';
import {
  GROUPS,
  TOLAS,
  type GameState,
  type LogEntry,
  type PaNote,
  type Story,
  type StoryKind,
} from './types.ts';
import type { Rng } from './rng.ts';

import { DRIFT_PER_DAY } from './constants.ts';
const DRIFT = DRIFT_PER_DAY;
const SPREAD = 0.1;

const NEWS: Partial<Record<LogEntry['kind'], { kind: StoryKind; weight: number }>> = {
  giftsFilmed: { kind: 'giftsFilmed', weight: 10 },
  divisive: { kind: 'divisive', weight: 9 },
  fir: { kind: 'fir', weight: 9 },
  notice: { kind: 'notice', weight: 8 },
  promiseBroken: { kind: 'promiseBroken', weight: 7 },
  rivalLastNight: { kind: 'rivalLastNight', weight: 6 },
  rivalRally: { kind: 'rivalRally', weight: 6 },
  rivalAttack: { kind: 'rivalAttack', weight: 6 },
  rivalMock: { kind: 'rivalAttack', weight: 6 },
  contradiction: { kind: 'contradiction', weight: 9 },
  favourLeaked: { kind: 'favourLeaked', weight: 9 },
  donorAngry: { kind: 'favourLeaked', weight: 9 },
  rivalWedge: { kind: 'wedge', weight: 7 },
  silence: { kind: 'silent', weight: 7 },
  solutionDelivered: { kind: 'solution', weight: 7 },
  stance: { kind: 'stance', weight: 5 },
  evasion: { kind: 'dodge', weight: 4 },
  publicWorks: { kind: 'publicWorks', weight: 5 },
  promiseKept: { kind: 'promiseKept', weight: 5 },
  rivalSweets: { kind: 'rivalSweets', weight: 4 },
  visit: { kind: 'visit', weight: 3 },
  statement: { kind: 'statement', weight: 3 },
};

function size(e: LogEntry): number {
  const sum = (o: Partial<Record<string, number>> | undefined): number => {
    let total = 0;
    for (const v of Object.values(o ?? {})) total += Math.abs(v ?? 0);
    return total;
  };
  const { trust, mood, rivalTrust, rivalMood } = e.effect;
  return sum(trust) + sum(mood) + sum(rivalTrust) + sum(rivalMood);
}

function pickStory(s: GameState, day: number): Story {
  let best: { e: LogEntry; score: number } | null = null;
  for (const e of s.log) {
    if (e.day !== day) continue;
    const news = NEWS[e.kind];
    if (!news) continue;
    const score = news.weight * 10 + size(e);
    if (!best || score > best.score) best = { e, score };
  }
  if (!best) return { day: day + 1, kind: 'quiet' };
  return {
    day: day + 1,
    kind: NEWS[best.e.kind]!.kind,
    tola: best.e.tola,
    issue: best.e.issue,
    faultLine: best.e.faultLine,
    stance: best.e.stance,
  };
}

export function endOfDay(s: GameState, rng: Rng): void {
  const day = s.clock.day;
  const notes: PaNote[] = [];

  // 0. Projects that finish today (a project in progress also holds its promise's deadline).
  notes.push(...completeProjects(s));

  // 1. Was anyone filmed handing out money today?
  for (const f of s.flags.pendingFilming) {
    if (!rng.chance(f.chance)) continue;
    s.flags.giftsFilmed += 1;
    record(s, {
      actor: 'world',
      kind: 'giftsFilmed',
      tola: f.tola,
      effect: {
        reputation: -8,
        heat: 10,
        credibility: -0.05,
        trust: allGroups(-2),
        mood: { [f.tola]: -10 },
      },
    });
    notes.push({ day, kind: 'giftsFilmed', tola: f.tola });
  }
  s.flags.pendingFilming = [];

  // 2. Communal tension after divisive politics.
  if (s.flags.pendingTension === day) {
    record(s, {
      actor: 'world',
      kind: 'communalTension',
      effect: { trust: allGroups(-3), reputation: -5, heat: 5 },
    });
    s.flags.pendingTension = null;
  }

  // 3. Promise deadlines. Work visibly under way counts: people wait for it.
  for (const p of promisesDue(s)) {
    const underway = s.projects.some(
      (pr) =>
        pr.status === 'building' &&
        (p.faultLine
          ? pr.faultLine === p.faultLine
          : pr.issue === p.issue && (p.tola === null || pr.tola === p.tola)),
    );
    if (!underway) notes.push(breakPromise(s, p.id));
  }

  // 3b. Questions left unanswered, calls not returned, secrets that leak.
  notes.push(...punishSilence(s), ...expireCall(s), ...rollLeaks(s, rng));

  // 4. Tea and fuel for the workers.
  const upkeep = Math.ceil(s.cadre.size / 10) * 300;
  if (upkeep > 0) {
    if (s.cash >= upkeep) s.cash -= upkeep;
    else {
      s.cadre.loyalty = Math.max(0, s.cadre.loyalty - 10);
      record(s, { actor: 'world', kind: 'cadreUnpaid', effect: {} });
      notes.push({ day, kind: 'cadreUnpaid' });
    }
  }

  // 5. The rival's turn, his wedge question for tomorrow, and tolas you have neglected.
  notes.push(...rivalTurn(s, rng));
  const wedge = rivalWedge(s);
  if (wedge) notes.push(wedge);
  notes.push(...neglect(s));

  // 6. Drift: memories fade, the old family's base reasserts itself.
  for (const g of GROUPS) {
    const grp = s.groups[g];
    grp.trust -= grp.trust * DRIFT;
    grp.rivalTrust += (grp.baseRivalTrust - grp.rivalTrust) * DRIFT;
  }
  // 7. Word of mouth between neighbouring tolas.
  const moods = Object.fromEntries(TOLAS.map((t) => [t, s.tolas[t].mood]));
  const rivalMoods = Object.fromEntries(TOLAS.map((t) => [t, s.tolas[t].rivalMood]));
  for (const t of TOLAS) {
    const tola = s.tolas[t];
    const nAvg = tola.neighbours.reduce((a, n) => a + moods[n]!, 0) / tola.neighbours.length;
    const rAvg = tola.neighbours.reduce((a, n) => a + rivalMoods[n]!, 0) / tola.neighbours.length;
    tola.mood = (moods[t]! + SPREAD * (nAvg - moods[t]!)) * (1 - DRIFT);
    tola.rivalMood = (rivalMoods[t]! + SPREAD * (rAvg - rivalMoods[t]!)) * (1 - DRIFT);
  }

  // 8. Legal heat.
  s.legalHeat = Math.max(0, s.legalHeat - 1);
  if (s.legalHeat >= 30 && !s.flags.noticeIssued) {
    s.flags.noticeIssued = true;
    record(s, { actor: 'world', kind: 'notice', effect: { reputation: -3 } });
    notes.push({ day, kind: 'notice' });
  }
  if (s.legalHeat >= 60 && !s.flags.firFiled) {
    s.flags.firFiled = true;
    s.flags.firSlotPenalty = true;
    record(s, { actor: 'world', kind: 'fir', effect: { reputation: -6 } });
    notes.push({ day, kind: 'fir' });
  }
  if (day >= 20 && s.legalHeat >= 85) {
    s.flags.disqualified = true;
  }

  // 9. Tomorrow's newspaper.
  s.stories.push(pickStory(s, day));

  // 10. A new day.
  s.clock = endDay(s.clock);
  const today = s.clock.day;
  if (s.flags.firSlotPenalty && s.clock.daysToPoll > 0) {
    s.clock = { ...s.clock, slotsLeftToday: 2 };
    s.flags.firSlotPenalty = false;
  }
  if (s.clock.daysToPoll === 0) {
    s.phase = 'polling';
    notes.push({ day: today, kind: 'pollingDay' });
  } else {
    if (s.clock.daysToPoll === 1) {
      s.flags.lastNightTola = rivalWeakestTola(s);
      notes.push(
        { day: today, kind: 'silence' },
        { day: today, kind: 'lastNight', tola: s.flags.lastNightTola },
      );
    }
    for (const p of s.promises) {
      if (p.status !== 'open' || p.deadlineDay === null) continue;
      const left = p.deadlineDay - today;
      if (left >= 0 && left <= 2)
        notes.push({ day: today, kind: 'deadlineSoon', issue: p.issue, daysLeft: left });
    }
    if (s.legalHeat >= 22 && s.legalHeat < 30 && !s.flags.noticeIssued)
      notes.push({ day: today, kind: 'heatWarning' });
    const call = donorCalls(s);
    if (call) notes.push(call);
    const demand = donorDemands(s);
    if (demand) notes.push(demand);
  }
  s.paNotes.push(...notes);
}
