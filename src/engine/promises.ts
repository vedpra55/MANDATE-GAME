/**
 * The promise ledger: extraction (offline fallback), deadlines, kept and broken.
 * In E4 extraction comes from the Responses API with Structured Outputs; the rules stay here.
 */
import { hasAny, ISSUE_WORDS, MARKERS } from './lexicon.ts';
import { mentionedTolas, splitSentences } from './interpret.ts';
import {
  GROUPS,
  type GameState,
  type GroupId,
  type IssueId,
  type LedgerPromise,
  type Reading,
  type TolaId,
} from './types.ts';
import region from '../data/regions/bihar-village.json';

const WORKS = region.works as Partial<Record<IssueId, number>>;
const UNDOABLE_COST = 20000;

export function worksCost(issue: IssueId): number | null {
  return WORKS[issue] ?? null;
}

/** Groups for whom this issue matters (weight ≥ 0.15). */
export function beneficiariesOf(state: GameState, issue: IssueId): GroupId[] {
  return GROUPS.filter((g) => (state.groups[g].issueWeights[issue] ?? 0) >= 0.15);
}

function parseDeadlineDays(sentence: string): number | null {
  const s = ` ${sentence.toLowerCase()} `;
  if (/(tomorrow|kal |कल)/.test(s)) return 1;
  if (/(two weeks|2 weeks|do hafte|do hafta|दो हफ्ते|दो हफ़्ते|2 hafte)/.test(s)) return 14;
  if (/(week|hafte|hafta|सप्ताह|हफ्ते|हफ़्ते)/.test(s)) return 7;
  const days = s.match(/(\d+)\s*(days|din|दिन)/);
  if (days) return Number(days[1]);
  if (/(do din|two days|दो दिन)/.test(s)) return 2;
  if (/(teen din|three days|तीन दिन)/.test(s)) return 3;
  if (/(month|mahine|mahina|महीने)/.test(s)) return 30;
  return null;
}

export type PromiseDraft = Omit<LedgerPromise, 'id' | 'status'>;

/**
 * One promise per committed issue (score ≥ 2), at most 3 per statement.
 * The text is the sentence the promise was made in, trimmed.
 */
export function extractPromisesFallback(
  state: GameState,
  text: string,
  reading: Reading,
  contextTola: TolaId | null,
): PromiseDraft[] {
  if (reading.containsPromise < 0.5) return [];
  const sentences = splitSentences(text);
  const committed = (Object.entries(reading.issues) as [IssueId, number][])
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const drafts: PromiseDraft[] = [];
  for (const [issue] of committed) {
    const sentence =
      sentences.find((s) => hasAny(` ${s.toLowerCase()} `, ISSUE_WORDS[issue])) ?? text;
    const lower = ` ${sentence.toLowerCase()} `;
    const ifElected =
      hasAny(lower, MARKERS.ifElected) || hasAny(` ${text.toLowerCase()} `, MARKERS.ifElected);
    const cost = worksCost(issue);
    const days = parseDeadlineDays(sentence);
    const campaignDaysLeft = state.clock.daysToPoll;
    const duringCampaign =
      !ifElected && cost !== null && (days === null || days < campaignDaysLeft);
    const tola = mentionedTolas(sentence)[0] ?? contextTola;
    const defaultDays = cost === null ? 14 : cost <= 3000 ? 3 : cost <= 8000 ? 7 : 14;
    drafts.push({
      day: state.clock.day,
      text: sentence.length > 140 ? `${sentence.slice(0, 137)}…` : sentence,
      issue,
      tola,
      when: duringCampaign ? 'during_campaign' : 'if_elected',
      deadlineDay: duringCampaign
        ? state.clock.day + Math.min(days ?? defaultDays, campaignDaysLeft - 1)
        : null,
      cost: cost ?? UNDOABLE_COST,
      beneficiaries: beneficiariesOf(state, issue),
    });
  }
  return drafts;
}

/** Open campaign promises that public works on this issue in this tola fulfil. */
export function promisesFulfilledBy(
  state: GameState,
  issue: IssueId,
  tola: TolaId,
): LedgerPromise[] {
  return state.promises.filter(
    (p) =>
      p.status === 'open' &&
      p.when === 'during_campaign' &&
      p.issue === issue &&
      (p.tola === null || p.tola === tola),
  );
}

/** Campaign promises whose deadline is today or earlier and are still open. */
export function promisesDue(state: GameState): LedgerPromise[] {
  return state.promises.filter(
    (p) => p.status === 'open' && p.deadlineDay !== null && p.deadlineDay <= state.clock.day,
  );
}
