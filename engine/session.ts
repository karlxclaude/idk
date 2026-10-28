// Training session resolution: lifting set by set with within-session fatigue, plus plyometric,
// sprint and cardio sessions. Writes today's stimulus into the character's ring buffers.
import { LOWER_BODY, MUSCLE_REGIONS, patternTransfer, MOVEMENT_PATTERNS, type MuscleId } from '../data/muscles';
import type { Exercise } from '../data/exercises/schema';
import { exerciseOf, transfersFrom, type SimContext } from './context';
import { bodyMass } from './body';
import { clamp, interp } from './math';
import {
  bodyweightLoad, oneRepMax, pctForReps, repsAt, repsMultiplier, roundLoad, skillOf, type AcuteModifiers,
} from './strength';
import { ML_O2_PER_KG_MIN_PER_MET, KCAL_PER_L_O2 } from './units';
import { HISTORY_DAYS, type CardioSession, type CharacterState, type LiftPrescription, type Session, type SetLog, type Zone } from './types';

export interface Hazard {
  exerciseId: string;
  /** Expected injuries for this exposure before day-level multipliers. */
  hazard: number;
  tissues: string[];
  muscles: MuscleId[];
  kind: 'lift' | 'olympic' | 'strongman' | 'run' | 'plyo' | 'sprint' | 'cardio' | 'job';
  impact: number;
}

export interface SessionDayCtx {
  day: number;
  readiness: number;
  acute: AcuteModifiers;
  creatineSat: number;
  ambientTempC: number;
  caffeinePowerMult: number;
  caffeineEnduranceMult: number;
  /** Multiplier on aerobic work capacity (dehydration, low glycogen, Mg). */
  aerobicPerfMult: number;
  /** Movement economy (1 = normal). Magnesium deficiency raises the O2 cost of a given pace: same kcal per minute, less distance. */
  economyMult?: number;
}

export interface SessionResult {
  sets: SetLog[];
  minutes: number;
  kcal: number;
  load: { str: number; pow: number; aer: number };
  hazards: Hazard[];
  sweatL: number;
  glycogenUsedG: number;
  hardSets: number;
  cardioMinutes: number;
  /** Weighted endurance minutes for interference (modality factor applied). */
  interferenceMinutes: number;
  runKm: number;
  kind: Session['kind'];
  startHour: number;
}

const idx = (day: number) => ((day % HISTORY_DAYS) + HISTORY_DAYS) % HISTORY_DAYS;

function emptyResult(kind: Session['kind'], startHour: number): SessionResult {
  return { sets: [], minutes: 0, kcal: 0, load: { str: 0, pow: 0, aer: 0 }, hazards: [], sweatL: 0, glycogenUsedG: 0, hardSets: 0, cardioMinutes: 0, interferenceMinutes: 0, runKm: 0, kind, startHour };
}

function ensureSkill(ctx: SimContext, s: CharacterState, id: string) {
  let k = s.skills[id];
  if (!k) {
    k = { skill: s.genetics.noviceSkill, lastDay: -9999, sessions: 0, rbe: 0 };
    s.skills[id] = k;
  }
  return k;
}

/** Base injury rate per hour for an exercise (before multipliers). */
function baseRatePerHour(ctx: SimContext, s: CharacterState, e: Exercise): { rate: number; kind: Hazard['kind'] } {
  const I = ctx.P.injury;
  const M = ctx.P.model;
  const run = (e.baseInjuryRisk / M.runInjuryRiskRef) / 1000;
  const lift = (e.baseInjuryRisk / M.liftInjuryRiskRef) / 1000;
  if (e.category === 'cardio' && e.cardio) {
    if (e.cardio.modality === 'running' || e.cardio.impact > M.impactRunningThreshold) {
      const novice = clamp(1 - s.aerobic.runHours / M.noviceRunHours, 0, 1);
      const r = I.rateRecreationalRunning + (I.rateNoviceRunning - I.rateRecreationalRunning) * novice;
      return { rate: r * run, kind: 'run' };
    }
    return { rate: I.ratePowerlifting * lift, kind: 'cardio' };
  }
  if (e.category === 'strongman') return { rate: (I.rateStrongman / 1000) * (e.baseInjuryRisk / M.strongmanInjuryRiskRef), kind: 'strongman' };
  if (e.category === 'olympic') return { rate: I.rateWeightlifting * lift, kind: 'olympic' };
  if (e.category === 'sprint') return { rate: I.rateRecreationalRunning * run, kind: 'sprint' };
  if (e.category === 'plyometric') return { rate: I.rateRecreationalRunning * run * M.plyoInjuryFactor, kind: 'plyo' };
  return { rate: I.ratePowerlifting * lift, kind: 'lift' };
}

function primaryMuscles(ctx: SimContext, e: Exercise): MuscleId[] {
  const out: MuscleId[] = [];
  const ms = e.muscles as Partial<Record<MuscleId, number>>;
  for (const k in ms) if ((ms[k as MuscleId] as number) >= ctx.P.model.primaryActivation) out.push(k as MuscleId);
  return out;
}

/** Add strength stimulus to a pattern and (scaled) to related patterns. */
function addPatternStimulus(ctx: SimContext, s: CharacterState, e: Exercise, d: number, strStim: number, hardSet: number) {
  const scale = ctx.P.training.neuralTransferScale;
  for (const p of MOVEMENT_PATTERNS) {
    const t = p === e.movementPattern ? 1 : patternTransfer(e.movementPattern, p) * scale;
    if (t <= 0) continue;
    const ps = s.patterns[p];
    ps.strHist[d] = (ps.strHist[d] as number) + strStim * t;
    ps.setHist[d] = (ps.setHist[d] as number) + hardSet * t;
    if (t === 1 && strStim > ctx.P.model.minStrStimForPatternDay) ps.lastStimDay = s.day;
  }
}

function addPowerStimulus(ctx: SimContext, s: CharacterState, e: Exercise, d: number, powStim: number) {
  let lower = 0;
  let total = 0;
  const ms = e.muscles as Partial<Record<MuscleId, number>>;
  for (const k in ms) {
    const a = ms[k as MuscleId] as number;
    total += a;
    if (LOWER_BODY.has(k as MuscleId)) lower += a;
  }
  const share = total > 0 ? lower / total : 0.5;
  const pw = s.power;
  pw.powHistLower[d] = (pw.powHistLower[d] as number) + powStim * share;
  pw.powHistUpper[d] = (pw.powHistUpper[d] as number) + powStim * (1 - share);
  if (powStim > ctx.P.model.minStrStimForPatternDay) pw.lastPowerDay = s.day;
}

function tissueKinds(ctx: SimContext, e: Exercise): string[] {
  return e.riskTissues.length ? e.riskTissues : primaryMuscles(ctx, e);
}

/** Resolve a lifting (or plyometric / sprint) session set by set. */
export function resolveSetSession(
  ctx: SimContext,
  s: CharacterState,
  exercises: LiftPrescription[],
  kind: 'lift' | 'plyo' | 'sprint',
  startHour: number,
  dc: SessionDayCtx,
): SessionResult {
  const { P, C } = ctx;
  const T = P.training;
  const M = P.model;
  const d = idx(dc.day);
  const res = emptyResult(kind, startHour);
  const bw = bodyMass(s, P);
  for (const m of MUSCLE_REGIONS) {
    s.muscles[m].sessionStim = 0;
    s.muscles[m].sessionFatigue = 0;
  }
  let seconds = M.warmupMinutes * 60;
  let kcal = 0;

  for (const rx of exercises) {
    const e = exerciseOf(ctx, rx.exerciseId);
    const sk = ensureSkill(ctx, s, e.id);
    const skill = skillOf(ctx, s, e.id);
    const repsMult = repsMultiplier(ctx, s, e, dc.creatineSat);
    const restS = rx.restS;
    const intent = rx.intent ?? (e.category === 'plyometric' || e.category === 'sprint' || e.category === 'olympic' ? 'max' : 'controlled');
    const intentF = intent === 'max' ? 1 : intent === 'slow' ? T.intentSubmaxPower * M.slowIntentPowerFactor : T.intentSubmaxPower;
    const tempo = rx.tempoS ?? e.secondsPerRep;
    const tempoF = tempo > T.tempoSlowThresholdS ? T.tempoSlowMultiplier : 1;
    const restF = interp(C.training.hypRest, restS);
    const base = baseRatePerHour(ctx, s, e);
    const tissues = tissueKinds(ctx, e);
    const prim = primaryMuscles(ctx, e);
    let maxPctUsed = 0;
    let setsDone = 0;

    // ---- loaded (external or bodyweight) lifts ----
    if (e.loadType !== 'none' && e.refLoad) {
      const fresh1rm = oneRepMax(ctx, s, e.id, dc.acute, false);
      const known1rm = oneRepMax(ctx, s, e.id, { ...dc.acute, readiness: 1 }, false);
      const bwLoad = bodyweightLoad(ctx, s, e);
      let load: number;
      if (rx.loadKg !== undefined) load = rx.loadKg + bwLoad;
      else if (rx.pct1rm !== undefined) load = (rx.pct1rm / 100) * known1rm;
      else {
        const target = (rx.reps ?? M.defaultTargetReps) + rx.targetRir;
        load = pctForReps(ctx, target, repsMult) * fresh1rm;
      }
      if (e.loadType === 'bodyweight') load = Math.max(bwLoad, bwLoad + roundLoad(ctx, load - bwLoad, e) * (load > bwLoad ? 1 : 0));
      else load = roundLoad(ctx, load, e);

      for (let i = 0; i < rx.sets; i++) {
        const cur1rm = oneRepMax(ctx, s, e.id, dc.acute, true);
        const pNow = cur1rm > 0 ? load / cur1rm : 2;
        const maxReps = repsAt(ctx, pNow, repsMult);
        let performed: number;
        if (maxReps < 1) performed = 0;
        else if (rx.reps !== undefined) performed = Math.max(1, Math.min(rx.reps, Math.floor(maxReps - rx.targetRir + 1e-9)));
        else performed = Math.max(1, Math.floor(maxReps - rx.targetRir + 1e-9));
        const failed = performed === 0;
        const rir = Math.max(0, maxReps - performed);
        const pctFresh = clamp((load / fresh1rm) * 100, 0, M.maxPctFresh);
        maxPctUsed = Math.max(maxPctUsed, pctFresh / 100);
        const effort = maxReps > 0 ? clamp(performed / maxReps, 0, 1) : 1;
        const vl = T.velocityLossAtFailure * effort ** T.velocityLossExponent;
        applySetStimulus(ctx, s, e, d, {
          performed, rir, pctFresh, effort, vl, restF, tempoF, intentF,
        });
        // systemic load
        const failMult = rir < 0.5 ? T.failureFatigueMultiplier : rir < 1.5 ? T.nearFailureFatigueMultiplier : 1;
        const hard = rir <= T.hardSetRir ? 1 : 0;
        res.hardSets += hard;
        res.load.str += e.systemicFatigue * T.systemicFatiguePerSet * failMult * (M.systemicEffortBase + (1 - M.systemicEffortBase) * effort);
        if (e.adaptationBias.power >= M.ballisticBiasThreshold) res.load.pow += e.systemicFatigue * M.powerLoadPerBallisticSet * intentF;
        res.sets.push({ exerciseId: e.id, loadKg: load - bwLoad, reps: performed, rir: Math.round(rir * 10) / 10, pct1rm: Math.round(pctFresh), velocityLoss: Math.round(vl), failed });
        const setSec = performed * tempo + (i < rx.sets - 1 ? restS : M.restAfterLastSetS);
        seconds += setSec;
        kcal += ((e.metValue - 1) * bw * setSec) / 3600;
        // injury exposure for this set
        const intensity = (Math.max(M.injuryIntensityFloor, pctFresh / 100) / M.injuryIntensityRef) ** P.injury.intensityHazardExponent;
        const technique = 1 + (P.injury.techniqueHazardMax - 1) * (1 - skill) * e.skillDemand;
        const fatigue = 1 + (P.injury.fatigueHazardMax - 1) * (1 - dc.readiness) * failMult;
        res.hazards.push({ exerciseId: e.id, hazard: base.rate * (setSec / 3600) * intensity * technique * fatigue, tissues, muscles: prim, kind: base.kind, impact: e.axialLoad });
        // within-session fatigue recovery during rest
        const rec = Math.exp((-T.intraSetRecoveryPerMin * restS) / 60);
        for (const m of MUSCLE_REGIONS) s.muscles[m].sessionFatigue *= rec;
        setsDone++;
      }
    } else {
      // ---- unloaded: plyometrics, sprints, holds ----
      for (let i = 0; i < rx.sets; i++) {
        const reps = rx.reps ?? 1;
        const effort = clamp(M.plyoEffortBase + M.plyoEffortPer5Reps * (reps / 5), M.plyoEffortBase, 1) * dc.readiness;
        const vl = kind === 'plyo' ? M.plyoVlBase + reps * M.plyoVlPerRep : M.plyoVlBase;
        applySetStimulus(ctx, s, e, d, { performed: reps, rir: T.hardSetRir, pctFresh: 0, effort, vl, restF, tempoF: 1, intentF });
        const pw = s.power;
        if (e.category === 'plyometric') {
          pw.plyoHist[d] = (pw.plyoHist[d] as number) + e.adaptationBias.jump * intentF * dc.caffeinePowerMult;
          pw.lastPlyoDay = s.day;
        }
        if (e.sprint) {
          const dist = rx.distanceM ?? M.sprintRefDistanceM;
          const distF = clamp(dist / M.sprintRefDistanceM, M.sprintDistFactorMin, M.sprintDistFactorMax);
          pw.sprintHist[d] = (pw.sprintHist[d] as number) + e.sprint.vmax * distF * intentF;
          pw.sprintF0hHist[d] = (pw.sprintF0hHist[d] as number) + e.sprint.f0h * intentF;
          pw.sprintTechHist[d] = (pw.sprintTechHist[d] as number) + e.sprint.technique;
          pw.lastSprintDay = s.day;
        }
        res.load.pow += e.systemicFatigue * T.systemicFatiguePerSet * M.unloadedPowerLoadFactor;
        const workSec = e.sprint ? (rx.distanceM ?? M.sprintRefDistanceM) / M.sprintMeanSpeed : reps * e.secondsPerRep;
        const setSec = workSec + (i < rx.sets - 1 ? restS : M.restAfterLastSetS);
        seconds += setSec;
        kcal += ((e.metValue - 1) * bw * setSec) / 3600;
        const fatigue = 1 + (P.injury.fatigueHazardMax - 1) * (1 - dc.readiness);
        const technique = 1 + (P.injury.techniqueHazardMax - 1) * (1 - skill) * e.skillDemand;
        res.hazards.push({ exerciseId: e.id, hazard: base.rate * (setSec / 3600) * fatigue * technique, tissues, muscles: prim, kind: base.kind, impact: e.axialLoad + M.unloadedImpactBonus });
        const rec = Math.exp((-T.intraSetRecoveryPerMin * restS) / 60);
        for (const m of MUSCLE_REGIONS) s.muscles[m].sessionFatigue *= rec;
        setsDone++;
        res.sets.push({ exerciseId: e.id, loadKg: 0, reps, rir: T.hardSetRir, pct1rm: 0, velocityLoss: Math.round(vl), failed: false });
      }
    }

    // ---- skill learning and repeated-bout protection (once per exercise per session) ----
    if (setsDone > 0) {
      const strQuality = interp(C.training.strLoad, maxPctUsed * 100);
      const spec = 1 - P.strength.skillLoadSpecificity + P.strength.skillLoadSpecificity * (e.loadType === 'none' ? 1 : strQuality);
      const rate = (1 - Math.exp(-1 / T.skillSessionsTau)) * e.learningRate * s.genetics.responderStr ** P.strength.skillResponderExponent * spec * Math.min(1, setsDone / M.skillFullSets);
      sk.skill = sk.skill + (1 - sk.skill) * clamp(rate, 0, M.skillMaxStep);
      for (const [other, t] of transfersFrom(ctx, e.id)) {
        const ok = ensureSkill(ctx, s, other);
        ok.skill = ok.skill + (1 - ok.skill) * clamp(rate * t * M.skillTransferRate, 0, M.skillTransferMaxStep);
      }
      sk.rbe = sk.rbe + (1 - sk.rbe) * M.rbeGainPerBout;
      sk.lastDay = s.day;
      sk.sessions += 1;
    }
  }
  res.minutes = seconds / 60;
  res.kcal = kcal;
  res.sweatL = (s.genetics.sweatRate * M.liftSweatFraction * res.minutes) / 60 * (1 + P.nutrition.sweatTempCoefficientPerC * Math.max(0, dc.ambientTempC - 20));
  res.glycogenUsedG = res.hardSets * M.glycogenPerHardSetG + kcal * M.glycogenPerLiftKcal;
  return res;
}

interface SetFacts {
  performed: number;
  rir: number;
  pctFresh: number;
  effort: number;
  vl: number;
  restF: number;
  tempoF: number;
  intentF: number;
}

/** Per-set stimulus vector and local fatigue/damage. */
function applySetStimulus(ctx: SimContext, s: CharacterState, e: Exercise, d: number, f: SetFacts) {
  const { P, C } = ctx;
  const T = P.training;
  const M = P.model;
  const loadHyp = e.loadType === 'none' ? M.noneLoadHypFactor : interp(C.training.hypLoad, f.pctFresh);
  const rirHyp = interp(C.training.hypRir, f.rir);
  const sk = s.skills[e.id];
  const rbe = sk?.rbe ?? 0;
  const novelty = 1 + (T.noveltyDamageMultiplier - 1) * (1 - rbe);
  const protection = 1 - T.repeatedBoutProtection * rbe;
  const failMult = f.rir < 0.5 ? T.failureFatigueMultiplier : f.rir < 1.5 ? T.nearFailureFatigueMultiplier : 1;
  const ms = e.muscles as Partial<Record<MuscleId, number>>;
  const lb = e.lengthBias as Partial<Record<MuscleId, number>>;
  const cap = T.sessionSaturationSets;
  for (const k in ms) {
    const m = k as MuscleId;
    const a = ms[m] as number;
    const st = s.muscles[m];
    const credit = a >= M.creditPrimaryThreshold ? a : a * (T.synergistCredit / 0.5);
    const lenB = lb[m] ?? 0;
    const lengthF = 1 + (T.lengthBiasMax - 1) * lenB;
    let stim = credit * loadHyp * rirHyp * lengthF * f.restF * f.tempoF * e.adaptationBias.hypertrophy;
    // per-session saturation
    const before = st.sessionStim;
    if (before >= cap) stim *= T.sessionSaturationTail;
    else if (before + stim > cap) stim = cap - before + (before + stim - cap) * T.sessionSaturationTail;
    st.sessionStim = before + stim;
    st.hypHist[d] = (st.hypHist[d] as number) + stim;
    if (stim > M.hardStimForLastDay) st.lastStimDay = s.day;
    // local fatigue (mechanical rep loss) and damage
    st.sessionFatigue += a * T.sessionFatigueRepLoss * f.effort ** M.sessionFatigueExponent + a * T.sessionSlowFatiguePerSet;
    if (e.loadType !== 'none' || e.category === 'plyometric' || e.category === 'sprint') {
      const dmg = T.damagePerSet * a * e.localDamage * f.effort ** M.damageEffortExponent * (1 + T.lengthenedDamageBonus * lenB) * novelty * protection * failMult;
      st.damage += dmg;
    }
  }
  // strength stimulus on the movement pattern
  if (e.loadType !== 'none') {
    const strStim = interp(C.training.strLoad, f.pctFresh) * interp(C.training.strRir, f.rir) * e.adaptationBias.maxStrength;
    addPatternStimulus(ctx, s, e, d, strStim, f.rir <= T.hardSetRir ? 1 : M.nonHardSetQualityWeight);
  }
  // power stimulus
  if (e.adaptationBias.power > M.powerBiasThreshold) {
    let loadF: number;
    if (e.peakPowerLoadPct !== undefined) {
      const z = (f.pctFresh - e.peakPowerLoadPct) / T.powerLoadWindowPct;
      loadF = Math.exp(-M.gaussianLoadCoefficient * z * z);
    } else loadF = M.nonBallisticPowerLoadFactor;
    if (e.loadType === 'none') loadF = 1;
    const vlF = interp(C.training.powVelocityLoss, f.vl);
    addPowerStimulus(ctx, s, e, d, f.intentF * loadF * vlF * e.adaptationBias.power);
  }
}

/** Fraction of VO2max for a zone given current thresholds; zone 3 sessions alternate work and recovery. */
export function zoneFraction(ctx: SimContext, s: CharacterState, zone: Zone): { work: number; avg: number; workShare: number } {
  const a = s.aerobic;
  const M = ctx.P.model;
  if (zone === 1) return { work: a.lt1 + M.zone1Offset, avg: a.lt1 + M.zone1Offset, workShare: 1 };
  const z2 = (a.lt1 + a.lt2) / 2 + M.zone2Offset;
  if (zone === 2) return { work: z2, avg: z2, workShare: 1 };
  const work = Math.min(M.zone3Max, a.lt2 + M.zone3Offset);
  const w = M.zone3WorkShare;
  return { work, avg: w * work + (1 - w) * (a.lt1 + M.zone3RecoveryOffset), workShare: w };
}

export function interferenceModality(ctx: SimContext, e: Exercise): number {
  const A = ctx.P.aerobic;
  switch (e.cardio?.modality) {
    case 'running': case 'stairs': case 'jumpRope': return A.interferenceRunning;
    case 'rowing': case 'skiErg': return A.interferenceRowing;
    case 'swimming': return A.interferenceSwimming;
    case 'cycling': case 'airBike': case 'elliptical': return A.interferenceCycling;
    case 'walking': case 'rucking': return A.interferenceCycling * ctx.P.model.interferenceWalkFactor;
    default: return A.interferenceRowing;
  }
}

/** Current VO2max in L/min (true value, including Hb mass and age drift). */
export function vo2maxAbs(ctx: SimContext, s: CharacterState): number {
  const a = s.aerobic;
  return (a.vo2Baseline + a.vo2Fast + a.vo2Slow) * a.hbMassFraction ** ctx.P.aerobic.vo2HbElasticity;
}

export function resolveCardio(ctx: SimContext, s: CharacterState, sess: CardioSession, dc: SessionDayCtx): SessionResult {
  const { P } = ctx;
  const A = P.aerobic;
  const M = P.model;
  const e = exerciseOf(ctx, sess.exerciseId);
  const res = emptyResult('cardio', sess.startHour);
  const d = idx(dc.day);
  const bw = bodyMass(s, P);
  const zf = zoneFraction(ctx, s, sess.zone);
  const vo2 = vo2maxAbs(ctx, s) * dc.aerobicPerfMult; // L/min
  const restingLmin = (bw * ML_O2_PER_KG_MIN_PER_MET) / 1000;
  const grossL = vo2 * zf.avg;
  const netKcalPerMin = Math.max(0, (grossL - restingLmin) * KCAL_PER_L_O2);
  const minutes = sess.minutes;
  res.kcal = netKcalPerMin * minutes;
  res.minutes = minutes;
  res.cardioMinutes = minutes;
  const zw = sess.zone === 1 ? A.zone1Weight : sess.zone === 2 ? A.zone2Weight : A.zone3Weight;
  const weighted = sess.zone === 3 ? minutes * (zf.workShare * A.zone3Weight + (1 - zf.workShare) * A.zone1Weight) : minutes * zw;
  const a = s.aerobic;
  a.aeroHist[d] = (a.aeroHist[d] as number) + weighted * e.adaptationBias.aerobic;
  const modF = interferenceModality(ctx, e);
  res.interferenceMinutes = minutes * modF * (sess.zone === 3 ? M.interferenceZone3Mult : sess.zone === 2 ? M.interferenceZone2Mult : 1);
  a.aeroMinutesHist[d] = (a.aeroMinutesHist[d] as number) + res.interferenceMinutes;
  if (e.cardio?.modality === 'running') {
    const rel = (grossL * 1000) / bw; // mL/kg/min
    const speed = (rel / (a.economyRun / 1000)) * (dc.economyMult ?? 1); // m/min
    res.runKm = (speed * minutes) / 1000;
    a.runKmHist[d] = (a.runKmHist[d] as number) + res.runKm;
    a.runHours += minutes / 60;
  }
  if (minutes > 5) a.lastAeroDay = s.day;
  const z = sess.zone;
  const perKcal = z === 1 ? A.glycogenUseZ1PerKcal : z === 2 ? (A.glycogenUseZ1PerKcal + A.glycogenUseZ3PerKcal) / 2 : A.glycogenUseZ3PerKcal;
  res.glycogenUsedG = res.kcal * perKcal;
  res.load.aer = weighted / 10;
  const intensityF = M.cardioSweatOffset + zf.avg;
  res.sweatL = ((s.genetics.sweatRate * intensityF * minutes) / 60) * (1 + P.nutrition.sweatTempCoefficientPerC * Math.max(0, dc.ambientTempC - 20));
  const base = baseRatePerHour(ctx, s, e);
  const fatigue = 1 + (P.injury.fatigueHazardMax - 1) * (1 - dc.readiness);
  const intensity = sess.zone === 3 ? M.cardioIntensityHazardZ3 : sess.zone === 2 ? M.cardioIntensityHazardZ2 : 1;
  res.hazards.push({ exerciseId: e.id, hazard: base.rate * (minutes / 60) * fatigue * intensity, tissues: e.riskTissues, muscles: primaryMuscles(ctx, e), kind: base.kind, impact: e.cardio?.impact ?? 0 });
  // light muscle stimulus/damage from cardio
  const ms = e.muscles as Partial<Record<MuscleId, number>>;
  for (const k in ms) {
    const st = s.muscles[k as MuscleId];
    st.damage += (ms[k as MuscleId] as number) * e.localDamage * M.cardioDamagePerHalfHour * (minutes / 30) * (sess.zone === 3 ? M.cardioDamageZ3Mult : 1) * (1 - 0.5 * (s.skills[e.id]?.rbe ?? 0));
  }
  const sk = ensureSkill(ctx, s, e.id);
  sk.rbe = sk.rbe + (1 - sk.rbe) * M.rbeGainPerCardio;
  sk.lastDay = s.day;
  sk.sessions += 1;
  return res;
}

export function resolveSession(ctx: SimContext, s: CharacterState, sess: Session, dc: SessionDayCtx): SessionResult {
  switch (sess.kind) {
    case 'cardio':
      return resolveCardio(ctx, s, sess, dc);
    case 'lift':
    case 'plyo':
    case 'sprint':
      return resolveSetSession(ctx, s, sess.exercises, sess.kind, sess.startHour, dc);
  }
}
