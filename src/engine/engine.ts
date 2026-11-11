/**
 * The engine's public API. Two functions: start a game, apply an action.
 * Both are pure: they never mutate their input and never touch the network or the clock.
 * Optional `reading` lets the orchestrator pass in an AI interpretation (E4); without it the
 * offline fallback interpreter is used.
 */
import { createClock, spendSlot } from './clock.ts';
import { buildCounting } from './counting.ts';
import { gifts, publicWorks, recruit } from './deeds.ts';
import { computeResult } from './endings.ts';
import { interpretFallback, MAX_TEXT_LENGTH } from './interpret.ts';
import { worksCost } from './promises.ts';
import { createRng } from './rng.ts';
import { applyStatement } from './statements.ts';
import { endOfDay } from './tick.ts';
import {
  BLOCS,
  GENDERS,
  GROUPS,
  TOLAS,
  type Action,
  type ActionError,
  type Address,
  type BlocId,
  type GameState,
  type GroupId,
  type GroupState,
  type IssueId,
  type PaNote,
  type Reading,
  type TolaId,
  type TolaState,
} from './types.ts';
import { computeCells, margin, totals } from './vote.ts';
import region from '../data/regions/bihar-village.json';

type BlocData = {
  baseTurnout: number;
  playerTrust: number;
  rivalTrust: number;
  issues: Partial<Record<IssueId, number>>;
};

export function newGame(opts: { seed: number; name: string; address: Address }): GameState {
  const blocs = region.blocs as Record<BlocId, BlocData>;
  const women = region.women as {
    share: number;
    turnoutDelta: number;
    rivalTrustDelta: number;
    issueBoost: Partial<Record<IssueId, number>>;
  };

  const groups = {} as Record<GroupId, GroupState>;
  for (const b of BLOCS) {
    for (const gender of GENDERS) {
      const data = blocs[b];
      const weights: Partial<Record<IssueId, number>> = {};
      let sum = 0;
      for (const [issue, w] of Object.entries(data.issues) as [IssueId, number][]) {
        const boosted = gender === 'w' ? w * (women.issueBoost[issue] ?? 1) : w;
        weights[issue] = boosted;
        sum += boosted;
      }
      for (const k of Object.keys(weights) as IssueId[]) weights[k] = weights[k]! / sum;
      const rivalTrust = data.rivalTrust + (gender === 'w' ? women.rivalTrustDelta : 0);
      groups[`${b}_${gender}`] = {
        trust: data.playerTrust,
        rivalTrust,
        baseRivalTrust: rivalTrust,
        baseTurnout: data.baseTurnout + (gender === 'w' ? women.turnoutDelta : 0),
        issueWeights: weights,
        trustCap: 100,
        turnoutPenalty: 0,
      };
    }
  }

  const tolaData = region.tolas as Record<
    TolaId,
    {
      voters: number;
      blocs: Record<BlocId, number>;
      grievances: Partial<Record<IssueId, number>>;
      neighbours: TolaId[];
      rivalMood: number;
      rivalCoverage: number;
    }
  >;
  const tolas = {} as Record<TolaId, TolaState>;
  for (const t of TOLAS) {
    const d = tolaData[t];
    const voters = {} as Record<GroupId, number>;
    for (const b of BLOCS) {
      voters[`${b}_w`] = Math.round(d.voters * d.blocs[b] * women.share);
      voters[`${b}_m`] = Math.round(d.voters * d.blocs[b] * (1 - women.share));
    }
    tolas[t] = {
      voters,
      mood: 0,
      rivalMood: d.rivalMood,
      grievances: { ...d.grievances },
      cadreCoverage: 0,
      rivalCoverage: d.rivalCoverage,
      neighbours: d.neighbours,
    };
  }

  const state: GameState = {
    version: 1,
    seed: opts.seed,
    rngState: opts.seed >>> 0,
    regionId: region.id,
    player: { name: opts.name.trim() || 'Candidate', address: opts.address },
    phase: 'nomination',
    clock: createClock(region.campaignDays),
    cash: region.startCash,
    reputation: 0,
    legalHeat: 0,
    credibility: 1,
    cadre: { ...region.startCadre, strongmen: 0 },
    groups,
    tolas,
    rival: {
      name: region.rival.name,
      cash: region.rival.cash,
      heat: 0,
      reputation: region.rival.reputation,
      rallyDone: false,
      attackedPromiseIds: [],
      lastMockDay: -99,
      memory: { issueFocus: {}, aggression: 0 },
    },
    promises: [],
    favours: [],
    statements: [],
    log: [],
    paNotes: [{ day: 1, kind: 'welcome' }],
    stories: [{ day: 1, kind: 'quiet' }],
    flags: {
      noticeIssued: false,
      firFiled: false,
      firSlotPenalty: false,
      disqualified: false,
      divisiveUsed: false,
      giftsTotal: 0,
      giftsFilmed: 0,
      lastNightTola: null,
      pendingFilming: [],
      pendingTension: null,
      initialMargin: 0,
    },
    counting: null,
    result: null,
    nextId: 1,
  };
  state.flags.initialMargin = margin(totals(computeCells(state)));
  return state;
}

const SLOT_ACTIONS = new Set<Action['type']>([
  'statement',
  'visit',
  'publicWorks',
  'gifts',
  'recruit',
]);

export function validate(s: GameState, a: Action): ActionError | null {
  const inCampaign = s.phase === 'campaign';
  const textCheck = (text: string): ActionError | null =>
    !text.trim() ? 'emptyText' : text.length > MAX_TEXT_LENGTH ? 'textTooLong' : null;
  switch (a.type) {
    case 'declare':
      return s.phase !== 'nomination' ? 'wrongPhase' : textCheck(a.text);
    case 'endDay':
      return inCampaign ? null : 'wrongPhase';
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
    case 'publicWorks': {
      const cost = worksCost(a.issue);
      if (cost === null || (s.tolas[a.tola].grievances[a.issue] ?? 0) < 0.05) return 'nothingToFix';
      return s.cash >= cost ? null : 'notEnoughCash';
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
  opts: { reading?: Reading } = {},
): ActionResult {
  const error = validate(state, action);
  if (error) return { state, error };

  const s = structuredClone(state);
  const rng = createRng(s.rngState);
  const notes: PaNote[] = [];
  const reading = () => opts.reading ?? interpretFallback(s, 'text' in action ? action.text : '');

  switch (action.type) {
    case 'declare': {
      notes.push(...applyStatement(s, rng, action.text, reading(), 'declaration', null).notes);
      s.phase = 'campaign';
      break;
    }
    case 'statement':
      notes.push(...applyStatement(s, rng, action.text, reading(), 'pad', null).notes);
      break;
    case 'visit':
      notes.push(...applyStatement(s, rng, action.text, reading(), 'visit', action.tola).notes);
      break;
    case 'publicWorks':
      notes.push(...publicWorks(s, action.tola, action.issue));
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
    case 'beginCounting':
      s.counting = buildCounting(s, rng);
      s.phase = 'counting';
      break;
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

export { GROUPS, TOLAS };
