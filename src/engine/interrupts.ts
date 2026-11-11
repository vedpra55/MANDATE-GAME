/**
 * Things that happen *to* the player and demand an answer (docs/CHALLENGE.md §3.4–3.6):
 * the rival's wedge questions, the donor's call and later demand, leaks, and neglect.
 */
import { hasAny } from './lexicon.ts';
import { allGroups, record } from './state.ts';
import {
  GROUPS,
  TOLAS,
  type CallReading,
  type CallReply,
  type FaultLineId,
  type GameState,
  type GroupId,
  type PaNote,
  type Reading,
  type TolaId,
} from './types.ts';
import type { Rng } from './rng.ts';
import { archetypeOf, sideWeight } from './world.ts';

export const DONOR = {
  name: 'Mahesh-ji',
  offer: 35000,
  negotiated: 15000,
  rivalGets: 30000,
  offerDay: 3,
  demandDay: 10,
};

/* ------------------------------------------------------------------ rival wedges */

/** Your support per group: trust (if positive) × voters. */
function support(s: GameState, g: GroupId): number {
  const voters = TOLAS.reduce((a, t) => a + s.tolas[t].voters[g], 0);
  return Math.max(0, s.groups[g].trust) * voters;
}

/**
 * The rival finds the fault line that splits the groups backing you and asks it in public.
 * Returns a note if he did. The question must be answered the next day.
 */
export function rivalWedge(s: GameState): PaNote | null {
  const day = s.clock.day;
  const arch = archetypeOf(s);
  if (
    day < 4 ||
    s.pending.question ||
    s.clock.daysToPoll <= 2 ||
    day - s.rival.lastWedgeDay < arch.wedgeEvery
  )
    return null;
  let best: FaultLineId | null = null;
  let bestScore = -1;
  for (const fl of s.faultLines) {
    // Never the same question twice, and never one you have already answered in public.
    if (s.asked.includes(fl) || s.publicWord[fl]) continue;
    let a = 0;
    let b = 0;
    for (const g of GROUPS) {
      a += support(s, g) * sideWeight(fl, 'side_a', g);
      b += support(s, g) * sideWeight(fl, 'side_b', g);
    }
    const score = Math.min(a, b) + 0.2 * (a + b) + 1;
    if (score > bestScore) {
      best = fl;
      bestScore = score;
    }
  }
  if (!best) return null;
  s.rival.lastWedgeDay = day;
  s.asked.push(best);
  // Asked tomorrow morning; due by the end of the day after.
  s.pending.question = { faultLine: best, by: 'rival', askedDay: day + 1, dueDay: day + 2 };
  if (!s.known.faultLines.includes(best)) s.known.faultLines.push(best);
  record(s, {
    actor: 'rival',
    kind: 'rivalWedge',
    faultLine: best,
    effect: { rivalReputation: 1 },
  });
  return { day: day + 1, kind: 'wedge', faultLine: best };
}

/** End of day: an unanswered question counts as silence; worse than a bad answer. */
export function punishSilence(s: GameState): PaNote[] {
  const q = s.pending.question;
  if (!q || s.clock.day < q.dueDay) return [];
  s.pending.question = null;
  if (q.by === 'donor') return donorAngry(s);
  s.publicWord[q.faultLine] = { word: 'silent', day: s.clock.day };
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS)
    trust[g] = -3.6 * (sideWeight(q.faultLine, 'side_a', g) + sideWeight(q.faultLine, 'side_b', g));
  record(s, {
    actor: 'player',
    kind: 'silence',
    faultLine: q.faultLine,
    effect: { trust, reputation: -2 },
  });
  return [{ day: s.clock.day, kind: 'silent', faultLine: q.faultLine }];
}

/* ------------------------------------------------------------------ the donor */

const ACCEPT = [
  'yes',
  'accept',
  'deal',
  'okay',
  'ok ',
  'haan',
  'han ',
  'theek hai',
  'thik hai',
  'manzoor',
  'le lunga',
  'le lungi',
  'chalega',
  'हाँ',
  'मंजूर',
  'ठीक है',
];
const REFUSE = [
  'no',
  'refuse',
  'not for sale',
  'nahi',
  'nahin',
  'mana',
  'nahi chahiye',
  'mat',
  'never',
  'kabhi nahi',
  'नहीं',
  'मना',
];
const NEGOTIATE = [
  'less',
  'half',
  'aadha',
  'kam ',
  'condition',
  'shart',
  'but no',
  'par koi',
  'without',
  'bina',
  'sirf',
  'only if',
  'शर्त',
];

export function readCallFallback(text: string): CallReading {
  const t = ` ${text.toLowerCase()} `;
  const n = hasAny(t, NEGOTIATE);
  const r = hasAny(t, REFUSE);
  const a = hasAny(t, ACCEPT);
  const reply: CallReply =
    n && (a || r) ? 'negotiate' : r ? 'refuse' : a ? 'accept' : n ? 'negotiate' : 'stall';
  return { reply, confidence: 0.6, source: 'fallback' };
}

export function donorCalls(s: GameState): PaNote | null {
  if (s.clock.day !== DONOR.offerDay || s.donor.state !== 'none') return null;
  s.donor.state = 'offered';
  s.pending.call = { kind: 'donorOffer', day: s.clock.day, dueDay: s.clock.day + 1 };
  return { day: s.clock.day, kind: 'donorCall' };
}

export function answerDonor(s: GameState, reading: CallReading): PaNote[] {
  s.pending.call = null;
  const day = s.clock.day;
  const kiln = s.faultLines.includes('kiln');
  const ask = kiln
    ? 'Say publicly that the brick kiln stays'
    : 'The road repair contract after you win';
  switch (reading.reply) {
    case 'accept':
      s.donor.state = 'accepted';
      s.favours.push({
        id: s.nextId++,
        day,
        creditor: DONOR.name,
        ask,
        amount: DONOR.offer,
        danger: 0.6,
        leakChancePerDay: 0.06,
        leaked: false,
      });
      record(s, {
        actor: 'player',
        kind: 'donorAccepted',
        amount: DONOR.offer,
        effect: { cash: DONOR.offer },
      });
      break;
    case 'negotiate':
      s.donor.state = 'negotiated';
      s.favours.push({
        id: s.nextId++,
        day,
        creditor: DONOR.name,
        ask: kiln ? ask : 'A word in his favour when it matters',
        amount: DONOR.negotiated,
        danger: 0.3,
        leakChancePerDay: 0.02,
        leaked: false,
      });
      record(s, {
        actor: 'player',
        kind: 'donorAccepted',
        amount: DONOR.negotiated,
        effect: { cash: DONOR.negotiated },
      });
      break;
    default:
      s.donor.state = 'refused';
      record(s, {
        actor: 'world',
        kind: 'donorRefused',
        effect: { rivalCash: reading.reply === 'stall' ? 30000 : DONOR.rivalGets },
      });
  }
  return [{ day, kind: 'donorResult', result: s.donor.state }];
}

/** End of day: an unanswered call is a stall; the donor goes to the rival. */
export function expireCall(s: GameState): PaNote[] {
  const c = s.pending.call;
  if (!c || s.clock.day < c.dueDay) return [];
  return answerDonor(s, { reply: 'stall', confidence: 1, source: 'fallback' });
}

/** Day 10: if you took his money and the kiln divides the village, he wants it said in public. */
export function donorDemands(s: GameState): PaNote | null {
  const took = s.donor.state === 'accepted' || s.donor.state === 'negotiated';
  if (
    !took ||
    s.donor.demandMade ||
    s.clock.day !== DONOR.demandDay ||
    !s.faultLines.includes('kiln') ||
    s.pending.question
  )
    return null;
  s.donor.demandMade = true;
  s.pending.question = {
    faultLine: 'kiln',
    by: 'donor',
    askedDay: s.clock.day,
    dueDay: s.clock.day + 1,
  };
  if (!s.known.faultLines.includes('kiln')) s.known.faultLines.push('kiln');
  return { day: s.clock.day, kind: 'donorDemand', faultLine: 'kiln' };
}

/** After an answer to the donor's demand: did you say the kiln stays? */
export function judgeDonorAnswer(s: GameState, reading: Reading): PaNote[] {
  const st = reading.faultLines.kiln?.stance;
  if (st === 'side_a') return [{ day: s.clock.day, kind: 'donorResult', result: s.donor.state }];
  return donorAngry(s);
}

function donorAngry(s: GameState): PaNote[] {
  s.donor.state = 'angry';
  for (const f of s.favours) if (f.creditor === DONOR.name) f.leaked = true;
  record(s, {
    actor: 'world',
    kind: 'donorAngry',
    effect: { reputation: -8, credibility: -0.1, heat: 5, trust: allGroups(-2), rivalCash: 30000 },
  });
  return [
    { day: s.clock.day, kind: 'donorResult', result: 'angry' },
    { day: s.clock.day, kind: 'favourLeaked' },
  ];
}

/** End of day: secret favours can leak, more likely when you are already under scrutiny. */
export function rollLeaks(s: GameState, rng: Rng): PaNote[] {
  const notes: PaNote[] = [];
  for (const f of s.favours) {
    if (f.leaked) continue;
    if (!rng.chance(f.leakChancePerDay * f.danger * (1 + s.legalHeat / 100) * 2)) continue;
    f.leaked = true;
    record(s, {
      actor: 'world',
      kind: 'favourLeaked',
      effect: { reputation: -8, trust: allGroups(-4), heat: 6, credibility: -0.08 },
    });
    notes.push({ day: s.clock.day, kind: 'favourLeaked' });
  }
  return notes;
}

/* ------------------------------------------------------------------ neglect */

/** A tola you have not visited in 5 days, which the rival has, starts to feel ignored. */
export function neglect(s: GameState): PaNote[] {
  const day = s.clock.day;
  const notes: PaNote[] = [];
  for (const t of TOLAS as readonly TolaId[]) {
    const tola = s.tolas[t];
    const away = day - tola.lastVisit;
    if (day < 5 || away < 5 || day - tola.rivalLastVisit > 4) continue;
    record(s, { actor: 'world', kind: 'neglect', tola: t, effect: { mood: { [t]: -1.5 } } });
    if (away === 5 || (tola.lastVisit === 0 && day === 5))
      notes.push({ day, kind: 'neglect', tola: t });
  }
  return notes;
}
