/**
 * A new game: the village is generated from the seed within the region's real bounds, so no two
 * campaigns are the same (docs/CHALLENGE.md §3.2): tola sizes, who lives where, what hurts, which
 * fault lines divide the village, and which kind of rival you face.
 */
import { createClock } from './clock.ts';
import { createRng, type Rng } from './rng.ts';
import {
  BLOCS,
  FAULT_LINES,
  GENDERS,
  ISSUES,
  TOLAS,
  type Address,
  type ArchetypeId,
  type BlocId,
  type FaultLineId,
  type GameState,
  type GroupId,
  type GroupState,
  type IssueId,
  type TolaId,
  type TolaState,
} from './types.ts';
import { ARCHETYPES, FAULT_LINE_DATA, REGION } from './world.ts';
import { computeCells, margin, totals } from './vote.ts';

type BlocData = {
  baseTurnout: number;
  playerTrust: number;
  rivalTrust: number;
  issues: Partial<Record<IssueId, number>>;
};
type TolaData = {
  voters: number;
  blocs: Record<BlocId, number>;
  grievances: Partial<Record<IssueId, number>>;
  neighbours: TolaId[];
  rivalMood: number;
  rivalCoverage: number;
};

const EXTRA_GRIEVANCES: IssueId[] = [
  'health',
  'education',
  'electricity',
  'safety',
  'ration',
  'pensions',
  'roads',
  'water',
];

function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const jitter = (rng: Rng, v: number, rel: number) => v * (1 + (rng.next() * 2 - 1) * rel);

export type NewGameOptions = {
  seed: number;
  name: string;
  address: Address;
  archetype?: ArchetypeId;
  varied?: boolean;
};

export function newGame(opts: NewGameOptions): GameState {
  const varied = opts.varied ?? true;
  const rng = createRng((opts.seed ^ 0x9e3779b9) >>> 0);
  const archetypeId: ArchetypeId =
    opts.archetype ?? (['dynast', 'firebrand', 'technocrat'] as const)[varied ? rng.int(0, 2) : 0]!;
  const arch = ARCHETYPES[archetypeId];
  const blocs = REGION.blocs as Record<BlocId, BlocData>;
  const women = REGION.women as {
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
      const rivalTrust =
        data.rivalTrust + (arch.trustShift[b] ?? 0) + (gender === 'w' ? women.rivalTrustDelta : 0);
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

  const tolaData = REGION.tolas as Record<TolaId, TolaData>;
  const tolas = {} as Record<TolaId, TolaState>;
  for (const t of TOLAS) {
    const d = tolaData[t];
    const total = varied ? jitter(rng, d.voters, 0.12) : d.voters;
    const shares = {} as Record<BlocId, number>;
    let shareSum = 0;
    for (const b of BLOCS) {
      shares[b] = varied ? jitter(rng, d.blocs[b], 0.25) : d.blocs[b];
      shareSum += shares[b];
    }
    const voters = {} as Record<GroupId, number>;
    for (const b of BLOCS) {
      voters[`${b}_w`] = Math.round((total * shares[b] * women.share) / shareSum);
      voters[`${b}_m`] = Math.round((total * shares[b] * (1 - women.share)) / shareSum);
    }
    const grievances: Partial<Record<IssueId, number>> = {};
    for (const [issue, g] of Object.entries(d.grievances) as [IssueId, number][]) {
      grievances[issue] = varied ? Math.min(1, Math.max(0.2, g + (rng.next() * 0.3 - 0.15))) : g;
    }
    if (varied) {
      const extra = shuffle(rng, EXTRA_GRIEVANCES).find((i) => !(i in grievances));
      if (extra) grievances[extra] = 0.3 + rng.next() * 0.3;
    }
    tolas[t] = {
      voters,
      mood: 0,
      rivalMood: d.rivalMood,
      grievances,
      cadreCoverage: 0,
      rivalCoverage: d.rivalCoverage,
      neighbours: d.neighbours,
      lastVisit: 0,
      rivalLastVisit: 0,
    };
  }

  const faultLines: FaultLineId[] = varied
    ? shuffle(rng, FAULT_LINES).slice(0, 3)
    : ['pond', 'wages', 'kiln'];
  // Fault lines make their issue hurt in the tolas where they are hot.
  for (const fl of faultLines) {
    for (const t of Object.keys(FAULT_LINE_DATA[fl].hot) as TolaId[]) {
      const issue = FAULT_LINE_DATA[fl].issue;
      tolas[t].grievances[issue] = Math.max(tolas[t].grievances[issue] ?? 0, 0.5);
    }
  }

  // Pintu starts with rumours: the worst problem in two tolas, and the loudest fault line.
  const known = {
    grievances: Object.fromEntries(TOLAS.map((t) => [t, [] as IssueId[]])) as Record<
      TolaId,
      IssueId[]
    >,
    faultLines: [faultLines[0]!] as FaultLineId[],
    level: Object.fromEntries(TOLAS.map((t) => [t, 0.15])) as Record<TolaId, number>,
  };
  for (const t of shuffle(rng, TOLAS).slice(0, 2)) {
    const top = (Object.entries(tolas[t].grievances) as [IssueId, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (top) known.grievances[t].push(top[0]);
  }
  const pollBias = Object.fromEntries(
    TOLAS.map((t) => [t, varied ? rng.normal() * 7 : 0]),
  ) as Record<TolaId, number>;

  const state: GameState = {
    version: 1,
    seed: opts.seed,
    rngState: opts.seed >>> 0,
    regionId: REGION.id,
    player: { name: opts.name.trim() || 'Candidate', address: opts.address },
    phase: 'nomination',
    clock: createClock(REGION.campaignDays),
    cash: REGION.startCash,
    reputation: 0,
    legalHeat: 0,
    credibility: 1,
    cadre: { ...REGION.startCadre, strongmen: 0 },
    groups,
    tolas,
    rival: {
      archetype: archetypeId,
      name: arch.name,
      cash: arch.cash,
      heat: 0,
      reputation: arch.reputation,
      rallyDone: false,
      attackedDodges: [],
      promises: [],
      outbidBy: [],
      attackedPromiseIds: [],
      lastMockDay: -99,
      lastWedgeDay: 0,
      memory: { issueFocus: {}, aggression: 0 },
    },
    faultLines,
    stances: {},
    publicWord: {},
    asked: [],
    known,
    pollBias,
    projects: [],
    pending: { question: null, call: null },
    donor: { state: 'none', demandMade: false },
    boothPlan: null,
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
      contradictions: 0,
      debate: null,
      leadersMet: {},
    },
    counting: null,
    result: null,
    nextId: 1,
  };
  state.flags.initialMargin = margin(totals(computeCells(state)));
  return state;
}

export { ISSUES };
