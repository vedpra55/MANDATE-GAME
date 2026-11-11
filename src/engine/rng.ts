/**
 * Seeded randomness. The engine never calls Math.random: the same seed and the same inputs
 * always produce the same game, which makes bugs reproducible and replays exact.
 */

export type Rng = {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  chance: (p: number) => boolean;
  /** Standard normal (Box–Muller). */
  normal: () => number;
  /** Index chosen with probability proportional to its weight. */
  weightedIndex: (weights: readonly number[]) => number;
  /** Current internal state, to store back into GameState. */
  readonly state: number;
};

/** mulberry32: small, fast, good enough for games. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    normal: () => {
      const u = Math.max(next(), 1e-12);
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    weightedIndex: (weights) => {
      const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
      if (total <= 0) return 0;
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= Math.max(0, weights[i]!);
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    get state() {
      return s;
    },
  };
  return rng;
}

/** Stable hash of several parts (FNV-1a), for noise that must not change while the player looks. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
