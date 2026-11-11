/**
 * The end card (ENGINE.md §12.3, §15): who won, what decided it, the title and the costs.
 */
import {
  GROUPS,
  type Decider,
  type EndingTag,
  type EndingTitle,
  type GameResult,
  type GameState,
  type GroupId,
  type TolaId,
} from './types.ts';
import { computeCells, TAU, type Cell } from './vote.ts';
import { DRIFT_PER_DAY } from './constants.ts';

const POLL_DAY = 22;

/** Votes an entry moved on the final margin (player − rival), with memory fading since that day. */
export function marginImpact(s: GameState, cells: Cell[], entryIndex: number): number {
  const e = s.log[entryIndex]!;
  const decay = Math.pow(1 - DRIFT_PER_DAY, Math.max(0, POLL_DAY - e.day));
  const eff = e.effect;
  let impact = 0;
  for (const c of cells) {
    const kP = (c.voters * c.turnout * c.pPlayer * (1 - c.pPlayer + c.pRival)) / TAU;
    const kR = (-c.voters * c.turnout * c.pRival * (1 - c.pRival + c.pPlayer)) / TAU;
    const dP =
      (eff.trust?.[c.group as GroupId] ?? 0) +
      0.5 * (eff.mood?.[c.tola as TolaId] ?? 0) +
      0.2 * (eff.reputation ?? 0);
    const dR =
      (eff.rivalTrust?.[c.group as GroupId] ?? 0) +
      0.5 * (eff.rivalMood?.[c.tola as TolaId] ?? 0) +
      0.2 * (eff.rivalReputation ?? 0);
    impact += dP * kP + dR * kR;
  }
  return impact * decay;
}

export function topDeciders(s: GameState, n = 3): Decider[] {
  const cells = computeCells(s);
  // Group repeats of the same cause ("staying silent on the kiln", twice) into one line.
  const groups = new Map<string, Decider>();
  s.log.forEach((e, i) => {
    const impact = marginImpact(s, cells, i);
    const groupable = !['visit', 'statement', 'publicWorks', 'worksStarted'].includes(e.kind);
    const key = groupable ? [e.kind, e.actor, e.faultLine, e.tola, e.issue].join('|') : `id${e.id}`;
    const g = groups.get(key);
    if (g) {
      g.impact += impact;
      g.count += 1;
    } else {
      groups.set(key, {
        logId: e.id,
        kind: e.kind,
        actor: e.actor,
        tola: e.tola,
        issue: e.issue,
        faultLine: e.faultLine,
        stance: e.stance,
        day: e.day,
        impact,
        count: 1,
      });
    }
  });
  return [...groups.values()]
    .filter((d) => Math.abs(d.impact) >= 1)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, n);
}

export function computeResult(s: GameState): GameResult {
  const kept = s.promises.filter((p) => p.status === 'kept').length;
  const broken = s.promises.filter((p) => p.status === 'broken').length;
  const open = s.promises.filter((p) => p.status === 'open').length;

  const tags: EndingTag[] = [];
  if (s.favours.some((f) => !f.leaked)) tags.push('favoursOwed');
  if (s.flags.firFiled) tags.push('fir');
  if (s.flags.noticeIssued) tags.push('notice');
  if (broken > 0) tags.push('brokenPromises');
  if (open > 0) tags.push('openPromises');
  if (s.flags.giftsFilmed > 0) tags.push('giftsFilmed');
  if (s.flags.contradictions > 0) tags.push('contradictions');

  const base = {
    tags,
    deciders: topDeciders(s),
    promises: { made: s.promises.length, kept, broken, open },
  };

  if (s.flags.disqualified || !s.counting) {
    return {
      ...base,
      title: 'barred',
      won: false,
      playerVotes: 0,
      rivalVotes: 0,
      otherVotes: 0,
      margin: 0,
    };
  }
  const c = s.counting;
  const playerVotes = c.rounds.reduce((a, r) => a + r.player, 0);
  const rivalVotes = c.rounds.reduce((a, r) => a + r.rival, 0);
  const otherVotes = c.rounds.reduce((a, r) => a + r.others, 0);
  const won = c.winner === 'player';
  const cast = playerVotes + rivalVotes + otherVotes;

  let title: EndingTitle;
  if (c.tieBrokenByLots) title = won ? 'wonByLottery' : 'lostByLottery';
  else if (s.flags.divisiveUsed) title = 'divider';
  else if (won) {
    if (s.flags.giftsTotal >= 10000 || s.favours.length > 0) title = 'boughtChair';
    else if (open >= 6 || broken >= 2) title = 'promiseMachine';
    else if (s.flags.initialMargin <= -0.15) title = 'giantKiller';
    else title = 'peoplesSarpanch';
  } else {
    title = (rivalVotes - playerVotes) / Math.max(1, cast) < 0.03 ? 'nearly' : 'outsider';
  }
  return {
    ...base,
    title,
    won,
    playerVotes,
    rivalVotes,
    otherVotes,
    margin: playerVotes - rivalVotes,
  };
}

export { GROUPS };
