// Systemic fatigue (Banister fitness-fatigue per quality), sleep debt, stress, illness, overreaching, readiness.
import { MUSCLE_REGIONS } from '../data/muscles';
import type { SimContext } from './context';
import { clamp, interp } from './math';
import type { Rng } from './rng';
import type { CharacterState, FactorBreakdown } from './types';

export interface Loads {
  str: number;
  pow: number;
  aer: number;
}

/** Effective sleep after caffeine and stress. Returns hours. */
export function effectiveSleep(ctx: SimContext, s: CharacterState, sleepH: number, caffeineAtBedMg: number, alcoholDrinks: number): number {
  const F = ctx.P.fatigue;
  const M = ctx.P.model;
  const caffeineLoss = (F.caffeineSleepLossPer100mg * caffeineAtBedMg) / 100;
  const alcoholLoss = Math.min(M.alcoholSleepLossMax, alcoholDrinks * M.alcoholSleepLossPerDrink);
  const stressLoss = Math.max(0, s.fatigue.stress - M.stressSleepThreshold) * M.stressSleepLoss;
  return clamp(sleepH - caffeineLoss - alcoholLoss - stressLoss, 0, 14);
}

export function sleepStep(ctx: SimContext, s: CharacterState, effSleepH: number) {
  const F = ctx.P.fatigue;
  const f = s.fatigue;
  const deficit = F.sleepNeedH - effSleepH;
  // Debt decays with a ~1-week memory; extra sleep repays it (Mah 2011 sleep extension).
  f.sleepDebtH = clamp(f.sleepDebtH * Math.exp(-F.sleepDebtDecay / ctx.P.model.sleepDebtMemoryDays) + deficit, 0, F.sleepDebtMaxH);
}

/** Recovery multiplier on fatigue/damage decay rates (1 = normal). */
export function recoveryRate(ctx: SimContext, s: CharacterState, effSleepH: number): number {
  const P = ctx.P;
  const M = P.model;
  const sleepF = 1 - P.fatigue.localRecoverySleepWeight * clamp((P.fatigue.sleepNeedH - effSleepH) / M.sleepDeficitSpanH, 0, 1);
  const stressF = 1 - P.fatigue.stressRecoveryPenalty * s.fatigue.stress;
  const ageF = s.ageYears <= M.recoveryAgeStart ? 1 : 1 - (1 - P.genetics.recoveryAt60) * clamp((s.ageYears - M.recoveryAgeStart) / M.recoveryAgeSpan, 0, M.recoveryAgeMaxFactor);
  return sleepF * stressF * ageF;
}

export function banisterStep(ctx: SimContext, s: CharacterState, L: Loads, recovery: number) {
  const F = ctx.P.fatigue;
  const f = s.fatigue;
  const tf = s.genetics.fitnessTau;
  const tz = s.genetics.fatigueTau;
  const kFit = Math.exp(-1 / tf);
  const kFat = Math.exp(-recovery / tz);
  const gain = (l: number) => F.fatigueGainRatio * (1 + F.fatigueLoadExponent * Math.max(0, l / F.refDailyLoad - 1));
  f.fitStr = f.fitStr * kFit + L.str;
  f.fatStr = f.fatStr * kFat + gain(L.str) * L.str;
  f.fitPow = f.fitPow * kFit + L.pow;
  f.fatPow = f.fatPow * kFat + gain(L.pow) * L.pow;
  f.fitAer = f.fitAer * kFit + L.aer;
  f.fatAer = f.fatAer * kFat + gain(L.aer) * L.aer;
}

/** Dimensionless systemic strain: fatigue relative to the work capacity built by fitness. */
export function strain(ctx: SimContext, fat: number, fit: number): number {
  const K = ctx.P.fatigue.refDailyLoad * ctx.P.model.strainCapacityMult;
  return fat / (K + ctx.P.model.strainFitnessWeight * fit);
}

export function systemicStrain(ctx: SimContext, s: CharacterState): number {
  const f = s.fatigue;
  const a = strain(ctx, f.fatStr, f.fitStr);
  const b = strain(ctx, f.fatPow, f.fitPow);
  const c = strain(ctx, f.fatAer, f.fitAer);
  const M = ctx.P.model;
  return M.strainMaxWeight * Math.max(a, b, c) + M.strainMeanWeight * ((a + b + c) / 3) + M.strainConcurrentWeight * Math.min(a, c) * (a > M.strainConcurrentMin && c > M.strainConcurrentMin ? 1 : 0);
}

export function damageDecay(ctx: SimContext, s: CharacterState, recovery: number) {
  const hl = ctx.P.training.damageHalfLifeH;
  const k = Math.exp((-Math.LN2 * 24 * recovery) / hl);
  for (const m of MUSCLE_REGIONS) s.muscles[m].damage *= k;
}

export function averageDamage(ctx: SimContext, s: CharacterState): number {
  let t = 0;
  let w = 0;
  for (const m of MUSCLE_REGIONS) {
    const st = s.muscles[m];
    t += Math.min(ctx.P.model.damageCap, st.damage) * st.mass;
    w += st.mass;
  }
  return t / w;
}

export interface StressInputs {
  jobStrain: number;
  financial: number; // 0..1
  events: number;
  socialHours: number;
}

export function stressStep(ctx: SimContext, s: CharacterState, inp: StressInputs) {
  const F = ctx.P.fatigue;
  const M = ctx.P.model;
  const f = s.fatigue;
  const target = clamp(M.stressBase + M.stressJobWeight * inp.jobStrain + M.stressMoneyWeight * inp.financial + M.stressSleepWeight * clamp(f.sleepDebtH / M.stressSleepDebtSpanH, 0, 1) + (f.state === 'NFOR' ? M.stressNforBonus : f.state === 'OTS' ? M.stressOtsBonus : 0), 0, 1);
  f.stress += (target - f.stress) * F.stressDecayPerDay;
  f.stress += inp.events;
  f.stress -= F.stressReliefPerSocialHour * inp.socialHours;
  f.stress = clamp(f.stress, 0, 1);
}

/** Overreaching state machine (Meeusen 2013: FOR -> NFOR -> OTS). */
export function overreachStep(ctx: SimContext, s: CharacterState, strainNow: number, poorRecovery: boolean): string | null {
  const F = ctx.P.fatigue;
  const M = ctx.P.model;
  const f = s.fatigue;
  const prev = f.state;
  const easy = strainNow < M.overreachEasyFraction * F.forThreshold;
  if (strainNow > F.forThreshold) f.overreachDays += poorRecovery ? M.overreachPoorRecoveryRate : 1;
  else f.overreachDays = Math.max(0, f.overreachDays - (easy ? M.overreachLowStrainRecovery : M.overreachModerateRecovery));
  f.stateDays += 1;
  switch (f.state) {
    case 'normal':
      if (f.overreachDays >= M.forEntryDays) f.state = 'FOR';
      break;
    case 'FOR':
      if (f.overreachDays >= F.nforDays) f.state = 'NFOR';
      else if (f.overreachDays === 0) f.state = 'normal';
      break;
    case 'NFOR':
      if (f.overreachDays >= F.otsDays && poorRecovery) f.state = 'OTS';
      else if (easy && f.stateDays >= F.nforRecoveryDays && f.overreachDays === 0) f.state = 'normal';
      break;
    case 'OTS':
      if (easy && f.stateDays >= F.otsRecoveryDays && f.overreachDays === 0) f.state = 'normal';
      break;
  }
  if (f.state !== prev) {
    f.stateDays = 0;
    return `${prev} -> ${f.state}`;
  }
  return null;
}

export function overreachAdaptationMultiplier(ctx: SimContext, s: CharacterState): number {
  const F = ctx.P.fatigue;
  return s.fatigue.state === 'NFOR' ? F.nforAdaptationMultiplier : s.fatigue.state === 'OTS' ? F.otsAdaptationMultiplier : 1;
}

export function illnessStep(ctx: SimContext, s: CharacterState, rng: Rng, month: number, lowEa: boolean): boolean {
  const F = ctx.P.fatigue;
  const M = ctx.P.model;
  const f = s.fatigue;
  if (f.illnessDays > 0) {
    f.illnessDays -= 1;
    return false;
  }
  const winter = month === 12 || month <= 3 ? M.winterIllnessMultiplier : 1;
  const p = F.illnessBaseDaily * (1 + (F.illnessStressMultiplier - 1) * Math.max(1 - f.readiness, f.stress)) * winter * (lowEa ? M.lowEaIllnessMultiplier : 1);
  if (rng.chance(p)) {
    f.illnessDays = Math.round(F.illnessDurationDays * rng.uniform(M.illnessDurationMin, M.illnessDurationMax));
    return true;
  }
  return false;
}

/** Overall readiness 0..1 and its factor breakdown. */
export function computeReadiness(ctx: SimContext, s: CharacterState, lastNightSleepH: number): { readiness: number; factors: FactorBreakdown } {
  const F = ctx.P.fatigue;
  const M = ctx.P.model;
  const f = s.fatigue;
  const st = systemicStrain(ctx, s);
  const fatiguePen = (F.readinessFatigueWeight * st) / (1 + st);
  const sleepPen = F.readinessSleepDebtPerHour * Math.min(F.readinessSleepDebtCapH, f.sleepDebtH);
  const acuteSleep = interp(ctx.C.fatigue.acuteSleepPerformance, lastNightSleepH);
  const stressPen = F.readinessStressWeight * f.stress;
  const damagePen = F.readinessDamageWeight * Math.min(1, averageDamage(ctx, s));
  const illnessPen = f.illnessDays > 0 ? F.readinessIllnessWeight : 0;
  const orPen = f.state === 'NFOR' ? F.nforReadinessPenalty : f.state === 'OTS' ? M.otsReadinessMultiplier * F.nforReadinessPenalty : 0;
  const r = clamp((1 - fatiguePen - sleepPen - stressPen - damagePen - illnessPen - orPen) * acuteSleep, M.readinessMin, M.readinessMax);
  f.readiness = r;
  return {
    readiness: r,
    factors: { systemicFatigue: 1 - fatiguePen, sleepDebt: 1 - sleepPen, lastNightSleep: acuteSleep, stress: 1 - stressPen, soreness: 1 - damagePen, illness: 1 - illnessPen, overreaching: 1 - orPen },
  };
}
