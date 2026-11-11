/**
 * Static world data, typed: the region, its pool of fault lines, and rival archetypes.
 */
import region from '../data/regions/bihar-village.json' with { type: 'json' };
import faultLineFile from '../data/regions/bihar-faultlines.json' with { type: 'json' };
import rivalFile from '../data/rivals.json' with { type: 'json' };
import type {
  ArchetypeId,
  BlocId,
  FaultLineData,
  FaultLineId,
  GameState,
  GroupId,
  IssueId,
  RivalMove,
} from './types.ts';

export const REGION = region;

export const FAULT_LINE_DATA = Object.fromEntries(
  (faultLineFile.faultLines as FaultLineData[]).map((f) => [f.id, f]),
) as Record<FaultLineId, FaultLineData>;

export type Archetype = {
  name: string;
  cash: number;
  reputation: number;
  trustShift: Partial<Record<BlocId, number>>;
  wedgeEvery: number;
  moveBias: Partial<Record<RivalMove, number>>;
  mockThreshold: number;
};

export const ARCHETYPES = rivalFile.archetypes as Record<ArchetypeId, Archetype>;

export function blocOf(g: GroupId): BlocId {
  return g.slice(0, g.lastIndexOf('_')) as BlocId;
}

/** How much a group cares about each side of a fault line (0..1). */
export function sideWeight(fl: FaultLineId, side: 'side_a' | 'side_b', g: GroupId): number {
  const d = FAULT_LINE_DATA[fl];
  return (side === 'side_a' ? d.sideA.groups : d.sideB.groups)[blocOf(g)] ?? 0;
}

export function worksCostFor(issue: IssueId): number | null {
  return (REGION.works as Partial<Record<IssueId, number>>)[issue] ?? null;
}

export function archetypeOf(s: GameState): Archetype {
  return ARCHETYPES[s.rival.archetype];
}
