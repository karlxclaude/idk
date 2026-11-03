// Phase 4 acceptance tests (spec): iron -> VO2max, winter vitamin D, low energy availability -> bone stress.
// Assertions are bands, not points.
import { describe, expect, it } from 'vitest';
import { RUNNER_WEEK } from '../data/programs';
import { createCharacter } from '../engine/character';
import { fatFreeMass } from '../engine/body';
import { vo2maxRel } from '../engine/performance';
import { intakeFromTarget } from '../engine/plan';
import { runDays } from '../engine/runner';
import { vo2maxAbs } from '../engine/session';
import type { CharacterState, Intake } from '../engine/types';
import { ctx, goodPlan } from './helpers';

const P = ctx.P;
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const FERRITIN_PER_MG = 1 / 10; // labFerritinMgPerNgMl = 10 mg per ng/mL

function runner(sex: 'male' | 'female', seed: string, startDate?: string): CharacterState {
  return createCharacter(ctx, {
    sex, ageYears: 24, heightCm: sex === 'male' ? 178 : 166, ffmi: sex === 'male' ? 19 : 16, bodyFat: sex === 'male' ? 0.13 : 0.22,
    enduranceYears: 3,
    genetics: { responderHyp: 1, responderStr: 1, responderAer: 1, ffmiCeiling: 23.5, injuryProneness: 1, creatineResponder: true, typeIVL: 50, bmrFactor: 1, neatResponsiveness: 0.33, noviceSkill: 0.3, neuralFastGain: 0.1 },
    ...(startDate ? { startDate } : {}),
  }, seed);
}

/** Replace the diet-template intake with an explicit one whose micronutrients are overridden. */
function withIntake(over: Partial<Intake>, balanceKcal = 250) {
  return (s: CharacterState, inp: import('../engine/plan').DayInputsWithTarget) => {
    const target = inp.intakeTarget;
    if (!target) return;
    inp.intake = { ...intakeFromTarget(ctx, s, { ...target, balanceKcal }, s.lastTdee || 2800), ...over };
    delete inp.intakeTarget;
  };
}

describe('Phase 4 nutrition acceptance', () => {
  it('1. iron deficiency lowers VO2max (anemia worse than non-anemic deficiency)', () => {
    const plan = goodPlan(RUNNER_WEEK, {}, { supplements: { vitDIU: 1000 } });
    const days = 22 * 7;
    const base = runner('female', 'iron');
    // Mild: stores drift below the deficient line but stay above zero. Severe: stores exhausted.
    const mild = structuredClone(base);
    const severe = structuredClone(base);
    // Marginal stores at the start (ferritin ~10): the engine cannot reach anemia from a 400 mg start within 24 wk.
    severe.nutrition.ironStoreMg = 100;
    const ok = structuredClone(base);
    runDays(ctx, ok, plan, days, { adjust: withIntake({ ironHemeMg: 3, ironNonHemeMg: 14 }) });
    runDays(ctx, mild, plan, days, { adjust: withIntake({ ironHemeMg: 0.6, ironNonHemeMg: 7.5 }) });
    runDays(ctx, severe, plan, days, { adjust: withIntake({ ironHemeMg: 0, ironNonHemeMg: 2 }) });
    const m = (s: CharacterState) => ({
      ferritin: r1(s.nutrition.ironStoreMg * FERRITIN_PER_MG), hb: r2(s.aerobic.hbMassFraction), vo2: r1(vo2maxRel(ctx, s)),
      // what the sim actually applies in training: Hb mass plus the non-anemic IDA performance penalty
      vo2Eff: r1(vo2maxRel(ctx, s, s.nutrition.ironStoreMg < P.nutrition.ironStoreDeficientMg ? 1 - P.nutrition.idnaPerformancePenalty : 1)),
    });
    const [a, b, c] = [m(ok), m(mild), m(severe)];
    console.log('iron 22wk ok/mild/severe', JSON.stringify({ ok: a, mild: b, severe: c }));
    expect(c.ferritin).toBeLessThan(a.ferritin);
    expect(c.hb).toBeLessThan(a.hb);
    expect(severe.nutrition.ironStoreMg).toBeLessThan(P.nutrition.ironStoreDeficientMg);
    expect(c.vo2).toBeLessThan(a.vo2 * 0.97);
    // non-anemic deficiency: Hb unchanged, small penalty, smaller than anemia
    expect(mild.nutrition.ironStoreMg).toBeLessThan(P.nutrition.ironStoreDeficientMg);
    expect(mild.nutrition.ironStoreMg).toBeGreaterThan(P.nutrition.ironStoreAnemicMg);
    expect(b.vo2Eff).toBeLessThan(a.vo2Eff);
    expect(a.vo2Eff - b.vo2Eff).toBeLessThan(a.vo2 - c.vo2);
  }, 30000);

  it('2. winter with no sun/supplement -> vitamin D deficiency; 2000 IU/day prevents it; summer sun sufficient', () => {
    const lowD = { vitDIU: 150 };
    const winterPlan = goodPlan(RUNNER_WEEK, {}, { supplements: { vitDIU: 0 }, sunMinutes: 0 });
    const winter = runner('male', 'vitd', '2026-10-25');
    const suppl = structuredClone(winter);
    const start = winter.nutrition.vitDngml;
    runDays(ctx, winter, winterPlan, 120, { adjust: withIntake(lowD) }); // to ~late Feb
    runDays(ctx, suppl, { ...winterPlan, supplements: { vitDIU: 2000 } }, 120, { adjust: withIntake(lowD) });
    const summer = runner('male', 'vitd', '2026-05-15');
    runDays(ctx, summer, goodPlan(RUNNER_WEEK, {}, { supplements: { vitDIU: 0 }, sunMinutes: 30 }), 100, { adjust: withIntake(lowD) });
    console.log('vitD start/winter/winter+2000IU/summer', r1(start), r1(winter.nutrition.vitDngml), r1(suppl.nutrition.vitDngml), r1(summer.nutrition.vitDngml));
    expect(winter.nutrition.vitDngml).toBeLessThan(20);
    expect(suppl.nutrition.vitDngml).toBeGreaterThanOrEqual(20);
    expect(summer.nutrition.vitDngml).toBeGreaterThanOrEqual(20);
  }, 30000);

  it('3. low energy availability (<30 kcal/kg FFM/day) raises stress-fracture incidence and lowers bone density', () => {
    const plan = (random: boolean) => goodPlan(RUNNER_WEEK, {}, { disableRandomEvents: !random });
    const days = 14 * 7;
    // deterministic bone/EA state, no random events
    const lowS = runner('female', 'ea');
    const okS = structuredClone(lowS);
    const bmd0 = lowS.body.bmd;
    const eaLog: number[] = [];
    const ffm = fatFreeMass(lowS, P);
    const lowDiet = (s: CharacterState, inp: import('../engine/plan').DayInputsWithTarget) => { if (inp.intakeTarget) inp.intakeTarget.fixedKcal = Math.max(1000, 17 * ffm + 450); };
    runDays(ctx, lowS, plan(false), days, { adjust: lowDiet, onDay: (_s, r) => eaLog.push(r.report.energyAvailability) });
    const okLog: number[] = [];
    runDays(ctx, okS, plan(false), days, { adjust: withIntake({}, 300), onDay: (_s, r) => okLog.push(r.report.energyAvailability) });
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const lowEa = avg(eaLog.slice(14)), okEa = avg(okLog.slice(14));
    console.log('EA low/ok', r1(lowEa), r1(okEa), 'bmd', r2(bmd0), '->', r2(lowS.body.bmd), 'vs', r2(okS.body.bmd), 'lowEaDays', lowS.nutrition.lowEaDays);
    expect(lowEa).toBeLessThan(30);
    expect(okEa).toBeGreaterThanOrEqual(45);
    expect(lowS.body.bmd).toBeLessThan(bmd0);
    expect(lowS.body.bmd).toBeLessThan(okS.body.bmd);

    // Monte Carlo with random events
    const N = 200;
    let fxLow = 0, fxOk = 0;
    for (let i = 0; i < N; i++) {
      const base = runner('female', `mc${i}`);
      const l = structuredClone(base), o = structuredClone(base);
      const count = (s: CharacterState) => s.injuries.concat(s.injuryHistory).filter((x) => x.type === 'stressFracture').length;
      runDays(ctx, l, plan(true), days, { adjust: lowDiet });
      runDays(ctx, o, plan(true), days, { adjust: withIntake({}, 300) });
      fxLow += count(l); fxOk += count(o);
    }
    console.log(`stress fractures over ${N} runners x 14 wk: lowEA=${fxLow} adequate=${fxOk}`);
    expect(fxLow).toBeGreaterThan(fxOk * 1.3);
  }, 120000);

  it('4a. vegan diet without B12 depletes B12 status over months', () => {
    const s = runner('male', 'b12');
    const ctl = structuredClone(s);
    const plan = goodPlan(RUNNER_WEEK, { diet: 'vegan' });
    runDays(ctx, s, plan, 540);
    runDays(ctx, ctl, { ...plan, supplements: { vitDIU: 1000, b12: true } }, 540);
    console.log('B12 status vegan/supplemented', r2(s.nutrition.b12Status), r2(ctl.nutrition.b12Status));
    expect(s.nutrition.b12Status).toBeLessThan(0.5);
    expect(ctl.nutrition.b12Status).toBeGreaterThan(0.9);
  }, 30000);

  // GAP: mgPerf scales aerobicPerfMult (lowers effective VO2, so absolute kcal per session falls) instead of raising energy cost.
  it('4b. magnesium deficiency raises exercise energy cost', () => {
    const lowMg = runner('male', 'mg');
    const okMg = structuredClone(lowMg);
    const plan = goodPlan(RUNNER_WEEK);
    runDays(ctx, lowMg, plan, 120, { adjust: withIntake({ magnesiumMg: 80 }) });
    runDays(ctx, okMg, plan, 120, { adjust: withIntake({ magnesiumMg: 450 }) });
    const run = (s: CharacterState) => {
      let k = 0;
      runDays(ctx, s, plan, 7, { adjust: withIntake({ magnesiumMg: s === lowMg ? 80 : 450 }), onDay: (_st, r) => { k += r.report.tdee.exercise; } });
      const km = s.aerobic.runKmHist.reduce((a, b) => a + b, 0) * 7 / 28;
      return k / km; // kcal per km run
    };
    const eLow = run(lowMg), eOk = run(okMg);
    console.log('Mg status low/ok', r2(lowMg.nutrition.magnesiumStatus), r2(okMg.nutrition.magnesiumStatus), 'kcal per km', Math.round(eLow), Math.round(eOk), 'vo2abs', r2(vo2maxAbs(ctx, lowMg)), r2(vo2maxAbs(ctx, okMg)));
    expect(lowMg.nutrition.magnesiumStatus).toBeLessThan(P.model.magnesiumDeficientStatus);
    expect(okMg.nutrition.magnesiumStatus).toBeGreaterThanOrEqual(P.model.magnesiumDeficientStatus);
    expect(eLow).toBeGreaterThan(eOk);
  }, 30000);
});
