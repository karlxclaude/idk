/** Small math helpers shared everywhere. Pure functions only. */
export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
/** Frame-rate independent exponential smoothing factor. rate = 1/seconds-ish. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
export const smoothstep = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Interpolate in log space (for zoom / scale). */
export const logLerp = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), t));
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
};
export const len = (x: number, y: number) => Math.sqrt(x * x + y * y);

/** Linear interpolation between two 0xRRGGBB colors. */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
export function colorToCss(c: number, alpha = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`;
}

/** Seeded PRNG (mulberry32) with helpers. */
export class Rng {
  private s: number;
  constructor(seed = (Math.random() * 2 ** 32) >>> 0) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  angle(): number {
    return this.next() * TAU;
  }
  weighted<T extends { weight?: number }>(arr: readonly T[]): T {
    let total = 0;
    for (const a of arr) total += a.weight ?? 1;
    let r = this.next() * total;
    for (const a of arr) {
      r -= a.weight ?? 1;
      if (r <= 0) return a;
    }
    return arr[arr.length - 1];
  }
}

export const rng = new Rng();
