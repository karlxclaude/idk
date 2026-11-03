// Daily tick (spec section 3 order):
//  1 inputs  2 expenditure  3 sessions (set by set)  4 stimulus accumulation  5 recovery & fatigue decay
//  6 adaptation  7 energy balance & partitioning  8 micronutrients & hydration  9 injury checks
//  10 detraining (inside adaptation steps)  11 measurement noise for displayed metrics
import { MOVEMENT_PATTERNS, MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import {
  agingStep, aerobicStep, applyMuscleChanges, boneStep, hypertrophyModProduct, hypertrophyStep, neuralStep, powerStep,
  sumLast, tendonStep, type DailyMods,
} from './adaptation';
import { bodyMass, fatFreeMass, glycogenCapacity, glycogenKg, skeletalMuscle } from './body';
import { exerciseOf, type SimContext } from './context';
import { adaptiveThermoStep, energyBalanceMod, expenditure, neatStep, partition } from './energy';
import {
  banisterStep, computeReadiness, damageDecay, effectiveSleep, illnessStep, overreachAdaptationMultiplier, overreachStep,
  recoveryRate, sleepStep, stressStep, systemicStrain,
} from './fatigue';
import { healStep, injuryCheck, isRestricted, restrictedMuscles } from './injury';
import { clamp, interp } from './math';
import {
  ambientTemp, caffeineAt, caffeineEffects, dateOf, dehydrationEffects, eaStep, effectiveProteinGkg, energyAvailability,
  hungerStep, hydrationStep, micronutrientStep, monthOf, proteinMod, supplementStep,
} from './nutrition';
import { intakeFromTarget, type DayInputsWithTarget } from './plan';
import { streamRng } from './rng';
import { resolveSession, type SessionDayCtx, type SessionResult } from './session';
import type { AcuteModifiers } from './strength';
import { DAYS_PER_YEAR, KCAL_PER_G_FAT } from './units';
import { HISTORY_DAYS, type CharacterState, type DayReport, type Intake, type Session } from './types';

const idx = (day: number) => ((day % HISTORY_DAYS) + HISTORY_DAYS) % HISTORY_DAYS;

function resetToday(s: CharacterState) {
  const d = idx(s.day);
  for (const m of MUSCLE_REGIONS) s.muscles[m].hypHist[d] = 0;
  for (const p of MOVEMENT_PATTERNS) {
    s.patterns[p].strHist[d] = 0;
    s.patterns[p].setHist[d] = 0;
  }
  const pw = s.power;
  for (const h of [pw.powHistLower, pw.powHistUpper, pw.plyoHist, pw.sprintHist, pw.sprintTechHist, pw.sprintF0hHist]) h[d] = 0;
  const a = s.aerobic;
  a.aeroHist[d] = 0;
  a.aeroMinutesHist[d] = 0;
  a.runKmHist[d] = 0;
  s.fatigue.acuteLoadHist[d] = 0;
  s.fatigue.closeHist[d] = 0;
  for (const k in s.fatigue.preventionHist) (s.fatigue.preventionHist[k] as number[])[d] = 0;
}

/** Remove exercises that load injured tissue; skip hard sessions while ill. */
function filterSessions(ctx: SimContext, s: CharacterState, sessions: Session[]): { sessions: Session[]; skipped: string[] } {
  const restricted = restrictedMuscles(s);
  const skipped: string[] = [];
  const ill = s.fatigue.illnessDays > 0;
  const out: Session[] = [];
  for (const sess of sessions) {
    if (ill && sess.kind !== 'cardio') {
      skipped.push('session skipped (ill)');
      continue;
    }
    if (sess.kind === 'cardio') {
      const e = exerciseOf(ctx, sess.exerciseId);
      if (isRestricted(ctx, e.muscles, restricted)) skipped.push(`${e.name} skipped (injury)`);
      else out.push(ill ? { ...sess, minutes: sess.minutes * ctx.P.model.illCardioFraction, zone: 1 } : sess);
      continue;
    }
    const ex = sess.exercises.filter((rx) => {
      const e = exerciseOf(ctx, rx.exerciseId);
      const bad = isRestricted(ctx, e.muscles, restricted);
      if (bad) skipped.push(`${e.name} skipped (injury)`);
      return !bad;
    });
    if (ex.length) out.push({ ...sess, exercises: ex });
  }
  return { sessions: out, skipped };
}

export interface DayResult {
  report: DayReport;
  sessions: SessionResult[];
}

export function simulateDay(ctx: SimContext, s: CharacterState, inputs: DayInputsWithTarget): DayResult {
  const { P, C } = ctx;
  const M = P.model;
  resetToday(s);
  const d = idx(s.day);
  const month = monthOf(s.startDate, s.day);
  const temp = Number.isFinite(inputs.ambientTempC) ? inputs.ambientTempC : ambientTemp(month);
  const events: string[] = [];
  const random = !inputs.disableRandomEvents;

  // ---- 1. inputs: sleep (last night), supplements, stress, illness, readiness ----
  const effSleep = effectiveSleep(ctx, s, inputs.sleepH, s.fatigue.caffeineMgAtBed, inputs.intakeTarget?.alcoholDrinks ?? inputs.intake.alcoholDrinks);
  sleepStep(ctx, s, effSleep);
  supplementStep(ctx, s, inputs);
  if (random && illnessStep(ctx, s, streamRng(s.seed, s.day, 'illness'), month, s.nutrition.lowEaDays > 14)) events.push('Caught a cold');
  const { readiness, factors: readinessFactors } = computeReadiness(ctx, s, effSleep);

  // ---- 2. expenditure prerequisites ----
  neatStep(ctx, s, inputs.jobHours);

  // ---- 3/4. training sessions (stimulus accumulates in ring buffers) ----
  const { sessions, skipped } = filterSessions(ctx, s, [...inputs.sessions].sort((a, b) => a.startHour - b.startHour));
  events.push(...skipped);
  const cre = s.body.creatineSaturation;
  const dehyd = dehydrationEffects(ctx, s.nutrition.hydration);
  const eaPerf = 1 - P.nutrition.lowEaPerformancePenalty * clamp(s.nutrition.lowEaDays / P.nutrition.lowEaDaysToEffect, 0, 1) * (s.nutrition.eaEma < P.nutrition.eaThreshold ? 1 : 0);
  const mgPerf = s.nutrition.magnesiumStatus < M.magnesiumDeficientStatus ? 1 - P.nutrition.magnesiumDeficiencyEconomyPenalty : 1;
  const ironPerf = s.nutrition.ironStoreMg < P.nutrition.ironStoreDeficientMg ? 1 - P.nutrition.idnaPerformancePenalty : 1;
  const glycFrac = s.aerobic.glycogen / glycogenCapacity(s, P, 0.5);
  const glycPerf = 1 - P.aerobic.glycogenPerformancePenalty * clamp(0.5 - glycFrac, 0, 0.5) * 2;
  const results: SessionResult[] = [];
  let liftHours: number[] = [];
  for (const sess of sessions) {
    const mg = caffeineAt(s, inputs.caffeine, sess.startHour);
    const caf = caffeineEffects(ctx, s, mg);
    const acute: AcuteModifiers = {
      readiness,
      caffeine: caf.strength,
      creatine: 1 + P.strength.creatineAcuteStrength * cre,
      hydration: dehyd.strength,
      other: eaPerf * (s.nutrition.vitDngml < P.nutrition.vitDDeficient ? 1 - P.nutrition.vitDMusclePenalty : 1),
    };
    const dc: SessionDayCtx = {
      day: s.day, readiness, acute, creatineSat: cre, ambientTempC: temp,
      caffeinePowerMult: caf.power * dehyd.power,
      caffeineEnduranceMult: caf.endurance,
      aerobicPerfMult: dehyd.endurance * eaPerf * ironPerf * glycPerf * caf.endurance,
      economyMult: mgPerf,
    };
    const r = resolveSession(ctx, s, sess, dc);
    results.push(r);
    if (sess.kind === 'lift') liftHours.push(sess.startHour);
  }
  // interference timing: cardio minutes within the gap of a lifting session today
  for (const r of results) {
    if (r.kind !== 'cardio') continue;
    if (liftHours.some((h) => Math.abs(h - r.startHour) < P.aerobic.interferenceGapHours)) s.fatigue.closeHist[d] = (s.fatigue.closeHist[d] as number) + r.interferenceMinutes;
  }
  liftHours = [];
  const exerciseKcal = results.reduce((a, r) => a + r.kcal, 0);
  const loads = results.reduce((a, r) => ({ str: a.str + r.load.str, pow: a.pow + r.load.pow, aer: a.aer + r.load.aer }), { str: 0, pow: 0, aer: 0 });
  s.fatigue.acuteLoadHist[d] = loads.str + loads.pow + loads.aer;
  // Physical work adds systemic fatigue (not counted in the training ACWR).
  loads.str += inputs.jobHours * inputs.jobStrain * M.jobFatigueLoadPerStrainHour;
  for (const r of results) for (const set of r.sets) {
    const e = exerciseOf(ctx, set.exerciseId);
    for (const tag of e.prevention) {
      const h = s.fatigue.preventionHist[tag];
      if (h) h[d] = (h[d] as number) + 1;
    }
  }
  const trainingMinutes = results.reduce((a, r) => a + r.minutes, 0);
  s.trainingHours += trainingMinutes / 60;

  // ---- 2 (cont). expenditure and intake ----
  const prelimIntake: Intake = inputs.intakeTarget ? intakeFromTarget(ctx, s, inputs.intakeTarget, s.lastTdee || M.prelimTdee) : inputs.intake;
  let ex = expenditure(ctx, s, prelimIntake, exerciseKcal, inputs.jobHours, inputs.jobMet);
  let intake = prelimIntake;
  if (inputs.intakeTarget) {
    intake = intakeFromTarget(ctx, s, inputs.intakeTarget, ex.total);
    ex = expenditure(ctx, s, intake, exerciseKcal, inputs.jobHours, inputs.jobMet);
  }
  s.lastTdee = ex.total;
  const balance = intake.kcal - ex.total;

  // ---- 5. recovery and fatigue decay ----
  const rec = recoveryRate(ctx, s, effSleep);
  damageDecay(ctx, s, rec);
  banisterStep(ctx, s, loads, rec);
  const strainNow = systemicStrain(ctx, s);
  const ea = energyAvailability(ctx, s, intake.kcal, exerciseKcal);
  const eaRes = eaStep(ctx, s, ea);
  const poorRecovery = s.fatigue.sleepDebtH > M.poorRecoverySleepDebtH || s.fatigue.stress > M.poorRecoveryStress || eaRes.low;
  const orEvent = overreachStep(ctx, s, strainNow, poorRecovery);
  if (orEvent) events.push(`Training state: ${orEvent}`);
  stressStep(ctx, s, { jobStrain: inputs.jobStrain, financial: inputs.financialStress ?? 0, events: inputs.stressEvents, socialHours: inputs.socialHours });

  // ---- 6. adaptation ----
  const bw = bodyMass(s, P);
  const interfMin = sumLast(s.aerobic.aeroMinutesHist, s.day, 7) + (P.aerobic.interferenceSameSessionMultiplier - 1) * sumLast(s.fatigue.closeHist, s.day, 7);
  const interfSat = clamp(interfMin / P.aerobic.interferenceSaturationMin, 0, 1);
  const chronicSleep = P.fatigue.sleepNeedH - s.fatigue.sleepDebtH / M.chronicSleepDebtDivisor;
  const fatFrac = intake.kcal > 0 ? (intake.fatG * KCAL_PER_G_FAT) / intake.kcal : P.nutrition.fatMinFraction;
  const mods: DailyMods = {
    protein: proteinMod(ctx, s, intake),
    energyBalance: energyBalanceMod(ctx, balance),
    sleep: interp(C.hypertrophy.sleep, Math.min(effSleep + 0.5, chronicSleep)),
    stress: interp(C.hypertrophy.stress, s.fatigue.stress),
    age: interp(C.hypertrophy.age, s.ageYears),
    alcohol: interp(C.hypertrophy.alcohol, intake.alcoholDrinks),
    creatine: 1 + (P.hypertrophy.creatineHypertrophyBonus - 1) * cre,
    creatineSat: cre,
    energyAvailability: eaRes.mod,
    overreach: overreachAdaptationMultiplier(ctx, s),
    interferenceHyp: 1 - P.hypertrophy.interferenceHypertrophy * interfSat,
    interferenceStr: 1 - P.strength.interferenceStrength * interfSat,
    interferencePow: 1 - P.power.interferencePower * interfSat,
    vitaminD: s.nutrition.vitDngml < P.nutrition.vitDDeficient ? 1 - P.nutrition.vitDMusclePenalty : 1,
    fatIntake: fatFrac < P.nutrition.fatMinFraction ? 1 - P.nutrition.fatLowPenalty : 1,
  };
  const mr = hypertrophyStep(ctx, s, mods);
  neuralStep(ctx, s, mods);
  powerStep(ctx, s, mods);
  const strengthPlyo = clamp((sumLast(s.power.plyoHist, s.day, 7) + sumLast(s.patterns.squat.strHist, s.day, 7)) / M.economyStrengthPlyoNorm, 0, 1);
  aerobicStep(ctx, s, mods, strengthPlyo);
  tendonStep(ctx, s, mr);

  // ---- 7. energy balance and partitioning ----
  let respSum = 0;
  let respW = 0;
  for (const m of MUSCLE_REGIONS) {
    respSum += mr[m].response * s.muscles[m].mass;
    respW += s.muscles[m].mass;
  }
  const meanResp = respSum / respW;
  const prevW = s.body.weightHist[idx(s.day - 7)] as number;
  const weeklyLossRate = prevW > 0 ? (prevW - bw) / prevW : 0;
  const part = partition(ctx, s, mr, { balance, proteinGkg: effectiveProteinGkg(ctx, s, intake), sleepH: Math.min(effSleep, chronicSleep + 1), trainingResponse: meanResp, weeklyLossRate });
  applyMuscleChanges(s, part.muscleDelta);
  s.body.fatMass = Math.max(0.5, s.body.fatMass + part.fatDelta);
  s.body.nonMuscleLean = Math.max(s.body.frameLean * M.nonMuscleLeanFloor, s.body.nonMuscleLean + part.nonMuscleLeanDelta);
  s.body.balanceEma += (balance - s.body.balanceEma) / M.balanceEmaDays;
  adaptiveThermoStep(ctx, s);
  // glycogen: refill from carbohydrate, drain by exercise
  const glycUsed = results.reduce((a, r) => a + r.glycogenUsedG, 0);
  const cap = glycogenCapacity(s, P, meanResp) * clamp(1 + Math.min(0, s.body.balanceEma) / M.glycogenDeficitScaleKcal, M.glycogenDeficitMinFraction, 1);
  const carbAvail = Math.max(0, intake.carbG - P.energy.carbBaselineUseG);
  const a = s.aerobic;
  a.glycogen = Math.max(M.glycogenFloorG, a.glycogen - glycUsed);
  const refill = Math.min(carbAvail * M.carbRefillEfficiency, (cap - a.glycogen) * (1 - Math.exp(-1 / P.energy.glycogenRefillTauDays)));
  if (a.glycogen > cap) a.glycogen -= (a.glycogen - cap) * (1 - Math.exp(-1 / P.energy.glycogenRefillTauDays));
  else a.glycogen = clamp(a.glycogen + Math.max(refill, intake.carbG < P.energy.carbBaselineUseG ? -(P.energy.carbBaselineUseG - intake.carbG) * M.lowCarbGlycogenDrain : 0), M.glycogenFloorG, Math.max(cap, M.glycogenFloorG));
  s.body.sodiumWater = P.energy.waterPerSodiumG * (intake.sodiumG - P.energy.sodiumRefG);
  s.body.weightHist[d] = bodyMass(s, P);

  // ---- 8. micronutrients, hydration, hunger ----
  const runKm = results.reduce((x, r) => x + r.runKm, 0);
  const micro = micronutrientStep(ctx, s, intake, inputs, runKm, trainingMinutes > 20, month);
  const sweat = results.reduce((x, r) => x + r.sweatL, 0);
  const jobSweat = inputs.jobMet > M.jobSweatMetThreshold ? (inputs.jobHours * s.genetics.sweatRate * M.jobSweatFraction) * (1 + P.nutrition.sweatTempCoefficientPerC * Math.max(0, temp - 20)) : 0;
  hydrationStep(ctx, s, intake, sweat, jobSweat);
  hungerStep(ctx, s, balance, intake);
  const loading = clamp((sumLast(s.patterns.squat.strHist, s.day, 7) + sumLast(s.patterns.hinge.strHist, s.day, 7) + sumLast(s.power.plyoHist, s.day, 7) + sumLast(a.runKmHist, s.day, 7) / M.boneRunKmPerUnit) / M.boneLoadingNorm, 0, 1);
  boneStep(ctx, s, loading, eaRes.severity, !micro.vitDDeficient, !micro.calciumLow);
  s.fatigue.caffeineMgAtBed = caffeineAt(s, inputs.caffeine, inputs.bedHour);

  // ---- 9. injuries ----
  const injuries: string[] = [];
  if (random) {
    const prevention: Record<string, number> = {};
    for (const k in s.fatigue.preventionHist) prevention[k] = sumLast(s.fatigue.preventionHist[k] as number[], s.day, 7);
    const hz = results.flatMap((r) => r.hazards);
    if (inputs.jobHours > 0 && inputs.jobStrain > 0) {
      hz.push({ exerciseId: 'job', hazard: (P.injury.occupationalRatePer1000h / 1000) * inputs.jobHours * (inputs.jobStrain / M.jobStrainReference), tissues: inputs.jobTissues ?? ['lowBack'], muscles: [], kind: 'job', impact: 0 });
    }
    for (const inj of injuryCheck(ctx, s, hz, { sleepH: effSleep, eaSeverity: eaRes.severity, readiness }, streamRng(s.seed, s.day, 'injury'), prevention)) {
      injuries.push(`${inj.type} (${inj.tissue}), ~${inj.durationDays} days`);
    }
  }
  for (const h of healStep(ctx, s, inputs.rehab ?? false)) events.push(`Recovered from ${h.type} (${h.tissue})`);

  // ---- aging ----
  s.ageYears += 1 / DAYS_PER_YEAR;
  agingStep(ctx, s);

  // ---- report ----
  const muscleStim: DayReport['muscleStim'] = {};
  let dMuscle = 0;
  for (const m of MUSCLE_REGIONS) {
    const delta = part.muscleDelta[m];
    dMuscle += delta;
    if (mr[m].weeklySets > M.minSetsForQuality || Math.abs(delta) > 1e-5) muscleStim[m] = { weeklySets: mr[m].weeklySets, response: mr[m].response, deltaKg: delta };
  }
  const report: DayReport = {
    day: s.day,
    date: dateOf(s.startDate, s.day),
    tdee: { bmr: ex.bmr, tef: ex.tef, exercise: ex.exercise, epoc: ex.epoc, neat: ex.neat, job: ex.job, adaptive: -ex.adaptive - ex.constrained, total: ex.total },
    intakeKcal: intake.kcal,
    balance,
    energyAvailability: ea,
    readiness,
    readinessFactors,
    sets: results.flatMap((r) => r.sets),
    cardioMinutes: results.reduce((x, r) => x + r.cardioMinutes, 0),
    trainingMinutes,
    hypMods: { ...mods, product: hypertrophyModProduct(mods) } as unknown as DayReport['hypMods'],
    muscleStim,
    deltaMuscleKg: dMuscle,
    deltaFatKg: part.fatDelta,
    deltaLeanOtherKg: part.nonMuscleLeanDelta,
    interference: { power: mods.interferencePow, hypertrophy: mods.interferenceHyp, strength: mods.interferenceStr },
    events,
    injuries,
  };
  delete (report.hypMods as Record<string, number>).creatineSat;
  s.day += 1;
  return { report, sessions: results };
}

/** Convenience: muscles (ids) trained with at least `minSets` weekly effective sets at the end of a run. */
export function trainedMuscles(s: CharacterState, minSets: number): MuscleId[] {
  return MUSCLE_REGIONS.filter((m) => sumLast(s.muscles[m].hypHist, s.day - 1, 7) >= minSets);
}

export { bodyMass, fatFreeMass, skeletalMuscle, glycogenKg };
