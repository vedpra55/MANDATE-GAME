/**
 * Fog of war (docs/CHALLENGE.md §3.2): the village has to be discovered. Pintu starts with
 * rumours; listening at people's doors, workers and public fights reveal the rest.
 */
import { FAULT_LINE_DATA } from './world.ts';
import type { FaultLineId, GameState, IssueId, PaNote, TolaId } from './types.ts';

export type LearnMode = 'listen' | 'glance' | 'workers';

/** Reveal what a visit or a worker teaches; returns a note listing what is new (or null). */
export function learnTola(s: GameState, t: TolaId, mode: LearnMode): PaNote | null {
  const known = s.known.grievances[t];
  const ranked = (Object.entries(s.tolas[t].grievances) as [IssueId, number][])
    .filter(([, v]) => v >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => i);
  const reveal = mode === 'glance' ? ranked.slice(0, 1) : ranked;
  const newIssues = reveal.filter((i) => !known.includes(i));
  known.push(...newIssues);

  const newFaults: FaultLineId[] = [];
  if (mode !== 'glance') {
    for (const fl of s.faultLines) {
      if (t in FAULT_LINE_DATA[fl].hot && !s.known.faultLines.includes(fl)) {
        s.known.faultLines.push(fl);
        newFaults.push(fl);
      }
    }
  }
  const gain = mode === 'listen' ? 0.5 : mode === 'workers' ? 0.4 : 0.2;
  s.known.level[t] = Math.min(1, s.known.level[t] + gain);
  if (newIssues.length === 0 && newFaults.length === 0) return null;
  return { day: s.clock.day, kind: 'learned', tola: t, issues: newIssues, faultLines: newFaults };
}

export function knowsGrievance(s: GameState, t: TolaId, issue: IssueId): boolean {
  return s.known.grievances[t].includes(issue);
}
