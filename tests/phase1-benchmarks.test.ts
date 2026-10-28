// Phase 1 physiology benchmarks (spec section 10). Assertions are bands, not points.
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import {
  ARM_ONLY_WEEK, CARDIO_WEEK, FULL_BODY_WEEK, PLYO_SESSION, RUNNER_WEEK, loadWeek, volumeWeek, weekOf, FULL_BODY_A, FULL_BODY_B, EASY_RUN, TEMPO_RUN, INTERVALS_4X4,
} from '../data/programs';
import { bodyMass, fatFreeMass, measuredMuscleSize, normalizedFfmi, skeletalMuscle } from '../engine/body';
import { createCharacter } from '../engine/character';
import { mean, stddev } from '../engine/math';
import { countermovementJump, lowerFv, vo2maxRel } from '../engine/performance';
import { makeRng } from '../engine/rng';
import { bodyFatTargetDiet, runDays } from '../engine/runner';
import { simulateDay } from '../engine/sim';
import { inputsForDay } from '../engine/plan';
import { testOneRepMax as oneRepMax } from '../engine/strength';
import { expenditure } from '../engine/energy';
import { emptyIntake } from '../engine/plan';
import { averageMan, ctx, goodPlan, pct, summary } from './helpers';

const P = ctx.P;
const LIFTS = ['back_squat_high_bar', 'bench_press', 'conventional_deadlift', 'overhead_press'];
const TRAINED: MuscleId[] = ['vasti', 'gluteMax', 'midLowerChest', 'lats', 'biceps', 'tricepsLatMed', 'hamstrings', 'frontDelts'];
const tissueLean = (s: ReturnType<typeof averageMan>) => skeletalMuscle(s) + s.body.nonMuscleLean;

const R: Record<string, Record<string, unknown>> = {};
const r1 = (x: number) => Math.round(x * 10) / 10;
afterAll(() => {
  const dir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'phase1-benchmarks.json'), JSON.stringify(R, null, 2) + '\n');
});

describe('Phase 1 benchmarks', () => {
  it('1. untrained average man, 12 weeks good conditions: CSA +5-15%, lean +1-3 kg, lifts +20-50%', () => {
    const s = averageMan();
    const size0 = Object.fromEntries(TRAINED.map((m) => [m, measuredMuscleSize(s, P, m)]));
    const ffm0 = fatFreeMass(s, P);
    const l0 = LIFTS.map((l) => oneRepMax(ctx, s, l));
    runDays(ctx, s, goodPlan(FULL_BODY_WEEK), 84);
    const sizeGain = TRAINED.map((m) => pct(size0[m] as number, measuredMuscleSize(s, P, m)));
    const leanGain = fatFreeMass(s, P) - ffm0;
    const liftGain = LIFTS.map((l, i) => pct(l0[i] as number, oneRepMax(ctx, s, l)));
    R['1'] = { trainedCsaPct: r1(mean(sizeGain)), leanKg: r1(leanGain), liftPct: Object.fromEntries(LIFTS.map((l, i) => [l, r1(liftGain[i] as number)])) };
    expect(mean(sizeGain)).toBeGreaterThanOrEqual(5);
    expect(mean(sizeGain)).toBeLessThanOrEqual(15);
    expect(leanGain).toBeGreaterThanOrEqual(1);
    expect(leanGain).toBeLessThanOrEqual(3);
    for (const g of liftGain) {
      expect(g).toBeGreaterThanOrEqual(20);
      expect(g).toBeLessThanOrEqual(50);
    }
  });

  it('2. same character, 4 years: year-1 lean 6-11 kg, later years roughly halving, normalized FFMI <= 25', () => {
    // Small surplus that shrinks as body fat rises above 15% (a lean bulk), DXA-style lean mass.
    const s = averageMan({ bodyFat: 0.14 });
    const plan = goodPlan(FULL_BODY_WEEK);
    const diet = bodyFatTargetDiet(ctx, 0.15, 300, 120);
    const lean: number[] = [fatFreeMass(s, P)];
    for (let y = 0; y < 4; y++) {
      runDays(ctx, s, plan, 365, { adjust: diet });
      lean.push(fatFreeMass(s, P));
    }
    const gains = lean.slice(1).map((v, i) => v - (lean[i] as number));
    const [y1, y2, y3, y4] = gains as [number, number, number, number];
    R['2'] = { yearlyLeanKg: gains.map(r1), normalizedFfmi: r1(normalizedFfmi(s, P)) };
    expect(y1).toBeGreaterThanOrEqual(6);
    expect(y1).toBeLessThanOrEqual(11);
    expect(y2 / y1).toBeGreaterThan(0.3);
    expect(y2 / y1).toBeLessThan(0.7);
    expect(y3 / y2).toBeGreaterThan(0.3);
    expect(y3 / y2).toBeLessThan(0.8);
    expect(y4).toBeGreaterThan(0.3);
    expect(y4).toBeLessThan(1.5);
    expect(normalizedFfmi(s, P)).toBeLessThanOrEqual(25);
  });

  it('3. 1,000 random characters on one arm program: Hubal-like spread (near-zero responders, long right tail)', () => {
    const csa: number[] = [];
    const str: number[] = [];
    const rng = makeRng('hubal');
    for (let i = 0; i < 1000; i++) {
      const sex = rng.chance(0.58) ? 'female' : 'male';
      const s = createCharacter(ctx, { sex, ageYears: 18 + rng.next() * 12 }, `hubal-${i}`);
      const c0 = measuredMuscleSize(s, P, 'biceps');
      const r0 = oneRepMax(ctx, s, 'barbell_curl');
      runDays(ctx, s, goodPlan(ARM_ONLY_WEEK, { balanceKcal: 100 }), 84);
      // MRI and 1RM test measurement error
      csa.push(pct(c0, measuredMuscleSize(s, P, 'biceps')) + rng.normal(0, 2));
      str.push(pct(r0, oneRepMax(ctx, s, 'barbell_curl')) * (1 + rng.normal(0, 0.03)) + rng.normal(0, 3));
    }
    const c = summary(csa);
    const r = summary(str);
    R['3'] = { csaPct: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, r1(v)])), csaCv: r1(stddev(csa) / mean(csa) * 100) / 100, oneRmPct: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, r1(v)])) };
    // Hubal 2005: CSA -2 to +59% (CV ~0.5), 1RM 0 to +250%.
    expect(c.min).toBeLessThan(3);
    expect(c.max).toBeGreaterThan(35);
    expect(c.mean).toBeGreaterThan(c.median);
    expect(c.p95 / c.median).toBeGreaterThan(1.8);
    const cv = stddev(csa) / mean(csa);
    expect(cv).toBeGreaterThan(0.35);
    expect(cv).toBeLessThan(0.9);
    expect(r.min).toBeLessThan(12);
    expect(r.max).toBeGreaterThan(100);
    expect(r.mean).toBeGreaterThan(r.median);
  }, 300000);

  it('4. 4 vs 10 vs 20 weekly sets: hypertrophy monotonic with diminishing returns; strength plateaus earlier', () => {
    const base = averageMan({}, 'volume');
    const res = [4, 10, 20].map((v) => {
      const s = structuredClone(base);
      const h0 = s.muscles.vasti.mass + s.muscles.biceps.mass;
      const r0 = oneRepMax(ctx, s, 'leg_extension') + oneRepMax(ctx, s, 'barbell_curl');
      runDays(ctx, s, goodPlan(volumeWeek(v)), 84);
      return { hyp: pct(h0, s.muscles.vasti.mass + s.muscles.biceps.mass), str: pct(r0, oneRepMax(ctx, s, 'leg_extension') + oneRepMax(ctx, s, 'barbell_curl')) };
    });
    const [a, b, c] = res as [typeof res[0], typeof res[0], typeof res[0]];
    R['4'] = { sets4: { hyp: r1(a.hyp), str: r1(a.str) }, sets10: { hyp: r1(b.hyp), str: r1(b.str) }, sets20: { hyp: r1(c.hyp), str: r1(c.str) } };
    expect(b.hyp).toBeGreaterThan(a.hyp);
    expect(c.hyp).toBeGreaterThan(b.hyp);
    expect((c.hyp - b.hyp) / 10).toBeLessThan((b.hyp - a.hyp) / 6);
    // strength gains: relative increment 10->20 smaller than hypertrophy's
    expect((c.str - b.str) / b.str).toBeLessThan((c.hyp - b.hyp) / b.hyp);
  });

  it('5. 30% vs 80% 1RM to failure: similar hypertrophy (+/-15%), 80% clearly stronger; 20% clearly less growth', () => {
    const base = averageMan({}, 'load');
    const run = (pctLoad: number) => {
      const s = structuredClone(base);
      const h0 = s.muscles.vasti.mass + s.muscles.biceps.mass;
      const r0 = oneRepMax(ctx, s, 'leg_press') + oneRepMax(ctx, s, 'barbell_curl');
      runDays(ctx, s, goodPlan(loadWeek(pctLoad, 3)), 84);
      return { hyp: pct(h0, s.muscles.vasti.mass + s.muscles.biceps.mass), str: pct(r0, oneRepMax(ctx, s, 'leg_press') + oneRepMax(ctx, s, 'barbell_curl')) };
    };
    const l30 = run(30);
    const l80 = run(80);
    const l20 = run(20);
    R['5'] = { pct20: { hyp: r1(l20.hyp), str: r1(l20.str) }, pct30: { hyp: r1(l30.hyp), str: r1(l30.str) }, pct80: { hyp: r1(l80.hyp), str: r1(l80.str) } };
    expect(Math.abs(l30.hyp / l80.hyp - 1)).toBeLessThanOrEqual(0.15);
    expect(l80.str).toBeGreaterThan(l30.str * 1.2);
    expect(l20.hyp).toBeLessThan(l80.hyp * 0.75);
  });

  it('6. beginner at -500 kcal/day: average lean gain ~0, strength still rises', () => {
    const gains: number[] = [];
    const strs: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = averageMan({ bodyFat: 0.2 }, `def${i}`);
      const l0 = tissueLean(s);
      const r0 = oneRepMax(ctx, s, 'back_squat_high_bar');
      runDays(ctx, s, goodPlan(FULL_BODY_WEEK, { balanceKcal: -500 }), 84);
      gains.push(tissueLean(s) - l0);
      strs.push(pct(r0, oneRepMax(ctx, s, 'back_squat_high_bar')));
    }
    R['6'] = { tissueLeanKg: r1(mean(gains) * 10) / 10, squatPct: r1(mean(strs)) };
    expect(Math.abs(mean(gains))).toBeLessThan(0.8);
    expect(mean(strs)).toBeGreaterThan(10);
  });

  it('7. detraining: strength kept at 3 weeks, measurable loss at 8; retraining reaches the peak faster than the original climb', () => {
    const train = goodPlan(FULL_BODY_WEEK);
    const rest = goodPlan(weekOf({}), { balanceKcal: 0 });
    const lift = 'back_squat_high_bar';
    const climb: number[] = [];
    const s3 = averageMan({}, 'detrain');
    runDays(ctx, s3, train, 84, { onDay: (st) => climb.push(oneRepMax(ctx, st, lift)) });
    const peak = oneRepMax(ctx, s3, lift);
    const s8 = structuredClone(s3);
    runDays(ctx, s3, rest, 21);
    const after3 = oneRepMax(ctx, s3, lift);
    runDays(ctx, s8, rest, 56);
    const after8 = oneRepMax(ctx, s8, lift);
    expect(pct(peak, after3)).toBeGreaterThan(-3);
    expect(pct(peak, after8)).toBeLessThan(-3);
    expect(pct(peak, after8)).toBeGreaterThan(-20);
    // original climb time from the detrained level to the peak
    const firstReach = climb.findIndex((v) => v >= after8);
    const originalClimb = 84 - firstReach;
    let regain = 0;
    while (oneRepMax(ctx, s8, lift) < peak && regain < 200) {
      runDays(ctx, s8, train, 1);
      regain++;
    }
    R['7'] = { after3wkPct: r1(pct(peak, after3)), after8wkPct: r1(pct(peak, after8)), regainDays: regain, originalClimbDays: originalClimb };
    expect(regain).toBeLessThan(originalClimb);
  });

  it('8. untrained 12 weeks cardio: VO2max +10-20%; trained character detrained 8 weeks: -10 to -20%', () => {
    const s = averageMan({}, 'cardio');
    const v0 = vo2maxRel(ctx, s);
    runDays(ctx, s, goodPlan(CARDIO_WEEK, { balanceKcal: 0 }), 84);
    const g = pct(v0, vo2maxRel(ctx, s));
    expect(g).toBeGreaterThanOrEqual(10);
    expect(g).toBeLessThanOrEqual(20);
    const t = averageMan({ enduranceYears: 3 }, 'trained-runner');
    runDays(ctx, t, goodPlan(RUNNER_WEEK, { balanceKcal: 0 }), 56);
    const vt = vo2maxRel(ctx, t);
    runDays(ctx, t, goodPlan(weekOf({}), { balanceKcal: 0 }), 56);
    const loss = pct(vt, vo2maxRel(ctx, t));
    R['8'] = { untrained12wkPct: r1(g), trainedDetrain8wkPct: r1(loss) };
    expect(loss).toBeLessThanOrEqual(-10);
    expect(loss).toBeGreaterThanOrEqual(-20);
  });

  it('9. high-volume running added to lifting: power gains reduced more than hypertrophy gains', () => {
    const liftWeek = weekOf({ 0: [FULL_BODY_A], 1: [PLYO_SESSION], 2: [FULL_BODY_B], 4: [FULL_BODY_A], 5: [PLYO_SESSION] });
    const runWeek = weekOf({
      0: [FULL_BODY_A, { ...EASY_RUN(60), startHour: 18 }], 1: [PLYO_SESSION, TEMPO_RUN(45)], 2: [FULL_BODY_B, { ...EASY_RUN(50), startHour: 18 }],
      3: [INTERVALS_4X4], 4: [FULL_BODY_A, { ...EASY_RUN(45), startHour: 18 }], 5: [PLYO_SESSION, EASY_RUN(60)], 6: [EASY_RUN(90)],
    });
    const base = averageMan({}, 'interference');
    const run = (week: typeof liftWeek, _label: string) => {
      const s = structuredClone(base);
      const m0 = skeletalMuscle(s);
      const p0 = lowerFv(ctx, s).pmax;
      runDays(ctx, s, goodPlan(week), 84);
      return { hyp: skeletalMuscle(s) - m0, pow: lowerFv(ctx, s).pmax - p0 };
    };
    const alone = run(liftWeek, 'interf-a');
    const combo = run(runWeek, 'interf-b');
    const hypReduction = 1 - combo.hyp / alone.hyp;
    const powReduction = 1 - combo.pow / alone.pow;
    R['9'] = { hypertrophyReductionPct: r1(hypReduction * 100), powerReductionPct: r1(powReduction * 100) };
    expect(powReduction).toBeGreaterThan(hypReduction);
    expect(powReduction).toBeGreaterThan(0.1);
  });

  it('10. sustained deficit: weight loss slows over time (Hall-type, not the 3,500 kcal rule)', () => {
    const s = averageMan({ bodyFat: 0.3, ffmi: 19.5 }, 'deficit');
    const ex0 = expenditure(ctx, s, { ...emptyIntake(), kcal: 2500, proteinG: 100, carbG: 300, fatG: 80 }, 0, 0, 1.5);
    const kcal = ex0.total - 500;
    const plan = goodPlan(weekOf({}), { fixedKcal: kcal, balanceKcal: 0, proteinGkg: 1.2 });
    const w: number[] = [bodyMass(s, P)];
    for (let wk = 0; wk < 52; wk++) {
      runDays(ctx, s, plan, 7);
      w.push(bodyMass(s, P));
    }
    const early = (w[2] as number) - (w[14] as number); // weeks 2-14
    const late = (w[40] as number) - (w[52] as number); // weeks 40-52
    // Hall 2011: half of the eventual change in ~1 year (time constant ~1-1.5 y) => late/early ~0.55-0.7.
    expect(late).toBeLessThan(early * 0.7);
    const total = (w[0] as number) - (w[52] as number);
    const rule = (500 * 364) / 7700;
    R['10'] = { lostKg1yr: r1(total), ruleKg: r1(rule), weeks2to14Kg: r1(early), weeks40to52Kg: r1(late) };
    expect(total).toBeLessThan(rule * 0.75);
    expect(total).toBeGreaterThan(rule * 0.25);
  });

  it('11. same deficit with 5.5 h vs 8.5 h sleep: short sleep loses a larger share as lean mass', () => {
    const base = averageMan({ bodyFat: 0.3, ageYears: 41 }, 'sleep');
    const run = (sleep: number) => {
      const s = structuredClone(base);
      const w0 = bodyMass(s, P);
      const f0 = fatFreeMass(s, P);
      runDays(ctx, s, goodPlan(weekOf({}), { balanceKcal: -700, proteinGkg: 1.0 }, { sleepH: sleep }), 14);
      return (f0 - fatFreeMass(s, P)) / (w0 - bodyMass(s, P));
    };
    const short = run(5.5);
    const long = run(8.5);
    R['11'] = { leanShare55h: r1(short * 100) / 100, leanShare85h: r1(long * 100) / 100 };
    expect(short).toBeGreaterThan(long + 0.1);
  });

  it('12. plyometrics 8-12 weeks: CMJ +5-9%; adding 3 kg fat with no strength change lowers jump height', () => {
    const s = averageMan({}, 'plyo');
    const c0 = countermovementJump(ctx, s);
    runDays(ctx, s, goodPlan(weekOf({ 1: [PLYO_SESSION], 4: [PLYO_SESSION] }), { balanceKcal: 0 }), 70);
    const c1 = countermovementJump(ctx, s);
    const g = pct(c0, c1);
    expect(g).toBeGreaterThanOrEqual(5);
    expect(g).toBeLessThanOrEqual(9);
    const fat = structuredClone(s);
    fat.body.fatMass += 3;
    R['12'] = { cmjPct: r1(g), cmjCm: r1(c1 * 100), cmjPlus3kgFatCm: r1(countermovementJump(ctx, fat) * 100) };
    expect(countermovementJump(ctx, fat)).toBeLessThan(c1);
  });

  it('13. creatine: +1-2 kg in week 1; ~8 percentage points extra strength gain on average; non-responders exist', () => {
    const rng = makeRng('creatine');
    const extra: number[] = [];
    const water: number[] = [];
    for (let i = 0; i < 60; i++) {
      const sex = rng.chance(0.5) ? 'male' : 'female';
      const prof = { sex: sex as 'male' | 'female', ageYears: 20 + rng.next() * 10 };
      const a = createCharacter(ctx, prof, `cr-${i}`);
      const b = createCharacter(ctx, prof, `cr-${i}`);
      const r0 = oneRepMax(ctx, a, 'bench_press') + oneRepMax(ctx, a, 'back_squat_high_bar');
      const planA = goodPlan(FULL_BODY_WEEK);
      const planB = goodPlan(FULL_BODY_WEEK, {}, { supplements: { vitDIU: 1000, creatine: true, creatineLoading: true } });
      const wA = bodyMass(a, P);
      runDays(ctx, a, planA, 7);
      runDays(ctx, b, planB, 7);
      water.push(bodyMass(b, P) - bodyMass(a, P) - 0 * wA);
      planB.supplements = { vitDIU: 1000, creatine: true };
      runDays(ctx, a, planA, 77);
      runDays(ctx, b, planB, 77);
      const ga = pct(r0, oneRepMax(ctx, a, 'bench_press') + oneRepMax(ctx, a, 'back_squat_high_bar'));
      const gb = pct(r0, oneRepMax(ctx, b, 'bench_press') + oneRepMax(ctx, b, 'back_squat_high_bar'));
      extra.push(gb - ga);
    }
    const responders = water.filter((w) => w > 0.5);
    R['13'] = { week1WaterKgResponders: r1(mean(responders)), extraStrengthPctPoints: r1(mean(extra)), nonResponderShare: r1((water.filter((w) => w < 0.4).length / water.length) * 100) / 100 };
    expect(mean(responders)).toBeGreaterThanOrEqual(1);
    expect(mean(responders)).toBeLessThanOrEqual(2);
    expect(mean(extra)).toBeGreaterThanOrEqual(4);
    expect(mean(extra)).toBeLessThanOrEqual(12);
    const nonResponders = water.filter((w) => w < 0.4).length / water.length;
    expect(nonResponders).toBeGreaterThan(0.08);
    expect(nonResponders).toBeLessThan(0.45);
  }, 120000);

  it('14. determinism and performance: same seed -> identical output; 10 years headless < 3 s', () => {
    const plan = { ...goodPlan(FULL_BODY_WEEK), disableRandomEvents: false };
    const a = averageMan({}, 'det');
    const b = averageMan({}, 'det');
    runDays(ctx, a, plan, 365);
    runDays(ctx, b, plan, 365);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = averageMan({}, 'perf');
    const t0 = performance.now();
    runDays(ctx, c, plan, 3653);
    const ms = performance.now() - t0;
    R['14'] = { deterministic: JSON.stringify(a) === JSON.stringify(b), tenYearMs: Math.round(ms) };
    expect(ms).toBeLessThan(3000);
    expect(MUSCLE_REGIONS.every((m) => Number.isFinite(c.muscles[m].mass))).toBe(true);
  }, 60000);
});

// keep imports used
void simulateDay;
void inputsForDay;
