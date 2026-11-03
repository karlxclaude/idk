// Small numeric helpers shared by the engine. Pure functions only.
import type { CurveTable } from '../data/constants';

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const clamp01 = (x: number): number => clamp(x, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Piecewise-linear interpolation on a curve table; clamps outside the domain. */
export function interp(curve: CurveTable, x: number): number {
  const { xs, ys } = curve;
  const n = xs.length;
  if (n === 0) return 0;
  const x0 = xs[0] as number;
  const xn = xs[n - 1] as number;
  if (x <= x0) return ys[0] as number;
  if (x >= xn) return ys[n - 1] as number;
  let i = 1;
  while (i < n && (xs[i] as number) < x) i++;
  const xa = xs[i - 1] as number;
  const xb = xs[i] as number;
  const ya = ys[i - 1] as number;
  const yb = ys[i] as number;
  return ya + ((yb - ya) * (x - xa)) / (xb - xa);
}

/** Saturating response 1 - exp(-v/v0). */
export const saturate = (v: number, v0: number): number => 1 - Math.exp(-Math.max(0, v) / v0);

/** Fraction of an exponential decay remaining after dt with time constant tau. */
export const decay = (dt: number, tau: number): number => Math.exp(-dt / tau);

/** Move x toward target by exponential approach with time constant tau over dt. */
export const approach = (x: number, target: number, dt: number, tau: number): number =>
  target + (x - target) * Math.exp(-dt / tau);

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * (pos - lo);
}

export function stddev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export const round = (x: number, d = 2): number => Math.round(x * 10 ** d) / 10 ** d;
