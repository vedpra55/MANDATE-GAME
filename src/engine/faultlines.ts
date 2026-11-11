/**
 * Fault lines (docs/CHALLENGE.md §3.1, §3.3): where interests genuinely conflict.
 * A statement can take side A, side B, offer a win-win, or evade. The village remembers your
 * public position; contradicting it costs credibility, unless you change your mind openly.
 */
import { hasAny } from './lexicon.ts';
import { record } from './state.ts';
import {
  GROUPS,
  type Channel,
  type FaultLineId,
  type GameState,
  type GroupId,
  type PaNote,
  type Reading,
  type Stance,
  type TolaId,
} from './types.ts';
import { FAULT_LINE_DATA, sideWeight } from './world.ts';
import { beneficiariesOf } from './promises.ts';

const BASE: Record<Channel, number> = { declaration: 2, pad: 6, visit: 7, answer: 8 };
const CHANGE_WORDS = [
  'i was wrong',
  'changed my mind',
  'change my position',
  'reconsider',
  'rethink',
  'maine galti',
  'galti ki',
  'galti thi',
  'soch badli',
  'soch badal',
  'maafi chahta',
  'maafi chahti',
  'मैंने गलती',
];
const LISTEN_WORDS = [
  'tell me',
  'listen',
  'what problem',
  'your problem',
  'batao',
  'bataiye',
  'bataiyे',
  'sunne',
  'sunna',
  'sunungi',
  'sununga',
  'kya pareshani',
  'kya dikkat',
  'dikkat',
  'pareshani',
  'samasya',
  'बताइए',
  'सुनने',
  'समस्या',
];

/** Offline reading of fault-line stances (the Decisions API replaces this in E4). */
export function detectStances(
  s: GameState,
  normalisedText: string,
  specificity: number,
): Reading['faultLines'] {
  const out: Reading['faultLines'] = {};
  const listening = detectListening(normalisedText) >= 0.5;
  for (const fl of s.faultLines) {
    const d = FAULT_LINE_DATA[fl];
    const touched = hasAny(normalisedText, d.topic);
    const a = d.sideA.words.filter((w) => hasAny(normalisedText, [w])).length;
    const b = d.sideB.words.filter((w) => hasAny(normalisedText, [w])).length;
    const elements = d.winWin.elements.filter((group) => hasAny(normalisedText, group)).length;
    if (!touched && a === 0 && b === 0 && elements < 2) continue;
    let stance: Stance;
    let quality = 0;
    if (elements >= 2 && touched) {
      stance = 'win_win';
      quality = Math.min(3, elements - 1 + (specificity >= 2 ? 1 : 0));
    } else if (a > b) stance = 'side_a';
    else if (b > a) stance = 'side_b';
    // Asking about a conflict is listening, not dodging it.
    else stance = touched && !listening ? 'evasive' : 'none';
    if (stance !== 'none') out[fl] = { stance, confidence: 0.6, quality };
  }
  return out;
}

export function detectListening(normalisedText: string): number {
  return normalisedText.includes('?') || hasAny(normalisedText, LISTEN_WORDS) ? 0.8 : 0.1;
}

export function detectChangeOfMind(normalisedText: string): number {
  return hasAny(normalisedText, CHANGE_WORDS) ? 0.8 : 0.05;
}

/** The tola that wants side A of a fault line (where a win-win is delivered). */
export function homeTola(fl: FaultLineId): TolaId {
  const hot = FAULT_LINE_DATA[fl].hot;
  return (
    (Object.keys(hot) as TolaId[]).find((t) => hot[t] === 'side_a') ??
    (Object.keys(hot)[0] as TolaId)
  );
}

const opposite = (st: 'side_a' | 'side_b') => (st === 'side_a' ? 'side_b' : 'side_a');

/**
 * Apply the stances in a reading. `forced` is the fault line a pending question asked about:
 * not addressing it in the answer counts as evasion.
 */
export function applyStances(
  s: GameState,
  reading: Reading,
  channel: Channel,
  statementId: number,
  forced: FaultLineId | null,
): PaNote[] {
  const notes: PaNote[] = [];
  const day = s.clock.day;
  const c = (conf: number) => Math.sqrt(Math.max(0.2, conf));
  if (reading.addressesEvaluator >= 0.5 || reading.coherent < 0.5) return notes;

  const entries = Object.entries(reading.faultLines) as [
    FaultLineId,
    { stance: Stance; confidence: number; quality: number },
  ][];
  if (forced && !entries.some(([fl, r]) => fl === forced && r.stance !== 'none')) {
    entries.push([forced, { stance: 'evasive', confidence: 0.8, quality: 0 }]);
  }

  for (const [fl, r] of entries) {
    if (!s.faultLines.includes(fl) || r.stance === 'none') continue;
    if (!s.known.faultLines.includes(fl)) s.known.faultLines.push(fl);
    const d = FAULT_LINE_DATA[fl];
    const base = BASE[channel] * c(r.confidence);
    const prev = s.stances[fl];
    let stance = r.stance;

    // A win-win only counts if it is concrete and the speaker is believed.
    let doubted = false;
    if (stance === 'win_win' && (r.quality < 2 || s.credibility < 0.75)) {
      notes.push({ day, kind: 'notBelieved', faultLine: fl });
      stance = 'evasive';
      doubted = true;
    }

    if (stance === 'evasive') {
      const trust: Partial<Record<GroupId, number>> = {};
      for (const g of GROUPS)
        trust[g] = -0.2 * base * (sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g));
      record(s, {
        actor: 'player',
        kind: 'evasion',
        faultLine: fl,
        stance,
        statementId,
        effect: { trust, reputation: -1 },
      });
      // Recorded, so the diary shows it and the rival does not ask again.
      s.publicWord[fl] = { word: doubted ? 'win_win_doubted' : 'evasive', day };
      if (!doubted) notes.push({ day, kind: 'stanceTaken', faultLine: fl, stance });
      continue;
    }

    const same = prev?.stance === stance;
    const reinforce = same ? 0.25 : 1;

    // Contradicting your public position (unless you say so openly).
    const isSide = stance === 'side_a' || stance === 'side_b';
    if (prev && !same && isSide && prev.stance === opposite(stance as 'side_a' | 'side_b')) {
      contradiction(s, fl, statementId, reading.changesMind >= 0.5, notes);
    } else if (prev && !same && prev.stance === 'win_win') {
      // Backing away from your own solution: a smaller credibility cost.
      record(s, {
        actor: 'player',
        kind: 'contradiction',
        faultLine: fl,
        statementId,
        effect: { credibility: reading.changesMind >= 0.5 ? -0.02 : -0.05 },
      });
    }

    const trust: Partial<Record<GroupId, number>> = {};
    const rivalTrust: Partial<Record<GroupId, number>> = {};
    const mood: Partial<Record<TolaId, number>> = {};
    if (stance === 'side_a' || stance === 'side_b') {
      const lose = opposite(stance);
      for (const g of GROUPS) {
        // Winners warm a little; losers anger more, and consolidate behind the rival.
        trust[g] =
          reinforce * base * (0.8 * sideWeight(fl, stance, g) - 1.2 * sideWeight(fl, lose, g));
        rivalTrust[g] = same ? 0 : 0.8 * base * sideWeight(fl, lose, g);
      }
      for (const [t, side] of Object.entries(d.hot) as [TolaId, 'side_a' | 'side_b'][]) {
        mood[t] = reinforce * (side === stance ? 5 : -6);
      }
    } else {
      for (const g of GROUPS)
        trust[g] =
          reinforce * 0.2 * base * (sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g));
      for (const t of Object.keys(d.hot) as TolaId[]) mood[t] = reinforce * 3;
      addSolutionPromise(s, fl);
    }
    record(s, {
      actor: 'player',
      kind: 'stance',
      faultLine: fl,
      stance,
      statementId,
      effect: { trust, rivalTrust, mood },
    });
    s.stances[fl] = { stance, day, statementId };
    s.publicWord[fl] = { word: stance, day };
    if (!same) notes.push({ day, kind: 'stanceTaken', faultLine: fl, stance });
  }
  return notes;
}

function contradiction(
  s: GameState,
  fl: FaultLineId,
  statementId: number,
  open: boolean,
  notes: PaNote[],
): void {
  if (open) {
    record(s, {
      actor: 'player',
      kind: 'contradiction',
      faultLine: fl,
      statementId,
      effect: { credibility: -0.05 },
    });
    return;
  }
  const trust: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS)
    trust[g] = -4 * (sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g));
  s.flags.contradictions += 1;
  record(s, {
    actor: 'player',
    kind: 'contradiction',
    faultLine: fl,
    statementId,
    effect: { credibility: -0.15, trust, reputation: -4 },
  });
  notes.push({ day: s.clock.day, kind: 'contradiction', faultLine: fl });
}

/** A believed win-win becomes a campaign promise with a real cost and a deadline. */
function addSolutionPromise(s: GameState, fl: FaultLineId): void {
  if (s.promises.some((p) => p.faultLine === fl && p.status === 'open')) return;
  const d = FAULT_LINE_DATA[fl];
  const days = Math.min(d.winWin.days, Math.max(1, s.clock.daysToPoll - 1));
  s.promises.push({
    id: s.nextId++,
    faultLine: fl,
    day: s.clock.day,
    text: '',
    issue: d.issue,
    tola: homeTola(fl),
    when: 'during_campaign',
    deadlineDay: s.clock.day + days,
    cost: d.winWin.cost,
    status: 'open',
    beneficiaries: GROUPS.filter(
      (g) => sideWeight(fl, 'side_a', g) + sideWeight(fl, 'side_b', g) > 0,
    )
      .concat(beneficiariesOf(s, d.issue))
      .filter((g, i, a) => a.indexOf(g) === i),
  });
}
