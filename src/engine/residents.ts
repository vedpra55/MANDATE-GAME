/**
 * Named residents and tola memory (PLAN-v1.1 §D). Code decides who speaks and what the tola
 * remembers; the AI only writes the words. Everything here is derived from the game state, so it
 * needs no extra saved data and replays exactly.
 */
import data from '../data/regions/bihar-residents.json' with { type: 'json' };
import { blocOf } from './world.ts';
import type { FaultLineId, GameState, GroupId, IssueId, Statement, TolaId } from './types.ts';

export type Resident = {
  id: string;
  tola: TolaId;
  name: string;
  age: number;
  group: GroupId;
  portrait: string;
  about: string;
};

export const RESIDENTS = data.residents as Resident[];

export function residentsOf(tola: TolaId): Resident[] {
  return RESIDENTS.filter((r) => r.tola === tola);
}

export function residentById(id: string): Resident | undefined {
  return RESIDENTS.find((r) => r.id === id);
}

/** Residents who spoke in the last few statements: they step back so others get a turn. */
function recentSpeakers(s: GameState, n = 3): Set<string> {
  const names = new Set<string>();
  for (const st of s.statements.slice(-n))
    for (const q of st.voices?.quotes ?? []) names.add(q.who.split(' (')[0]!);
  return names;
}

/**
 * Who answers for a reacting group: a resident of that group in this tola, else of the same bloc,
 * else anyone from the tola. Village-wide statements draw from every tola. Recent speakers rest.
 */
export function speakerFor(
  s: GameState,
  group: GroupId,
  tola: TolaId | null,
  taken: Set<string>,
): Resident | null {
  const pool = (tola ? residentsOf(tola) : RESIDENTS).filter((r) => !taken.has(r.id));
  if (pool.length === 0) return null;
  const rested = recentSpeakers(s);
  const order = (r: Resident) =>
    (r.group === group ? 0 : blocOf(r.group) === blocOf(group) ? 1 : 2) +
    (rested.has(r.name) ? 1.5 : 0);
  // Stable tie-break by day so the same face does not always win.
  return [...pool].sort(
    (a, b) => order(a) - order(b) || ((a.age + s.clock.day) % 7) - ((b.age + s.clock.day) % 7),
  )[0]!;
}

export type TolaMemory = {
  visits: { day: number; text: string }[];
  promises: { issue: IssueId; status: 'open' | 'kept' | 'broken'; deadlineDay: number | null }[];
  works: { issue: IssueId | null; faultLine: FaultLineId | null; done: boolean }[];
  rival: { visitedDay: number | null; promised: IssueId[] };
  lastQuotes: { who: string; text: string }[];
  /** The candidate already said this here recently ("Aap yeh pehle bhi keh chuke ho"). */
  repeating: boolean;
};

/** What a tola remembers about you (and the rival), excluding the statement being voiced. */
export function tolaMemory(s: GameState, tola: TolaId, current?: Statement): TolaMemory {
  const here = s.statements.filter(
    (st) => st.channel === 'visit' && st.tola === tola && st.id !== current?.id,
  );
  const repeating =
    !!current &&
    current.issues.length > 0 &&
    here.some(
      (st) => st.day >= current.day - 3 && st.issues.some((i) => current.issues.includes(i)),
    );
  return {
    visits: here.slice(-3).map((st) => ({ day: st.day, text: st.text.slice(0, 120) })),
    promises: s.promises
      .filter((p) => p.tola === tola && !p.faultLine)
      .slice(-4)
      .map((p) => ({ issue: p.issue, status: p.status, deadlineDay: p.deadlineDay })),
    works: s.projects
      .filter((p) => p.tola === tola)
      .map((p) => ({ issue: p.issue, faultLine: p.faultLine, done: p.status === 'done' })),
    rival: {
      visitedDay: s.tolas[tola].rivalLastVisit >= 1 ? s.tolas[tola].rivalLastVisit : null,
      promised: s.rival.promises.filter((p) => p.tola === tola).map((p) => p.issue),
    },
    lastQuotes: here.flatMap((st) => st.voices?.quotes ?? []).slice(-4),
    repeating,
  };
}
