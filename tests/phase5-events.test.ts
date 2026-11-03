import { describe, expect, it } from 'vitest';
import { COMPETITIONS, FIELD_TESTS, runFieldTest, simulateCompetition, estimateOneRmFromReps, type CompetitionId } from '../engine/events';
import { ctx, averageMan } from './helpers';

const base = { seed: 'ev', day: 10 };

describe('phase 5: field tests and competitions', () => {
  it('stronger character gets a higher powerlifting total and a better or equal placement', () => {
    const weak = averageMan();
    const strong = averageMan();
    for (const k of Object.keys(strong.muscles) as Array<keyof typeof strong.muscles>) strong.muscles[k].mass *= 1.4;
    const a = simulateCompetition(ctx, weak, 'powerlifting', base);
    const b = simulateCompetition(ctx, strong, 'powerlifting', base);
    expect(b.total).toBeGreaterThan(a.total);
    expect(b.placement).toBeLessThanOrEqual(a.placement);
  });

  it('an opener above 100% is missed, a modest opener is made', () => {
    const s = averageMan();
    const over = simulateCompetition(ctx, s, 'powerlifting', { ...base, openersPct: 1.3 });
    expect(over.results[0]?.attempts?.[0]?.made).toBe(false);
    const ok = simulateCompetition(ctx, s, 'powerlifting', { ...base, openersPct: 0.8 });
    expect(ok.results.every((r) => r.attempts?.[0]?.made)).toBe(true);
    expect(ok.total).toBeGreaterThan(0);
  });

  it('sprint times: 10 m < 30 m < 40 yd', () => {
    const s = averageMan();
    const t10 = runFieldTest(ctx, s, 'sprint10', base).trueValue;
    const t30 = runFieldTest(ctx, s, 'sprint30', base).trueValue;
    const t40 = runFieldTest(ctx, s, 'sprint40yd', base).trueValue;
    expect(t10).toBeLessThan(t30);
    expect(t40).toBeGreaterThan(t30);
  });

  it('field VO2 error is wider than the lab VO2 error', () => {
    expect(ctx.P.model.evtFieldVo2ErrorSd).toBeGreaterThan(ctx.P.genetics.labVo2ErrorSd);
    const r = runFieldTest(ctx, averageMan(), 'fieldVo2', base);
    expect(r.noiseSd / r.value).toBeGreaterThan(ctx.P.genetics.labVo2ErrorSd);
  });

  it('rep-based 1RM estimates are noisier at high reps', () => {
    const s = averageMan();
    const lo = estimateOneRmFromReps(ctx, s, 'bench_press', 3, base);
    const hi = estimateOneRmFromReps(ctx, s, 'bench_press', 15, base);
    expect(hi.noiseSd / hi.value).toBeGreaterThan(lo.noiseSd / lo.value);
  });

  it('caffeine improves the 2K row time slightly', () => {
    const s = averageMan();
    const none = runFieldTest(ctx, s, 'row2k', base).trueValue;
    const caf = runFieldTest(ctx, s, 'row2k', { ...base, caffeineMg: 300 }).trueValue;
    expect(caf).toBeLessThan(none);
    expect(caf / none).toBeGreaterThan(0.95);
  });

  it('entry fees match the economy constants and prizes follow placement', () => {
    const s = averageMan();
    const econ = ctx.P.economy as unknown as Record<string, number>;
    for (const c of COMPETITIONS) {
      const r = simulateCompetition(ctx, s, c.id, base);
      expect(r.entryFee).toBe(econ[c.entryFeeConstantId.split('.')[1] as string]);
      expect(r.placement).toBeGreaterThanOrEqual(1);
      expect(r.placement).toBeLessThanOrEqual(r.fieldSize);
      expect(r.prize).toBeLessThanOrEqual(ctx.P.economy.prizeLocalWin);
      expect(r.fatigueLoad).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed and day and does not mutate the state', () => {
    const s = averageMan();
    const before = JSON.stringify(s);
    for (const c of COMPETITIONS) expect(simulateCompetition(ctx, s, c.id as CompetitionId, base)).toEqual(simulateCompetition(ctx, s, c.id, base));
    for (const t of FIELD_TESTS) {
      const o = { ...base, exerciseId: 'bench_press' };
      expect(runFieldTest(ctx, s, t.id, o)).toEqual(runFieldTest(ctx, s, t.id, o));
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});
