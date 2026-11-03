// Seeded, deterministic random number generation.
// sfc32 core seeded via cyrb128 string hashing. Same seed + same inputs => same output.
// Engine code must never call Math.random().

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [a, b). */
  uniform(a: number, b: number): number;
  /** Standard normal via Box-Muller. */
  normal(mean?: number, sd?: number): number;
  /** Lognormal with given median and log-space sigma. */
  lognormal(median: number, sigma: number): number;
  /** Bernoulli trial. */
  chance(p: number): boolean;
  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
}

export function hashString(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

class Sfc32 implements Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private spare: number | null = null;

  constructor(seed: [number, number, number, number]) {
    [this.a, this.b, this.c, this.d] = seed;
    for (let i = 0; i < 15; i++) this.next();
  }

  next(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  normal(mean = 0, sd = 1): number {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return mean + sd * s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return mean + sd * r * Math.cos(2 * Math.PI * v);
  }

  lognormal(median: number, sigma: number): number {
    return median * Math.exp(this.normal(0, sigma));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  pick<T>(arr: readonly T[]): T {
    const v = arr[Math.floor(this.next() * arr.length)];
    if (v === undefined) throw new Error('pick from empty array');
    return v;
  }
}

export function makeRng(seed: string | number): Rng {
  return new Sfc32(hashString(String(seed)));
}

/**
 * Derive an independent stream for (seed, day, stream). Using per-day, per-subsystem streams
 * keeps results stable when unrelated subsystems change how many random numbers they draw.
 */
export function streamRng(seed: string | number, day: number, stream: string): Rng {
  return new Sfc32(hashString(`${seed}|${day}|${stream}`));
}

/** Truncated normal by clamping (cheap; adequate for trait sampling). */
export function clampedNormal(rng: Rng, mean: number, sd: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, rng.normal(mean, sd)));
}

/** Draw a pair of standard normals with correlation rho. */
export function correlatedNormals(rng: Rng, rho: number): [number, number] {
  const z1 = rng.normal();
  const z2 = rng.normal();
  return [z1, rho * z1 + Math.sqrt(1 - rho * rho) * z2];
}
