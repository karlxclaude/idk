import { describe, expect, it } from 'vitest';
import { JOBS, type JobId } from '../data/jobs';
import { inputsForDay } from '../engine/plan';
import { simulateDay } from '../engine/sim';
import { AutoResolveUnavailableError, CertificationRequiredError, certificationCost, isShiftDay, jobDayInputs, miniGameDifficulty, recordPlay, resolveShift, type JobHistory } from '../engine/jobs';
import { averageMan, ctx, goodPlan } from './helpers';

const plan = goodPlan([]);

function runDays(jobId: JobId, days: number) {
  const s = averageMan({}, 'job');
  let hist: JobHistory = {};
  hist = recordPlay(hist, jobId, 0.8);
  let first;
  for (let d = 0; d < days; d++) {
    let inp = inputsForDay(plan, d);
    if (isShiftDay(jobId, d)) inp = jobDayInputs(inp, resolveShift(ctx, s, jobId, 0.8, hist));
    const r = simulateDay(ctx, s, inp);
    first ??= r;
  }
  return { s, first };
}

describe('jobs', () => {
  it('defines at least 6 jobs with distinct mini-games', () => {
    expect(JOBS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(JOBS.map((j) => j.miniGame)).size).toBe(JOBS.length);
  });

  it('sleep-deprived or stressed characters earn less', () => {
    const rested = averageMan({}, 'a');
    const tired = averageMan({}, 'a');
    tired.fatigue.sleepDebtH = 15; tired.fatigue.stress = 0.8; tired.fatigue.readiness = 0.5;
    rested.fatigue.readiness = 0.9;
    expect(miniGameDifficulty(ctx, tired)).toBeLessThan(miniGameDifficulty(ctx, rested));
    const hist = recordPlay({}, 'warehouse_picker', 0.8);
    for (const p of [0.8, 'auto'] as const) {
      expect(resolveShift(ctx, tired, 'warehouse_picker', p, hist).pay).toBeLessThan(resolveShift(ctx, rested, 'warehouse_picker', p, hist).pay);
    }
  });

  it('data entry has lower TEE than warehouse work', () => {
    const tee = (id: JobId) => {
      const s = averageMan({}, 'tee');
      const hist = recordPlay({}, id, 0.8);
      return simulateDay(ctx, s, jobDayInputs(inputsForDay(plan, 0), resolveShift(ctx, s, id, 0.8, hist))).report.tdee.total;
    };
    expect(tee('data_entry')).toBeLessThan(tee('warehouse_picker'));
  });

  it('auto-resolve is unavailable before the first play', () => {
    const s = averageMan();
    expect(() => resolveShift(ctx, s, 'line_cook', 'auto', {})).toThrow(AutoResolveUnavailableError);
    const r = resolveShift(ctx, s, 'line_cook', 'auto', recordPlay({}, 'line_cook', 0.6));
    expect(r.performance).toBeCloseTo(0.6);
  });

  it('construction raises stress and lowers readiness more than retail over 2 weeks', () => {
    const c = runDays('construction_labor', 14).s;
    const r = runDays('retail_stocking', 14).s;
    expect(c.fatigue.stress).toBeGreaterThan(r.fatigue.stress);
    expect(c.fatigue.readiness).toBeLessThan(r.fatigue.readiness);
  });

  it('bike delivery adds a cycling session and removes it from job hours', () => {
    const s = averageMan();
    const r = resolveShift(ctx, s, 'bike_delivery', 0.7, {});
    expect(r.cardio?.kind).toBe('cardio');
    expect(r.dayInputs.jobHours).toBeLessThan(r.hours);
    expect(jobDayInputs(inputsForDay(plan, 0), r).sessions).toHaveLength(1);
  });

  it('personal trainer requires certification', () => {
    const s = averageMan();
    expect(() => resolveShift(ctx, s, 'personal_trainer', 0.7, {})).toThrow(CertificationRequiredError);
    expect(resolveShift(ctx, s, 'personal_trainer', 0.7, {}, { certified: true }).pay).toBeGreaterThan(0);
    expect(certificationCost(ctx, 'personal_trainer')).toBe(ctx.P.economy.ptCertificationCost);
  });
});
