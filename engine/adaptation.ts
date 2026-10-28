// Daily adaptation: hypertrophy, neuromuscular quality, skill decay, power/sprint pools, aerobic system,
// tendon and bone. Reads the ring-buffer stimulus histories written by session.ts.
import { LOWER_BODY, MOVEMENT_PATTERNS, MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { SimContext } from './context';
import { clamp, interp, saturate } from './math';
import { HISTORY_DAYS, type CharacterState } from './types';

export function sumLast(hist: readonly number[], day: number, n: number): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += hist[(((day - i) % HISTORY_DAYS) + HISTORY_DAYS) % HISTORY_DAYS] as number;
  return t;
}

/** Multiplicative modifiers applied to adaptation rates today. Each is 1 when neutral. */
export interface DailyMods {
  protein: number;
  energyBalance: number;
  sleep: number;
  stress: number;
  age: number;
  alcohol: number;
  creatine: number;
  /** Muscle creatine saturation 0..1 (responders only), used for the neuromuscular adaptation bonus. */
  creatineSat: number;
  energyAvailability: number;
  overreach: number;
  interferenceHyp: number;
  interferenceStr: number;
  interferencePow: number;
  vitaminD: number;
  fatIntake: number;
}

export const NEUTRAL_MODS: DailyMods = {
  protein: 1, energyBalance: 1, sleep: 1, stress: 1, age: 1, alcohol: 1, creatine: 1, creatineSat: 0, energyAvailability: 1, overreach: 1,
  interferenceHyp: 1, interferenceStr: 1, interferencePow: 1, vitaminD: 1, fatIntake: 1,
};

export function hypertrophyModProduct(m: DailyMods): number {
  return m.protein * m.energyBalance * m.sleep * m.stress * m.age * m.alcohol * m.creatine * m.energyAvailability * m.overreach * m.interferenceHyp * m.vitaminD * m.fatIntake;
}

export interface MuscleDayResult {
  weeklySets: number;
  response: number;
  growthKg: number; // training-driven synthesis (costs energy)
  atrophyKg: number; // detraining loss
}

/** Weekly hypertrophy response R(V) with a recoverable-volume penalty. */
export function hypResponse(ctx: SimContext, weeklySets: number): number {
  const H = ctx.P.hypertrophy;
  let r = saturate(weeklySets, ctx.P.training.v0Hypertrophy);
  if (weeklySets > H.mrvSets) r -= H.mrvPenalty * ((weeklySets - H.mrvSets) / H.mrvSets) ** 2;
  return Math.max(0, r);
}

/** Compute today's hypertrophy and atrophy per muscle (does not apply energy partitioning). */
export function hypertrophyStep(ctx: SimContext, s: CharacterState, mods: DailyMods): Record<MuscleId, MuscleDayResult> {
  const { P } = ctx;
  const H = P.hypertrophy;
  const out = {} as Record<MuscleId, MuscleDayResult>;
  const modProd = hypertrophyModProduct(mods);
  const k = H.kHypPerDay * s.genetics.responderHyp;
  const p = H.ceilingExponent;
  const M = P.model;
  for (const m of MUSCLE_REGIONS) {
    const st = s.muscles[m];
    const v7 = sumLast(st.hypHist, s.day, 7);
    const R = hypResponse(ctx, v7);
    const gap = Math.max(0, st.mmax - st.mass);
    const memory = st.mass < st.highWater * M.memoryThreshold ? H.muscleMemoryMultiplier : 1;
    const growth = k * R * (p === 1 ? gap : gap ** p / st.mmax ** (p - 1)) * modProd * memory;
    let atrophy = 0;
    const since = s.day - st.lastStimDay;
    if (R < H.maintenanceResponse && since > H.atrophyGraceDays && st.mass > st.baseline) {
      atrophy = ((st.mass - st.baseline) / H.atrophyTauDays) * (1 - R / H.maintenanceResponse);
    } else if (st.mass < st.baseline) {
      // daily activity restores untrained mass toward its set point (e.g. after a crash diet)
      atrophy = -(st.baseline - st.mass) / H.atrophyTauDays;
    }
    out[m] = { weeklySets: v7, response: R, growthKg: Math.min(growth, gap), atrophyKg: atrophy };
  }
  return out;
}

/** Apply muscle mass changes (after partitioning scales growth). */
export function applyMuscleChanges(s: CharacterState, deltas: Record<MuscleId, number>) {
  for (const m of MUSCLE_REGIONS) {
    const st = s.muscles[m];
    st.mass = Math.max(st.baseline * 0.5, st.mass + deltas[m]);
    if (st.mass > st.highWater) st.highWater = st.mass;
  }
}

/** Age-related decline of the untrained muscle set point (sarcopenia) and of the aerobic baseline. */
export function agingStep(ctx: SimContext, s: CharacterState) {
  const H = ctx.P.hypertrophy;
  if (s.ageYears > H.sarcopeniaOnsetAge) {
    const f = 1 - H.sarcopeniaRatePerYear / 365;
    for (const m of MUSCLE_REGIONS) s.muscles[m].baseline *= f;
  }
  const C = ctx.C.aerobic.ageFactor;
  const prev = interp(C, s.ageYears - 1 / 365);
  const now = interp(C, s.ageYears);
  const r = now / prev;
  s.aerobic.vo2Baseline *= r;
  s.aerobic.vo2Ceiling *= r;
}

/** Neuromuscular-quality pools per movement pattern; skill and repeated-bout decay. */
export function neuralStep(ctx: SimContext, s: CharacterState, mods: DailyMods) {
  const { P, C } = ctx;
  const S = P.strength;
  const T = P.training;
  const M = P.model;
  const ageF = interp(C.strength.ageNeural, s.ageYears);
  const modProd = mods.sleep * mods.stress * mods.interferenceStr * mods.energyAvailability * mods.overreach;
  const creatineRate = 1 + S.creatineAdaptationBonus * mods.creatineSat;
  for (const pat of MOVEMENT_PATTERNS) {
    const ps = s.patterns[pat];
    const v7 = sumLast(ps.strHist, s.day, 7);
    const R = saturate(v7, T.v0Strength);
    const sets28 = sumLast(ps.setHist, s.day, HISTORY_DAYS);
    const stim28 = sumLast(ps.strHist, s.day, HISTORY_DAYS);
    const quality = sets28 > M.minSetsForQuality ? clamp(stim28 / sets28, 0, 1) : 0;
    const memory = ps.neural < ps.highWater * M.neuralMemoryThreshold ? S.neuralMemoryMultiplier : 1;
    if (quality > ps.neural && R > 0) {
      const rate = (1 / S.neuralQualityTauDays) * s.genetics.responderStr * R * ageF * modProd * memory * creatineRate;
      ps.neural += clamp(rate, 0, M.neuralMaxStep) * (quality - ps.neural);
    }
    // fast early-neural pool: rises within weeks with any meaningful strength stimulus
    const fastTarget = clamp(quality / S.neuralFastQualitySaturation, 0, 1);
    if (R > 0 && fastTarget > ps.fast) ps.fast += (fastTarget - ps.fast) * clamp((R * Math.sqrt(s.genetics.responderStr) * modProd * memory) / S.neuralFastTauDays, 0, M.fastPoolMaxStep);
    const since = s.day - ps.lastStimDay;
    if (since > S.neuralGraceDays && R < S.maintenanceStimulusFraction) {
      ps.fast -= (ps.fast / S.neuralDecayTauDays) * (1 - R / S.maintenanceStimulusFraction);
      ps.neural -= (ps.neural / S.neuralDecayTauDays) * (1 - R / S.maintenanceStimulusFraction);
    } else if (quality < ps.neural && R > 0) {
      ps.neural -= (ps.neural - quality) / (S.neuralDecayTauDays * M.lightTrainingDriftFactor);
    }
    ps.neural = clamp(ps.neural, 0, 1);
    ps.fast = clamp(ps.fast, 0, 1);
    if (ps.neural > ps.highWater) ps.highWater = ps.neural;
  }
  const rbeDecay = Math.exp(-1 / T.repeatedBoutDecayDays);
  for (const id in s.skills) {
    const sk = s.skills[id];
    if (!sk) continue;
    sk.rbe *= rbeDecay;
    if (s.day - sk.lastDay > M.skillDecayGraceDays && sk.skill > T.skillStart) sk.skill -= (sk.skill - T.skillStart) / T.skillDecayTauDays;
  }
}

/** Move a pool toward a target: up with time constant tauUp, down with tauDown (only after a grace period). */
function trackPool(x: number, target: number, tauUp: number, tauDown: number, allowDown: boolean): number {
  if (target > x) return x + (target - x) / tauUp;
  if (allowDown) return x - (x - target) / tauDown;
  return x;
}

export function powerStep(ctx: SimContext, s: CharacterState, mods: DailyMods) {
  const { P } = ctx;
  const W = P.power;
  const T = P.training;
  const pw = s.power;
  const resp = Math.sqrt(s.genetics.responderStr);
  const interf = mods.interferencePow;
  const adapt = mods.sleep * mods.energyAvailability * mods.overreach;
  const M = P.model;
  const grace = M.powerGraceDays;
  const powLower = saturate(sumLast(pw.powHistLower, s.day, 7), T.v0Power);
  const powUpper = saturate(sumLast(pw.powHistUpper, s.day, 7), T.v0Power);
  const plyo = saturate(sumLast(pw.plyoHist, s.day, 7), T.v0Power);
  const sprintV = saturate(sumLast(pw.sprintHist, s.day, 7), T.v0Power);
  const sprintF = saturate(sumLast(pw.sprintF0hHist, s.day, 7), T.v0Power);
  const tech = saturate(sumLast(pw.sprintTechHist, s.day, 7), T.v0Power);
  const downPow = s.day - pw.lastPowerDay > grace && s.day - pw.lastPlyoDay > grace;
  const downSpr = s.day - pw.lastSprintDay > grace;
  const lowerStim = Math.max(powLower, plyo * M.v0FromPlyo, sprintV * M.v0FromSprint);
  pw.v0Lower = trackPool(pw.v0Lower, lowerStim * interf * adapt, W.v0TauDays / resp, W.v0TauDays * M.v0DownTauMultiplier, downPow);
  pw.v0Upper = trackPool(pw.v0Upper, powUpper * interf * adapt, W.v0TauDays / resp, W.v0TauDays * M.v0DownTauMultiplier, s.day - pw.lastPowerDay > grace);
  pw.ssc = trackPool(pw.ssc, Math.max(plyo, sprintV * M.sscFromSprint) * interf * adapt, W.sscTauDays / resp, W.sscTauDays * M.sscDownTauMultiplier, downPow && downSpr);
  pw.rfd = trackPool(pw.rfd, Math.max(powLower, plyo) * interf * adapt, W.rfdTauDays / resp, W.rfdTauDays * M.v0DownTauMultiplier, downPow);
  pw.vmaxPool = trackPool(pw.vmaxPool, sprintV * interf * adapt, W.vmaxTauDays / resp, W.vmaxTauDays * M.v0DownTauMultiplier, downSpr);
  pw.f0hPool = trackPool(pw.f0hPool, sprintF * interf * adapt, W.vmaxTauDays / resp, W.vmaxTauDays * M.v0DownTauMultiplier, downSpr);
  const rfTarget = W.rfStart + (W.rfTrainableMax - W.rfStart) * tech;
  pw.rf = trackPool(pw.rf, rfTarget, W.rfTauSessions * M.rfDaysPerSession, M.rfDecayTauDays, downSpr);
}

export function aerobicStep(ctx: SimContext, s: CharacterState, mods: DailyMods, strengthPlyoStim: number) {
  const { P } = ctx;
  const A = P.aerobic;
  const M = P.model;
  const a = s.aerobic;
  const v7 = sumLast(a.aeroHist, s.day, 7);
  const R = saturate(v7, A.v0AerobicLoad);
  const targetFrac = Math.min(1, R / A.targetSaturationResponse);
  const gapTot = Math.max(0, a.vo2Ceiling - a.vo2Baseline) * targetFrac;
  const adapt = mods.sleep * mods.energyAvailability * mods.overreach * mods.stress;
  const up = A.kAerPerDay * s.genetics.responderAer ** M.aerResponderRateExponent * R * adapt;
  const fastT = gapTot * A.detrainFastFraction;
  const slowT = gapTot * (1 - A.detrainFastFraction);
  const allowDown = true;
  if (fastT > a.vo2Fast) a.vo2Fast += (fastT - a.vo2Fast) * up;
  else if (allowDown) a.vo2Fast -= (a.vo2Fast - fastT) / A.detrainFastTauDays;
  if (slowT > a.vo2Slow) a.vo2Slow += (slowT - a.vo2Slow) * up;
  else if (allowDown) a.vo2Slow -= (a.vo2Slow - slowT) / A.detrainSlowTauDays;
  // thresholds keep improving after VO2max plateaus
  const kT = A.kThresholdPerDay * adapt;
  if (R > M.thresholdMinResponse) {
    a.lt1 += (A.lt1MaxFraction - a.lt1) * kT * R;
    a.lt2 += (A.lt2MaxFraction - a.lt2) * kT * R;
  } else {
    a.lt1 -= (a.lt1 - A.lt1StartFraction) / (A.detrainSlowTauDays * M.thresholdDetrainFactor);
    a.lt2 -= (a.lt2 - A.lt2StartFraction) / (A.detrainSlowTauDays * M.thresholdDetrainFactor);
  }
  // running economy: running volume + strength/plyometric work
  const runR = saturate(sumLast(a.runKmHist, s.day, 7), A.economyRunVolumeKm);
  const econStim = runR + A.economyStrengthBonus * strengthPlyoStim;
  if (econStim > M.economyStimMin) a.economyRun -= (a.economyRun - A.economyRunBest) * A.kEconomyPerDay * econStim;
  else a.economyRun += (A.economyRunStart - a.economyRun) / (A.detrainSlowTauDays * M.economyDetrainFactor);
  a.economyBike = clamp(a.economyBike + (1 - a.economyBike) * A.kEconomyPerDay * R * M.bikeRowEconomyRate, 0, 1);
  a.economyRow = clamp(a.economyRow + (1 - a.economyRow) * A.kEconomyPerDay * R * M.bikeRowEconomyRate, 0, 1);
}

/** Tendon capacity adapts slowly toward the force demands of the muscles it serves. */
export function tendonStep(ctx: SimContext, s: CharacterState, responses: Record<MuscleId, MuscleDayResult>) {
  const I = ctx.P.injury;
  const M = ctx.P.model;
  const maxDaily = I.tendonMaxGainPerYear / 365;
  for (const m of MUSCLE_REGIONS) {
    const st = s.muscles[m];
    const demand = st.mass / st.baseline;
    const R = responses[m].response;
    if (demand > st.tendon && R > M.tendonMinResponse) st.tendon += Math.min(maxDaily, ((demand - st.tendon) / I.tendonTauDays) * (M.tendonResponseOffset + R));
    else if (demand < st.tendon) st.tendon -= (st.tendon - demand) / (I.tendonTauDays * M.tendonDownTauMultiplier);
  }
}

/** Tendon-to-muscle capacity gap (0 = matched). */
export function tissueGap(ctx: SimContext, s: CharacterState, m: MuscleId): number {
  const st = s.muscles[m];
  return Math.max(0, st.mass / st.baseline / Math.max(ctx.P.model.tendonFloor, st.tendon) - 1);
}

export function boneStep(ctx: SimContext, s: CharacterState, loading: number, eaSeverity: number, vitDOk: boolean, calciumOk: boolean) {
  const I = ctx.P.injury;
  const M = ctx.P.model;
  let gain = (I.bmdGainPerYear / 365) * clamp(loading, 0, 1);
  if (!vitDOk || !calciumOk) gain *= I.bmdDeficiencyVitDPenalty;
  const loss = (I.bmdLossPerYearLowEa / 365) * eaSeverity;
  const ageLoss = s.ageYears > M.bmdAgeOnset ? M.bmdAgeLossPerYear / 365 : 0;
  // gains taper as BMD rises above the young-adult mean
  const taper = clamp(M.bmdTaperCeiling - s.body.bmd, 0, 1);
  s.body.bmd = clamp(s.body.bmd + gain * taper - loss - ageLoss, M.bmdMin, M.bmdMax);
}

/** Lower-body share of today's strength stimulus (for economy and bone). */
export function lowerBodyLoading(s: CharacterState): number {
  let t = 0;
  for (const m of MUSCLE_REGIONS) if (LOWER_BODY.has(m)) t += sumLast(s.muscles[m].hypHist, s.day, 7);
  return t;
}
