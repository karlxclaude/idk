// Engine state and input types. Pure data; no behaviour.
import type { MuscleId, MovementPattern } from '../data/muscles';
import type { CardioModality } from '../data/exercises/schema';

export type Sex = 'male' | 'female';
export type Zone = 1 | 2 | 3;

export const HISTORY_DAYS = 28;

export interface MuscleState {
  mass: number; // kg
  mmax: number; // kg genetic ceiling
  baseline: number; // untrained set point (atrophy target)
  highWater: number; // kg, for muscle memory
  typeII: number; // fraction fast-twitch (0-1)
  momentArm: number; // relative insertion leverage (1 = average)
  damage: number; // local damage 0..~2 (decays over 24-96 h)
  tendon: number; // tendon capacity relative to force index at creation (1 = matched)
  /** Daily hypertrophy stimulus (effective sets), ring buffer indexed by day % HISTORY_DAYS. */
  hypHist: number[];
  lastStimDay: number;
  sessionStim: number; // scratch: stimulus accumulated in the current session
  sessionFatigue: number; // scratch: within-session local fatigue
}

export interface ExerciseSkill {
  skill: number; // 0..1
  lastDay: number; // last day performed
  sessions: number; // lifetime sessions
  rbe: number; // repeated-bout protection 0..1
}

export interface PatternState {
  neural: number; // slow neuromuscular quality pool 0..1
  fast: number; // fast early-neural pool 0..1 (voluntary activation, coordination; weeks)
  highWater: number; // max neural pool reached (strength memory)
  strHist: number[]; // daily strength stimulus (load/RIR weighted sets) ring buffer
  setHist: number[]; // daily hard sets ring buffer (for load quality)
  lastStimDay: number;
}

export interface Genetics {
  responderHyp: number;
  responderStr: number;
  responderAer: number;
  typeIVL: number; // vastus lateralis type I %
  ffmiCeiling: number; // normalised FFMI ceiling
  bmrFactor: number;
  neatResponsiveness: number;
  fitnessTau: number;
  fatigueTau: number;
  tendonStiffness: number;
  injuryProneness: number;
  caffeineHalfLifeH: number;
  creatineResponder: boolean;
  actn3xx: boolean;
  /** Max fractional 1RM gain from early neural adaptation (individual; lognormal, correlated with responderStr). */
  neuralFastGain: number;
  /** Starting technique on unfamiliar lifts (0-1); individual motor-learning baseline. */
  noviceSkill: number;
  sweatRate: number; // L/h base
  sweatSodium: number; // mmol/L
  androidFat: number; // fraction of fat stored centrally (visual)
  /** Hidden-trait reveal flags. */
  revealed: { fiberType: boolean; responders: boolean; ceiling: boolean; metabolism: boolean };
}

export interface Anthropometry {
  heightCm: number;
  thigh: number; // fraction of height
  shank: number;
  upperArm: number;
  forearm: number;
  torso: number;
  wristCm: number;
}

export interface PowerState {
  v0Lower: number; // trainable V0 pool 0..1
  v0Upper: number;
  ssc: number; // stretch-shortening quality 0..1
  rfd: number; // rate of force development pool 0..1
  vmaxPool: number; // sprint max-velocity pool 0..1
  rf: number; // sprint technique (ratio of forces) 0..1
  f0hPool: number; // sprint horizontal-force pool 0..1
  powHistLower: number[];
  powHistUpper: number[];
  plyoHist: number[];
  sprintHist: number[];
  sprintTechHist: number[];
  sprintF0hHist: number[];
  lastPowerDay: number;
  lastPlyoDay: number;
  lastSprintDay: number;
}

export interface AerobicState {
  vo2Pool: number; // trained gain above baseline, in mL/kg/min units of the ceiling gap, split into two pools:
  vo2Fast: number; // central component (mL/kg/min above untrained baseline)
  vo2Slow: number; // peripheral component
  vo2Baseline: number; // untrained baseline at current age (mL/kg/min)
  vo2Ceiling: number; // genetic ceiling (mL/kg/min)
  lt1: number; // fraction of VO2max
  lt2: number;
  economyRun: number; // mL/kg/km
  economyBike: number; // relative 0..1 (1 = best)
  economyRow: number;
  hbMassFraction: number; // 1 = normal for sex
  glycogen: number; // g whole body
  aeroHist: number[]; // weighted minutes per day
  aeroMinutesHist: number[]; // raw minutes per day (interference)
  runKmHist: number[];
  runHours: number; // lifetime running hours (novice injury factor)
  lastAeroDay: number;
}

export interface BodyState {
  fatMass: number; // kg
  nonMuscleLean: number; // kg (bone, organs, residual)
  frameLean: number; // kg, fixed component of nonMuscleLean
  earlyWater: number; // kg water/glycogen pool from novel training
  creatineWater: number; // kg
  creatineSaturation: number; // 0..1
  sodiumWater: number; // kg
  bmd: number; // relative bone mineral density (1 = young adult mean)
  adaptiveThermo: number; // 0..1 fraction of max
  neat: number; // kcal/day current NEAT
  balanceEma: number; // exponentially weighted energy balance (kcal/day, ~1 week)
  weightHist: number[]; // true weight ring buffer (for loss-rate)
}

export interface FatigueState {
  fitStr: number; fatStr: number;
  fitPow: number; fatPow: number;
  fitAer: number; fatAer: number;
  sleepDebtH: number;
  stress: number; // 0..1
  illnessDays: number; // remaining illness days
  overreachDays: number; // consecutive days above threshold
  state: 'normal' | 'FOR' | 'NFOR' | 'OTS';
  stateDays: number; // days in current state
  readiness: number; // computed each day 0..1
  acuteLoadHist: number[]; // daily load for ACWR
  closeHist: number[]; // cardio minutes performed within the interference gap of a lifting session
  preventionHist: Record<string, number[]>; // daily prevention-exercise sets by tag
  caffeineMgAtBed: number;
}

export interface NutritionState {
  ironStoreMg: number;
  vitDngml: number;
  magnesiumStatus: number; // 0..1 (1 replete)
  b12Status: number; // 0..1
  calciumStatus: number; // 0..1
  hydration: number; // fraction of body mass deficit (0 = euhydrated, 0.03 = -3%)
  lowEaDays: number; // consecutive days below EA threshold
  hunger: number; // 0..1
  betaAlanineLoad: number; // 0..1
  caffeineHabit: number; // 0..1 fraction of recent days with caffeine
  eaEma: number; // energy availability EMA (kcal/kg FFM/day)
}

export type InjuryType = 'strain' | 'tendinopathy' | 'jointIrritation' | 'lowBack' | 'stressFracture';
export interface Injury {
  id: number;
  type: InjuryType;
  tissue: string; // e.g. 'hamstrings', 'patellarTendon', 'lowBack', 'tibia'
  muscles: MuscleId[]; // regions that cannot be loaded hard
  startDay: number;
  durationDays: number;
  severity: number; // 0..1
}

export interface CharacterState {
  seed: string;
  day: number; // simulation day index (0-based)
  startDate: string; // ISO date of day 0
  sex: Sex;
  ageYears: number; // fractional, advances daily
  anthro: Anthropometry;
  genetics: Genetics;
  muscles: Record<MuscleId, MuscleState>;
  patterns: Record<MovementPattern, PatternState>;
  skills: Record<string, ExerciseSkill>;
  power: PowerState;
  aerobic: AerobicState;
  body: BodyState;
  fatigue: FatigueState;
  nutrition: NutritionState;
  injuries: Injury[];
  injuryHistory: Injury[];
  nextInjuryId: number;
  trainingHours: number; // lifetime
  flags: { creatine: boolean; accelerated: boolean };
  lastTdee: number;
}

// ---------- Inputs ----------

export interface LiftPrescription {
  exerciseId: string;
  sets: number;
  /** Target reps per set (used with targetRir to autoregulate load) or with pct1rm to fix load. */
  reps?: number;
  /** Fixed relative load (0-100). If given, reps are what the lifter achieves minus RIR. */
  pct1rm?: number;
  /** Absolute load in kg (overrides pct). */
  loadKg?: number;
  targetRir: number;
  restS: number;
  tempoS?: number; // seconds per rep
  intent?: 'max' | 'controlled' | 'slow';
  /** Sprint/plyo: number of contacts or sprints; distance for sprints. */
  distanceM?: number;
}

export interface LiftSession {
  kind: 'lift';
  startHour: number;
  exercises: LiftPrescription[];
}
export interface CardioSession {
  kind: 'cardio';
  startHour: number;
  exerciseId: string;
  minutes: number;
  zone: Zone;
}
export interface PlyoSession {
  kind: 'plyo';
  startHour: number;
  exercises: LiftPrescription[]; // sets x reps of jump exercises
}
export interface SprintSession {
  kind: 'sprint';
  startHour: number;
  exercises: LiftPrescription[]; // sets (sprints) x distanceM
}
export type Session = LiftSession | CardioSession | PlyoSession | SprintSession;

export interface Intake {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  alcoholDrinks: number;
  sodiumG: number;
  waterL: number;
  ironHemeMg: number;
  ironNonHemeMg: number;
  vitDIU: number;
  magnesiumMg: number;
  b12Ug: number;
  calciumMg: number;
  /** Mean DIAAS-weighted protein quality (1 = complete). */
  proteinQuality: number;
  /** Number of feedings with >= proteinPerMealTarget. */
  proteinMeals: number;
  leucineG: number;
  /** Mean satiety index of the day's food (100 = white bread). */
  satiety: number;
}

export interface DayInputs {
  sessions: Session[];
  sleepH: number;
  intake: Intake;
  /** Caffeine doses in mg with hour of day. */
  caffeine: Array<{ mg: number; hour: number }>;
  bedHour: number;
  jobHours: number;
  jobMet: number;
  /** Occupational injury/fatigue exposure 0..1. */
  jobStrain: number;
  /** Tissues loaded by the job (occupational injury hazard). Defaults to low back. */
  jobTissues?: string[];
  stressEvents: number; // 0..1 added stress
  socialHours: number;
  sunMinutes: number;
  ambientTempC: number;
  supplements: { creatine: boolean; creatineLoading?: boolean; betaAlanine: boolean; nitrate: boolean; bicarb: boolean; vitDIU: number; ironMg: number; b12: boolean; magnesium: boolean };
  /** Benchmarks/tests may disable stochastic injury and illness. */
  disableRandomEvents?: boolean;
  /** Rehab performed today for active injuries. */
  rehab?: boolean;
}

// ---------- Outputs ----------

export interface SetLog {
  exerciseId: string;
  loadKg: number;
  reps: number;
  rir: number;
  pct1rm: number;
  velocityLoss: number;
  failed: boolean;
}

export interface FactorBreakdown {
  /** Name -> multiplier (1 = neutral). */
  [name: string]: number;
}

export interface DayReport {
  day: number;
  date: string;
  tdee: { bmr: number; tef: number; exercise: number; epoc: number; neat: number; job: number; adaptive: number; total: number };
  intakeKcal: number;
  balance: number;
  energyAvailability: number;
  readiness: number;
  readinessFactors: FactorBreakdown;
  sets: SetLog[];
  cardioMinutes: number;
  trainingMinutes: number;
  /** Hypertrophy modifiers applied today. */
  hypMods: FactorBreakdown;
  /** Per-muscle: weekly effective sets and R(V). */
  muscleStim: Partial<Record<MuscleId, { weeklySets: number; response: number; deltaKg: number }>>;
  deltaMuscleKg: number;
  deltaFatKg: number;
  deltaLeanOtherKg: number;
  interference: { power: number; hypertrophy: number; strength: number };
  events: string[];
  injuries: string[];
}

export interface Snapshot {
  day: number;
  weight: number;
  fatMass: number;
  muscleMass: number;
  leanMass: number;
  vo2max: number;
  readiness: number;
  fatigueStr: number;
  fitnessStr: number;
  lifts: Record<string, number>; // true 1RM for tracked lifts
  cmj: number;
  sprint40yd: number;
  ironStoreMg: number;
  vitD: number;
  balance: number;
}

export interface CardioPerf {
  modality: CardioModality;
  vo2Expressed: number;
}
