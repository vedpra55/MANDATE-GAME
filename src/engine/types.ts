/**
 * Core types of the game engine. Pure data, no behaviour.
 * See docs/ENGINE.md §3–4 for the model these describe.
 */
import type { Clock } from './clock.ts';

export const BLOCS = ['farmers', 'labourers', 'youth', 'traders', 'elders'] as const;
export type BlocId = (typeof BLOCS)[number];

export const GENDERS = ['w', 'm'] as const;
export type Gender = (typeof GENDERS)[number];

/** A voter group: one bloc, one gender. 10 in total. */
export type GroupId = `${BlocId}_${Gender}`;
export const GROUPS: readonly GroupId[] = BLOCS.flatMap((b) =>
  GENDERS.map((g) => `${b}_${g}` as GroupId),
);

export const TOLAS = ['purvi', 'paschim', 'bazaar', 'pokhar', 'naya'] as const;
export type TolaId = (typeof TOLAS)[number];

export const ISSUES = [
  'water',
  'roads',
  'irrigation',
  'crop_prices',
  'wages_work',
  'housing',
  'ration',
  'pensions',
  'jobs_exams',
  'health',
  'education',
  'safety',
  'corruption',
  'electricity',
  'credit',
  'sports',
  'dignity',
] as const;
export type IssueId = (typeof ISSUES)[number];

export type Phase = 'nomination' | 'campaign' | 'polling' | 'counting' | 'ended';
export type Address = 'bhaiya' | 'didi';
export type Tone = 'policy' | 'emotional' | 'humble' | 'aggressive' | 'evasive' | 'divisive';
export type Channel = 'declaration' | 'pad' | 'visit';
export type Language = 'hindi' | 'english' | 'hinglish' | 'other';
export type IntentAction =
  'none' | 'public_works' | 'cash_help' | 'visit' | 'rally' | 'recruit' | 'other';

/**
 * What the engine needs to know about a piece of player text. In E4 this comes from the
 * Decisions API; until then (and whenever the API fails) from the offline fallback interpreter.
 */
export type Reading = {
  reactions: Record<GroupId, { score: number; confidence: number }>; // score 0..4
  issues: Partial<Record<IssueId, number>>; // 0 not mentioned … 3 concrete commitment
  tone: Tone;
  specificity: number; // 0..3
  containsPromise: number; // probability
  risks: {
    inflammatory: number;
    defamatory: number;
    falseClaim: number;
    unconstitutional: number;
    voteBuying: number;
  };
  addressesEvaluator: number; // probability the text tries to instruct the game/judge
  coherent: number; // probability it is a coherent message to villagers
  language: Language;
  intentAction: IntentAction;
  source: 'ai' | 'fallback';
};

export type GroupState = {
  trust: number; // toward the player, -100..100
  rivalTrust: number; // toward the rival, -100..100
  baseRivalTrust: number; // where rival trust drifts back to
  baseTurnout: number; // 0..1
  issueWeights: Partial<Record<IssueId, number>>; // sums to 1
  trustCap: number; // lowered permanently by divisive politics
  turnoutPenalty: number; // fear
};

export type TolaState = {
  voters: Record<GroupId, number>;
  mood: number; // local feeling toward the player, -100..100
  rivalMood: number;
  grievances: Partial<Record<IssueId, number>>; // 0..1
  cadreCoverage: number; // 0..1
  rivalCoverage: number; // 0..1
  neighbours: TolaId[];
};

export type LedgerPromise = {
  id: number;
  day: number;
  text: string;
  issue: IssueId;
  tola: TolaId | null;
  when: 'during_campaign' | 'if_elected';
  deadlineDay: number | null;
  cost: number;
  status: 'open' | 'kept' | 'broken';
  beneficiaries: GroupId[];
};

export type Favour = {
  id: number;
  day: number;
  creditor: string;
  ask: string;
  amount: number;
  danger: number;
  leakChancePerDay: number;
  leaked: boolean;
};

export type RiskFlag =
  'inflammatory' | 'defamatory' | 'false_claim' | 'unconstitutional' | 'vote_buying';

export type Statement = {
  id: number;
  day: number;
  slot: number;
  channel: Channel;
  tola: TolaId | null;
  text: string;
  issues: IssueId[];
  tone: Tone;
  flags: RiskFlag[];
  source: 'ai' | 'fallback';
};

/** A change to the world. Every change is logged so the end card can say what decided the result. */
export type Effect = {
  trust?: Partial<Record<GroupId, number>>;
  rivalTrust?: Partial<Record<GroupId, number>>;
  mood?: Partial<Record<TolaId, number>>;
  rivalMood?: Partial<Record<TolaId, number>>;
  heat?: number;
  reputation?: number;
  rivalReputation?: number;
  credibility?: number;
  cash?: number;
  rivalCash?: number;
};

export type LogKind =
  | 'declaration'
  | 'statement'
  | 'visit'
  | 'publicWorks'
  | 'gifts'
  | 'giftsFilmed'
  | 'recruit'
  | 'promiseKept'
  | 'promiseBroken'
  | 'divisive'
  | 'notice'
  | 'fir'
  | 'communalTension'
  | 'cadreUnpaid'
  | 'rivalDoorToDoor'
  | 'rivalSweets'
  | 'rivalCounterIssue'
  | 'rivalAttack'
  | 'rivalMock'
  | 'rivalRally'
  | 'rivalLastNight';

export type LogEntry = {
  id: number;
  day: number;
  slot: number;
  actor: 'player' | 'rival' | 'world';
  kind: LogKind;
  tola?: TolaId;
  issue?: IssueId;
  amount?: number;
  statementId?: number;
  promiseId?: number;
  effect: Effect;
};

export type Band = 'veryAngry' | 'unhappy' | 'waiting' | 'with' | 'solid';

/** What the PA writes in the diary. Structured; the UI turns it into words. */
export type PaNote =
  | { day: number; kind: 'welcome' }
  | { day: number; kind: 'groupShift'; group: GroupId; band: Band; up: boolean }
  | { day: number; kind: 'tolaShift'; tola: TolaId; band: Band; up: boolean }
  | { day: number; kind: 'confused' }
  | { day: number; kind: 'noEffect' }
  | { day: number; kind: 'promiseNoted'; issue: IssueId; deadlineDay: number | null }
  | { day: number; kind: 'promiseKept'; issue: IssueId; tola: TolaId | null }
  | { day: number; kind: 'promiseBroken'; issue: IssueId; tola: TolaId | null }
  | { day: number; kind: 'deadlineSoon'; issue: IssueId; daysLeft: number }
  | { day: number; kind: 'heatWarning' }
  | { day: number; kind: 'notice' }
  | { day: number; kind: 'fir' }
  | { day: number; kind: 'giftsFilmed'; tola: TolaId }
  | { day: number; kind: 'divisive' }
  | { day: number; kind: 'cadreUnpaid' }
  | { day: number; kind: 'rivalMove'; move: RivalMove; tola?: TolaId; issue?: IssueId }
  | { day: number; kind: 'silence' }
  | { day: number; kind: 'lastNight'; tola: TolaId }
  | { day: number; kind: 'pollingDay' };

export type StoryKind =
  | 'quiet'
  | 'statement'
  | 'visit'
  | 'publicWorks'
  | 'giftsFilmed'
  | 'promiseBroken'
  | 'promiseKept'
  | 'divisive'
  | 'notice'
  | 'fir'
  | 'rivalSweets'
  | 'rivalRally'
  | 'rivalAttack'
  | 'rivalLastNight'
  | 'pollingDay';

/** Tomorrow's newspaper. Structured; the UI writes the headline. */
export type Story = { day: number; kind: StoryKind; tola?: TolaId; issue?: IssueId };

export type RivalMove =
  | 'doorToDoor'
  | 'sweets'
  | 'counterIssue'
  | 'attackPromise'
  | 'rally'
  | 'lieLow'
  | 'mockPromises'
  | 'lastNight';

export type RivalState = {
  name: string;
  cash: number;
  heat: number;
  reputation: number;
  rallyDone: boolean;
  attackedPromiseIds: number[];
  lastMockDay: number;
  /** What the rival has learned about the player: issue focus counts, aggression. */
  memory: { issueFocus: Partial<Record<IssueId, number>>; aggression: number };
};

export type CountingRound = {
  tola: TolaId;
  player: number;
  rival: number;
  others: number;
};

export type CountingState = {
  rounds: CountingRound[];
  revealed: number;
  tieBrokenByLots: boolean;
  winner: 'player' | 'rival';
};

export type EndingTitle =
  | 'peoplesSarpanch'
  | 'giantKiller'
  | 'promiseMachine'
  | 'boughtChair'
  | 'divider'
  | 'wonByLottery'
  | 'lostByLottery'
  | 'nearly'
  | 'outsider'
  | 'barred';

export type EndingTag =
  'favoursOwed' | 'fir' | 'notice' | 'brokenPromises' | 'openPromises' | 'giftsFilmed';

export type Decider = {
  logId: number;
  kind: LogKind;
  actor: LogEntry['actor'];
  tola?: TolaId;
  issue?: IssueId;
  day: number;
  impact: number;
};

export type GameResult = {
  title: EndingTitle;
  tags: EndingTag[];
  won: boolean;
  playerVotes: number;
  rivalVotes: number;
  otherVotes: number;
  margin: number; // player − rival votes
  deciders: Decider[];
  promises: { made: number; kept: number; broken: number; open: number };
};

export type GameState = {
  version: 1;
  seed: number;
  rngState: number;
  regionId: string;
  player: { name: string; address: Address };
  phase: Phase;
  clock: Clock;
  cash: number;
  reputation: number; // -100..100
  legalHeat: number; // 0..100
  credibility: number; // 0.3..1.2
  cadre: { size: number; loyalty: number; strongmen: number };
  groups: Record<GroupId, GroupState>;
  tolas: Record<TolaId, TolaState>;
  rival: RivalState;
  promises: LedgerPromise[];
  favours: Favour[];
  statements: Statement[];
  log: LogEntry[];
  paNotes: PaNote[];
  stories: Story[];
  flags: {
    noticeIssued: boolean;
    firFiled: boolean;
    firSlotPenalty: boolean;
    disqualified: boolean;
    divisiveUsed: boolean;
    giftsTotal: number;
    giftsFilmed: number;
    lastNightTola: TolaId | null;
    pendingFilming: { tola: TolaId; chance: number }[];
    pendingTension: number | null; // day a communal tension event fires
    initialMargin: number; // expected vote share margin at the start (for "giant-killer")
  };
  counting: CountingState | null;
  result: GameResult | null;
  nextId: number;
};

export type Action =
  | { type: 'declare'; text: string }
  | { type: 'statement'; text: string }
  | { type: 'visit'; tola: TolaId; text: string }
  | { type: 'publicWorks'; tola: TolaId; issue: IssueId }
  | { type: 'gifts'; tola: TolaId; amount: number }
  | { type: 'recruit'; tola: TolaId; strongman: boolean }
  | { type: 'endDay' }
  | { type: 'beginCounting' }
  | { type: 'revealRound' };

export type ActionError =
  | 'wrongPhase'
  | 'noSlots'
  | 'notEnoughCash'
  | 'silencePeriod'
  | 'emptyText'
  | 'textTooLong'
  | 'nothingToFix'
  | 'invalidAmount';
