/**
 * The engine's public API. Two functions: start a game, apply an action.
 * Both are pure: they never mutate their input and never touch the network or the clock.
 * The orchestrator may pass AI readings in `opts` (E4); without them the offline fallback
 * interpreter is used, so the game always works.
 */
import { spendSlot } from './clock.ts';
import { buildCounting } from './counting.ts';
import { deliverSolution, gifts, publicWorks, recruit } from './deeds.ts';
import { computeResult } from './endings.ts';
import { answerDonor, judgeDonorAnswer, readCallFallback } from './interrupts.ts';
import { interpretFallback, MAX_TEXT_LENGTH } from './interpret.ts';
import { knowsGrievance } from './knowledge.ts';
import { worksCost, type PromiseDraft } from './promises.ts';
import { createRng } from './rng.ts';
import { applyStatement } from './statements.ts';
import { endOfDay } from './tick.ts';
import {
  TOLAS,
  type Action,
  type ActionError,
  type CallReading,
  type GameState,
  type PaNote,
  type Reading,
} from './types.ts';

export { newGame } from './setup.ts';

const SLOT_ACTIONS = new Set<Action['type']>([
  'statement',
  'visit',
  'publicWorks',
  'gifts',
  'recruit',
  'deliver',
]);

export type ActionOptions = {
  /** An AI reading of the action's text (Decisions API). */
  reading?: Reading;
  /** An AI reading of a phone reply. */
  callReading?: CallReading;
  /** Promises extracted by the AI (Responses API); replaces the keyword extraction. */
  promises?: PromiseDraft[];
};

export function validate(s: GameState, a: Action): ActionError | null {
  const inCampaign = s.phase === 'campaign';
  const textCheck = (text: string): ActionError | null =>
    !text.trim() ? 'emptyText' : text.length > MAX_TEXT_LENGTH ? 'textTooLong' : null;
  switch (a.type) {
    case 'declare':
      return s.phase !== 'nomination' ? 'wrongPhase' : textCheck(a.text);
    case 'endDay':
      return inCampaign ? null : 'wrongPhase';
    case 'assignBooths': {
      if (s.phase !== 'polling') return 'wrongPhase';
      const values = TOLAS.map((t) => a.plan[t] ?? 0);
      if (values.some((v) => !Number.isInteger(v) || v < 0)) return 'invalidAmount';
      return values.reduce((x, y) => x + y, 0) > s.cadre.size ? 'tooManyWorkers' : null;
    }
    case 'beginCounting':
      return s.phase === 'polling' ? null : 'wrongPhase';
    case 'revealRound':
      return s.phase === 'counting' ? null : 'wrongPhase';
    default:
      break;
  }
  if (!inCampaign) return 'wrongPhase';
  if (SLOT_ACTIONS.has(a.type) && s.clock.slotsLeftToday === 0) return 'noSlots';
  switch (a.type) {
    case 'statement':
      if (s.clock.daysToPoll === 1) return 'silencePeriod';
      return textCheck(a.text);
    case 'visit':
      return textCheck(a.text);
    case 'answer':
      return s.pending.question ? textCheck(a.text) : 'nothingPending';
    case 'answerCall':
      return s.pending.call ? textCheck(a.text) : 'nothingPending';
    case 'publicWorks': {
      const cost = worksCost(a.issue);
      if (cost === null || (s.tolas[a.tola].grievances[a.issue] ?? 0) < 0.05) return 'nothingToFix';
      if (!knowsGrievance(s, a.tola, a.issue)) return 'unknownGrievance';
      if (
        s.projects.some((p) => p.status === 'building' && p.tola === a.tola && p.issue === a.issue)
      )
        return 'alreadyBuilding';
      return s.cash >= cost ? null : 'notEnoughCash';
    }
    case 'deliver': {
      const p = s.promises.find((pr) => pr.faultLine === a.faultLine && pr.status === 'open');
      if (!p) return 'nothingPending';
      if (s.projects.some((pr) => pr.status === 'building' && pr.faultLine === a.faultLine))
        return 'alreadyBuilding';
      return s.cash >= p.cost ? null : 'notEnoughCash';
    }
    case 'gifts':
      if (!(a.amount > 0)) return 'invalidAmount';
      return s.cash >= a.amount ? null : 'notEnoughCash';
    case 'recruit':
      return null;
  }
}

export type ActionResult = { state: GameState; error: ActionError | null };

export function applyAction(
  state: GameState,
  action: Action,
  opts: ActionOptions = {},
): ActionResult {
  const error = validate(state, action);
  if (error) return { state, error };

  const s = structuredClone(state);
  const rng = createRng(s.rngState);
  const notes: PaNote[] = [];
  const reading = () => opts.reading ?? interpretFallback(s, 'text' in action ? action.text : '');
  const extracted = opts.promises;

  switch (action.type) {
    case 'declare':
      notes.push(
        ...applyStatement(s, rng, action.text, reading(), 'declaration', null, null, extracted)
          .notes,
      );
      s.phase = 'campaign';
      break;
    case 'statement':
      notes.push(
        ...applyStatement(s, rng, action.text, reading(), 'pad', null, null, extracted).notes,
      );
      break;
    case 'visit':
      notes.push(
        ...applyStatement(s, rng, action.text, reading(), 'visit', action.tola, null, extracted)
          .notes,
      );
      break;
    case 'answer': {
      const q = s.pending.question!;
      s.pending.question = null;
      const r = reading();
      notes.push(
        ...applyStatement(s, rng, action.text, r, 'answer', null, q.faultLine, extracted).notes,
      );
      if (q.by === 'donor') notes.push(...judgeDonorAnswer(s, r));
      break;
    }
    case 'answerCall':
      notes.push(...answerDonor(s, opts.callReading ?? readCallFallback(action.text)));
      break;
    case 'publicWorks':
      notes.push(...publicWorks(s, rng, action.tola, action.issue));
      break;
    case 'deliver':
      notes.push(...deliverSolution(s, rng, action.faultLine));
      break;
    case 'gifts':
      notes.push(...gifts(s, action.tola, action.amount));
      break;
    case 'recruit':
      notes.push(...recruit(s, rng, action.tola, action.strongman));
      break;
    case 'endDay':
      endOfDay(s, rng);
      if (s.flags.disqualified) {
        s.phase = 'ended';
        s.result = computeResult(s);
      }
      break;
    case 'assignBooths':
      s.boothPlan = Object.fromEntries(
        TOLAS.map((t) => [t, action.plan[t] ?? 0]),
      ) as GameState['boothPlan'];
      break;
    case 'beginCounting': {
      if (!s.boothPlan)
        s.boothPlan = Object.fromEntries(TOLAS.map((t) => [t, 0])) as GameState['boothPlan'];
      const empty = TOLAS.filter((t) => (s.boothPlan![t] ?? 0) === 0).length;
      if (empty > 0) notes.push({ day: s.clock.day, kind: 'boothsUnmanned', count: empty });
      s.counting = buildCounting(s, rng);
      s.phase = 'counting';
      break;
    }
    case 'revealRound': {
      const c = s.counting!;
      c.revealed = Math.min(c.rounds.length, c.revealed + 1);
      if (c.revealed === c.rounds.length) {
        s.phase = 'ended';
        s.result = computeResult(s);
      }
      break;
    }
  }

  if (SLOT_ACTIONS.has(action.type)) s.clock = spendSlot(s.clock);
  s.paNotes.push(...notes);
  s.rngState = rng.state;
  return { state: s, error: null };
}

/** Attach AI-written voices (PA line, voter quotes) to a statement. Presentation only. */
export function attachVoices(
  state: GameState,
  statementId: number,
  voices: NonNullable<GameState['statements'][number]['voices']>,
): GameState {
  return {
    ...state,
    statements: state.statements.map((st) => (st.id === statementId ? { ...st, voices } : st)),
  };
}
