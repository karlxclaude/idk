// Character creation: sample genetics, build the body, set initial training status.
import {
  FEMALE_UPPER_BODY_FACTOR, MOVEMENT_PATTERNS, MUSCLE_FIBER_FACTOR, MUSCLE_HEADROOM_CLASS, MUSCLE_MASS_FRACTIONS,
  MUSCLE_REGIONS, UPPER_BODY, type MovementPattern, type MuscleId,
} from '../data/muscles';
import type { SimContext } from './context';
import { clamp, interp } from './math';
import { clampedNormal, correlatedNormals, makeRng, type Rng } from './rng';
import { FFMI_REFERENCE_HEIGHT_M, REF_AGE, REF_BODY_FAT, REF_BODY_MASS_KG, REF_HEIGHT_M } from './units';
import {
  HISTORY_DAYS, type AerobicState, type Anthropometry, type CharacterState, type Genetics, type MuscleState,
  type PatternState, type Sex,
} from './types';

export interface CharacterProfile {
  name?: string;
  sex: Sex;
  ageYears: number;
  heightCm?: number;
  /** Untrained fat-free mass index (kg/m^2). Defaults to a population draw. */
  ffmi?: number;
  bodyFat?: number; // fraction
  /** Years of consistent lifting up to today. */
  liftingYears?: number;
  /** Former lifter: years trained in the past and years since stopping (muscle memory). */
  pastLiftingYears?: number;
  detrainedYears?: number;
  enduranceYears?: number;
  sprintYears?: number;
  plyoYears?: number;
  /** Exercise ids the character already knows how to perform. */
  knownExercises?: string[];
  /** Custom lab / archetype overrides of hidden traits. */
  genetics?: Partial<Omit<Genetics, 'revealed'>>;
  anthro?: Partial<Anthropometry>;
  startDate?: string;
}

const emptyHist = (): number[] => new Array<number>(HISTORY_DAYS).fill(0);

export function sampleAnthropometry(ctx: SimContext, sex: Sex, rng: Rng, over: Partial<Anthropometry> = {}): Anthropometry {
  const G = ctx.P.genetics;
  const M = ctx.P.model;
  const male = sex === 'male';
  const sd = G.segmentSd;
  const seg = (f: number) => f * clamp(rng.normal(1, sd), 1 - M.segmentClampSd * sd, 1 + M.segmentClampSd * sd);
  return {
    heightCm: over.heightCm ?? clampedNormal(rng, male ? G.heightMeanMen : G.heightMeanWomen, male ? G.heightSdMen : G.heightSdWomen, M.heightMinCm, M.heightMaxCm),
    thigh: over.thigh ?? seg(G.thighFraction),
    shank: over.shank ?? seg(G.shankFraction),
    upperArm: over.upperArm ?? seg(G.upperArmFraction),
    forearm: over.forearm ?? seg(G.forearmFraction),
    torso: over.torso ?? seg(G.torsoFraction),
    wristCm: over.wristCm ?? clampedNormal(rng, male ? G.wristCircMeanMen : G.wristCircMeanWomen, G.wristCircSd, M.wristMinCm, M.wristMaxCm),
  };
}

export function sampleGenetics(ctx: SimContext, sex: Sex, rng: Rng, over: Partial<Genetics> = {}): Genetics {
  const { P } = ctx;
  const G = P.genetics;
  const M = P.model;
  const male = sex === 'male';
  const [zh, zs] = correlatedNormals(rng, G.responderCorrelation);
  const za = G.responderCorrelation * zh + Math.sqrt(1 - G.responderCorrelation ** 2) * rng.normal();
  const g: Genetics = {
    responderHyp: Math.exp(P.hypertrophy.responderSigma * zh),
    responderStr: Math.exp(G.responderSigmaStrength * zs),
    responderAer: Math.exp(P.aerobic.responderSigma * za),
    typeIVL: clampedNormal(rng, G.typeIMean, G.typeISd, G.typeIMin, G.typeIMax),
    ffmiCeiling: male
      ? clampedNormal(rng, P.hypertrophy.ffmiCeilingMeanMen, P.hypertrophy.ffmiCeilingSdMen, M.ffmiCeilingMinMen, M.ffmiCeilingMaxMen)
      : clampedNormal(rng, P.hypertrophy.ffmiCeilingMeanWomen, P.hypertrophy.ffmiCeilingSdWomen, M.ffmiCeilingMinWomen, M.ffmiCeilingMaxWomen),
    bmrFactor: clampedNormal(rng, 1, P.energy.bmrGeneticSd, M.bmrFactorMin, M.bmrFactorMax),
    neatResponsiveness: clampedNormal(rng, P.energy.neatResponsivenessMean, P.energy.neatResponsivenessSd, M.neatRespMin, M.neatRespMax),
    fitnessTau: clampedNormal(rng, P.fatigue.fitnessTauDays, P.fatigue.fitnessTauDays * G.banisterTauSd, M.fitnessTauMin, M.fitnessTauMax),
    fatigueTau: clampedNormal(rng, P.fatigue.fatigueTauDays, P.fatigue.fatigueTauDays * G.banisterTauSd, M.fatigueTauMin, M.fatigueTauMax),
    tendonStiffness: clampedNormal(rng, 1, G.tendonStiffnessSd, M.tendonStiffMin, M.tendonStiffMax),
    injuryProneness: rng.lognormal(1, P.injury.pronenessSigma),
    caffeineHalfLifeH: clamp(rng.lognormal(P.fatigue.caffeineHalfLifeH, G.caffeineHalfLifeSigma), M.caffeineHalfLifeMinH, M.caffeineHalfLifeMaxH),
    creatineResponder: rng.next() >= P.nutrition.creatineNonResponderRate,
    actn3xx: rng.next() < G.actn3XxFrequency,
    neuralFastGain: 0,
    noviceSkill: clampedNormal(rng, P.training.skillStart, P.training.noviceSkillSd, M.noviceSkillMin, M.noviceSkillMax),
    sweatRate: clampedNormal(rng, P.nutrition.sweatRateBase, P.nutrition.sweatRateSd, M.sweatRateMin, M.sweatRateMax),
    sweatSodium: clampedNormal(rng, P.nutrition.sweatSodiumMmol, P.nutrition.sweatSodiumSd, M.sweatSodiumMin, M.sweatSodiumMax),
    androidFat: clampedNormal(rng, male ? P.energy.fatDistributionAndroidMen : P.energy.fatDistributionAndroidWomen, M.androidFatSd, M.androidFatMin, M.androidFatMax),
    revealed: { fiberType: false, responders: false, ceiling: false, metabolism: false },
  };
  const merged = { ...g, ...over, revealed: { ...g.revealed, ...(over.revealed ?? {}) } };
  if (over.neuralFastGain === undefined) merged.neuralFastGain = P.strength.neuralFastGainMedian * merged.responderStr * Math.exp(P.strength.neuralFastGainSigma * rng.normal());
  return merged;
}

/** Fraction of the remaining gap closed after `years` of consistent training at typical response R. */
function trainedFraction(kPerDay: number, years: number, R: number): number {
  return 1 - Math.exp(-kPerDay * R * 365 * Math.max(0, years));
}

export function createCharacter(ctx: SimContext, profile: CharacterProfile, seed: string | number): CharacterState {
  const { P, C } = ctx;
  const rng = makeRng(`char|${seed}`);
  const sex = profile.sex;
  const male = sex === 'male';
  const anthro = sampleAnthropometry(ctx, sex, rng, { ...profile.anthro, ...(profile.heightCm ? { heightCm: profile.heightCm } : {}) });
  const genetics = sampleGenetics(ctx, sex, rng, profile.genetics);
  const h = anthro.heightCm / 100;
  const G = P.genetics;
  const M = P.model;

  // --- Fat-free mass and skeletal muscle ---
  const ffmi = profile.ffmi ?? clampedNormal(rng, male ? G.ffmiUntrainedMeanMen : G.ffmiUntrainedMeanWomen, male ? G.ffmiUntrainedSdMen : G.ffmiUntrainedSdWomen, M.ffmiUntrainedMin, M.ffmiUntrainedMax);
  const ffm0 = ffmi * h * h;
  const smmFrac = male ? P.hypertrophy.smmFractionOfFfmMen : P.hypertrophy.smmFractionOfFfmWomen;
  const smm0 = smmFrac * ffm0;
  const glycCapacity0 = P.aerobic.glycogenPerKgMuscle * smm0 + P.aerobic.liverGlycogenG;
  const glycogen0 = M.initialGlycogenFraction * glycCapacity0;
  const glycKg = (glycogen0 * (1 + P.energy.waterPerGlycogen)) / 1000;
  const nonMuscleLean = ffm0 - smm0 - glycKg;

  // --- Genetic ceiling from normalized FFMI (Kouri) + frame ---
  const wristMean = male ? G.wristCircMeanMen : G.wristCircMeanWomen;
  const ceilingNorm = genetics.ffmiCeiling + G.frameCeilingPerCm * (anthro.wristCm - wristMean);
  const ceilingRaw = ceilingNorm - P.hypertrophy.ffmiHeightCorrection * (FFMI_REFERENCE_HEIGHT_M - h);
  const ceilingFfm = ceilingRaw * h * h;
  const glycCeilKg = ((P.aerobic.glycogenPerKgMuscle * (1 + P.hypertrophy.trainedGlycogenBonus) * smm0 * M.ceilingGlycogenMassFactor + P.aerobic.liverGlycogenG) * (1 + P.energy.waterPerGlycogen)) / 1000;
  const mmaxTotal = Math.max(smm0 * M.minHeadroom, ceilingFfm - nonMuscleLean - glycCeilKg);
  const headroom = mmaxTotal / smm0 - 1;

  // --- Regional distribution ---
  const raw: Record<string, number> = {};
  let rawSum = 0;
  for (const m of MUSCLE_REGIONS) {
    const f = MUSCLE_MASS_FRACTIONS[m] * (!male && UPPER_BODY.has(m) ? FEMALE_UPPER_BODY_FACTOR : 1);
    raw[m] = f;
    rawSum += f;
  }
  const headClass = (m: MuscleId): number => {
    const c = MUSCLE_HEADROOM_CLASS[m];
    const H = P.hypertrophy;
    return c === 'upper' ? H.regionHeadroomUpper : c === 'legs' ? H.regionHeadroomLegs : c === 'calves' ? H.regionHeadroomCalves : H.regionHeadroomCore;
  };
  let weighted = 0;
  for (const m of MUSCLE_REGIONS) weighted += ((raw[m] as number) / rawSum) * headClass(m);
  const typeIIvl = 1 - genetics.typeIVL / 100;

  const lift = profile.liftingYears ?? 0;
  const past = profile.pastLiftingYears ?? 0;
  const detrained = profile.detrainedYears ?? 0;
  const kH = P.hypertrophy.kHypPerDay * Math.sqrt(genetics.responderHyp);
  const peakFrac = trainedFraction(kH, past + lift, M.historyTrainingResponse);
  // Detraining decays the trained gain toward baseline with the atrophy time constant.
  const detrainKeep = Math.exp((-Math.max(0, detrained * 365 - P.hypertrophy.atrophyGraceDays)) / P.hypertrophy.atrophyTauDays);

  const muscles = {} as Record<MuscleId, MuscleState>;
  for (const m of MUSCLE_REGIONS) {
    const m0 = (smm0 * (raw[m] as number)) / rawSum;
    const mmax = m0 * (1 + (headroom * headClass(m)) / weighted);
    const peak = m0 + (mmax - m0) * peakFrac;
    const current = past > 0 ? m0 + (peak - m0) * detrainKeep : peak;
    muscles[m] = {
      mass: current,
      mmax,
      baseline: m0,
      highWater: peak,
      typeII: clamp(typeIIvl * MUSCLE_FIBER_FACTOR[m], M.typeIIMin, M.typeIIMax),
      momentArm: clamp(rng.normal(1, G.momentArmSd), M.momentArmMin, M.momentArmMax),
      damage: 0,
      tendon: 1,
      hypHist: emptyHist(),
      lastStimDay: lift > 0 ? 0 : -9999,
      sessionStim: 0,
      sessionFatigue: 0,
    };
  }

  // --- Neural pools / skills from training history ---
  const tauN = P.strength.neuralQualityTauDays;
  const neuralPeak = 1 - Math.exp((-(past + lift) * 365 * M.historyNeuralPerformance) / tauN);
  const neuralKeep = Math.exp((-Math.max(0, detrained * 365 - P.strength.neuralGraceDays)) / P.strength.neuralDecayTauDays);
  const liftPatterns = new Set<MovementPattern>(['squat', 'hinge', 'horizontalPress', 'verticalPress', 'horizontalPull', 'verticalPull', 'elbowFlexion', 'elbowExtension', 'kneeExtension', 'kneeFlexion', 'lunge', 'hipThrust']);
  const patterns = {} as Record<MovementPattern, PatternState>;
  for (const p of MOVEMENT_PATTERNS) {
    const trained = liftPatterns.has(p) ? neuralPeak : 0;
    const cur = past > 0 ? trained * neuralKeep : trained;
    patterns[p] = { neural: cur, fast: liftPatterns.has(p) && lift + past > M.historyRecentPastYears ? (past > 0 ? neuralKeep : 1) : 0, highWater: trained, strHist: emptyHist(), setHist: emptyHist(), lastStimDay: lift > 0 ? 0 : -9999 };
  }
  const skills: CharacterState['skills'] = {};
  const tr = P.training;
  for (const id of profile.knownExercises ?? []) {
    const years = past + lift;
    const sessions = years * M.sessionsPerYear;
    const skill = 1 - (1 - tr.skillStart) * Math.exp(-sessions / (tr.skillSessionsTau * 3));
    const decayed = tr.skillStart + (skill - tr.skillStart) * Math.exp((-detrained * 365) / tr.skillDecayTauDays);
    skills[id] = { skill: decayed, lastDay: detrained > 0 ? -Math.round(detrained * 365) : 0, sessions: Math.round(sessions), rbe: detrained > 0 ? 0 : M.knownSkillRbe };
  }

  // --- Aerobic ---
  const A = P.aerobic;
  const ageF = interp(C.aerobic.ageFactor, profile.ageYears) / interp(C.aerobic.ageFactor, 25);
  const refRel = (male ? A.vo2BaseMen20s : A.vo2BaseWomen20s) * clamp(rng.normal(1, M.vo2IndividualSd), M.vo2IndividualMin, M.vo2IndividualMax);
  const typicalBw = ffm0 / (male ? M.typicalLeanFractionMen : M.typicalLeanFractionWomen);
  const vo2Base = (refRel * typicalBw * ageF) / 1000; // L/min
  const ceiling = vo2Base * (1 + A.vo2TrainableFraction * genetics.responderAer ** M.aerResponderCeilingExponent);
  const endY = profile.enduranceYears ?? 0;
  const aerFrac = trainedFraction(A.kAerPerDay * genetics.responderAer ** M.aerResponderRateExponent, endY, M.aerHistoryResponse);
  const gain = (ceiling - vo2Base) * aerFrac;
  const aerobic: AerobicState = {
    vo2Pool: 0,
    vo2Fast: gain * A.detrainFastFraction,
    vo2Slow: gain * (1 - A.detrainFastFraction),
    vo2Baseline: vo2Base,
    vo2Ceiling: ceiling,
    lt1: A.lt1StartFraction + (A.lt1MaxFraction - A.lt1StartFraction) * aerFrac * M.aerHistoryThresholdShare,
    lt2: A.lt2StartFraction + (A.lt2MaxFraction - A.lt2StartFraction) * aerFrac * M.aerHistoryThresholdShare,
    economyRun: A.economyRunStart - (A.economyRunStart - A.economyRunBest) * aerFrac * M.aerHistoryEconomyShare,
    economyBike: M.economyBikeStart + M.economyHistoryGain * aerFrac,
    economyRow: M.economyRowStart + M.economyHistoryGain * aerFrac,
    hbMassFraction: 1 + M.hbTrainedGain * aerFrac,
    glycogen: glycogen0,
    aeroHist: emptyHist(),
    aeroMinutesHist: emptyHist(),
    runKmHist: emptyHist(),
    runHours: endY * M.runHoursPerEnduranceYear,
    lastAeroDay: endY > 0 ? 0 : -9999,
  };

  // --- Fat mass ---
  const bf = profile.bodyFat ?? clampedNormal(rng, male ? G.bodyFatMeanMen : G.bodyFatMeanWomen, male ? G.bodyFatSdMen : G.bodyFatSdWomen, M.bodyFatMin, M.bodyFatMax);
  const smmNow = MUSCLE_REGIONS.reduce((a, m) => a + muscles[m].mass, 0);
  const ffmNow = smmNow + nonMuscleLean + glycKg;
  const fatMass = (bf * ffmNow) / (1 - bf);

  const sprintY = profile.sprintYears ?? 0;
  const plyoY = profile.plyoYears ?? 0;
  const pw = P.power;
  const sp = 1 - Math.exp((-sprintY * 365) / (pw.vmaxTauDays * M.historyPowerTauMultiplier));
  const pl = 1 - Math.exp((-plyoY * 365) / (pw.sscTauDays * M.historyPowerTauMultiplier));

  const state: CharacterState = {
    seed: String(seed),
    day: 0,
    startDate: profile.startDate ?? '2026-01-05',
    sex,
    ageYears: profile.ageYears,
    anthro,
    genetics,
    muscles,
    patterns,
    skills,
    power: {
      v0Lower: Math.max(sp, pl) * M.historyPowerShare,
      v0Upper: 0,
      ssc: pl * M.historyPowerShare,
      rfd: Math.max(sp, pl) * M.historyRfdShare,
      vmaxPool: sp * M.historyPowerShare,
      rf: pw.rfStart + (pw.rfTrainableMax - pw.rfStart) * sp,
      f0hPool: sp * M.historyF0hShare,
      powHistLower: emptyHist(),
      powHistUpper: emptyHist(),
      plyoHist: emptyHist(),
      sprintHist: emptyHist(),
      sprintTechHist: emptyHist(),
      sprintF0hHist: emptyHist(),
      lastPowerDay: -9999,
      lastPlyoDay: -9999,
      lastSprintDay: -9999,
    },
    aerobic,
    body: {
      fatMass,
      nonMuscleLean,
      frameLean: nonMuscleLean,
      earlyWater: 0,
      creatineWater: 0,
      creatineSaturation: 0,
      sodiumWater: 0,
      bmd: clamp(rng.normal(1, M.bmdSd), M.bmdMinStart, M.bmdMaxStart) * (1 + M.bmdPerTrainingYear * Math.min(lift + past, M.bmdHistoryMaxYears)),
      adaptiveThermo: 0,
      neat: P.energy.neatBase * ((smmNow + fatMass + nonMuscleLean) / 75) ** P.energy.neatMassExponent,
      weightHist: emptyHist(),
      balanceEma: 0,
    },
    fatigue: {
      fitStr: 0, fatStr: 0, fitPow: 0, fatPow: 0, fitAer: 0, fatAer: 0,
      sleepDebtH: 0, stress: M.startStress, illnessDays: 0, overreachDays: 0, state: 'normal', stateDays: 0, readiness: 1,
      acuteLoadHist: emptyHist(), closeHist: emptyHist(), preventionHist: { nordic: emptyHist(), copenhagen: emptyHist() }, caffeineMgAtBed: 0,
    },
    nutrition: {
      ironStoreMg: male ? P.nutrition.ironStoreStartMen : P.nutrition.ironStoreStartWomen,
      vitDngml: P.nutrition.vitDStartNgMl,
      magnesiumStatus: M.startMagnesiumStatus,
      b12Status: 1,
      calciumStatus: M.startCalciumStatus,
      hydration: 0,
      lowEaDays: 0,
      hunger: M.startHunger,
      betaAlanineLoad: 0,
      caffeineHabit: 0,
      eaEma: M.startEa,
    },
    injuries: [],
    injuryHistory: [],
    nextInjuryId: 1,
    trainingHours: 0,
    flags: { creatine: false, accelerated: false },
    lastTdee: 0,
  };
  // Tendon capacity starts matched to muscle force capacity, adjusted by genetic stiffness; trained lifters have adapted tendons.
  for (const m of MUSCLE_REGIONS) {
    const st = state.muscles[m];
    st.tendon = (st.mass / st.baseline) * genetics.tendonStiffness;
  }
  return state;
}

/** Reference untrained man (75 kg, 175 cm, median genetics) used to anchor exercise refLoad values. */
export function referenceCharacter(ctx: SimContext): CharacterState {
  const st = buildReference(ctx);
  for (const m of MUSCLE_REGIONS) st.muscles[m].momentArm = 1;
  return st;
}

function buildReference(ctx: SimContext): CharacterState {
  const h = REF_HEIGHT_M;
  const bf = REF_BODY_FAT;
  // Solve FFMI so body mass is ~75 kg.
  const ffmi = (REF_BODY_MASS_KG * (1 - bf)) / (h * h);
  return createCharacter(
    ctx,
    {
      sex: 'male',
      ageYears: REF_AGE,
      heightCm: REF_HEIGHT_M * 100,
      ffmi,
      bodyFat: bf,
      anthro: { thigh: ctx.P.genetics.thighFraction, shank: ctx.P.genetics.shankFraction, upperArm: ctx.P.genetics.upperArmFraction, forearm: ctx.P.genetics.forearmFraction, torso: ctx.P.genetics.torsoFraction, wristCm: ctx.P.genetics.wristCircMeanMen },
      genetics: {
        responderHyp: 1, responderStr: 1, responderAer: 1, typeIVL: 50, ffmiCeiling: ctx.P.hypertrophy.ffmiCeilingMeanMen, bmrFactor: 1,
        neatResponsiveness: ctx.P.energy.neatResponsivenessMean, tendonStiffness: 1, injuryProneness: 1, creatineResponder: true, actn3xx: false, noviceSkill: ctx.P.training.skillStart, neuralFastGain: ctx.P.strength.neuralFastGainMedian,
      },
    },
    'reference',
  );
}

export function totalMuscle(s: CharacterState): number {
  let t = 0;
  for (const m of MUSCLE_REGIONS) t += s.muscles[m].mass;
  return t;
}
