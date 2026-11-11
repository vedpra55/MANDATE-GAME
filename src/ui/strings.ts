/**
 * All player-facing text lives here so Hindi can be added later without touching components.
 * Only English (with the PA's Hinglish flavour) for the MVP.
 */
import type {
  ActionError,
  Band,
  EndingTag,
  EndingTitle,
  FaultLineId,
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
    nothingPending: 'Nobody is waiting for an answer.',
    unknownGrievance: "You don't know that problem yet. Go and listen first.",
    alreadyBuilding: 'Work is already going on there.',
    tooManyWorkers: "You don't have that many workers.",
    needWorkers: 'You need more workers for that. Recruit some first.',
    notHere: "That can't be done here.",
    alreadyDone: 'Not again so soon.',
  } satisfies Record<ActionError, string>,

  faultLines: {
    pond: {
      name: 'The pond',
      a: 'Protect the homes on the pond land',
      b: 'Clear the encroachment for the farmers',
    },
    wages: {
      name: 'Harvest wages',
      a: "Raise the labourers' wage",
      b: 'Back the farmers: wages stay',
    },
    plot: {
      name: 'The panchayat plot',
      a: 'A playground for the youth',
      b: 'A hall for the elders',
    },
    bazaarRoad: {
      name: 'The bazaar road',
      a: 'Widen it, stalls must go',
      b: 'Protect the vendors',
    },
    rationShop: { name: 'The ration shop', a: 'Act against the dealer', b: 'Defend the dealer' },
    kiln: {
      name: 'The brick kiln',
      a: 'Keep it for the jobs',
      b: 'Close it for fields and health',
    },
  } satisfies Record<FaultLineId, { name: string; a: string; b: string }>,
  stanceWords: {
    side_a: 'you sided with',
    side_b: 'you sided with',
    win_win: 'you offered a way for both',
    none: '',
    evasive: 'you dodged it',
  },

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
    noDate: 'when? set a date',
    changeDate: 'Choose or change the date',
    kabTak: 'Kab tak, {address}? Pick the day you will have it done, or after the win.',
    changeWarning: 'You already gave a date. Moving it is public: people will notice.',
    afterWin: 'After I win',
    kabTakShort: 'Kab tak? You promised it but did not say when.',
    openSlip: 'Set the date',
    dateHint:
      'A near date is believed more, and is harder to keep. "After I win" costs nothing today.',
  },

  newspaper: {
    masthead: 'Gram Samachar',
    edition: (day: number) => `Day ${day} · Local edition`,
    countdown: (n: number) =>
      n <= 0
        ? 'The village votes today.'
        : `The village votes in ${n} days. Tea stalls talk of little else.`,
    quote: 'Candidate says:',
    rivalColumn: (r: string) => `${r} promises`,
    rivalNone: (r: string) => `${r} has promised nothing in particular yet.`,
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

  diary: {
    title: "Pintu's notes",
    tally: 'My tally (rough)',
    village: 'Whole village',
    divides: 'What divides the village',
    unknownDivides: "There may be more fights I don't know about yet.",
    yourWord: 'Your word:',
    rivalPromises: (r: string) => `What ${r} has promised`,
    meTooMark: 'you said it first',
    words: {
      win_win: 'a way for both sides (believed)',
      win_win_doubted: "you offered a compromise, but people don't believe it yet",
      evasive: 'you dodged it',
      silent: 'you stayed silent',
    },
    noPosition: 'you have said nothing yet',
    works: 'Work going on',
    due: (d: number) => `due day ${d}`,
  },
  phone: {
    title: 'Messages',
    reply: 'Reply',
    send: 'Send',
    placeholder: 'Type your reply…',
    donorFrom: 'Mahesh-ji (contractor)',
    donorOffer:
      'Namaste. I like what you are doing. ₹35,000 for your campaign, today. When you win, we will talk about a small favour. Haan ya na?',
    donorDemand:
      'Bhaiya-ji, now I need one small thing. Say in public that the brick kiln stays. My workers need it. You understand.',
    priyaFrom: 'Priya (Gaon Ki Awaaz)',
    wedge: (rival: string, q: string) =>
      `${rival} said this at the chowk today: "${q}" Your answer, on record?`,
    dueToday: 'Answer today. Silence will be reported.',
  },
  thinking: 'Pintu is listening…',
  guide: {
    title: 'How to play',
    open: 'How to play',
    deskTag: 'Kaise khelein?',
    close: 'Back',
  },
  dusk: {
    text: 'Shaam ho gayi. The day is done…',
    wait: 'Wait',
    auto: 'End the day by itself when I have nothing left to do',
  },
  files: { title: 'Janta darbar', hint: 'Hearings at the chaupal arrive in a later build.' },
  cash: { title: 'Cash in hand' },

  map: {
    modes: {
      visit: 'Door to door',
      chai: 'Chai pe charcha',
      sabha: 'Nukkad sabha',
      leader: (name: string) => `Sit with ${name}`,
      debate: (rival: string) => `Debate ${rival}`,
    },
    modeHelp: {
      visit: "1 slot, free. Go to people's doors; ask, listen, promise.",
      chai: '1 slot, ₹300 for the tea. A small group at the stall: you learn a lot; the young and the traders listen most.',
      sabha:
        '2 slots, ₹2,000 (needs 3+ workers to gather people). A short speech to a crowd: a bigger audience than door to door. Not on the silent day.',
      leader: (name: string, about: string) =>
        `1 slot, free. One to one with ${name} (${about}). Win them and their people hear it through them; bore them and they say so.`,
      debate: (rival: string) =>
        `2 slots, once, from day 5. You and ${rival} face the village at the chowk. Whoever convinces a group takes it from the other. High risk.`,
    },
    sweets: 'Tea and sweets for the crowd',
    sweetsNone: 'None',
    leaderMet: (name: string, day: number) => `You last sat with ${name} on day ${day}.`,
    deeds: 'Be there',
    play: {
      cricket: 'Play cricket with the young ones on the ground (1 slot)',
      school: 'Spend an hour at the school (1 slot)',
    },
    shramdaan: 'Shramdaan with your workers',
    shramdaanHelp: (n: number) =>
      `Shramdaan: clean up a lane or the pond edge with your workers. 1 slot; needs 5 workers, you have ${n}.`,
    debatePlaceholder: (rival: string) =>
      `What will you say to the village, face to face with ${rival}?`,
    debateDone: (won: number) => `The debate is over. You won over ${won} of 10 groups.`,
    people: 'People you know here',
    rivalWasHere: (r: string) => `${r}'s people were here and promised this`,
    title: 'The village',
    hint: 'Pick a tola to visit.',
    backToDesk: 'Back to the charpai',
    pintuSays: 'Pintu:',
    tally: (lo: number, hi: number) => `My rough tally: ${lo}–${hi}% with you.`,
    grievances: 'What hurts here',
    noGrievances: 'Nothing urgent right now.',
    visit: 'Go door to door',
    unknown: "Pintu: I don't know what hurts here yet. Go and listen: ask people.",
    deliver: 'Make your compromise happen',
    building: (d: number) => `work under way, due day ${d}`,
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

  booths: {
    title: 'Polling day: who goes where?',
    hint: 'Your workers bring your voters out. A booth with nobody of yours loses votes.',
    workersLeft: (n: number) => `${n} worker${n === 1 ? '' : 's'} left`,
    go: 'Send them out',
  },

  settings: {
    title: 'Settings: AI models',
    aiOn: 'AI on',
    aiOff: 'AI off (offline play)',
    noKey: 'No OpenAI key on the server: the game plays offline.',
    readOnly: 'Settings are read-only here.',
    save: 'Save',
    saved: 'Saved.',
    enabled: 'on',
    unreachable: 'The game server is not running: the game plays offline.',
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
      contradictions: 'Said two things',
    } satisfies Record<EndingTag, string>,
    masthead: 'Gram Samachar · Result special',
    decided: 'What decided it',
    helped: 'helped',
    hurt: 'hurt',
    votes: (n: number) => `about ${n} vote${n === 1 ? '' : 's'}`,
    times: (n: number) => (n === 2 ? 'twice' : `${n} times`),
    ledger: (made: number, kept: number, broken: number, open: number) =>
      `${made} promises made: ${kept} kept, ${broken} broken, ${open} still open.`,
    result: (you: number, rival: number, others: number) =>
      `You ${you} · Rajendra Babu ${rival} · Others ${others}`,
    playAgain: 'Play again',
    toTitle: 'Back to the title',
  },

  /** What the rival promised, as people repeat it. level 1 vague, 2 big, 3 specific. */
  rivalPromise: (level: 1 | 2 | 3, raised: number, issue: string, tola: string) => {
    const where = tola || 'the village';
    if (raised > 0 && level < 3) return `${issue} for ${where}, "bilkul pakka, sabse pehle!"`;
    if (level === 1) return `"${where} ka ${issue}? Hamara parivaar dekh lega."`;
    if (level === 2) return `${issue} for ${where} "in one week, guaranteed!"`;
    return `${issue} for ${where}: a costed plan, work to start in ten days`;
  },
  rivalPromised: (issue: string) => ` He promised ${issue} there.`,
  verbs: {
    leaderWon: (name: string) =>
      `${name} nodded. "Theek hai, hum logon ko batayenge." Their people will hear it from them.`,
    leaderLost: (name: string) => `${name} was not impressed. Word of that will travel too.`,
    leaderNeutral: (name: string) => `${name} listened, said little. Not won, not lost.`,
    debate: (won: number, rival: string) =>
      won >= 6
        ? `The chowk is buzzing: you won over ${won} of 10 groups against ${rival}.`
        : won >= 4
          ? `A close debate: ${won} of 10 groups leaned your way. ${rival} held the rest.`
          : `${rival} had the better evening: only ${won} of 10 groups leaned your way.`,
    play: {
      cricket:
        'The boys and girls on the ground will talk about this. And they told you about the exam.',
      school:
        'The teachers and the mothers saw you at the school. You heard what the children lack.',
    },
    shramdaan: (t: string) => `Your workers cleaned up ${t} with you. They feel part of something.`,
  },
  /** The rival's lines in the debate (offline; the AI voices may replace them). */
  rivalDebate: {
    dynast:
      'Mere parivaar ne is gaon ki teen peedhi tak seva ki hai. Naye log aate hain, chale jaate hain.',
    firebrand:
      'Bhaiyo-behno, yeh log sirf baatein karte hain! Hum sadak pe utarte hain, hum ladte hain!',
    technocrat:
      'Mere paas har tole ka hisaab hai: kitna paisa, kitne din, kaun sa kaam. Yeh kaagaz dekhiye.',
  },
  compare: {
    meToo: (r: string, i: string) =>
      `People heard ${r} say the same about ${i}: "${r.split(' ')[0]} bhi yahi bole the." Say more than he did: when, how, how much.`,
    outbid: (r: string, i: string) =>
      `On ${i} you went further than ${r}. People noticed the difference. He may raise his offer.`,
    proof: (r: string, i: string) =>
      `${r} promises ${i}; you already built it. "Isne to kaam karke dikhaya."`,
  },
  rivalMoves: {
    doorToDoor: (t: string, _i: string, r: string) => `${r}'s people went door to door in ${t}.`,
    sweets: (t: string, _i: string, r: string) => `Sweets from ${r}'s people in ${t} last night.`,
    counterIssue: (_t: string, i: string, r: string) => `${r} has started talking about ${i} too.`,
    attackPromise: (_t: string, i: string, r: string) =>
      `${r} is telling everyone about your broken ${i} promise.`,
    rally: (_t: string, _i: string, r: string) => `${r} held a big rally. People were bussed in.`,
    mockPromises: (_t: string, _i: string, r: string) =>
      `${r} is laughing at your promises: 'Itna paisa kahan se aayega?'`,
    doubtSolution: (_t: string, _i: string, r: string) =>
      `${r} says your compromise is hot air: 'Kab hoga? Sab hawa hai.'`,
    attackDodge: (_t: string, f: string, r: string) =>
      `${r} is telling everyone you still won't say where you stand on ${f}.`,
    raiseOffer: (t: string, i: string, r: string) =>
      `${r} has raised his offer on ${i}${t ? ` in ${t}` : ''}. He heard what you promised.`,
    lieLow: () => '',
    lastNight: (t: string) => `Envelopes went round in ${t} last night.`,
  } satisfies Record<RivalMove, (tola: string, issue: string, rival: string) => string>,
} as const;

export type Strings = typeof en;
export const strings: Strings = en;
