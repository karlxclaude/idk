// Energy expenditure (BMR + TEF + exercise + EPOC + NEAT + job) and tissue partitioning (Hall/Forbes).
import { MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { SimContext } from './context';
import { bodyMass, skeletalMuscle } from './body';
import { clamp, interp } from './math';
import type { MuscleDayResult } from './adaptation';
import type { CharacterState, Intake } from './types';
import { KCAL_PER_G_CARB, KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN, MIFFLIN, REF_BODY_MASS_KG } from './units';

/** Tissue-based resting metabolic rate (Elia 1992 / Wang 2010 constants). kcal/day. */
export function bmr(ctx: SimContext, s: CharacterState): number {
  const E = ctx.P.energy;
  const organs = E.rmrOrganRefKcal * (Math.max(5, s.body.nonMuscleLean) / E.rmrOrganRefNonMuscleLeanKg) ** E.rmrOrganScalingExponent;
  return (E.rmrMuscle * skeletalMuscle(s) + E.rmrAdipose * s.body.fatMass + organs) * s.genetics.bmrFactor;
}

/** Mifflin-St Jeor REE for cross-checking. */
export function mifflin(s: CharacterState, weightKg: number): number {
  return MIFFLIN.weight * weightKg + MIFFLIN.height * s.anthro.heightCm - MIFFLIN.age * s.ageYears + (s.sex === 'male' ? MIFFLIN.male : MIFFLIN.female);
}

export function tef(ctx: SimContext, intake: Intake): number {
  const E = ctx.P.energy;
  return intake.proteinG * KCAL_PER_G_PROTEIN * E.tefProtein + intake.carbG * KCAL_PER_G_CARB * E.tefCarb + intake.fatG * KCAL_PER_G_FAT * E.tefFat + intake.alcoholDrinks * ctx.P.nutrition.kcalPerDrink * E.tefAlcohol;
}

export interface Expenditure {
  bmr: number;
  tef: number;
  exercise: number;
  epoc: number;
  neat: number;
  job: number;
  adaptive: number;
  constrained: number;
  total: number;
}

/** Update NEAT toward its target: genetic responsiveness to surplus, suppression in deficit (Levine 1999). */
export function neatStep(ctx: SimContext, s: CharacterState, jobHours: number) {
  const E = ctx.P.energy;
  const M = ctx.P.model;
  const bw = bodyMass(s, ctx.P);
  const base = E.neatBase * (bw / REF_BODY_MASS_KG) ** E.neatMassExponent * (1 - M.neatJobOffset * clamp(jobHours / M.wakingHours, 0, 1));
  const bal = s.body.balanceEma;
  let target = base;
  if (bal > 0) target += s.genetics.neatResponsiveness * bal;
  else target -= base * E.neatDeficitSuppression * clamp(-bal / 1000, 0, 1);
  s.body.neat += (Math.max(base * M.neatMinFraction, target) - s.body.neat) / M.neatTauDays;
}

export function expenditure(ctx: SimContext, s: CharacterState, intake: Intake, exerciseKcal: number, jobHours: number, jobMet: number): Expenditure {
  const P = ctx.P;
  const E = P.energy;
  const bw = bodyMass(s, P);
  const b = bmr(ctx, s);
  const t = tef(ctx, intake);
  const epoc = exerciseKcal * E.epocFraction;
  const job = Math.max(0, jobMet - P.economy.metSedentary) * bw * jobHours;
  const neat = s.body.neat;
  const activity = exerciseKcal + epoc + job;
  const constrained = activity > E.constrainedTeeThresholdKcal ? (activity - E.constrainedTeeThresholdKcal) * E.constrainedTeeOffset : 0;
  const adaptive = E.adaptiveThermogenesisMax * s.body.adaptiveThermo * (b + neat);
  const total = b + t + exerciseKcal + epoc + neat + job - adaptive - constrained;
  return { bmr: b, tef: t, exercise: exerciseKcal, epoc, neat, job, adaptive, constrained, total };
}

/** Adaptive thermogenesis pool builds during sustained deficit and reverses on refeeding. */
export function adaptiveThermoStep(ctx: SimContext, s: CharacterState) {
  const E = ctx.P.energy;
  const target = clamp(-s.body.balanceEma / ctx.P.model.adaptiveThermoFullDeficit, 0, 1);
  s.body.adaptiveThermo += (target - s.body.adaptiveThermo) / E.adaptiveThermogenesisTauDays;
}

export interface PartitionInputs {
  balance: number; // kcal today
  proteinGkg: number;
  sleepH: number;
  trainingResponse: number; // mean hypertrophy response across muscles (0..1)
  weeklyLossRate: number; // fraction of BW lost per week (positive = losing)
}

export interface PartitionResult {
  muscleDelta: Record<MuscleId, number>;
  fatDelta: number;
  nonMuscleLeanDelta: number;
  growthKg: number;
  /** Lean change from the Forbes term (negative in deficit). */
  forbesLeanKg: number;
  leanShareOfLoss: number;
}

/**
 * Partition today's energy imbalance between lean and fat. Training-driven synthesis is paid for first,
 * the rest follows Forbes' curve (Hall 2007) with lean sparing from training, protein, and sleep.
 */
export function partition(ctx: SimContext, s: CharacterState, mr: Record<MuscleId, MuscleDayResult>, inp: PartitionInputs): PartitionResult {
  const P = ctx.P;
  const E = P.energy;
  const M = P.model;
  const muscleDelta = {} as Record<MuscleId, number>;
  let growth = 0;
  let atrophy = 0;
  for (const m of MUSCLE_REGIONS) {
    growth += mr[m].growthKg;
    atrophy += mr[m].atrophyKg;
    muscleDelta[m] = mr[m].growthKg - mr[m].atrophyKg;
  }
  const fm = s.body.fatMass;
  let rest = inp.balance - growth * E.kcalPerKgMuscleGain + atrophy * E.kcalPerKgLean;
  let leanW: number;
  let forbesLean = 0;
  let nonMuscleDelta = 0;
  let fatDelta: number;
  const forbes = E.forbesC / (E.forbesC + Math.max(1, fm));
  if (rest >= 0) {
    leanW = E.surplusLeanFractionNoTraining * (forbes / (E.forbesC / (E.forbesC + M.forbesReferenceFatKg))) * (1 - clamp(inp.trainingResponse, 0, 1));
    leanW = clamp(leanW, 0, M.surplusLeanMax);
    const pE = (leanW * E.kcalPerKgLean) / (leanW * E.kcalPerKgLean + (1 - leanW) * E.kcalPerKgFat);
    forbesLean = (rest * pE) / E.kcalPerKgLean;
    nonMuscleDelta = forbesLean;
    fatDelta = (rest * (1 - pE)) / E.kcalPerKgFat;
  } else {
    const proteinAdequacy = clamp((inp.proteinGkg - M.proteinAdequacyStart) / M.proteinAdequacySpan, 0, 1);
    const sparing = clamp(E.leanSparingTraining * inp.trainingResponse + E.leanSparingProtein * proteinAdequacy, 0, M.maxLeanSparing);
    const shortSleep = clamp((P.fatigue.sleepNeedH - inp.sleepH) / (P.fatigue.sleepNeedH - E.shortSleepH), 0, M.shortSleepMaxFactor);
    const sleepMult = 1 + (E.sleepLeanLossMultiplier - 1) * shortSleep;
    const fast = inp.weeklyLossRate > E.safeLossRatePerWeek ? 1 + (E.fastLossLeanPenalty * (inp.weeklyLossRate - E.safeLossRatePerWeek)) / E.safeLossRatePerWeek : 1;
    leanW = clamp(forbes * (1 - sparing) * sleepMult * fast, M.leanShareMin, M.leanShareMax);
    const essential = (s.sex === 'male' ? E.essentialFatMen : E.essentialFatWomen) * bodyMass(s, P);
    if (fm <= essential) leanW = M.leanShareMax;
    const pE = (leanW * E.kcalPerKgLean) / (leanW * E.kcalPerKgLean + (1 - leanW) * E.kcalPerKgFat);
    forbesLean = (rest * pE) / E.kcalPerKgLean; // negative
    fatDelta = (rest * (1 - pE)) / E.kcalPerKgFat;
    // lean loss: first from non-muscle lean above frame (adipose-associated lean), then from muscle by mass
    const excess = Math.max(0, s.body.nonMuscleLean - s.body.frameLean);
    const fromExcess = -Math.min(excess, -forbesLean);
    const remaining = forbesLean - fromExcess;
    nonMuscleDelta = fromExcess + E.organShareOfLeanLoss * remaining;
    const fromMuscle = (1 - E.organShareOfLeanLoss) * remaining;
    if (fromMuscle < 0) {
      const smm = skeletalMuscle(s);
      for (const m of MUSCLE_REGIONS) muscleDelta[m] = (muscleDelta[m] as number) + (fromMuscle * s.muscles[m].mass) / smm;
    }
  }
  rest = 0;
  return { muscleDelta, fatDelta, nonMuscleLeanDelta: nonMuscleDelta, growthKg: growth, forbesLeanKg: forbesLean, leanShareOfLoss: leanW };
}

/** Hypertrophy energy-balance multiplier. */
export function energyBalanceMod(ctx: SimContext, balance: number): number {
  return interp(ctx.C.hypertrophy.energyBalance, balance);
}
