// Multi-day runner with optional per-day plan adjustment and snapshots.
import { DIET_CONTROLLER_DEFAULTS as DC } from '../data/planDefaults';
import type { SimContext } from './context';
import { bodyFatFraction, bodyMass, fatFreeMass, skeletalMuscle } from './body';
import { countermovementJump, runTime, sprintProfile, sprintTime, vo2maxRel, YARDS_40 } from './performance';
import { inputsForDay, type DayInputsWithTarget, type WeeklyPlan } from './plan';
import { simulateDay, type DayResult } from './sim';
import { testOneRepMax } from './strength';
import type { CharacterState, Snapshot } from './types';

export interface RunOptions {
  /** Modify the day's inputs before simulation (diet control, schedule changes). */
  adjust?: (s: CharacterState, inputs: DayInputsWithTarget) => void;
  onDay?: (s: CharacterState, r: DayResult) => void;
}

export function runDays(ctx: SimContext, s: CharacterState, plan: WeeklyPlan, days: number, opts: RunOptions = {}): void {
  for (let i = 0; i < days; i++) {
    const inp = inputsForDay(plan, s.day);
    opts.adjust?.(s, inp);
    const r = simulateDay(ctx, s, inp);
    opts.onDay?.(s, r);
  }
}

/** Diet controller that keeps body fat in a band: lean-gain surplus below `low`, deficit above `high`. */
export function bodyFatBandDiet(ctx: SimContext, low: number, high: number, surplus: number = DC.bandSurplus, deficit: number = DC.bandDeficit) {
  let cutting = false;
  return (s: CharacterState, inp: DayInputsWithTarget) => {
    const bf = bodyFatFraction(s, ctx.P);
    if (bf > high) cutting = true;
    else if (bf < low) cutting = false;
    if (inp.intakeTarget) inp.intakeTarget.balanceKcal = cutting ? deficit : surplus;
  };
}

export const MAIN_LIFTS = ['back_squat_high_bar', 'bench_press', 'conventional_deadlift', 'overhead_press'] as const;

export function snapshot(ctx: SimContext, s: CharacterState, lifts: readonly string[] = MAIN_LIFTS): Snapshot {
  const out: Record<string, number> = {};
  for (const l of lifts) out[l] = testOneRepMax(ctx, s, l);
  const sp = sprintProfile(ctx, s);
  return {
    day: s.day,
    weight: bodyMass(s, ctx.P),
    fatMass: s.body.fatMass,
    muscleMass: skeletalMuscle(s),
    leanMass: fatFreeMass(s, ctx.P),
    vo2max: vo2maxRel(ctx, s),
    readiness: s.fatigue.readiness,
    fatigueStr: s.fatigue.fatStr,
    fitnessStr: s.fatigue.fitStr,
    lifts: out,
    cmj: countermovementJump(ctx, s),
    sprint40yd: sprintTime(sp, YARDS_40),
    ironStoreMg: s.nutrition.ironStoreMg,
    vitD: s.nutrition.vitDngml,
    balance: s.body.balanceEma,
  };
}

export { runTime };

/** Smooth diet controller: surplus shrinks (and becomes a deficit) as body fat rises above the target. */
export function bodyFatTargetDiet(ctx: SimContext, target: number, surplus: number = DC.targetSurplus, kcalPerPct: number = DC.targetKcalPerPct) {
  return (s: CharacterState, inp: DayInputsWithTarget) => {
    const bf = bodyFatFraction(s, ctx.P);
    if (inp.intakeTarget) inp.intakeTarget.balanceKcal = Math.max(DC.maxDeficit, Math.min(surplus, surplus - kcalPerPct * (bf - target) * 100));
  };
}
