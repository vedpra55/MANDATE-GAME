/**
 * Offline fallback interpreter: turns player text into a Reading using keyword lists.
 * It fills exactly the contract the Decisions API will fill in E4, so the rest of the engine
 * never knows (or cares) which one answered. Deliberately conservative: when unsure, people
 * are "indifferent" and nothing is flagged.
 */
import { hasAny, hasWord, ISSUE_WORDS, MARKERS, TOLA_WORDS } from './lexicon.ts';
import {
  GROUPS,
  ISSUES,
  type GameState,
  type IntentAction,
  type IssueId,
  type Language,
  type Reading,
  type TolaId,
  type Tone,
  TOLAS,
} from './types.ts';

export const MAX_TEXT_LENGTH = 1200;

export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?।\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
}

export function mentionedTolas(text: string): TolaId[] {
  const t = normalise(text);
  return TOLAS.filter((tola) => hasAny(t, TOLA_WORDS[tola]));
}

function detectLanguage(text: string): Language {
  if (/[ऀ-ॿ]/.test(text)) return 'hindi';
  const t = normalise(text);
  const hinglish = [
    ' hai ',
    ' ka ',
    ' ki ',
    ' ko ',
    ' mein ',
    ' nahi ',
    ' hoga',
    ' aur ',
    ' hum ',
    ' main ',
    ' aap',
  ];
  if (hinglish.filter((w) => t.includes(w)).length >= 2) return 'hinglish';
  return /[a-z]/.test(t) ? 'english' : 'other';
}

/** Rough gibberish check: most words should look like words in some script. */
function coherence(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return 0.2;
  const wordLike = words.filter(
    (w) => /[ऀ-ॿ]/.test(w) || (/[aeiouy]/i.test(w) && !/[bcdfghjklmnpqrstvwxz]{5,}/i.test(w)),
  );
  return wordLike.length / words.length >= 0.7 ? 0.9 : 0.2;
}

export function interpretFallback(state: GameState, text: string): Reading {
  const t = normalise(text);
  const sentences = splitSentences(text).map(normalise);
  const hasCommitment = hasAny(t, MARKERS.commitment);
  const hasTime = hasAny(t, MARKERS.time);
  const hasNumber = /\d|₹/.test(t);
  const tolaNamed = mentionedTolas(text).length > 0;

  // Issues: 1 mentioned, 2 with a commitment in the same sentence, 3 also with time/place/number.
  const issues: Partial<Record<IssueId, number>> = {};
  for (const issue of ISSUES) {
    let best = 0;
    for (const s of sentences) {
      if (!hasAny(s, ISSUE_WORDS[issue])) continue;
      let score = 1;
      if (hasAny(s, MARKERS.commitment)) {
        score = 2;
        if (
          hasAny(s, MARKERS.time) ||
          /\d|₹/.test(s) ||
          TOLAS.some((tl) => hasAny(s, TOLA_WORDS[tl]))
        ) {
          score = 3;
        }
      }
      best = Math.max(best, score);
    }
    if (best > 0) issues[issue] = best;
  }
  const anyIssue = Object.keys(issues).length > 0;
  const committedIssue = Object.values(issues).some((v) => v >= 2);

  const specificity = Math.min(
    3,
    (committedIssue ? 1 : 0) + (hasTime ? 1 : 0) + (tolaNamed || hasNumber ? 1 : 0),
  );
  const containsPromise = committedIssue ? 0.9 : hasCommitment ? 0.55 : 0.05;

  const voteBuying =
    hasAny(t, MARKERS.voteRef) && hasAny(t, MARKERS.money) && hasCommitment ? 0.8 : 0.05;
  const divisive = hasAny(t, MARKERS.divisive);
  const exclusion = hasAny(t, MARKERS.exclusion) && hasAny(t, MARKERS.voteRef);
  const inflammatory = divisive ? 0.75 : 0.05;
  const unconstitutional = exclusion ? 0.8 : 0.05;
  const addressesEvaluator = hasAny(t, MARKERS.injection) ? 0.85 : 0.02;
  const coherent = coherence(text);

  let tone: Tone;
  if (divisive || exclusion) tone = 'divisive';
  else if (hasAny(t, MARKERS.aggressive)) tone = 'aggressive';
  else if (hasAny(t, MARKERS.humble)) tone = 'humble';
  else if (hasAny(t, MARKERS.emotional) || (text.match(/!/g)?.length ?? 0) >= 2) tone = 'emotional';
  else if (anyIssue || specificity >= 2) tone = 'policy';
  else tone = 'evasive';

  let intentAction: IntentAction = 'none';
  if (hasCommitment && hasAny(t, MARKERS.fix)) intentAction = 'public_works';
  else if (hasCommitment && hasAny(t, MARKERS.money)) intentAction = 'cash_help';

  // Reactions: indifferent by default; people warm to statements about what they care about.
  const commit = containsPromise >= 0.5 ? 1 : 0.6;
  // A vague list of promises convinces less than one concrete one.
  const committedCount = Object.values(issues).filter((v) => v >= 2).length;
  const breadth = committedCount >= 3 && specificity <= 1 ? 0.9 : 1;
  const toneShift =
    tone === 'humble' ? 0.15 : tone === 'evasive' ? -0.3 : tone === 'aggressive' ? -0.1 : 0;
  const reactions = {} as Reading['reactions'];
  for (const g of GROUPS) {
    const weights = state.groups[g].issueWeights;
    let rel = 0;
    for (const [issue, score] of Object.entries(issues) as [IssueId, number][]) {
      rel += (weights[issue] ?? 0) * (score / 3);
    }
    let score = 2 + 2 * Math.min(1, rel / 0.25) * commit * breadth + toneShift;
    if (tone === 'divisive') score = 1;
    reactions[g] = { score: Math.max(0, Math.min(4, score)), confidence: 0.6 };
  }

  return {
    reactions,
    issues,
    tone,
    specificity,
    containsPromise,
    risks: { inflammatory, defamatory: 0.02, falseClaim: 0.02, unconstitutional, voteBuying },
    addressesEvaluator,
    coherent,
    language: detectLanguage(text),
    intentAction,
    source: 'fallback',
  };
}

export { hasWord };
