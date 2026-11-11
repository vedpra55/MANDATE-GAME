/**
 * All player-facing text lives here so Hindi can be added later without touching components.
 * Only English (with the PA's Hinglish flavour) for the MVP.
 */
import type {
  ActionError,
  Band,
  EndingTag,
  EndingTitle,
  GroupId,
  IssueId,
  RivalMove,
  TolaId,
} from '../engine/types.ts';

export const en = {
  title: 'MANDATE',
  tagline: 'Every vote has a price.',
  close: 'Close',
  back: 'Back',
  slots: ['Morning', 'Afternoon', 'Evening'],
  pa: 'Pintu',
  rival: 'Rajendra Babu',

  menu: {
    newGame: 'New game',
    continue: 'Continue',
    settings: 'Settings',
    settingsSoon: 'AI model settings arrive with the AI wiring.',
    formTitle: 'Nomination form',
    nameLabel: 'Your name',
    namePlaceholder: 'Write your name',
    addressLabel: 'How should the village address you?',
    file: 'File nomination',
  },

  tolas: {
    purvi: 'Purvi tola',
    paschim: 'Paschim tola',
    bazaar: 'Bazaar',
    pokhar: 'Pokhar tola',
    naya: 'Naya tola',
  } satisfies Record<TolaId, string>,

  groups: {
    farmers_w: 'farmer women',
    farmers_m: 'farmer men',
    labourers_w: 'labourer women',
    labourers_m: 'labourer men',
    youth_w: 'young women',
    youth_m: 'young men',
    traders_w: 'women traders',
    traders_m: 'the traders',
    elders_w: 'older women',
    elders_m: 'older men',
  } satisfies Record<GroupId, string>,

  issues: {
    water: 'water',
    roads: 'roads',
    irrigation: 'irrigation',
    crop_prices: 'crop prices',
    wages_work: 'work and wages',
    housing: 'housing',
    ration: 'rations',
    pensions: 'pensions',
    jobs_exams: 'jobs and exams',
    health: 'health',
    education: 'the school',
    safety: 'safety',
    corruption: 'corruption',
    electricity: 'electricity',
    credit: 'loans',
    sports: 'the playground',
    dignity: 'respect',
  } satisfies Record<IssueId, string>,

  works: {
    water: 'Repair the handpump',
    roads: 'Patch the worst stretch of road',
    irrigation: 'Repair the irrigation channel',
    electricity: 'Fix the street wiring',
    health: 'Hold a health camp',
    education: 'Books and benches for the school',
    safety: 'Put up street lights',
    sports: 'Level the playground',
    jobs_exams: 'Run a free coaching week',
    credit: 'Help the SHG with a loan guarantee',
    housing: 'Run a housing-form camp',
    ration: 'Sort out ration-card papers',
    pensions: 'Run a pension-form camp',
    wages_work: 'Run a job-card camp',
  } as Partial<Record<IssueId, string>>,

  bands: {
    veryAngry: 'very angry (bahut naraz)',
    unhappy: 'unhappy (naraz)',
    waiting: 'waiting to see (dekh rahe hain)',
    with: 'with you (saath hain)',
    solid: 'solidly with you (pakka saath)',
  } satisfies Record<Band, string>,

  grievance: (v: number) => (v >= 0.7 ? 'badly' : v >= 0.4 ? 'a lot' : 'a little'),

  calendar: {
    day: 'Day',
    daysToPoll: (n: number) => (n === 1 ? 'Last day: silence' : `${n} days to poll`),
    pollDay: 'Polling day',
    pollHint: 'Tear the page: go to the counting',
    tearHint: 'Tear the page to end the day',
  },

  errors: {
    wrongPhase: 'Not now.',
    noSlots: 'No time left today. Tear the calendar page.',
    notEnoughCash: 'Not enough money in the tin.',
    silencePeriod: 'Campaigning has stopped. Only quiet visits today.',
    emptyText: 'Write something first.',
    textTooLong: 'Too long. Keep it under 1,200 characters.',
    nothingToFix: 'Nothing to fix there.',
    invalidAmount: 'That amount makes no sense.',
  } satisfies Record<ActionError, string>,

  phone: { title: 'Messages', empty: 'No new messages.' },

  ledger: {
    promises: 'Promises made',
    favours: 'Favours owed',
    noPromises: 'No promises yet. Every one you make will be written here.',
    noFavours: 'You owe nobody. Yet.',
    colDay: 'Day',
    colPromise: 'Promise',
    colStatus: 'Status',
    colOwedTo: 'Owed to',
    colAsk: 'Their price',
    status: { open: 'open', kept: 'kept', broken: 'broken' },
    due: (day: number) => `due day ${day}`,
    ifElected: 'if elected',
  },

  newspaper: {
    masthead: 'Gram Samachar',
    edition: (day: number) => `Day ${day} · Local edition`,
    countdown: (n: number) =>
      n <= 0
        ? 'The village votes today.'
        : `The village votes in ${n} days. Tea stalls talk of little else.`,
    quote: 'Candidate says:',
  },

  writing: {
    title: 'Your statement',
    declareTitle: 'Why are you standing?',
    placeholder: 'Write what you will say to the village. English, Hindi or Hinglish.',
    stamp: 'Say it',
    declareStamp: 'Sign it',
    slotCost: 'Goes to the newspaper. Costs one part of the day.',
    declareCost: 'Free. Priya will remember it.',
  },

  diary: { title: "Pintu's notes", tally: 'My tally (rough)', village: 'Whole village' },
  files: { title: 'Janta darbar', hint: 'Hearings at the chaupal arrive in a later build.' },
  cash: { title: 'Cash in hand' },

  map: {
    title: 'The village',
    hint: 'Pick a tola to visit.',
    backToDesk: 'Back to the charpai',
    pintuSays: 'Pintu:',
    tally: (lo: number, hi: number) => `My rough tally: ${lo}–${hi}% with you.`,
    grievances: 'What hurts here',
    noGrievances: 'Nothing urgent right now.',
    visit: 'Go door to door',
    visitPlaceholder: 'What do you say at their doors?',
    works: 'Fix it yourself',
    gifts: 'Hand out money',
    giftsWarning: 'It works. It is also illegal, and phones have cameras.',
    recruit: 'Recruit workers',
    recruitYouth: 'Ask local youth',
    recruitStrongman: 'Bring in a strongman',
    slotsLeft: (n: number) => `${n} part${n === 1 ? '' : 's'} of the day left`,
    silence: 'Silence period: only quiet visits, works and money now.',
  },

  counting: {
    title: 'Counting',
    round: (r: number, of: number) => `Round ${r} of ${of}`,
    you: 'You',
    others: 'Others',
    total: 'Total',
    lead: (n: number) => `YOU LEAD BY ${n}`,
    trail: (n: number) => `TRAILING BY ${n}`,
    level: 'LEVEL',
    next: 'Next round',
    start: 'Open the first booth',
    result: 'See the result',
    lots: 'An exact tie. The returning officer draws lots.',
  },

  endings: {
    titles: {
      peoplesSarpanch: "The People's Sarpanch",
      giantKiller: 'The Giant-Killer',
      promiseMachine: 'The Promise Machine',
      boughtChair: 'The Bought Chair',
      divider: 'The Divider',
      wonByLottery: 'Won by Lottery',
      lostByLottery: 'Lost by Lottery',
      nearly: 'The Nearly-Man',
      outsider: 'The Outsider Who Stayed Outside',
      barred: 'Barred',
    } satisfies Record<EndingTitle, string>,
    nearlyWoman: 'The Nearly-Woman',
    lines: {
      peoplesSarpanch: 'Won on kept promises and clean hands.',
      giantKiller: 'Beat a twenty-year dynasty from far behind.',
      promiseMachine: "Won on promises. They'll be back to collect.",
      boughtChair: 'Won, with money that came from somewhere.',
      divider: 'Turned neighbours against each other. The village will remember.',
      wonByLottery: 'An exact tie, decided by a slip of paper.',
      lostByLottery: 'An exact tie, decided by a slip of paper. Not yours.',
      nearly: 'So close that every wasted morning hurts.',
      outsider: 'The old family never had to worry.',
      barred: 'Disqualified before the village could vote.',
    } satisfies Record<EndingTitle, string>,
    tags: {
      favoursOwed: 'Favours owed',
      fir: 'FIR pending',
      notice: 'EC notice on file',
      brokenPromises: 'Broken promises',
      openPromises: 'Open promises',
      giftsFilmed: 'Caught on video',
    } satisfies Record<EndingTag, string>,
    masthead: 'Gram Samachar · Result special',
    decided: 'What decided it',
    helped: 'helped',
    hurt: 'hurt',
    votes: (n: number) => `about ${n} vote${n === 1 ? '' : 's'}`,
    ledger: (made: number, kept: number, broken: number, open: number) =>
      `${made} promises made: ${kept} kept, ${broken} broken, ${open} still open.`,
    result: (you: number, rival: number, others: number) =>
      `You ${you} · Rajendra Babu ${rival} · Others ${others}`,
    playAgain: 'Play again',
    toTitle: 'Back to the title',
  },

  rivalMoves: {
    doorToDoor: (t: string) => `Rajendra Babu's people went door to door in ${t}.`,
    sweets: (t: string) => `Sweets from the old family in ${t} last night.`,
    counterIssue: (_t: string, i: string) => `Rajendra Babu has started talking about ${i} too.`,
    attackPromise: (_t: string, i: string) =>
      `Rajendra Babu is telling everyone about your broken ${i} promise.`,
    rally: () => 'Rajendra Babu held a big rally. People were bussed in.',
    mockPromises: () => "Rajendra Babu is laughing at your promises: 'Itna paisa kahan se aayega?'",
    lieLow: () => '',
    lastNight: (t: string) => `Envelopes went round in ${t} last night.`,
  } satisfies Record<RivalMove, (tola: string, issue: string) => string>,
} as const;

export type Strings = typeof en;
export const strings: Strings = en;
