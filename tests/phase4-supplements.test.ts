import { describe, expect, it } from 'vitest';
import { SUPPLEMENTS } from '../data/supplements';
import sources from '../data/sources.json';
import { FULL_BODY_WEEK } from '../data/programs';
import { NO_SUPPLEMENTS } from '../engine/plan';
import { runDays } from '../engine/runner';
import { testOneRepMax } from '../engine/strength';
import { averageMan, ctx, goodPlan } from './helpers';

const econ = ctx.P.economy as Record<string, unknown>;
const sourceIds = new Set((sources as Array<{ id: string }>).map((s) => s.id));

describe('Phase 4 supplements', () => {
  it('(a) every supplement has an existing cost constant and valid source ids', () => {
    expect(SUPPLEMENTS.length).toBeGreaterThanOrEqual(14);
    for (const s of SUPPLEMENTS) {
      expect(typeof econ[s.costConstantId], s.id).toBe('number');
      expect(econ[s.costConstantId] as number).toBeGreaterThan(0);
      for (const id of s.sourceIds) expect(sourceIds.has(id), `${s.id}:${id}`).toBe(true);
      expect(s.evidence.length).toBeGreaterThan(20);
    }
  });

  it('(b) useless supplements map to no engine change', () => {
    const useless = SUPPLEMENTS.filter((s) => s.category === 'useless');
    expect(useless.map((s) => s.id).sort()).toEqual(['bcaa', 'fatBurner', 'glutamine', 'hmb', 'testBooster']);
    for (const s of useless) expect(s.apply({ ...NO_SUPPLEMENTS })).toBeNull();
    for (const s of SUPPLEMENTS.filter((x) => x.category !== 'useless' && x.id !== 'caffeine')) {
      expect(s.apply({ ...NO_SUPPLEMENTS }), s.id).not.toBeNull();
    }
  });

  it('(c) vitamin D raises 25(OH)D only when deficient; sufficient characters see no performance change', () => {
    const vitD = SUPPLEMENTS.find((s) => s.id === 'vitD')!;
    const supp = vitD.apply({ ...NO_SUPPLEMENTS })!;
    const run = (start: number, take: boolean) => {
      const s = averageMan({ startDate: '2026-01-05' }, 'vitd');
      s.nutrition.vitDngml = start;
      const plan = goodPlan(FULL_BODY_WEEK, {}, { supplements: take ? supp : { vitDIU: 0 }, sunMinutes: 0 });
      runDays(ctx, s, plan, 56);
      return { vitD: s.nutrition.vitDngml, lift: testOneRepMax(ctx, s, 'back_squat_high_bar') };
    };
    const defStart = 12, sufStart = 40;
    const defOn = run(defStart, true), defOff = run(defStart, false);
    const sufOn = run(sufStart, true), sufOff = run(sufStart, false);
    // Deficient: supplementation lifts status above baseline and well above no-supplement.
    expect(defOn.vitD).toBeGreaterThan(defStart + 5);
    expect(defOn.vitD - defOff.vitD).toBeGreaterThan(5);
    // Sufficient: winter drift down at most, never a rise; and no performance difference.
    expect(sufOn.vitD).toBeLessThanOrEqual(sufStart);
    expect(sufOff.vitD).toBeGreaterThan(20); // still sufficient, no penalty either way
    expect(Math.abs(sufOn.lift / sufOff.lift - 1)).toBeLessThan(0.005);
  });

  it('(d) beta-alanine loads carnosine over 4+ weeks', () => {
    const ba = SUPPLEMENTS.find((s) => s.id === 'betaAlanine')!;
    const s = averageMan({}, 'ba');
    runDays(ctx, s, goodPlan(FULL_BODY_WEEK, {}, { supplements: ba.apply({ ...NO_SUPPLEMENTS })! }), 35);
    expect(s.nutrition.betaAlanineLoad).toBeGreaterThan(0.8);
  });

  // Engine gap: betaAlanineLoad / betaAlanineEffect are never read by performance code (row2kTime etc.).
  // (d) performance effect: see 'ergogenic aids in timed efforts' below (ergogenicPerf).
});

describe('ergogenic aids in timed efforts', () => {
  it('beta-alanine ~3% in 0.5-10 min efforts only; bicarb 1-7 min; nitrate attenuated in elites', async () => {
    const { ergogenicPerf } = await import('../engine/nutrition');
    const s = averageMan();
    s.nutrition.betaAlanineLoad = 1;
    const none = NO_SUPPLEMENTS;
    const ba4 = ergogenicPerf(ctx, s, none, 4, 45);
    expect(ba4).toBeGreaterThan(1.02);
    expect(ba4).toBeLessThan(1.05);
    expect(ergogenicPerf(ctx, s, none, 30, 45)).toBe(1);
    s.nutrition.betaAlanineLoad = 0;
    expect(ergogenicPerf(ctx, s, { ...none, bicarb: true }, 3, 45)).toBeGreaterThan(1);
    expect(ergogenicPerf(ctx, s, { ...none, bicarb: true }, 20, 45)).toBe(1);
    const nitRec = ergogenicPerf(ctx, s, { ...none, nitrate: true }, 25, 45) - 1;
    const nitElite = ergogenicPerf(ctx, s, { ...none, nitrate: true }, 25, 70) - 1;
    expect(nitElite).toBeLessThan(nitRec);
    expect(nitElite).toBeGreaterThan(0);
  });
});
