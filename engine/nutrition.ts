// Protein effectiveness, energy availability, micronutrient stores, hydration, supplements, hunger.
import { MONTHLY_TEMP_C, MONTHLY_UVB_FACTOR } from '../data/climate';
import type { SimContext } from './context';
import { bodyMass, fatFreeMass } from './body';
import { clamp, interp } from './math';
import type { CharacterState, DayInputs, Intake } from './types';

export const EMPTY_INTAKE: Intake = {
  kcal: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0, alcoholDrinks: 0, sodiumG: 3, waterL: 2,
  ironHemeMg: 0, ironNonHemeMg: 0, vitDIU: 0, magnesiumMg: 0, b12Ug: 0, calciumMg: 0,
  proteinQuality: 1, proteinMeals: 0, leucineG: 0, satiety: 100,
};

/** Quality-weighted protein (g/kg/day) after DIAAS weighting. */
export function effectiveProteinGkg(ctx: SimContext, s: CharacterState, intake: Intake): number {
  const q = interp(ctx.C.nutrition.qualityWeight, intake.proteinQuality);
  return (intake.proteinG * q) / bodyMass(s, ctx.P);
}

/** Protein multiplier on hypertrophy (Morton 2018) with small distribution bonus (Schoenfeld & Aragon 2018). */
export function proteinMod(ctx: SimContext, s: CharacterState, intake: Intake): number {
  const N = ctx.P.nutrition;
  const M = ctx.P.model;
  const base = interp(ctx.C.hypertrophy.protein, effectiveProteinGkg(ctx, s, intake));
  const dist = 1 + N.proteinDistributionBonus * clamp(intake.proteinMeals / N.proteinMealsTarget, 0, 1) - N.proteinDistributionBonus;
  // Older adults need more leucine per meal (anabolic resistance).
  const leuThresh = s.ageYears >= 60 ? N.leucineThresholdOlderG : N.leucineThresholdG;
  const perMeal = intake.proteinMeals > 0 ? intake.leucineG / Math.max(1, intake.proteinMeals) : 0;
  const leu = perMeal >= leuThresh || intake.leucineG === 0 ? 1 : M.leucineShortfallPenalty;
  return base * dist * leu;
}

export function energyAvailability(ctx: SimContext, s: CharacterState, intakeKcal: number, exerciseKcal: number): number {
  return (intakeKcal - exerciseKcal) / Math.max(20, fatFreeMass(s, ctx.P));
}

/** Update the EA EMA and low-EA day counter; returns the adaptation multiplier and REDs severity (0..1). */
export function eaStep(ctx: SimContext, s: CharacterState, ea: number): { mod: number; severity: number; low: boolean } {
  const N = ctx.P.nutrition;
  const n = s.nutrition;
  n.eaEma += (ea - n.eaEma) / 7;
  const low = n.eaEma < N.eaThreshold;
  n.lowEaDays = low ? n.lowEaDays + 1 : Math.max(0, n.lowEaDays - 2);
  const ramp = clamp(n.lowEaDays / N.lowEaDaysToEffect, 0, 1);
  const mod = 1 - (1 - interp(ctx.C.nutrition.eaAdaptation, n.eaEma)) * ramp;
  const severity = clamp((N.eaThreshold - n.eaEma) / (N.eaThreshold - N.eaSevereThreshold), 0, 1) * ramp;
  return { mod, severity, low };
}

export function monthOf(startDate: string, day: number): number {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return d.getUTCMonth() + 1;
}

export function dateOf(startDate: string, day: number): string {
  const d = new Date(`${startDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return d.toISOString().slice(0, 10);
}

/** Seasonal UVB synthesis factor at ~42 N (Boston). Zero Nov-Feb (Webb 1988). */
export function vitDSeasonFactor(ctx: SimContext, month: number): number {
  const N = ctx.P.nutrition;
  if (month >= N.vitDNoSynthesisStartMonth || month <= N.vitDNoSynthesisEndMonth) return 0;
  return MONTHLY_UVB_FACTOR[month] ?? 0;
}

/** Typical New England temperature (C) by month, for sweat rates. */
export function ambientTemp(month: number): number {
  return MONTHLY_TEMP_C[month] ?? MONTHLY_TEMP_C[1] ?? 0;
}

export interface MicroResult {
  ironDeficient: boolean;
  anemic: boolean;
  vitDDeficient: boolean;
  magnesiumDeficient: boolean;
  b12Deficient: boolean;
  calciumLow: boolean;
  events: string[];
}

export function micronutrientStep(ctx: SimContext, s: CharacterState, intake: Intake, inp: DayInputs, runKm: number, trained: boolean, month: number): MicroResult {
  const N = ctx.P.nutrition;
  const M = ctx.P.model;
  const n = s.nutrition;
  const events: string[] = [];
  const male = s.sex === 'male';
  // Iron: absorption falls as stores fill; hepcidin after exercise cuts absorption.
  const storeFrac = clamp(n.ironStoreMg / N.ironStoreFullMg, 0, M.ironStoreFracMax);
  const upReg = M.ironUpregulationBase - storeFrac;
  const hepcidin = trained ? 1 - N.ironHepcidinAbsorptionPenalty * M.hepcidinTrainingDayShare : 1;
  const absorbed = (intake.ironHemeMg * N.ironAbsorptionHeme + (intake.ironNonHemeMg + inp.supplements.ironMg) * N.ironAbsorptionNonHeme * upReg) * hepcidin;
  const losses = (male ? N.ironLossMgPerDayMen : N.ironLossMgPerDayWomen) + runKm * N.ironLossPerRunningKm;
  n.ironStoreMg = clamp(n.ironStoreMg + absorbed - losses, M.ironStoreMinMg, M.ironStoreMaxMg);
  const a = s.aerobic;
  if (n.ironStoreMg <= N.ironStoreAnemicMg) a.hbMassFraction = Math.max(N.hbMinFraction, a.hbMassFraction - N.hbLossPerDayAnemic);
  else if (a.hbMassFraction < 1) a.hbMassFraction = Math.min(1, a.hbMassFraction + N.hbRegainPerDay * clamp(n.ironStoreMg / N.ironStoreDeficientMg, 0, 1));
  // Vitamin D: sun + diet + supplement -> steady state; 25(OH)D pool half-life.
  const sun = s.nutrition.vitDngml >= 0 ? inp.sunMinutes * N.vitDSunIuPerMinSummer * vitDSeasonFactor(ctx, month) : 0;
  const totalIU = intake.vitDIU + inp.supplements.vitDIU + sun;
  const steady = N.vitDBaselineNgMl + N.vitDPerIuPerDay * totalIU;
  n.vitDngml += (steady - n.vitDngml) * (1 - Math.exp(-Math.LN2 / N.vitDHalfLifeDays));
  // Magnesium, B12, calcium: slow status pools vs intake/RDA.
  const mgIntake = intake.magnesiumMg + (inp.supplements.magnesium ? M.magnesiumSupplementMg : 0);
  n.magnesiumStatus += (clamp(mgIntake / N.magnesiumRdaMg, 0, M.statusIntakeCap) - n.magnesiumStatus) / N.magnesiumStoreDays;
  const b12 = intake.b12Ug + (inp.supplements.b12 ? M.b12SupplementUg : 0) * M.b12SupplementAbsorption;
  const b12Days = N.b12StoreMonthsToDeplete * 30;
  if (b12 < N.b12RdaUg * M.b12DeficientShare) n.b12Status = Math.max(0, n.b12Status - 1 / b12Days);
  else n.b12Status = Math.min(1, n.b12Status + 1 / M.b12RepletionDays);
  n.calciumStatus += (clamp(intake.calciumMg / N.calciumRdaMg, 0, M.statusIntakeCap) - n.calciumStatus) / M.calciumStatusDays;
  if (n.b12Status <= M.b12AnemicStatus) a.hbMassFraction = Math.max(N.hbMinFraction, a.hbMassFraction - N.hbLossPerDayAnemic * M.b12HbLossFactor);
  return {
    ironDeficient: n.ironStoreMg < N.ironStoreDeficientMg,
    anemic: n.ironStoreMg <= N.ironStoreAnemicMg || a.hbMassFraction < M.anemicHbFraction,
    vitDDeficient: n.vitDngml < N.vitDDeficient,
    magnesiumDeficient: n.magnesiumStatus < M.magnesiumDeficientStatus,
    b12Deficient: n.b12Status < M.b12DeficientStatus,
    calciumLow: n.calciumStatus < M.calciumLowStatus,
    events,
  };
}

/** Daily water balance -> hypohydration fraction of body mass carried into training. */
export function hydrationStep(ctx: SimContext, s: CharacterState, intake: Intake, sweatL: number, jobSweatL: number) {
  const n = s.nutrition;
  const M = ctx.P.model;
  const bw = bodyMass(s, ctx.P);
  const need = M.waterNeedBaseL + sweatL + jobSweatL;
  const deficitL = Math.max(0, need - intake.waterL - M.waterFromFoodL);
  // Most of a deficit is corrected overnight when thirst is followed; residual carries over.
  n.hydration = clamp((n.hydration * bw * M.hydrationCarryover + deficitL * M.hydrationDeficitShare) / bw, 0, M.hydrationMax);
}

/** Creatine and beta-alanine loading; creatine water. */
export function supplementStep(ctx: SimContext, s: CharacterState, inp: DayInputs) {
  const N = ctx.P.nutrition;
  const M = ctx.P.model;
  const b = s.body;
  const taking = inp.supplements.creatine;
  s.flags.creatine = taking;
  const max = s.genetics.creatineResponder ? 1 : M.creatineNonResponderMax;
  if (taking) {
    const loading = b.creatineSaturation < M.creatineLoadingUntil && inp.supplements.creatineLoading === true;
    const tau = loading ? N.creatineLoadingDays / 3 : N.creatineMaintenanceSaturationDays / 3;
    b.creatineSaturation += (max - b.creatineSaturation) / tau;
  } else {
    b.creatineSaturation -= b.creatineSaturation / M.creatineWashoutDays;
  }
  b.creatineWater = N.creatineWaterGainKg * b.creatineSaturation;
  const n = s.nutrition;
  if (inp.supplements.betaAlanine) n.betaAlanineLoad += (1 - n.betaAlanineLoad) / (N.betaAlanineLoadingDays / 3);
  else n.betaAlanineLoad -= n.betaAlanineLoad / M.betaAlanineWashoutDays;
  const usedCaffeine = inp.caffeine.length > 0 ? 1 : 0;
  n.caffeineHabit += (usedCaffeine - n.caffeineHabit) / M.caffeineHabitDays;
}

/** Caffeine (mg) remaining at a given hour from today's doses. */
export function caffeineAt(s: CharacterState, doses: Array<{ mg: number; hour: number }>, hour: number): number {
  let t = 0;
  for (const d of doses) if (d.hour <= hour) t += d.mg * 0.5 ** ((hour - d.hour) / s.genetics.caffeineHalfLifeH);
  return t;
}

/** Acute caffeine performance multipliers at session time (3-6 mg/kg, 30-60 min prior). */
export function caffeineEffects(ctx: SimContext, s: CharacterState, mgInSystem: number): { strength: number; power: number; endurance: number } {
  const N = ctx.P.nutrition;
  const perKg = mgInSystem / bodyMass(s, ctx.P);
  const dose = clamp(perKg / ctx.P.model.caffeineFullDoseMgKg, 0, 1);
  const tol = 1 - (1 - N.caffeineToleranceFactor) * s.nutrition.caffeineHabit;
  return {
    strength: 1 + N.caffeineStrengthEffect * dose * tol,
    power: 1 + N.caffeinePowerEffect * dose * tol,
    endurance: 1 + ctx.P.aerobic.caffeineEnduranceBonus * dose * tol,
  };
}

export function hungerStep(ctx: SimContext, s: CharacterState, balance: number, intake: Intake) {
  const N = ctx.P.nutrition;
  const M = ctx.P.model;
  const bw = bodyMass(s, ctx.P);
  let h = interp(ctx.C.energy.hungerBalance, balance);
  h *= 1 - N.satietyEffect * clamp((intake.satiety - M.hungerSatietySpan) / M.hungerSatietySpan, -1, 1.5);
  h *= 1 - N.proteinHungerReduction * clamp(intake.proteinG / bw - M.hungerProteinSpanGkg, 0, 1);
  h *= 1 - N.fiberHungerReductionPer30g * clamp(intake.fiberG / M.hungerFiberSpanG, 0, 1.5);
  h *= 1 + M.hungerSleepDebtPerH * Math.min(M.hungerSleepDebtCapH, s.fatigue.sleepDebtH);
  s.nutrition.hunger = clamp(h, 0, 1);
}

/** Dehydration multipliers (Judelson 2007; Cheuvront & Kenefick 2014). */
export function dehydrationEffects(ctx: SimContext, fraction: number): { strength: number; power: number; endurance: number } {
  const N = ctx.P.nutrition;
  const M = ctx.P.model;
  const r = clamp(fraction / M.dehydrationRefFraction, 0, 2);
  const aer = fraction < N.dehydrationAerobicThreshold ? 0 : clamp((fraction - N.dehydrationAerobicThreshold) / M.dehydrationAerobicSpan, 0, 2);
  return {
    strength: 1 - N.dehydrationStrengthAt3pct * r,
    power: 1 - N.dehydrationPowerAt3pct * r,
    endurance: 1 - N.dehydrationEnduranceAt3pct * Math.max(r * 0.5, aer),
  };
}

/**
 * Event-performance multiplier (>= 1 means faster/stronger) from ergogenic aids for an all-out effort of `minutes`:
 * beta-alanine (0.5-10 min, scaled by muscle carnosine load), bicarbonate (1-7 min, minus expected GI distress),
 * dietary nitrate (endurance efforts, attenuated above an elite VO2max). Feeds the `perf` argument of race functions.
 */
export function ergogenicPerf(ctx: SimContext, s: CharacterState, supp: DayInputs['supplements'], minutes: number, vo2maxRel: number): number {
  const N = ctx.P.nutrition;
  let m = 1;
  if (minutes >= N.betaAlanineMinEffortMin && minutes <= N.betaAlanineMaxEffortMin) m *= 1 + N.betaAlanineEffect * s.nutrition.betaAlanineLoad;
  if (supp.bicarb && minutes >= N.bicarbMinEffortMin && minutes <= N.bicarbMaxEffortMin) m *= (1 + N.bicarbEffect) * (1 - N.bicarbGutDistressProb * N.bicarbGutDistressPenalty);
  if (supp.nitrate && minutes >= N.nitrateMinEffortMin) m *= 1 + N.nitrateEnduranceEffect * (vo2maxRel >= N.nitrateEliteVo2 ? N.nitrateEliteAttenuation : 1);
  return m;
}
