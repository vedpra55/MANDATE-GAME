/**
 * Headless bots for balance checks (docs/CHALLENGE.md §5). Pure and seeded.
 * Each bot is a strategy a real player might try; the targets say how well each should do.
 */
import { applyAction, newGame } from './engine.ts';
import { ISSUE_WORDS } from './lexicon.ts';
import { worksCost } from './promises.ts';
import { tolaVoters } from './state.ts';
import {
  GROUPS,
  TOLAS,
  type Action,
  type ArchetypeId,
  type FaultLineId,
  type GameState,
  type IssueId,
  type TolaId,
} from './types.ts';
import { computeCells, playerShare, totals } from './vote.ts';
import { FAULT_LINE_DATA, sideWeight } from './world.ts';

export type BotName = 'idle' | 'naive' | 'panderer' | 'coalition' | 'cash' | 'promiser';

const TOLA_NAMES: Record<TolaId, string> = {
  purvi: 'Purvi tola',
  paschim: 'Paschim tola',
  bazaar: 'the bazaar',
  pokhar: 'Pokhar tola',
  naya: 'Naya tola',
};

const word = (issue: IssueId) => ISSUE_WORDS[issue][0]!;

function topKnownGrievance(s: GameState, t: TolaId): IssueId | null {
  const known = s.known.grievances[t];
  let best: IssueId | null = null;
  let v = 0.05;
  for (const issue of known) {
    const g = s.tolas[t].grievances[issue] ?? 0;
    if (g > v) {
      best = issue;
      v = g;
    }
  }
  return best;
}

function sideText(fl: FaultLineId, side: 'side_a' | 'side_b'): string {
  const d = FAULT_LINE_DATA[fl];
  const w = (side === 'side_a' ? d.sideA.words : d.sideB.words)[0]!;
  return `On the ${d.topic[0]} I say it clearly: ${w}.`;
}

function winWinText(fl: FaultLineId): string {
  const d = FAULT_LINE_DATA[fl];
  return `On the ${d.topic[0]} there is a way for everyone: ${d.winWin.elements.map((g) => g[0]).join(', ')}. I will get this done within 10 days, I promise.`;
}

/** A skilled player's choice on a fault line: a win-win it can pay for, else the bigger side. */
function coalitionText(s: GameState, fl: FaultLineId): string {
  const committed = s.promises
    .filter((p) => p.faultLine && p.status === 'open')
    .reduce((a, p) => a + p.cost, 0);
  if (s.cash - committed >= FAULT_LINE_DATA[fl].winWin.cost + 2000) return winWinText(fl);
  const held = s.stances[fl]?.stance;
  if (held === 'side_a' || held === 'side_b') return sideText(fl, held);
  const weightOf = (side: 'side_a' | 'side_b') =>
    GROUPS.reduce(
      (a, g) => a + sideWeight(fl, side, g) * TOLAS.reduce((b, t) => b + s.tolas[t].voters[g], 0),
      0,
    );
  return sideText(fl, weightOf('side_a') >= weightOf('side_b') ? 'side_a' : 'side_b');
}

function evasiveText(fl: FaultLineId): string {
  return `On the ${FAULT_LINE_DATA[fl].topic[0]}, I respect every view and we will talk to everyone.`;
}

function listenText(s: GameState, t: TolaId): string {
  const issue = topKnownGrievance(s, t);
  const w = issue ? word(issue) : 'daily';
  return `I have come to listen. Tell me about the ${w} problem in ${TOLA_NAMES[t]}?`;
}

/** Answer whatever the phone or the rival is asking before spending the slot. */
function interrupt(bot: BotName, s: GameState): Action | null {
  if (s.pending.call) {
    const yes = bot === 'cash' || bot === 'promiser';
    return {
      type: 'answerCall',
      text: yes ? 'Haan, theek hai. Deal.' : 'Nahi. My vote is not for sale.',
    };
  }
  const q = s.pending.question;
  if (q) {
    if (q.by === 'donor') {
      return {
        type: 'answer',
        text:
          bot === 'cash' || bot === 'promiser'
            ? sideText('kiln', 'side_a')
            : sideText('kiln', 'side_b'),
      };
    }
    switch (bot) {
      case 'coalition':
        return {
          type: 'answer',
          text: s.stances[q.faultLine] ? winWinText(q.faultLine) : coalitionText(s, q.faultLine),
        };
      case 'promiser':
      case 'panderer':
        return { type: 'answer', text: sideText(q.faultLine, 'side_a') };
      case 'naive':
      case 'cash':
        return { type: 'answer', text: evasiveText(q.faultLine) };
      case 'idle':
        return null;
    }
  }
  return null;
}

function decide(bot: BotName, s: GameState, i: number): Action {
  const pending = interrupt(bot, s);
  if (pending) return pending;
  if (s.clock.slotsLeftToday === 0) return { type: 'endDay' };
  const day = s.clock.day;
  const slot = 3 - s.clock.slotsLeftToday;
  const tola = TOLAS[(day * 3 + slot + i) % TOLAS.length]!;
  const issue = topKnownGrievance(s, tola);
  const affordable =
    issue !== null && worksCost(issue) !== null && s.cash >= worksCost(issue)! + 1000;
  const building =
    issue !== null &&
    s.projects.some((p) => p.status === 'building' && p.tola === tola && p.issue === issue);

  switch (bot) {
    case 'idle':
      return { type: 'endDay' };
    case 'naive':
      if (day === 1 && slot === 0) return { type: 'recruit', tola, strongman: false };
      if (slot === 0 && affordable && !building)
        return { type: 'publicWorks', tola, issue: issue! };
      return { type: 'visit', tola, text: listenText(s, tola) };
    case 'panderer': {
      const hot = s.faultLines.find((fl) => FAULT_LINE_DATA[fl].hot[tola]);
      if (hot) return { type: 'visit', tola, text: sideText(hot, FAULT_LINE_DATA[hot].hot[tola]!) };
      return { type: 'visit', tola, text: listenText(s, tola) };
    }
    case 'coalition': {
      if (day <= 2)
        return {
          type: 'visit',
          tola: TOLAS[(day - 1) * 3 + slot] ?? tola,
          text: listenText(s, TOLAS[(day - 1) * 3 + slot] ?? tola),
        };
      if (day === 3 && slot === 0) return { type: 'recruit', tola, strongman: false };
      const unsolved = s.known.faultLines.find((fl) => !s.stances[fl] && s.clock.daysToPoll > 1);
      if (unsolved) return { type: 'statement', text: coalitionText(s, unsolved) };
      const deliverable = s.promises.find(
        (p) =>
          p.faultLine &&
          p.status === 'open' &&
          s.cash >= p.cost &&
          !s.projects.some((pr) => pr.status === 'building' && pr.faultLine === p.faultLine),
      );
      if (deliverable) return { type: 'deliver', faultLine: deliverable.faultLine! };
      if (slot === 0 && affordable && !building)
        return { type: 'publicWorks', tola, issue: issue! };
      return { type: 'visit', tola, text: listenText(s, tola) };
    }
    case 'cash':
      // Money where it counts: every third morning, and the last night.
      if (s.clock.daysToPoll === 1 && slot === 0 && s.cash >= 10000)
        return { type: 'gifts', tola, amount: 10000 };
      if (slot === 0 && day % 3 === 0 && s.cash >= 5000)
        return { type: 'gifts', tola, amount: 5000 };
      if (slot === 1 && affordable && !building)
        return { type: 'publicWorks', tola, issue: issue! };
      return { type: 'visit', tola, text: listenText(s, tola) };
    case 'promiser': {
      // Promise everything, and spend the donor's money on visible works.
      if (slot === 0 && affordable && !building)
        return { type: 'publicWorks', tola, issue: issue! };
      if (day <= 2 && slot === 2) return { type: 'visit', tola, text: listenText(s, tola) };
      const w = issue ? word(issue) : 'job';
      return {
        type: 'visit',
        tola,
        text: `If elected I will give you a new ${w}, a road, jobs and pension. I promise.`,
      };
    }
  }
}

function boothPlan(bot: BotName, s: GameState): Record<TolaId, number> {
  const cells = computeCells(s);
  const weight = (t: TolaId) =>
    bot === 'coalition' ? tolaVoters(s, t) * Math.max(0.2, playerShare(totals(cells, t))) : 1;
  const sum = TOLAS.reduce((a, t) => a + weight(t), 0);
  const plan = Object.fromEntries(
    TOLAS.map((t) => [t, Math.floor((s.cadre.size * weight(t)) / sum)]),
  ) as Record<TolaId, number>;
  return plan;
}

function act(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  return r.error ? s : r.state;
}

export function playGame(bot: BotName, seed: number, archetype?: ArchetypeId): GameState {
  let s = newGame({ seed, name: 'Bot', address: 'bhaiya', archetype });
  s = act(s, {
    type: 'declare',
    text: 'I am standing because this village deserves water, roads and respect.',
  });
  let i = 0;
  let guard = 0;
  while (s.phase === 'campaign' && guard++ < 600) {
    const before = s;
    s = act(s, decide(bot, s, i++));
    if (s === before) s = act(s, { type: 'endDay' });
  }
  if (s.phase === 'polling') {
    if (bot !== 'idle') s = act(s, { type: 'assignBooths', plan: boothPlan(bot, s) });
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
  contradictions: number;
  titles: Record<string, number>;
};

export function simulate(
  bot: BotName,
  games: number,
  seed0 = 1,
  archetype?: ArchetypeId,
): SimSummary {
  let wins = 0;
  let marginSum = 0;
  let heat = 0;
  let contra = 0;
  const titles: Record<string, number> = {};
  for (let k = 0; k < games; k++) {
    const s = playGame(bot, seed0 + k * 7919, archetype);
    const r = s.result!;
    if (r.won) wins++;
    const cast = r.playerVotes + r.rivalVotes + r.otherVotes;
    marginSum += cast ? r.margin / cast : -1;
    if (r.tags.includes('fir') || r.title === 'barred') heat++;
    contra += s.flags.contradictions;
    titles[r.title] = (titles[r.title] ?? 0) + 1;
  }
  return {
    bot,
    games,
    winRate: wins / games,
    avgMargin: marginSum / games,
    heatEndings: heat / games,
    contradictions: contra / games,
    titles,
  };
}
