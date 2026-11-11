/**
 * More to do (PLAN-v1.1 §E): organise, meet, play, argue. Words go through applyStatement like
 * every other text (presence, repetition, the rival comparison, fault lines); this file holds the
 * prices and the parts that are deeds, not words.
 */
import { leaderOf } from './residents.ts';
import { clamp, record } from './state.ts';
import type { Rng } from './rng.ts';
import type { GameState, GroupId, IssueId, PaNote, Reading, TolaId } from './types.ts';
import { GROUPS } from './types.ts';
import { archetypeOf, blocOf } from './world.ts';

export const COST = { chai: 300, sabha: 2000 } as const;
export const SABHA_WORKERS = 3;
export const SHRAMDAAN_WORKERS = 5;
export const DEBATE_FROM_DAY = 5;
const LEADER_COOLDOWN = 5;

/** Where each kind of play happens: the ground in Naya tola, the school in Purvi tola. */
export const PLAY_PLACE = { cricket: 'naya', school: 'purvi' } as const satisfies Record<
  string,
  TolaId
>;

/** Same deed in the same place recently: each repeat counts for less. */
function repeats(s: GameState, kind: 'play' | 'shramdaan', tola: TolaId): number {
  return s.log.filter(
    (e) => e.actor === 'player' && e.kind === kind && e.tola === tola && e.day >= s.clock.day - 3,
  ).length;
}

function learnIssue(s: GameState, tola: TolaId, issue: IssueId): void {
  if ((s.tolas[tola].grievances[issue] ?? 0) >= 0.05 && !s.known.grievances[tola].includes(issue))
    s.known.grievances[tola].push(issue);
}

/** Cricket with the young men and women on the ground, or an hour at the school. */
export function play(s: GameState, tola: TolaId, kind: 'cricket' | 'school'): PaNote[] {
  const k = Math.pow(0.5, repeats(s, 'play', tola));
  const trust: Partial<Record<GroupId, number>> =
    kind === 'cricket'
      ? { youth_m: 2.5 * k, youth_w: 1 * k }
      : { youth_w: 1.5 * k, farmers_w: 1 * k, labourers_w: 1 * k, youth_m: 0.5 * k };
  record(s, {
    actor: 'player',
    kind: 'play',
    tola,
    effect: { trust, mood: { [tola]: 2 * k } },
  });
  // Listening on the side of the pitch or in the staff room.
  learnIssue(s, tola, kind === 'cricket' ? 'jobs_exams' : 'education');
  learnIssue(s, tola, kind === 'cricket' ? 'sports' : 'health');
  s.known.level[tola] = Math.min(1, s.known.level[tola] + 0.15);
  return [{ day: s.clock.day, kind: 'play', tola, play: kind }];
}

/** Your workers clean a lane, a drain or the pond edge with you: visible work at no cost. */
export function shramdaan(s: GameState, tola: TolaId): PaNote[] {
  const k = Math.pow(0.5, repeats(s, 'shramdaan', tola));
  record(s, { actor: 'player', kind: 'shramdaan', tola, effect: { mood: { [tola]: 3 * k } } });
  s.cadre.loyalty = clamp(s.cadre.loyalty + 0.04 * k, 0, 1);
  for (const issue of ['roads', 'water', 'health'] as IssueId[]) {
    const g = s.tolas[tola].grievances[issue];
    if (g !== undefined) s.tolas[tola].grievances[issue] = Math.max(0, g - 0.05 * k);
  }
  return [{ day: s.clock.day, kind: 'shramdaan', tola }];
}

/** Tea and sweets at your sabha: legal hospitality, a small mood gain, no heat. */
export function shareSweets(s: GameState, tola: TolaId, amount: number): void {
  if (amount <= 0) return;
  record(s, {
    actor: 'player',
    kind: 'sweetsShared',
    tola,
    amount,
    effect: { mood: { [tola]: Math.min(3, amount / 1000) }, cash: -amount },
  });
}

/**
 * After you sit with the tola's opinion leader: if they were convinced, their people hear it
 * through them (their bloc across the village, and the tola); if put off, a little the other way.
 */
export function leaderVerdict(s: GameState, tola: TolaId, reading: Reading): PaNote[] {
  const leader = leaderOf(tola);
  const score = reading.reactions[leader.group].score;
  // An elder is not won by flattery: it takes their concern, said concretely (what, when, how).
  const won =
    score >= 3 &&
    reading.specificity >= 2 &&
    reading.coherent >= 0.5 &&
    reading.tone !== 'divisive';
  const lost = score < 1.6 || reading.tone === 'divisive';
  s.flags.leadersMet ??= {};
  const before = s.flags.leadersMet[leader.id];
  s.flags.leadersMet[leader.id] = { day: s.clock.day, won: won || (before?.won ?? false) };
  if (won && !before?.won) {
    const trust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS) if (blocOf(g) === blocOf(leader.group)) trust[g] = 2;
    record(s, {
      actor: 'player',
      kind: 'leaderWon',
      tola,
      effect: { trust, mood: { [tola]: 2 } },
    });
  } else if (lost) {
    const trust: Partial<Record<GroupId, number>> = {};
    for (const g of GROUPS) if (blocOf(g) === blocOf(leader.group)) trust[g] = -1.5;
    record(s, {
      actor: 'player',
      kind: 'leaderMet',
      tola,
      effect: { trust, mood: { [tola]: -1 } },
    });
  }
  return [
    { day: s.clock.day, kind: 'leader', name: leader.name, won: won ? true : lost ? false : null },
  ];
}

export function leaderOnCooldown(s: GameState, tola: TolaId): boolean {
  const met = s.flags.leadersMet?.[leaderOf(tola).id];
  return !!met && s.clock.day - met.day < LEADER_COOLDOWN;
}

/**
 * The debate at the chowk. Both speak; for each group, how your words landed is weighed against
 * his showing (his archetype, a little luck). Winning a group cools it on him; losing warms it.
 * Returns how many groups you won (of 10).
 */
export function debateDuel(s: GameState, rng: Rng, reading: Reading): PaNote[] {
  const strength = { dynast: 2.0, firebrand: 2.3, technocrat: 2.5 }[s.rival.archetype];
  const form = (rng.next() - 0.5) * 0.8;
  const rivalTrust: Partial<Record<GroupId, number>> = {};
  let won = 0;
  for (const g of GROUPS) {
    const affinity = (archetypeOf(s).trustShift[blocOf(g)] ?? 0) / 20;
    const diff = reading.reactions[g].score - (strength + form + affinity);
    rivalTrust[g] = clamp(-4 * diff, -6, 6);
    if (diff > 0) won++;
  }
  const invalid = reading.coherent < 0.5 || reading.addressesEvaluator >= 0.5;
  if (invalid) for (const g of GROUPS) rivalTrust[g] = 4;
  record(s, {
    actor: 'player',
    kind: 'debate',
    effect: { rivalTrust, reputation: invalid ? -4 : won >= 6 ? 3 : won <= 3 ? -2 : 0 },
  });
  const result = invalid ? 0 : won;
  s.flags.debate = { day: s.clock.day, won: result };
  return [{ day: s.clock.day, kind: 'debate', won: result }];
}
