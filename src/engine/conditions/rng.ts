/**
 * Deterministic seeded PRNG utilities for the conditions engine.
 *
 * The same seed ALWAYS yields the same pitch, weather, toss report and derived
 * condition model. This is what lets a fixture's conditions survive a page
 * refresh, a spectator skip, and a watch/resume cycle without regenerating.
 */

/** FNV-1a string hash → unsigned 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough seeded PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience wrapper with the helpers the conditions engine needs. */
export class SeededRng {
  private readonly next: () => number;

  constructor(seed: number | string) {
    const resolved = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
    this.next = mulberry32(resolved);
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick one element. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length) % items.length];
  }

  /** True with the given probability (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Weighted pick from [value, weight] pairs. */
  weighted<T>(pairs: ReadonlyArray<readonly [T, number]>): T {
    const total = pairs.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) return pairs[0][0];
    let roll = this.next() * total;
    for (const [value, weight] of pairs) {
      roll -= Math.max(0, weight);
      if (roll <= 0) return value;
    }
    return pairs[0][0];
  }

  /** Gaussian-ish noise via sum of uniforms, clamped to ±limit. */
  noise(limit: number): number {
    const n = (this.next() + this.next() + this.next() - 1.5) / 1.5; // ~[-1,1]
    return n * limit;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to `decimals` places for stable, readable persisted numbers. */
export function round(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
