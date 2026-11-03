import { describe, expect, it } from 'vitest';
import { FULL_BODY_WEEK } from '../data/programs';
import { runDays } from '../engine/runner';
import { explainChange, explainDay, METRICS_WITHOUT_FACTORS } from '../engine/why';
import type { DayReport } from '../engine/types';
import type { DayLog } from '../engine/game';
import { bodyFatFraction, bodyMass } from '../engine/body';
import { averageMan, ctx, goodPlan } from './helpers';

const DAYS = 28;
function run(balanceKcal: number, sleepH: number) {
  const s = averageMan();
  const reports: DayReport[] = [];
  const history: DayLog[] = [];
  const log = () => history.push({ day: s.day, date: '', bodyMass: bodyMass(s, ctx.P), bodyFat: bodyFatFraction(s, ctx.P), lifts: {}, readiness: s.fatigue.readiness, fitness: 0, fatigue: 0, kcalIn: 0, kcalOut: 0, proteinG: 0, proteinQuality: 0, cash: 0, financialStress: 0, vo2maxRel: 0, cmj: null });
  log();
  runDays(ctx, s, goodPlan(FULL_BODY_WEEK, { balanceKcal }, { sleepH }), DAYS, { onDay: (_st, r) => { reports.push(r.report); log(); } });
  return { reports, history };
}

describe('Why? panel', () => {
  const deficit = run(-600, 5.5);
  const control = run(250, 8);
  const ex = explainChange(deficit.reports, deficit.history, 'leanMass', 0, DAYS);
  const exC = explainChange(control.reports, control.history, 'leanMass', 0, DAYS);
  const eff = (r: typeof ex, n: string) => r.factors.find((f) => f.name === n)?.effectPct ?? 0;

  it('deficit run lists negative energy and sleep factors', () => {
    expect(eff(ex, 'energyBalance') + eff(ex, 'energyAvailability')).toBeLessThan(-2);
    expect(eff(ex, 'sleep')).toBeLessThan(-2);
    expect(ex.sentence).toMatch(/deficit/);
    expect(ex.sentence).toMatch(/sleep/);
  });
  it('control has no negative for energy and sleep', () => {
    expect(eff(exC, 'energyBalance')).toBeGreaterThanOrEqual(-2); // a surplus boosts rather than reduces
    expect(Math.abs(eff(exC, 'sleep'))).toBeLessThan(2);
    expect(exC.sentence).not.toMatch(/deficit/);
  });
  it('is deterministic and handles undecomposed metrics', () => {
    expect(explainChange(deficit.reports, deficit.history, 'leanMass', 0, DAYS)).toEqual(ex);
    const fm = explainChange(deficit.reports, deficit.history, 'fatMass', 0, DAYS);
    expect(fm.factors).toEqual([]);
    expect(fm.sentence).toMatch(/not decomposed/);
    expect(METRICS_WITHOUT_FACTORS).toContain('bodyMass');
    expect(explainDay(deficit.reports[DAYS - 1] as DayReport).hypertrophy.length).toBeGreaterThan(0);
  });
});
