/**
 * Applying a Reading of player text to the world: the trust formula (ENGINE.md §7.2), tone
 * effects (§7.3), the divisive path (§7.4) and promises (§7.5).
 */
import { extractPromisesFallback, type PromiseDraft } from './promises.ts';
import { allGroups, clamp, record, slotIndex, tolaVoters } from './state.ts';
import {
  GROUPS,
  TOLAS,
  type Channel,
  type Effect,
  type FaultLineId,
  type GameState,
  type GroupId,
  type IssueId,
  type PaNote,
  type Reading,
  type RiskFlag,
  type Statement,
  type TolaId,
} from './types.ts';
import type { Rng } from './rng.ts';
import { bandOfTrust, bandOfTola } from './pa.ts';
import { applyStances } from './faultlines.ts';
import { learnTola } from './knowledge.ts';

const K: Record<Channel, number> = { declaration: 4, pad: 12, visit: 13, answer: 10 };
const MAX_DELTA = 12;

function mainIssue(reading: Reading): IssueId | null {
  let best: IssueId | null = null;
  let bestScore = 0;
  for (const [issue, score] of Object.entries(reading.issues) as [IssueId, number][]) {
    if (score > bestScore) {
      best = issue;
      bestScore = score;
    }
  }
  return best;
}

/** Village-wide grievance per issue, weighted by tola size. */
function villageGrievance(s: GameState, issue: IssueId): number {
  let sum = 0;
  let voters = 0;
  for (const t of TOLAS) {
    const n = tolaVoters(s, t);
    sum += (s.tolas[t].grievances[issue] ?? 0) * n;
    voters += n;
  }
  return voters ? sum / voters : 0;
}

/** Δtrust for one group before audience share (aud) is applied. */
function groupDelta(
  s: GameState,
  reading: Reading,
  g: GroupId,
  channel: Channel,
  tola: TolaId | null,
  repetition: number,
): number {
  const { score, confidence } = reading.reactions[g];
  const r = (score - 2) / 2;
  let rel = 0;
  for (const [issue, iScore] of Object.entries(reading.issues) as [IssueId, number][]) {
    const grievance = tola ? (s.tolas[tola].grievances[issue] ?? 0) : villageGrievance(s, issue);
    rel += (s.groups[g].issueWeights[issue] ?? 0) * (iScore / 3) * (0.5 + 0.5 * grievance);
  }
  const relM = 0.5 + 0.5 * Math.min(1, 3 * rel);
  const cred = s.credibility * (0.7 + 0.1 * reading.specificity);
  const sat = 1 - Math.abs(s.groups[g].trust) / 120;
  const coh = reading.coherent >= 0.5 ? 1 : 0.3;
  const inj = reading.addressesEvaluator >= 0.5 ? 0 : 1;
  return K[channel] * r * Math.sqrt(confidence) * relM * cred * repetition * sat * coh * inj;
}

export type StatementOutcome = { statement: Statement; notes: PaNote[] };

export function applyStatement(
  s: GameState,
  rng: Rng,
  text: string,
  reading: Reading,
  channel: Channel,
  tola: TolaId | null,
  forced: FaultLineId | null = null,
  extracted?: PromiseDraft[],
): StatementOutcome {
  const day = s.clock.day;
  const notes: PaNote[] = [];
  const issue = mainIssue(reading);

  // Diminishing returns: the same main issue pushed in the last 3 days.
  // Repetition is per audience: the same tola for visits, the newspaper's readers for the pad.
  // Platitudes with no issue repeat against each other too.
  const repeats = s.statements.filter(
    (st) =>
      st.day >= day - 2 &&
      st.channel === channel &&
      (channel !== 'visit' || st.tola === tola) &&
      (issue ? st.issues.includes(issue) : st.issues.length === 0),
  ).length;
  const repetition = Math.pow(0.6, repeats);

  const flags: RiskFlag[] = [];
  if (reading.risks.inflammatory >= 0.6) flags.push('inflammatory');
  if (reading.risks.defamatory >= 0.6) flags.push('defamatory');
  if (reading.risks.falseClaim >= 0.6) flags.push('false_claim');
  if (reading.risks.unconstitutional >= 0.6) flags.push('unconstitutional');
  if (reading.risks.voteBuying >= 0.6) flags.push('vote_buying');

  const statement: Statement = {
    id: s.nextId++,
    day,
    slot: slotIndex(s),
    channel,
    tola,
    text,
    issues: (Object.entries(reading.issues) as [IssueId, number][])
      .filter(([, v]) => v >= 1)
      .map(([k]) => k),
    tone: reading.tone,
    flags,
    source: reading.source,
    reading: reading.source === 'ai' ? reading : undefined,
  };
  s.statements.push(statement);
  if (issue) s.rival.memory.issueFocus[issue] = (s.rival.memory.issueFocus[issue] ?? 0) + 1;

  // --- trust and mood
  const trust: Partial<Record<GroupId, number>> = {};
  const aud =
    channel === 'pad' ? 0.5 : channel === 'visit' ? 0.35 : channel === 'answer' ? 0.6 : 0.3;
  let moodNumerator = 0;
  for (const g of GROUPS) {
    const raw = groupDelta(s, reading, g, channel, tola, repetition);
    trust[g] = clamp(raw * aud, -MAX_DELTA, MAX_DELTA);
    if (tola) moodNumerator += raw * s.tolas[tola].voters[g];
  }
  const effect: Effect = { trust };
  if (tola) {
    // Showing up at people's doors counts in itself (less on repeat visits to the same tola).
    const recentVisits = s.statements.filter(
      (st) =>
        st.channel === 'visit' && st.tola === tola && st.day >= day - 2 && st.id !== statement.id,
    ).length;
    const badWords =
      reading.tone === 'divisive' || reading.addressesEvaluator >= 0.5 || reading.coherent < 0.5;
    const presence = badWords ? 0 : 2.5 * Math.pow(0.6, recentVisits);
    effect.mood = {
      [tola]: clamp(moodNumerator / tolaVoters(s, tola) + presence, -MAX_DELTA, MAX_DELTA),
    };
  }

  // --- tone (small, never by group)
  if (reading.tone === 'policy' && reading.specificity >= 2) effect.credibility = 0.01;
  if (reading.tone === 'humble') effect.reputation = 1;
  if (reading.tone === 'aggressive') {
    effect.reputation = -1;
    s.rival.memory.aggression += 1;
  }
  if (reading.tone === 'evasive') effect.reputation = -2;
  if (channel === 'declaration') {
    // Day-0 statement: only a nudge.
    effect.reputation = {
      humble: 3,
      policy: 2,
      emotional: 1,
      aggressive: -1,
      evasive: -1,
      divisive: -3,
    }[reading.tone];
  }
  if (flags.includes('vote_buying')) {
    effect.heat = (effect.heat ?? 0) + 8;
    effect.reputation = (effect.reputation ?? 0) - 3;
  }

  const kind =
    channel === 'visit' ? 'visit' : channel === 'declaration' ? 'declaration' : 'statement';
  record(s, {
    actor: 'player',
    kind,
    tola: tola ?? undefined,
    issue: issue ?? undefined,
    statementId: statement.id,
    effect,
  });

  // --- the divisive path
  const p = Math.max(
    reading.risks.inflammatory,
    reading.risks.unconstitutional,
    reading.tone === 'divisive' ? 0.6 : 0,
  );
  if (p >= 0.6 && reading.addressesEvaluator < 0.5) {
    applyDivisive(s, rng, reading, p);
    notes.push({ day, kind: 'divisive' });
  }

  // --- fault lines: sides, win-wins, evasion, contradictions
  notes.push(...applyStances(s, reading, channel, statement.id, forced));

  // --- what a visit teaches you about the tola
  if (tola && channel === 'visit') {
    s.tolas[tola].lastVisit = day;
    const learned = learnTola(s, tola, reading.listens >= 0.5 ? 'listen' : 'glance');
    if (learned) notes.push(learned);
  }

  // --- promises (a repeat of an open promise reinforces it instead of duplicating it)
  // A believed win-win already wrote its own promise: do not log the same thing twice.
  const solvedIssues = s.promises
    .filter(
      (p) =>
        p.faultLine && p.status === 'open' && s.stances[p.faultLine]?.statementId === statement.id,
    )
    .map((p) => p.issue);
  const drafts = (
    channel === 'declaration' ? [] : (extracted ?? extractPromisesFallback(s, text, reading, tola))
  ).filter((d) => !solvedIssues.includes(d.issue));
  for (const d of drafts) {
    const duplicate = s.promises.some(
      (pr) =>
        pr.status === 'open' && pr.issue === d.issue && pr.tola === d.tola && pr.when === d.when,
    );
    if (duplicate) continue;
    s.promises.push({ ...d, id: s.nextId++, status: 'open' });
    notes.push({ day, kind: 'promiseNoted', issue: d.issue, deadlineDay: d.deadlineDay });
    if (d.when === 'if_elected' && d.cost >= 5000 && openBigPromises(s) > 6) {
      // Promise inflation: "itna paisa kahan se aayega?" Credibility falls and sceptics cool.
      record(s, {
        actor: 'player',
        kind: 'statement',
        statementId: statement.id,
        effect: {
          credibility: -0.03,
          trust: {
            ...allGroups(-0.5),
            elders_w: -1.5,
            elders_m: -1.5,
            traders_w: -1.5,
            traders_m: -1.5,
          },
        },
      });
    }
  }

  // --- what the PA notices
  if (reading.addressesEvaluator >= 0.5 || reading.coherent < 0.5) {
    notes.unshift({ day, kind: 'confused' });
  } else if (tola && effect.mood) {
    const d = effect.mood[tola] ?? 0;
    notes.unshift(
      Math.abs(d) < 0.5
        ? { day, kind: 'noEffect' }
        : { day, kind: 'tolaShift', tola, band: bandOfTola(s, tola), up: d > 0 },
    );
  } else {
    let best: GroupId = GROUPS[0]!;
    for (const g of GROUPS) if (Math.abs(trust[g] ?? 0) > Math.abs(trust[best] ?? 0)) best = g;
    const d = trust[best] ?? 0;
    notes.unshift(
      Math.abs(d) < 0.5
        ? { day, kind: 'noEffect' }
        : {
            day,
            kind: 'groupShift',
            group: best,
            band: bandOfTrust(s.groups[best].trust),
            up: d > 0,
          },
    );
  }

  return { statement, notes };
}

function applyDivisive(s: GameState, rng: Rng, reading: Reading, p: number): void {
  const inGroup = GROUPS.filter((g) => reading.reactions[g].score >= 3);
  const trust: Partial<Record<GroupId, number>> = allGroups(-6);
  for (const g of inGroup) trust[g] = 4;
  for (const g of GROUPS) {
    if (inGroup.includes(g)) {
      if (g.endsWith('_w')) s.groups[g].turnoutPenalty += 0.05; // fear among your own supporters
    } else {
      s.groups[g].trustCap = Math.min(s.groups[g].trustCap, 40); // the permanent turn
    }
  }
  s.flags.divisiveUsed = true;
  record(s, { actor: 'player', kind: 'divisive', effect: { trust, heat: 15 * p, reputation: -8 } });
  if (p >= 0.8 && !s.flags.noticeIssued) {
    s.flags.noticeIssued = true;
    record(s, { actor: 'world', kind: 'notice', effect: { heat: 5, reputation: -3 } });
  }
  if (s.flags.pendingTension === null && rng.chance(0.5 * p)) {
    s.flags.pendingTension = s.clock.day + rng.int(1, 3);
  }
}

/** Expensive "if elected" promises still open: what sceptics and the rival count. */
export function openBigPromises(s: GameState): number {
  return s.promises.filter(
    (pr) => pr.status === 'open' && pr.when === 'if_elected' && pr.cost >= 5000,
  ).length;
}
