// Phase 3: each genetic / individual trait changes outcomes mechanically (paired comparisons, one trait changed).
import { describe, expect, it } from 'vitest';
import { FULL_BODY_WEEK } from '../data/programs';
import { bodyMass, fatFreeMass } from '../engine/body';
import { createCharacter, type CharacterProfile } from '../engine/character';
import { countermovementJump, sprintProfile, sprintTime, vo2maxRel, YARDS_40 } from '../engine/performance';
import { bodyFatTargetDiet, runDays } from '../engine/runner';
import { exerciseOf } from '../engine/context';
import { repsAt, repsMultiplier, testOneRepMax as oneRepMax } from '../engine/strength';
import { totalMuscle } from '../engine/character';
import type { Genetics } from '../engine/types';
import { ctx, goodPlan } from './helpers';

const P = ctx.P;
const SQ = 'back_squat_high_bar';
const DL = 'conventional_deadlift';
const BP = 'bench_press';

const BASE_GEN: Partial<Genetics> = {
  responderHyp: 1, responderStr: 1, responderAer: 1, ffmiCeiling: 23.5, injuryProneness: 1, creatineResponder: true, typeIVL: 50,
  bmrFactor: 1, neatResponsiveness: 0.33, noviceSkill: 0.3, neuralFastGain: 0.1, actn3xx: false, tendonStiffness: 1,
};

/** Same seed + same base profile; only the passed overrides differ. */
function make(over: Partial<CharacterProfile> = {}, gen: Partial<Genetics> = {}, seed = 'trait') {
  return createCharacter(ctx, {
    sex: 'male', ageYears: 22, heightCm: 177, ffmi: 18.5, bodyFat: 0.16,
    ...over,
    genetics: { ...BASE_GEN, ...gen },
  }, seed);
}
const lean = (s: ReturnType<typeof make>) => fatFreeMass(s, P);
const log = (name: string, o: Record<string, number | string>) => console.log(`[trait] ${name}`, JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

describe('Phase 3 trait effects', () => {
  it('1. long femurs relative to torso: lower squat:deadlift ratio', () => {
    const a = make();
    const b = structuredClone(a);
    b.anthro.thigh *= 1.05;
    b.anthro.torso *= 0.95;
    const ra = oneRepMax(ctx, a, SQ) / oneRepMax(ctx, a, DL);
    const rb = oneRepMax(ctx, b, SQ) / oneRepMax(ctx, b, DL);
    log('1 femur', { ratioBase: ra, ratioLongFemur: rb });
    expect(rb).toBeLessThan(ra);
  });

  it('2. long arms: higher deadlift, lower bench', () => {
    const a = make();
    const b = structuredClone(a);
    b.anthro.upperArm *= 1.06;
    b.anthro.forearm *= 1.06;
    log('2 arms', { dlBase: oneRepMax(ctx, a, DL), dlLong: oneRepMax(ctx, b, DL), bpBase: oneRepMax(ctx, a, BP), bpLong: oneRepMax(ctx, b, BP) });
    expect(oneRepMax(ctx, b, DL)).toBeGreaterThan(oneRepMax(ctx, a, DL));
    expect(oneRepMax(ctx, b, BP)).toBeLessThan(oneRepMax(ctx, a, BP));
  });

  it('3. responderHyp: low gains less lean mass than average, high gains more (identical program and diet)', () => {
    const gain = (r: number) => {
      const s = make({}, { responderHyp: r });
      const l0 = lean(s);
      runDays(ctx, s, goodPlan(FULL_BODY_WEEK), 112);
      return lean(s) - l0;
    };
    const lo = gain(0.5), mid = gain(1), hi = gain(1.6);
    log('3 responderHyp', { lo, mid, hi });
    expect(lo).toBeLessThan(mid);
    expect(hi).toBeGreaterThan(mid);
  }, 60000);

  it('4. fiber type: low typeIVL gives higher CMJ and fewer reps at 75% 1RM than high typeIVL', () => {
    const fast = make({}, { typeIVL: 30 });
    const slow = make({}, { typeIVL: 75 });
    const e = exerciseOf(ctx, SQ);
    const repsFast = repsAt(ctx, 0.75, repsMultiplier(ctx, fast, e, 0));
    const repsSlow = repsAt(ctx, 0.75, repsMultiplier(ctx, slow, e, 0));
    const cFast = countermovementJump(ctx, fast);
    const cSlow = countermovementJump(ctx, slow);
    log('4 fiber', { cmjFastCm: cFast * 100, cmjSlowCm: cSlow * 100, repsFast, repsSlow });
    expect(cFast).toBeGreaterThan(cSlow);
    expect(repsFast).toBeLessThan(repsSlow);
  });

  it('5. higher ffmiCeiling gives more lean gain over a long run (and a higher mmax)', () => {
    const lo = make({}, { ffmiCeiling: 21.5 });
    const hi = make({}, { ffmiCeiling: 25.5 });
    expect(totalMuscle(hi)).toBeCloseTo(totalMuscle(lo), 6);
    const mmax = (s: typeof lo) => Object.values(s.muscles).reduce((t, m) => t + m.mmax, 0);
    expect(mmax(hi)).toBeGreaterThan(mmax(lo));
    const l0 = lean(lo);
    const diet = (s: typeof lo) => bodyFatTargetDiet(ctx, 0.15, 300, 120);
    runDays(ctx, lo, goodPlan(FULL_BODY_WEEK), 2 * 365, { adjust: diet(lo) });
    runDays(ctx, hi, goodPlan(FULL_BODY_WEEK), 2 * 365, { adjust: diet(hi) });
    log('5 ceiling', { mmaxLo: mmax(lo), mmaxHi: mmax(hi), leanGainLo: lean(lo) - l0, leanGainHi: lean(hi) - l0 });
    expect(lean(hi) - l0).toBeGreaterThan(lean(lo) - l0);
  }, 90000);

  it('6. creatine non-responder: no strength or body-mass gain from creatine, responder has both', () => {
    const run = (responder: boolean, creatine: boolean) => {
      const s = make({}, { creatineResponder: responder });
      const plan = goodPlan(FULL_BODY_WEEK, {}, { supplements: { vitDIU: 1000, creatine, creatineLoading: creatine } });
      runDays(ctx, s, plan, 28);
      return { s, str: oneRepMax(ctx, s, BP) + oneRepMax(ctx, s, SQ), mass: bodyMass(s, P) };
    };
    const rOn = run(true, true), rOff = run(true, false);
    const nOn = run(false, true), nOff = run(false, false);
    log('6 creatine', { respStrDelta: rOn.str - rOff.str, respMassDelta: rOn.mass - rOff.mass, nonStrDelta: nOn.str - nOff.str, nonMassDelta: nOn.mass - nOff.mass });
    expect(rOn.str).toBeGreaterThan(rOff.str);
    expect(rOn.mass - rOff.mass).toBeGreaterThan(0.5);
    // non-responder gets essentially nothing (well under the responder's effect)
    expect(nOn.mass - nOff.mass).toBeLessThan(0.25 * (rOn.mass - rOff.mass));
    expect(nOn.str - nOff.str).toBeLessThan(0.25 * (rOn.str - rOff.str));
  }, 60000);

  it('7. actn3xx: slightly lower CMJ (< 5% lower)', () => {
    const a = make({}, { actn3xx: false });
    const b = make({}, { actn3xx: true });
    const ca = countermovementJump(ctx, a), cb = countermovementJump(ctx, b);
    log('7 actn3', { rr: ca * 100, xx: cb * 100, pctLower: (1 - cb / ca) * 100 });
    expect(cb).toBeLessThan(ca);
    expect(cb).toBeGreaterThan(ca * 0.95);
  });

  it('8. age: 60-year-old gains less lean than a 25-year-old on the same program', () => {
    const gain = (age: number) => {
      const s = make({ ageYears: age });
      const l0 = lean(s);
      runDays(ctx, s, goodPlan(FULL_BODY_WEEK), 112);
      return lean(s) - l0;
    };
    const young = gain(25), old = gain(60);
    log('8 age', { young25: young, old60: old });
    expect(old).toBeLessThan(young);
  }, 60000);

  it('9. sex: women have lower absolute VO2max; relative lean gain is similar to men', () => {
    const m = make({ sex: 'male', ffmi: 19, bodyFat: 0.16 });
    const f = make({ sex: 'female', ffmi: 16, bodyFat: 0.26, heightCm: 165 }, { ffmiCeiling: 19.5 });
    const absVo2 = (s: typeof m) => (vo2maxRel(ctx, s) * bodyMass(s, P)) / 1000;
    const m0 = lean(m), f0 = lean(f);
    runDays(ctx, m, goodPlan(FULL_BODY_WEEK), 112);
    runDays(ctx, f, goodPlan(FULL_BODY_WEEK), 112);
    const rm = (lean(m) - m0) / m0, rf = (lean(f) - f0) / f0;
    log('9 sex', { vo2AbsM: absVo2(m), vo2AbsF: absVo2(f), relLeanM: rm * 100, relLeanF: rf * 100, ratio: rf / rm });
    expect(absVo2(f)).toBeLessThan(absVo2(m));
    expect(rf / rm).toBeGreaterThan(0.65);
    expect(rf / rm).toBeLessThan(1.35);
  }, 60000);

  it('10. leg length: longer legs sprint faster 40 yd and jump higher at equal mass and strength', () => {
    const a = make();
    const b = structuredClone(a);
    b.anthro.thigh *= 1.08;
    b.anthro.shank *= 1.08;
    const ta = sprintTime(sprintProfile(ctx, a), YARDS_40), tb = sprintTime(sprintProfile(ctx, b), YARDS_40);
    const ja = countermovementJump(ctx, a), jb = countermovementJump(ctx, b);
    log('10 legs', { t40Base: ta, t40Long: tb, cmjBaseCm: ja * 100, cmjLongCm: jb * 100 });
    expect(tb).toBeLessThan(ta);
    expect(jb).toBeGreaterThan(ja);
  });

  it('11. bmrFactor: higher BMR loses more weight on the identical fixed diet', () => {
    const run = (f: number) => {
      const s = make({}, { bmrFactor: f });
      const w0 = bodyMass(s, P);
      runDays(ctx, s, goodPlan(FULL_BODY_WEEK, { balanceKcal: 0, fixedKcal: 2000 }), 84);
      return w0 - bodyMass(s, P);
    };
    const lo = run(0.92), hi = run(1.08);
    log('11 bmr', { lossLowKg: lo, lossHighKg: hi });
    expect(hi).toBeGreaterThan(lo);
  }, 60000);

  it('12. injuryProneness: higher proneness gives more injuries across seeds on the same hard program', () => {
    const count = (prone: number) => {
      let n = 0;
      for (let i = 0; i < 30; i++) {
        const s = make({}, { injuryProneness: prone }, `inj-${i}`);
        // hard program: full-body A/B on 6 days, random events on (injury rolls)
        const plan = { ...goodPlan([...FULL_BODY_WEEK.slice(0, 1), ...FULL_BODY_WEEK.slice(2, 3), ...FULL_BODY_WEEK.slice(4, 5), ...FULL_BODY_WEEK.slice(0, 1), ...FULL_BODY_WEEK.slice(2, 3), ...FULL_BODY_WEEK.slice(4, 5), { sessions: [] }]), disableRandomEvents: false };
        runDays(ctx, s, plan, 84);
        n += s.injuryHistory.length + s.injuries.length;
      }
      return n;
    };
    const lo = count(0.5), hi = count(2.5);
    log('12 injury', { injuriesLow: lo, injuriesHigh: hi });
    expect(hi).toBeGreaterThan(lo);
  }, 120000);

  it('13. responderStr affects 1RM gain', () => {
    const gain = (r: number) => {
      const s = make({}, { responderStr: r, neuralFastGain: 0.1 * r });
      const r0 = oneRepMax(ctx, s, BP) + oneRepMax(ctx, s, SQ);
      runDays(ctx, s, goodPlan(FULL_BODY_WEEK), 84);
      return (oneRepMax(ctx, s, BP) + oneRepMax(ctx, s, SQ)) / r0 - 1;
    };
    const lo = gain(0.5), mid = gain(1), hi = gain(1.6);
    log('13 responderStr', { lo, mid, hi });
    expect(lo).toBeLessThan(mid);
    expect(hi).toBeGreaterThan(mid);
  }, 60000);

  it('14. caffeineHalfLifeH: slow metabolizer loses more sleep from late caffeine', () => {
    const run = (halfLife: number) => {
      const s = make({}, { caffeineHalfLifeH: halfLife });
      const plan = goodPlan(FULL_BODY_WEEK, {}, { caffeine: [{ mg: 300, hour: 17 }] });
      let bed = 0;
      runDays(ctx, s, plan, 14, { onDay: (st) => { bed = st.fatigue.caffeineMgAtBed; } });
      return { bed, debt: s.fatigue.sleepDebtH };
    };
    const fast = run(3), slow = run(9);
    log('14 caffeine', { fastBedMg: fast.bed, slowBedMg: slow.bed, fastDebtH: fast.debt, slowDebtH: slow.debt });
    expect(slow.bed).toBeGreaterThan(fast.bed);
    expect(slow.debt).toBeGreaterThan(fast.debt);
  }, 30000);
});

