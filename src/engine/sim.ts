/**
 * Headless bots for balance checks (docs/ENGINE.md §13). Pure and seeded: the same seed gives the
 * same game. Used by tests and by `npm run sim`.
 */
import { applyAction, newGame } from './engine.ts';
import { ISSUE_WORDS } from './lexicon.ts';
import { worksCost } from './promises.ts';
import { TOLAS, type Action, type GameState, type IssueId, type TolaId } from './types.ts';

export type BotName = 'idle' | 'talker' | 'honest' | 'promiser' | 'cash';

const TOLA_NAMES: Record<TolaId, string> = {
  purvi: 'Purvi tola',
  paschim: 'Paschim tola',
  bazaar: 'the bazaar',
  pokhar: 'Pokhar tola',
  naya: 'Naya tola',
};

function topGrievance(s: GameState, t: TolaId): IssueId | null {
  let best: IssueId | null = null;
  let v = 0.05;
  for (const [issue, g] of Object.entries(s.tolas[t].grievances) as [IssueId, number][]) {
    if (g > v) {
      best = issue;
      v = g;
    }
  }
  return best;
}

function word(issue: IssueId): string {
  return ISSUE_WORDS[issue][0]!;
}

function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  return r.error ? s : r.state;
}

/** One bot decision for the current slot. */
function decide(bot: BotName, s: GameState, i: number): Action {
  if (s.clock.slotsLeftToday === 0) return { type: 'endDay' };
  const tola = TOLAS[(s.clock.day + i) % TOLAS.length]!;
  const issue = topGrievance(s, tola);
  const slot = 3 - s.clock.slotsLeftToday;
  switch (bot) {
    case 'idle':
      return { type: 'endDay' };
    case 'talker':
      return {
        type: 'statement',
        text: 'I will serve this village with honesty. Please give me a chance.',
      };
    case 'honest': {
      if (s.clock.day === 1 && slot === 0) return { type: 'recruit', tola, strongman: false };
      if (issue && slot === 0) {
        const cost = worksCost(issue);
        if (cost !== null && s.cash >= cost + 1000) return { type: 'publicWorks', tola, issue };
      }
      const w = issue ? word(issue) : 'school';
      return {
        type: 'visit',
        tola,
        text: `I have come to listen about the ${w} problem in ${TOLA_NAMES[tola]}. Your ${w} matters to me.`,
      };
    }
    case 'promiser': {
      const w = issue ? word(issue) : 'job';
      return {
        type: 'visit',
        tola,
        text: `If elected I will give you a new ${w}, a road, jobs and pension. I promise.`,
      };
    }
    case 'cash': {
      if (s.cash >= 5000 && slot === 0) return { type: 'gifts', tola, amount: 5000 };
      const w = issue ? word(issue) : 'road';
      return {
        type: 'visit',
        tola,
        text: `Tell me about the ${w} problem in ${TOLA_NAMES[tola]}. I am listening.`,
      };
    }
  }
}

export function playGame(bot: BotName, seed: number): GameState {
  let s = newGame({ seed, name: 'Bot', address: 'bhaiya' });
  s = act(s, {
    type: 'declare',
    text: 'I am standing because this village deserves water, roads and respect.',
  });
  let i = 0;
  let guard = 0;
  while (s.phase === 'campaign' && guard++ < 500) {
    const before = s;
    s = act(s, decide(bot, s, i++));
    if (s === before) s = act(s, { type: 'endDay' });
  }
  if (s.phase === 'polling') {
    s = act(s, { type: 'beginCounting' });
    while (s.phase === 'counting') s = act(s, { type: 'revealRound' });
  }
  return s;
}

export type SimSummary = {
  bot: BotName;
  games: number;
  winRate: number;
  avgMargin: number;
  heatEndings: number;
  titles: Record<string, number>;
};

export function simulate(bot: BotName, games: number, seed0 = 1): SimSummary {
  let wins = 0;
  let marginSum = 0;
  let heat = 0;
  const titles: Record<string, number> = {};
  for (let k = 0; k < games; k++) {
    const s = playGame(bot, seed0 + k * 7919);
    const r = s.result!;
    if (r.won) wins++;
    const cast = r.playerVotes + r.rivalVotes + r.otherVotes;
    marginSum += cast ? r.margin / cast : -1;
    if (r.tags.includes('fir') || r.title === 'barred') heat++;
    titles[r.title] = (titles[r.title] ?? 0) + 1;
  }
  return {
    bot,
    games,
    winRate: wins / games,
    avgMargin: marginSum / games,
    heatEndings: heat / games,
    titles,
  };
}
