// Field tests and local competitions (phase 5). Field tests carry wider measurement error than lab tests
// (engine/labTests.ts); competitions rank the player against a synthetic local field and pay entry fees and prizes.
// All noise streams are keyed by (seed, day, 'event|...') so results are deterministic. Nothing here mutates the state.
import type { SimContext } from './context';
import { exerciseOf } from './context';
import { bodyMass } from './body';
import { caffeineEffects, ergogenicPerf } from './nutrition';
import { broadJump, countermovementJump, formatTime, row2kTime, runTime, sprintProfile, sprintTime, vo2maxRel, YARDS_40, type PerfMods } from './performance';
import { streamRng, type Rng } from './rng';
import { NEUTRAL_ACUTE, estimateOneRm, oneRepMax, pctForReps, repsAt, repsMultiplier, roundLoad, type AcuteModifiers } from './strength';
import type { CharacterState, DayInputs } from './types';
import { ROW_2K_M, REF_BODY_MASS_KG } from './units';
import { clamp } from './math';

export type FieldTestId = 'oneRepMax' | 'cmj' | 'broadJump' | 'sprint10' | 'sprint30' | 'sprint40yd' | 'fieldVo2' | 'run5k' | 'row2k';

export interface FieldTestMeta {
  id: FieldTestId;
  name: string;
  unit: string;
  /** Dotted constant id (group.key) of the per-attempt measurement error SD for this test (units of the value, or a ratio). */
  noiseConstantId: string;
  note: string;
}

export const FIELD_TESTS: readonly FieldTestMeta[] = [
  { id: 'oneRepMax', name: 'One-rep max day', unit: 'kg', noiseConstantId: 'model.evtOneRmAttemptSd', note: 'Needs an exercise id. Test-day max at current readiness; ratio error from discrete attempt jumps.' },
  { id: 'cmj', name: 'Countermovement jump (mat)', unit: 'm', noiseConstantId: 'model.evtJumpMatSd', note: 'Jump-mat flight-time error.' },
  { id: 'broadJump', name: 'Standing broad jump', unit: 'm', noiseConstantId: 'model.evtBroadJumpTapeSd', note: 'Tape-measure error.' },
  { id: 'sprint10', name: '10 m sprint (timing gates)', unit: 's', noiseConstantId: 'model.evtSprintElectronicSd', note: 'Electronic timing.' },
  { id: 'sprint30', name: '30 m sprint (timing gates)', unit: 's', noiseConstantId: 'model.evtSprintElectronicSd', note: 'Electronic timing.' },
  { id: 'sprint40yd', name: '40 yard dash (hand timed)', unit: 's', noiseConstantId: 'model.evtSprintHandSd', note: 'Hand timing, wider error than electronic.' },
  { id: 'fieldVo2', name: 'Cooper 12-minute test (predicted VO2max)', unit: 'mL/kg/min', noiseConstantId: 'model.evtFieldVo2ErrorSd', note: 'VO2max predicted from the 12-minute distance; error is a ratio and wider than the lab test.' },
  { id: 'run5k', name: '5K time trial', unit: 's', noiseConstantId: 'model.evtRunClockSd', note: 'Field course and pacing error (ratio).' },
  { id: 'row2k', name: '2K row ergometer test', unit: 's', noiseConstantId: 'model.evtRowErgSd', note: 'Ergometer pacing repeatability (ratio).' },
];

export interface EventOpts {
  /** Overrides the state's current readiness (0..1). */
  readiness?: number;
  /** Caffeine in the system at the effort (mg). */
  caffeineMg?: number;
  supplements?: Partial<DayInputs['supplements']>;
  seed: string | number;
  day: number;
}
export interface FieldTestOpts extends EventOpts {
  exerciseId?: string;
  /** Reps for rep-based 1RM estimates (estimateOneRmFromReps). */
  reps?: number;
}

export interface FieldTestResult {
  value: number;
  unit: string;
  display: string;
  trueValue: number;
  /** Measurement-error SD in the unit of `value`. */
  noiseSd: number;
}

function konst(ctx: SimContext, id: string): number {
  const [group, key] = id.split('.') as [string, string];
  return ((ctx.P as unknown as Record<string, Record<string, number>>)[group] as Record<string, number>)[key] as number;
}

const NO_SUPP: DayInputs['supplements'] = { creatine: false, betaAlanine: false, nitrate: false, bicarb: false, vitDIU: 0, ironMg: 0, b12: false, magnesium: false };

interface DayMods {
  readiness: number;
  acute: AcuteModifiers;
  perf: PerfMods;
  /** Multiplier on aerobic capacity (caffeine endurance x readiness). */
  endurance: number;
  supp: DayInputs['supplements'];
}

function dayMods(ctx: SimContext, s: CharacterState, o: EventOpts): DayMods {
  const readiness = clamp(o.readiness ?? s.fatigue.readiness, 0, 1);
  const caf = caffeineEffects(ctx, s, o.caffeineMg ?? 0);
  const creatine = 1 + ctx.P.strength.creatineAcuteStrength * s.body.creatineSaturation;
  const acute: AcuteModifiers = { ...NEUTRAL_ACUTE, readiness, caffeine: caf.strength, creatine };
  const endurance = caf.endurance * (1 - ctx.P.model.evtEnduranceReadinessPenalty * (1 - readiness));
  return { readiness, acute, perf: { readiness, power: caf.power }, endurance, supp: { ...NO_SUPP, ...o.supplements } };
}

/** Endurance multiplier on VO2 expressed, including ergogenic aids for an effort of about `baseSeconds`. */
function endurancePerf(ctx: SimContext, s: CharacterState, m: DayMods, baseSeconds: number): number {
  return m.endurance * ergogenicPerf(ctx, s, m.supp, baseSeconds / 60, vo2maxRel(ctx, s));
}

/** Distance (m) covered in 12 minutes, by bisection on the race-time model. */
function distance12Min(ctx: SimContext, s: CharacterState, perf: number): number {
  const target = 12 * 60;
  let lo = 1000;
  let hi = 5 * 1000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (runTime(ctx, s, mid, perf) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function fmt(v: number, unit: string): string {
  return unit === 's' ? formatTime(v) : `${v.toFixed(2)} ${unit}`;
}

/** Cooper regression: VO2max (mL/kg/min) from the 12-minute distance (m). */
function cooperVo2(ctx: SimContext, distanceM: number): number {
  return (distanceM - ctx.P.model.evtCooperInterceptM) / ctx.P.model.evtCooperSlopeM;
}

export function runFieldTest(ctx: SimContext, state: CharacterState, testId: FieldTestId, opts: FieldTestOpts): FieldTestResult {
  const meta = FIELD_TESTS.find((t) => t.id === testId);
  if (!meta) throw new Error(`unknown field test ${testId}`);
  const rng = streamRng(opts.seed, opts.day, `event|test|${testId}`);
  const m = dayMods(ctx, state, opts);
  const sd = konst(ctx, meta.noiseConstantId);
  let truth: number;
  let noiseSd: number;
  let value: number;

  switch (testId) {
    case 'oneRepMax': {
      if (!opts.exerciseId) throw new Error('oneRepMax test needs exerciseId');
      const e = exerciseOf(ctx, opts.exerciseId);
      truth = oneRepMax(ctx, state, e.id, m.acute);
      noiseSd = truth * sd;
      value = roundLoad(ctx, truth + rng.normal(0, noiseSd), e);
      break;
    }
    case 'cmj':
      truth = countermovementJump(ctx, state, m.perf);
      noiseSd = sd;
      value = Math.max(0, truth + rng.normal(0, noiseSd));
      break;
    case 'broadJump':
      truth = broadJump(ctx, state, m.perf);
      noiseSd = sd;
      value = Math.max(0, truth + rng.normal(0, noiseSd));
      break;
    case 'sprint10':
    case 'sprint30':
    case 'sprint40yd': {
      const d = testId === 'sprint10' ? 10 : testId === 'sprint30' ? 30 : YARDS_40;
      truth = sprintTime(sprintProfile(ctx, state, m.perf), d);
      noiseSd = sd;
      value = Math.max(0, truth + rng.normal(0, noiseSd));
      break;
    }
    case 'fieldVo2': {
      const perf = endurancePerf(ctx, state, m, 12 * 60);
      truth = vo2maxRel(ctx, state, perf);
      const predicted = cooperVo2(ctx, distance12Min(ctx, state, perf));
      noiseSd = predicted * sd;
      value = Math.max(0, predicted + rng.normal(0, noiseSd));
      break;
    }
    case 'run5k': {
      const dist = 5 * 1000;
      const perf = endurancePerf(ctx, state, m, runTime(ctx, state, dist));
      truth = runTime(ctx, state, dist, perf);
      noiseSd = truth * sd;
      value = truth + rng.normal(0, noiseSd);
      break;
    }
    case 'row2k': {
      const perf = endurancePerf(ctx, state, m, row2kTime(ctx, state));
      truth = row2kTime(ctx, state, perf);
      noiseSd = truth * sd;
      value = truth + rng.normal(0, noiseSd);
      break;
    }
  }
  return { value, unit: meta.unit, display: fmt(value, meta.unit), trueValue: truth, noiseSd };
}

/**
 * 1RM estimated from a set of `reps` reps at the load the athlete can just manage for that many reps (Epley).
 * Relative error grows with reps: evtEstRmBaseSd + evtEstRmPerRepSd x (reps - 1).
 */
export function estimateOneRmFromReps(ctx: SimContext, state: CharacterState, exerciseId: string, reps: number, opts: EventOpts): FieldTestResult {
  const rng = streamRng(opts.seed, opts.day, `event|test|estRm|${exerciseId}|${reps}`);
  const m = dayMods(ctx, state, opts);
  const e = exerciseOf(ctx, exerciseId);
  const truth = oneRepMax(ctx, state, exerciseId, m.acute);
  const mult = repsMultiplier(ctx, state, e, state.body.creatineSaturation);
  const load = roundLoad(ctx, truth * pctForReps(ctx, reps, mult), e);
  const achieved = Math.max(1, Math.floor(repsAt(ctx, load / truth, mult)));
  const rel = ctx.P.model.evtEstRmBaseSd + ctx.P.model.evtEstRmPerRepSd * (Math.max(1, achieved) - 1);
  const est = estimateOneRm(load, achieved);
  const noiseSd = est * rel;
  const value = Math.max(0, est + rng.normal(0, noiseSd));
  return { value, unit: 'kg', display: fmt(value, 'kg'), trueValue: truth, noiseSd };
}

// ---------------- Competitions ----------------

export type CompetitionId = 'powerlifting' | 'weightlifting' | 'strongman' | 'sprintMeet' | 'jumpContest' | 'run5k' | 'run10k' | 'row2k' | 'ruck';
type Kind = 'strength' | 'jump' | 'speed';

export interface CompetitionMeta {
  id: CompetitionId;
  name: string;
  /** Dotted ids (group.key) of constants. */
  entryFeeConstantId: string;
  medianConstantId: string;
  sigmaConstantId: string;
  fatigueConstantId: string;
  kind: Kind;
  /** True when a larger total wins (kg, reps, m); false for times. */
  higherBetter: boolean;
  unit: string;
  lifts?: readonly string[];
  note: string;
}

export const COMPETITIONS: readonly CompetitionMeta[] = [
  { id: 'powerlifting', name: 'Powerlifting meet', entryFeeConstantId: 'economy.entryFeePowerlifting', medianConstantId: 'model.evtMedianPowerlifting', sigmaConstantId: 'model.evtSigmaPowerlifting', fatigueConstantId: 'model.evtFatiguePowerlifting', kind: 'strength', higherBetter: true, unit: 'kg', lifts: ['back_squat_low_bar', 'bench_press', 'conventional_deadlift'], note: 'Three attempts each. Openers are a fraction of the estimated 1RM; an attempt above the day\'s true 1RM is missed. Total = best made lifts, 0 if any lift has no make (bomb out).' },
  { id: 'weightlifting', name: 'Weightlifting meet', entryFeeConstantId: 'economy.entryFeeWeightlifting', medianConstantId: 'model.evtMedianWeightlifting', sigmaConstantId: 'model.evtSigmaWeightlifting', fatigueConstantId: 'model.evtFatigueWeightlifting', kind: 'strength', higherBetter: true, unit: 'kg', lifts: ['power_snatch', 'clean_and_jerk'], note: 'HEUR: there is no full (squat) snatch in the exercise library, so the power snatch and the clean and jerk stand in. Same attempt logic as powerlifting.' },
  { id: 'strongman', name: 'Strongman show', entryFeeConstantId: 'economy.entryFeeStrongman', medianConstantId: 'model.evtMedianStrongman', sigmaConstantId: 'model.evtSigmaStrongman', fatigueConstantId: 'model.evtFatigueStrongman', kind: 'strength', higherBetter: true, unit: 'reps', lifts: ['atlas_stone', 'farmers_walk', 'log_press'], note: 'HEUR: each event uses a fixed implement (evtStrongmanImplementRatio x the exercise refLoad); the score is the reps (carries: lengths) the athlete manages from the rep-strength curve. Total = sum over the three events (a time-based proxy).' },
  { id: 'sprintMeet', name: 'Sprint meet (100 m)', entryFeeConstantId: 'economy.entryFeeSprintMeet', medianConstantId: 'model.evtMedianSprintMeet', sigmaConstantId: 'model.evtSigmaSprintMeet', fatigueConstantId: 'model.evtFatigueSprintMeet', kind: 'speed', higherBetter: false, unit: 's', note: '100 m from the mono-exponential sprint model.' },
  { id: 'jumpContest', name: 'Jump contest', entryFeeConstantId: 'economy.entryFeeSprintMeet', medianConstantId: 'model.evtMedianJumpContest', sigmaConstantId: 'model.evtSigmaJumpContest', fatigueConstantId: 'model.evtFatigueJumpContest', kind: 'jump', higherBetter: true, unit: 'm', note: 'Best of three countermovement jumps (no economy key exists for a jump contest, so it uses the sprint-meet entry fee).' },
  { id: 'run5k', name: '5K road race', entryFeeConstantId: 'economy.entryFee5k', medianConstantId: 'model.evtMedianRun5k', sigmaConstantId: 'model.evtSigmaRun5k', fatigueConstantId: 'model.evtFatigueRun5k', kind: 'speed', higherBetter: false, unit: 's', note: 'runTime model.' },
  { id: 'run10k', name: '10K road race', entryFeeConstantId: 'economy.entryFee10k', medianConstantId: 'model.evtMedianRun10k', sigmaConstantId: 'model.evtSigmaRun10k', fatigueConstantId: 'model.evtFatigueRun10k', kind: 'speed', higherBetter: false, unit: 's', note: 'runTime model.' },
  { id: 'row2k', name: '2K rowing event', entryFeeConstantId: 'economy.entryFeeRow2k', medianConstantId: 'model.evtMedianRow2k', sigmaConstantId: 'model.evtSigmaRow2k', fatigueConstantId: 'model.evtFatigueRow2k', kind: 'speed', higherBetter: false, unit: 's', note: 'row2kTime model.' },
  { id: 'ruck', name: 'Rucking event (12 mi, 35 lb)', entryFeeConstantId: 'economy.entryFeeRuck', medianConstantId: 'model.evtMedianRuck', sigmaConstantId: 'model.evtSigmaRuck', fatigueConstantId: 'model.evtFatigueRuck', kind: 'speed', higherBetter: false, unit: 's', note: 'HEUR: runTime over the distance x evtRuckPaceFactor x (1 + evtRuckLoadPenalty x pack/body mass).' },
];

export interface CompetitionOpts extends EventOpts {
  /** Opener as a fraction of the estimated 1RM (default model.evtOpenerPct). Above 1 the opener is a miss. */
  openersPct?: number;
}

export interface EventResult {
  event: string;
  /** Best made lift (kg), reps, time (s) or jump (m). */
  value: number;
  unit: string;
  attempts?: Array<{ loadKg: number; made: boolean }>;
}

export interface CompetitionResult {
  compId: CompetitionId;
  results: EventResult[];
  /** Ranking score: total kg / reps / metres, or time in seconds. */
  total: number;
  unit: string;
  placement: number;
  fieldSize: number;
  prize: number;
  entryFee: number;
  /** Systemic fatigue the caller may add after the event (session equivalents). Not applied to the state. */
  fatigueLoad: number;
}

export function competitionMeta(id: CompetitionId): CompetitionMeta {
  const c = COMPETITIONS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown competition ${id}`);
  return c;
}

/** Three attempts at one lift. Attempt 1 = opener; after a make jump up, after a miss repeat. */
function liftAttempts(ctx: SimContext, e: ReturnType<typeof exerciseOf>, estimate: number, dayMax: number, openerPct: number): { best: number; attempts: Array<{ loadKg: number; made: boolean }> } {
  const M = ctx.P.model;
  const attempts: Array<{ loadKg: number; made: boolean }> = [];
  let pct = openerPct;
  let best = 0;
  const jumps = [M.evtSecondJumpPct, M.evtThirdJumpPct];
  for (let i = 0; i < 3; i++) {
    const load = roundLoad(ctx, estimate * pct, e);
    const made = load <= dayMax;
    attempts.push({ loadKg: load, made });
    if (made) {
      best = Math.max(best, load);
      pct += jumps[i] ?? 0;
    }
  }
  return { best, attempts };
}

function liftTotal(ctx: SimContext, s: CharacterState, lifts: readonly string[], m: DayMods, rng: Rng, openerPct: number): EventResult[] {
  const M = ctx.P.model;
  return lifts.map((id) => {
    const e = exerciseOf(ctx, id);
    const rested = oneRepMax(ctx, s, id, { ...NEUTRAL_ACUTE, creatine: m.acute.creatine });
    const estimate = rested * Math.max(0, 1 + rng.normal(0, M.evtOpenerEstimateSd));
    const dayMax = oneRepMax(ctx, s, id, m.acute) * Math.max(0, 1 + rng.normal(0, M.evtDayToDaySd));
    const { best, attempts } = liftAttempts(ctx, e, estimate, dayMax, openerPct);
    return { event: e.name, value: best, unit: 'kg', attempts };
  });
}

function strongmanScores(ctx: SimContext, s: CharacterState, lifts: readonly string[], m: DayMods, rng: Rng): EventResult[] {
  const M = ctx.P.model;
  return lifts.map((id) => {
    const e = exerciseOf(ctx, id);
    const dayMax = oneRepMax(ctx, s, id, m.acute) * Math.max(0, 1 + rng.normal(0, M.evtDayToDaySd));
    const implement = M.evtStrongmanImplementRatio * (e.refLoad ?? 0);
    const reps = dayMax > 0 ? repsAt(ctx, implement / dayMax, repsMultiplier(ctx, s, e, s.body.creatineSaturation)) : 0;
    return { event: e.name, value: reps, unit: 'reps' };
  });
}

function sexFactor(ctx: SimContext, s: CharacterState, kind: Kind): number {
  if (s.sex !== 'female') return 1;
  const M = ctx.P.model;
  return kind === 'strength' ? M.evtFemaleStrengthFactor : kind === 'jump' ? M.evtFemaleJumpFactor : M.evtFemaleSpeedFactor;
}

/** Local-field median for this athlete's sex and (for strength) body mass, in the unit of the competition. */
export function fieldMedian(ctx: SimContext, s: CharacterState, meta: CompetitionMeta): number {
  const base = konst(ctx, meta.medianConstantId);
  const f = sexFactor(ctx, s, meta.kind);
  if (meta.kind === 'strength') return base * f * (bodyMass(s, ctx.P) / REF_BODY_MASS_KG) ** ctx.P.strength.massToForceExponent;
  return meta.higherBetter ? base * f : base / f;
}

export function simulateCompetition(ctx: SimContext, state: CharacterState, compId: CompetitionId, opts: CompetitionOpts): CompetitionResult {
  const meta = competitionMeta(compId);
  const M = ctx.P.model;
  const rng = streamRng(opts.seed, opts.day, `event|comp|${compId}`);
  const m = dayMods(ctx, state, opts);
  const dayNoise = Math.max(0, 1 + rng.normal(0, M.evtDayToDaySd));
  let results: EventResult[];
  let total: number;

  switch (compId) {
    case 'powerlifting':
    case 'weightlifting': {
      results = liftTotal(ctx, state, meta.lifts as readonly string[], m, rng, opts.openersPct ?? M.evtOpenerPct);
      total = results.every((r) => r.value > 0) ? results.reduce((a, r) => a + r.value, 0) : 0;
      break;
    }
    case 'strongman': {
      results = strongmanScores(ctx, state, meta.lifts as readonly string[], m, rng);
      total = results.reduce((a, r) => a + r.value, 0);
      break;
    }
    case 'sprintMeet': {
      const t = sprintTime(sprintProfile(ctx, state, m.perf), 100) / dayNoise;
      results = [{ event: '100 m', value: t, unit: 's' }];
      total = t;
      break;
    }
    case 'jumpContest': {
      const jumps = [0, 1, 2].map((i) => {
        const h = countermovementJump(ctx, state, m.perf) * Math.max(0, 1 + rng.normal(0, M.evtDayToDaySd));
        return { event: `CMJ ${i + 1}`, value: Math.max(0, h + rng.normal(0, M.evtJumpMatSd)), unit: 'm' };
      });
      results = jumps;
      total = Math.max(...jumps.map((j) => j.value));
      break;
    }
    case 'run5k':
    case 'run10k': {
      const dist = (compId === 'run5k' ? 5 : 10) * 1000;
      const perf = endurancePerf(ctx, state, m, runTime(ctx, state, dist));
      const t = runTime(ctx, state, dist, perf) / dayNoise;
      results = [{ event: compId === 'run5k' ? '5K' : '10K', value: t, unit: 's' }];
      total = t;
      break;
    }
    case 'row2k': {
      const perf = endurancePerf(ctx, state, m, row2kTime(ctx, state));
      const t = row2kTime(ctx, state, perf) / dayNoise;
      results = [{ event: `${ROW_2K_M} m row`, value: t, unit: 's' }];
      total = t;
      break;
    }
    case 'ruck': {
      const dist = M.evtRuckMiles * M.evtMileM;
      const perf = endurancePerf(ctx, state, m, runTime(ctx, state, dist));
      const load = 1 + M.evtRuckLoadPenalty * (M.evtRuckLoadKg / bodyMass(state, ctx.P));
      const t = (runTime(ctx, state, dist, perf) * M.evtRuckPaceFactor * load) / dayNoise;
      results = [{ event: 'Ruck', value: t, unit: 's' }];
      total = t;
      break;
    }
  }

  // Synthetic local field: lognormal results around the sex- and mass-scaled median. The player is one of `fieldSize`.
  const fieldSize = Math.round(M.evtFieldSize);
  const median = fieldMedian(ctx, state, meta);
  const sigma = konst(ctx, meta.sigmaConstantId);
  const frng = streamRng(opts.seed, opts.day, `event|field|${compId}`);
  let better = 0;
  for (let i = 0; i < fieldSize - 1; i++) {
    const r = frng.lognormal(median, sigma);
    if (meta.higherBetter ? r > total : r < total) better++;
  }
  const placement = better + 1;
  const win = ctx.P.economy.prizeLocalWin;
  const prize = placement === 1 ? win : placement === 2 ? win * M.evtPrizeSecondFrac : placement === 3 ? win * M.evtPrizeThirdFrac : 0;
  return {
    compId, results, total, unit: meta.unit, placement, fieldSize, prize,
    entryFee: konst(ctx, meta.entryFeeConstantId),
    fatigueLoad: konst(ctx, meta.fatigueConstantId),
  };
}
