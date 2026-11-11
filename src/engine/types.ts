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

export const FAULT_LINES = ['pond', 'wages', 'plot', 'bazaarRoad', 'rationShop', 'kiln'] as const;
export type FaultLineId = (typeof FAULT_LINES)[number];
/** Where a statement stands on a fault line. */
export type Stance = 'none' | 'side_a' | 'side_b' | 'win_win' | 'evasive';
export type ArchetypeId = 'dynast' | 'firebrand' | 'technocrat';

export type Phase = 'nomination' | 'campaign' | 'polling' | 'counting' | 'ended';
export type Address = 'bhaiya' | 'didi';
export type Tone = 'policy' | 'emotional' | 'humble' | 'aggressive' | 'evasive' | 'divisive';
export type Channel = 'declaration' | 'pad' | 'visit' | 'answer';
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
  /** Stance on each fault line the text touches; quality 0..3 rates a win-win's credibility. */
  faultLines: Partial<Record<FaultLineId, { stance: Stance; confidence: number; quality: number }>>;
  /** Probability the speaker asks about and listens to people's problems (reveals the village). */
  listens: number;
  /** Probability the speaker openly admits changing a position ("I was wrong about…"). */
  changesMind: number;
  source: 'ai' | 'fallback';
};

/** How the player answered a phone call (the donor). */
export type CallReply = 'accept' | 'refuse' | 'negotiate' | 'stall';
export type CallReading = { reply: CallReply; confidence: number; source: 'ai' | 'fallback' };

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
  lastVisit: number; // day the player last went door to door here (0 = never)
  rivalLastVisit: number;
};

export type FaultLineData = {
  id: FaultLineId;
  issue: IssueId;
  topic: string[];
  hot: Partial<Record<TolaId, 'side_a' | 'side_b'>>;
  sideA: { groups: Partial<Record<BlocId, number>>; words: string[] };
  sideB: { groups: Partial<Record<BlocId, number>>; words: string[] };
  winWin: { elements: string[][]; cost: number; days: number };
  describe: { topic: string; sideA: string; sideB: string; winWin: string; question: string };
};

/** A public position, as the village remembers it. */
/** The last thing the player said in public on a fault line, whatever it was (shown in the diary). */
export type PublicWord = {
  word: 'side_a' | 'side_b' | 'win_win' | 'win_win_doubted' | 'evasive' | 'silent';
  day: number;
};

export type StanceRecord = {
  stance: 'side_a' | 'side_b' | 'win_win';
  day: number;
  statementId: number;
};

export type Project = {
  id: number;
  tola: TolaId;
  issue: IssueId | null;
  faultLine: FaultLineId | null;
  cost: number;
  startDay: number;
  dueDay: number; // what the contractor promised
  doneDay: number; // when it will really finish (hidden until then)
  status: 'building' | 'done';
};

/** A question the player must answer: the rival's wedge or the donor's demand. */
export type PendingQuestion = {
  faultLine: FaultLineId;
  by: 'rival' | 'donor';
  askedDay: number;
  dueDay: number;
};
export type PendingCall = { kind: 'donorOffer'; day: number; dueDay: number };

export type DonorState = 'none' | 'offered' | 'accepted' | 'negotiated' | 'refused' | 'angry';

export type LedgerPromise = {
  id: number;
  faultLine?: FaultLineId;
  day: number;
  text: string;
  issue: IssueId;
  tola: TolaId | null;
  when: 'during_campaign' | 'if_elected';
  deadlineDay: number | null;
  /**
   * Who set the date: your own words, you on the slip, or nobody yet (a provisional date the
   * engine picked; Pintu asks "Kab tak, bhaiya?"). Missing on older saves = words.
   */
  dateSource?: 'words' | 'player' | 'default';
  dateChanges?: number;
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
  /** The reading the engine used (the AI tape: replaying it reproduces the game). */
  reading?: Reading;
  /** AI-written reactions, attached after the engine resolved the statement. Presentation only. */
  voices?: { pa?: string; quotes?: { who: string; text: string }[] };
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
  | 'rivalDoubt'
  | 'rivalAttackDodge'
  | 'rivalRally'
  | 'rivalLastNight'
  | 'stance'
  | 'evasion'
  | 'contradiction'
  | 'worksStarted'
  | 'worksDone'
  | 'solutionDelivered'
  | 'rivalWedge'
  | 'silence'
  | 'neglect'
  | 'donorAccepted'
  | 'donorRefused'
  | 'favourLeaked'
  | 'donorAngry'
  | 'promiseDated'
  | 'promiseDateChanged';

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
  faultLine?: FaultLineId;
  stance?: Stance;
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
  | {
      day: number;
      kind: 'promiseNoted';
      issue: IssueId;
      deadlineDay: number | null;
      needsDate?: boolean;
    }
  | { day: number; kind: 'promiseDateChanged'; issue: IssueId }
  | { day: number; kind: 'promiseKept'; issue: IssueId; tola: TolaId | null }
  | { day: number; kind: 'promiseBroken'; issue: IssueId; tola: TolaId | null }
  | { day: number; kind: 'deadlineSoon'; issue: IssueId; daysLeft: number }
  | { day: number; kind: 'heatWarning' }
  | { day: number; kind: 'notice' }
  | { day: number; kind: 'fir' }
  | { day: number; kind: 'giftsFilmed'; tola: TolaId }
  | { day: number; kind: 'divisive' }
  | { day: number; kind: 'cadreUnpaid' }
  | {
      day: number;
      kind: 'rivalMove';
      move: RivalMove;
      tola?: TolaId;
      issue?: IssueId;
      faultLine?: FaultLineId;
    }
  | { day: number; kind: 'silence' }
  | { day: number; kind: 'lastNight'; tola: TolaId }
  | { day: number; kind: 'pollingDay' }
  | { day: number; kind: 'stanceTaken'; faultLine: FaultLineId; stance: Stance }
  | { day: number; kind: 'notBelieved'; faultLine: FaultLineId }
  | { day: number; kind: 'contradiction'; faultLine: FaultLineId }
  | { day: number; kind: 'learned'; tola: TolaId; issues: IssueId[]; faultLines: FaultLineId[] }
  | { day: number; kind: 'wedge'; faultLine: FaultLineId }
  | { day: number; kind: 'silent'; faultLine: FaultLineId }
  | { day: number; kind: 'neglect'; tola: TolaId }
  | { day: number; kind: 'worksStarted'; tola: TolaId; dueDay: number }
  | {
      day: number;
      kind: 'worksDone';
      tola: TolaId;
      issue: IssueId | null;
      faultLine: FaultLineId | null;
    }
  | { day: number; kind: 'worksLate'; tola: TolaId }
  | { day: number; kind: 'donorCall' }
  | { day: number; kind: 'donorDemand'; faultLine: FaultLineId }
  | { day: number; kind: 'donorResult'; result: DonorState }
  | { day: number; kind: 'favourLeaked' }
  | { day: number; kind: 'boothsUnmanned'; count: number };

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
  | 'pollingDay'
  | 'stance'
  | 'dodge'
  | 'contradiction'
  | 'wedge'
  | 'silent'
  | 'worksDone'
  | 'solution'
  | 'favourLeaked';

/** Tomorrow's newspaper. Structured; the UI writes the headline. */
export type Story = {
  day: number;
  kind: StoryKind;
  tola?: TolaId;
  issue?: IssueId;
  faultLine?: FaultLineId;
  stance?: Stance;
};

export type RivalMove =
  | 'doorToDoor'
  | 'sweets'
  | 'counterIssue'
  | 'attackPromise'
  | 'rally'
  | 'lieLow'
  | 'mockPromises'
  | 'doubtSolution'
  | 'attackDodge'
  | 'lastNight';

export type RivalState = {
  archetype: ArchetypeId;
  name: string;
  cash: number;
  heat: number;
  reputation: number;
  rallyDone: boolean;
  attackedDodges: FaultLineId[];
  attackedPromiseIds: number[];
  lastMockDay: number;
  lastWedgeDay: number;
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
  | 'favoursOwed'
  | 'fir'
  | 'notice'
  | 'brokenPromises'
  | 'openPromises'
  | 'giftsFilmed'
  | 'contradictions';

export type Decider = {
  logId: number;
  kind: LogKind;
  actor: LogEntry['actor'];
  tola?: TolaId;
  issue?: IssueId;
  faultLine?: FaultLineId;
  stance?: Stance;
  day: number;
  impact: number;
  /** How many log entries were grouped into this line ("twice"). */
  count: number;
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
  faultLines: FaultLineId[]; // the conflicts that exist in this village
  stances: Partial<Record<FaultLineId, StanceRecord>>; // the player's public positions
  publicWord: Partial<Record<FaultLineId, PublicWord>>; // what you last said, dodges included
  asked: FaultLineId[]; // fault lines the rival has already asked about (never twice)
  known: {
    grievances: Record<TolaId, IssueId[]>;
    faultLines: FaultLineId[];
    level: Record<TolaId, number>; // 0..1, how well Pintu knows this tola
  };
  pollBias: Record<TolaId, number>; // Pintu's systematic error per tola, shrinks with knowledge
  projects: Project[];
  pending: { question: PendingQuestion | null; call: PendingCall | null };
  donor: { state: DonorState; demandMade: boolean };
  boothPlan: Record<TolaId, number> | null;
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
    contradictions: number;
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
  | { type: 'answer'; text: string }
  | { type: 'answerCall'; text: string }
  | { type: 'deliver'; faultLine: FaultLineId }
  /** Choose when an open promise is due: a campaign day, or null for "after I win". No slot. */
  | { type: 'setPromiseDate'; id: number; day: number | null }
  | { type: 'assignBooths'; plan: Record<TolaId, number> }
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
  | 'invalidAmount'
  | 'nothingPending'
  | 'unknownGrievance'
  | 'alreadyBuilding'
  | 'tooManyWorkers';
