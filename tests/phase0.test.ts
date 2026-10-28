import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { allConstants, validateConstants, DEFAULT_CURVES, DEFAULT_PARAMS, withOverrides } from '../data/constants';
import { SourcesFileSchema } from '../data/schemas';
import { makeRng, streamRng } from '../engine/rng';
import { interp } from '../engine/math';

const sources = SourcesFileSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'sources.json'), 'utf8')));

describe('Phase 0: constants and sources', () => {
  it('every constant validates against the mandatory schema', () => {
    const all = validateConstants();
    expect(all.length).toBeGreaterThan(200);
  });

  it('every constant maps to a known source or is HEUR/design', () => {
    const ids = new Set(sources.map((s) => s.id));
    const bad = allConstants().filter((c) => c.sourceIds.some((s) => !ids.has(s)));
    expect(bad.map((c) => `${c.id}: ${c.sourceIds.join(',')}`)).toEqual([]);
  });

  it('sources.json validates and has unique ids', () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sources.length).toBeGreaterThan(150);
  });

  it('curves interpolate and clamp', () => {
    const c = DEFAULT_CURVES.training.hypRir;
    expect(interp(c, 0)).toBeCloseTo(1.0);
    expect(interp(c, 0.5)).toBeCloseTo(0.975);
    expect(interp(c, 20)).toBeCloseTo(0.15);
    expect(interp(c, -5)).toBeCloseTo(1.0);
  });

  it('overrides do not mutate defaults', () => {
    const p = withOverrides(DEFAULT_PARAMS, { hypertrophy: { kHypPerDay: 0.1 } });
    expect(p.hypertrophy.kHypPerDay).toBe(0.1);
    expect(DEFAULT_PARAMS.hypertrophy.kHypPerDay).not.toBe(0.1);
  });
});

describe('Phase 0: seeded RNG', () => {
  it('is deterministic for the same seed', () => {
    const a = makeRng('seed-1');
    const b = makeRng('seed-1');
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it('differs for different seeds and streams', () => {
    expect(makeRng('a').next()).not.toBe(makeRng('b').next());
    expect(streamRng('a', 1, 'x').next()).not.toBe(streamRng('a', 1, 'y').next());
  });
  it('normal() has roughly the right moments', () => {
    const r = makeRng(42);
    const xs = Array.from({ length: 20000 }, () => r.normal(10, 2));
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
    expect(m).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
  });
});
