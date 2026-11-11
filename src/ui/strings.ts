/**
 * All player-facing text lives in string tables so Hindi can be added later
 * without touching components. Only English for the MVP.
 */
export const en = {
  title: 'MANDATE',
  tagline: 'Every vote has a price.',
  scaffoldNote: 'The village desk will be built here.',
  serverChecking: 'Checking the AI proxy…',
  serverOk: 'AI proxy is up.',
  serverNoKey: 'AI proxy is up, but no OpenAI key is set.',
  serverDown: 'AI proxy is not reachable. Run `npm run dev`.',
} as const;

export type Strings = typeof en;
export const strings: Strings = en;
