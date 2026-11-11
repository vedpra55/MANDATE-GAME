/**
 * All player-facing text lives in string tables so Hindi can be added later
 * without touching components. Only English for the MVP.
 */
export const en = {
  title: 'MANDATE',
  tagline: 'Every vote has a price.',
  close: 'Close',
  back: 'Back',
  slots: ['Morning', 'Afternoon', 'Evening'],
  props: {
    calendar: 'Wall calendar: tear the page to end the day',
    phone: 'Phone',
    cash: 'Cash tin',
    ledger: 'Bahi-khata: promises and favours',
    newspaper: "Today's newspaper",
    files: 'Janta darbar files',
    writingPad: 'Writing pad: make a statement',
    diary: "PA's diary",
    chai: 'Chai',
    bicycle: 'Bicycle: ride out to the village',
  },
  calendar: {
    day: 'Day',
    daysToPoll: (n: number) => (n === 1 ? '1 day to poll' : `${n} days to poll`),
    pollDay: 'Polling day',
    tearHint: 'Tear the page',
  },
  phone: {
    title: 'Messages',
    empty: 'No new messages.',
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
  },
  newspaper: {
    masthead: 'Gram Samachar',
    edition: (day: number) => `Day ${day} · Local edition`,
  },
  writing: {
    title: 'Your statement',
    placeholder: 'Write what you will say to the village. English, Hindi or Hinglish.',
    stamp: 'Say it',
    noSlots: 'No time left today. Tear the calendar page.',
    slotCost: 'Costs one part of the day.',
  },
  diary: { title: "PA's notes" },
  files: { title: 'Janta darbar', hint: 'Visit the chaupal to hear these in person.' },
  cash: { title: 'Cash in hand' },
  map: {
    title: 'The village',
    hint: 'Pick a place to visit. (Visits arrive in a later build.)',
    backToDesk: 'Back to the charpai',
  },
} as const;

export type Strings = typeof en;
export const strings: Strings = en;
