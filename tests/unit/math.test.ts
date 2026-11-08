import { describe, expect, it } from 'vitest';
import { Rng, clamp, lerp, invLerp, smoothstep, lerpColor, logLerp, easeOutExpo } from '../../src/core/math';
import { formatScale } from '../../src/core/camera';

describe('math helpers', () => {
  it('clamp/lerp/invLerp/smoothstep', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(invLerp(0, 10, 5)).toBe(0.5);
    expect(invLerp(3, 3, 5)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
    expect(easeOutExpo(1)).toBe(1);
  });
  it('logLerp and lerpColor', () => {
    expect(logLerp(1, 100, 0.5)).toBeCloseTo(10);
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000);
    expect(lerpColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(123), b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('differs across seeds and stays in [0,1)', () => {
    const a = new Rng(1), b = new Rng(2);
    expect(a.next()).not.toBe(b.next());
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('range/int/pick/weighted respect bounds', () => {
    const r = new Rng(42);
    for (let i = 0; i < 500; i++) {
      const v = r.range(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
      const n = r.int(1, 3);
      expect([1, 2, 3]).toContain(n);
      expect(['a', 'b']).toContain(r.pick(['a', 'b']));
      expect([-1, 1]).toContain(r.sign());
    }
    const w = [{ id: 'x', weight: 0 }, { id: 'y', weight: 1 }];
    for (let i = 0; i < 50; i++) expect(r.weighted(w).id).toBe('y');
  });
});

describe('formatScale', () => {
  it('formats exponents with superscripts', () => {
    expect(formatScale(-35)).toBe('10⁻³⁵ m');
    expect(formatScale(0)).toBe('10⁰ m');
    expect(formatScale(26.4)).toBe('10²⁶ m');
  });
});
