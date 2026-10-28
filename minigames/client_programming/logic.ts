// Client programming mini-game core: the player builds an 8-week plan for a seeded client; the real engine
// runs it for 56 days and the goal metric is scored against the best of a few preset plans.
// Pure and deterministic: no DOM, no React, no Math.random.
import { FULL_BODY_A, FULL_BODY_B, weekOf } from '../../data/programs';
import { makeContext, type SimContext } from '../../engine/context';
import { createCharacter } from '../../engine/character';
import { bodyMass, fatFreeMass } from '../../engine/body';
import { runTime } from '../../engine/performance';
import type { WeeklyPlan } from '../../engine/plan';
import { makeRng, type Rng } from '../../engine/rng';
import { runDays } from '../../engine/runner';
import { testOneRepMax } from '../../engine/strength';
import type { CharacterState, LiftPrescription, Session } from '../../engine/types';
import { goodPlan } from './planBase';

export type Goal = 'strength' | 'muscle' | 'fat_loss' | '5k';
export const GOALS: readonly Goal[] = ['strength', 'muscle', 'fat_loss', '5k'];
export type TemplateId = 'full_body' | 'strength_focus' | 'custom_volume';
export type SetsLevel = 'low' | 'medium' | 'high';
export type Intensity = { mode: 'rir'; rir: number } | { mode: 'pct'; pct: number };

export interface PlanChoice {
  days: 2 | 3 | 4 | 5;
  template: TemplateId;
  /** Only used by custom_volume. */
  sets: SetsLevel;
  intensity: Intensity;
  /** Easy 30 min runs per week (0-3). */
  cardio: 0 | 1 | 2 | 3;
  /** Daily energy balance target in kcal (-700..+500). */
  balanceKcal: number;
}

export const PLAN_DAYS = 56;
export const BALANCE_RANGE: readonly [number, number] = [-700, 500];
const LIFT_IDS = ['back_squat_high_bar', 'bench_press', 'conventional_deadlift', 'overhead_press'] as const;
const LIFT_DAYS: Record<number, number[]> = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5] };
const CARDIO_DAYS: Record<number, number[]> = { 0: [], 1: [6], 2: [2, 6], 3: [1, 3, 6] };
const SETS_PER_EXERCISE: Record<SetsLevel, number> = { low: 2, medium: 3, high: 5 };
const DEFAULT_DECISION_SEC = 45;
const MIN_DECISION_SEC = 15;

/** Hidden truth about the client plus the (possibly noisy) intake form the player sees. */
export interface ClientInfo {
  goal: Goal;
  sex: 'male' | 'female';
  ageYears: number;
  bodyFat: number;
  liftingYears: number;
}
export interface IntakeForm {
  goal: Goal;
  sex: 'male' | 'female';
  ageYears: number;
  /** null = left blank on the form. */
  bodyFat: number | null;
  liftingYears: number | null;
}

export interface GameState {
  seed: string;
  difficulty: number;
  decisionSec: number;
  timeLeft: number;
  client: ClientInfo;
  form: IntakeForm;
  choice: PlanChoice;
  locked: boolean;
  /** Cached results, filled by evaluate(). */
  outcome: number | null;
  best: number | null;
}

export const DEFAULT_CHOICE: PlanChoice = { days: 3, template: 'full_body', sets: 'medium', intensity: { mode: 'rir', rir: 2 }, cardio: 0, balanceKcal: 0 };

let sharedCtx: SimContext | null = null;
function ctx(): SimContext {
  sharedCtx ??= makeContext();
  return sharedCtx;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function makeClient(rng: Rng): ClientInfo {
  const goal = rng.pick(GOALS);
  const sex = rng.chance(0.5) ? 'male' : 'female';
  const ageYears = rng.int(20, 45);
  const fatBase = goal === 'fat_loss' ? 0.3 : 0.18;
  const bodyFat = clamp(fatBase + rng.normal(0, 0.03) + (sex === 'female' ? 0.07 : 0), 0.1, 0.42);
  const liftingYears = goal === '5k' ? 0 : rng.pick([0, 0, 1, 2, 4]);
  return { goal, sex, ageYears, bodyFat, liftingYears };
}

export function buildCharacter(c: ClientInfo, seed: string): CharacterState {
  return createCharacter(ctx(), {
    sex: c.sex, ageYears: c.ageYears, bodyFat: c.bodyFat, liftingYears: c.liftingYears,
    enduranceYears: 0, genetics: { responderHyp: 1, responderStr: 1, responderAer: 1, injuryProneness: 1 },
  }, `client-${seed}`);
}

/** Lower difficulty: noisier or missing body fat / training age and fewer decision seconds. */
export function makeForm(c: ClientInfo, rng: Rng, difficulty: number): IntakeForm {
  const d = clamp(difficulty, 0, 1);
  const noise = 1 - d;
  const missP = 0.7 * noise;
  const bf = rng.chance(missP) ? null : clamp(c.bodyFat + rng.normal(0, 0.06 * noise), 0.05, 0.5);
  const ty = rng.chance(missP) ? null : Math.max(0, Math.round(c.liftingYears + rng.normal(0, 2 * noise)));
  return { goal: c.goal, sex: c.sex, ageYears: c.ageYears, bodyFat: bf, liftingYears: ty };
}

export function createGame(seed: string, difficulty: number, durationSec: number = DEFAULT_DECISION_SEC): GameState {
  const d = clamp(difficulty, 0, 1);
  const rng = makeRng(`clientprog-${seed}`);
  const client = makeClient(rng);
  const form = makeForm(client, makeRng(`clientprog-form-${seed}-${d}`), d);
  const decisionSec = Math.max(MIN_DECISION_SEC, durationSec * (0.5 + 0.5 * d));
  return {
    seed, difficulty: d, decisionSec, timeLeft: decisionSec, client, form,
    choice: { ...DEFAULT_CHOICE, intensity: { ...DEFAULT_CHOICE.intensity } }, locked: false, outcome: null, best: null,
  };
}

/** Player edits; ignored once locked. */
export function setChoice(g: GameState, patch: Partial<PlanChoice>): void {
  if (g.locked) return;
  const c = { ...g.choice, ...patch };
  c.balanceKcal = clamp(Math.round(c.balanceKcal), BALANCE_RANGE[0], BALANCE_RANGE[1]);
  g.choice = c;
}

/** Advance the decision clock; locks the plan as-is when time runs out. */
export function step(g: GameState, dtSec: number): void {
  if (g.locked) return;
  g.timeLeft = Math.max(0, g.timeLeft - dtSec);
  if (g.timeLeft <= 0) g.locked = true;
}

export function lockPlan(g: GameState): void {
  g.locked = true;
}

function lift(exerciseId: string, sets: number, reps: number, intensity: Intensity, restS = 120): LiftPrescription {
  const base: LiftPrescription = { exerciseId, sets, reps, targetRir: 2, restS };
  if (intensity.mode === 'rir') base.targetRir = intensity.rir;
  else { base.pct1rm = intensity.pct; base.targetRir = 0; }
  return base;
}

function withIntensity(s: Session, intensity: Intensity): Session {
  if (s.kind !== 'lift') return s;
  return { ...s, exercises: s.exercises.map((e) => (intensity.mode === 'rir' ? { ...e, targetRir: intensity.rir } : { ...e, pct1rm: intensity.pct, targetRir: 0 })) };
}

function liftSessions(c: PlanChoice): [Session, Session] {
  const I = c.intensity;
  if (c.template === 'full_body') return [withIntensity(FULL_BODY_A, I), withIntensity(FULL_BODY_B, I)];
  if (c.template === 'strength_focus') {
    const a: Session = { kind: 'lift', startHour: 17, exercises: [lift('back_squat_high_bar', 5, 5, I, 210), lift('bench_press', 5, 5, I, 210), lift('barbell_row', 3, 6, I, 150)] };
    const b: Session = { kind: 'lift', startHour: 17, exercises: [lift('conventional_deadlift', 3, 5, I, 210), lift('overhead_press', 4, 6, I, 180), lift('lat_pulldown', 3, 8, I, 120)] };
    return [a, b];
  }
  const n = SETS_PER_EXERCISE[c.sets];
  const a: Session = { kind: 'lift', startHour: 17, exercises: [lift('back_squat_high_bar', n, 8, I), lift('bench_press', n, 8, I), lift('barbell_row', n, 10, I), lift('barbell_curl', n, 12, I, 90), lift('standing_calf_raise', n, 12, I, 90)] };
  const b: Session = { kind: 'lift', startHour: 17, exercises: [lift('leg_press', n, 10, I), lift('incline_db_press', n, 10, I), lift('lat_pulldown', n, 10, I), lift('romanian_deadlift', n, 10, I), lift('triceps_pushdown', n, 12, I, 90)] };
  return [a, b];
}

export function buildPlan(c: PlanChoice): WeeklyPlan {
  const [a, b] = liftSessions(c);
  const byDay: Record<number, Session[]> = {};
  LIFT_DAYS[c.days]?.forEach((d, i) => { byDay[d] = [i % 2 === 0 ? a : b]; });
  CARDIO_DAYS[c.cardio]?.forEach((d) => {
    byDay[d] = [...(byDay[d] ?? []), { kind: 'cardio', startHour: 7, exerciseId: 'easy_run', minutes: 30, zone: 1 }];
  });
  return goodPlan(weekOf(byDay), { balanceKcal: c.balanceKcal });
}

/** The goal metric improvement over the 56 days (bigger is better). */
export function runOutcome(client: ClientInfo, seed: string, c: PlanChoice): number {
  const x = ctx();
  const s = buildCharacter(client, seed);
  const lifts0 = LIFT_IDS.map((l) => testOneRepMax(x, s, l));
  const ffm0 = fatFreeMass(s, x.P);
  const fat0 = s.body.fatMass;
  const t0 = runTime(x, s, 5000);
  runDays(x, s, buildPlan(c), PLAN_DAYS);
  switch (client.goal) {
    case 'strength': return LIFT_IDS.reduce((acc, l, i) => acc + testOneRepMax(x, s, l) / (lifts0[i] as number), 0) / LIFT_IDS.length - 1;
    case 'muscle': return (fatFreeMass(s, x.P) - ffm0) / bodyMass(s, x.P);
    case 'fat_loss': return (fat0 - s.body.fatMass - Math.max(0, ffm0 - fatFreeMass(s, x.P))) / bodyMass(s, x.P);
    case '5k': return (t0 - runTime(x, s, 5000)) / t0;
  }
}

/** Preset good plans the best-of-N is taken over. */
export function presetPlans(goal: Goal): PlanChoice[] {
  const rir = (r: number): Intensity => ({ mode: 'rir', rir: r });
  const mk = (p: Partial<PlanChoice>): PlanChoice => ({ ...DEFAULT_CHOICE, ...p });
  switch (goal) {
    case 'strength': return [
      mk({ days: 3, template: 'strength_focus', intensity: rir(2), balanceKcal: 250 }),
      mk({ days: 4, template: 'strength_focus', intensity: rir(2), balanceKcal: 250 }),
      mk({ days: 4, template: 'strength_focus', intensity: { mode: 'pct', pct: 82 }, balanceKcal: 250 }),
      mk({ days: 3, template: 'full_body', intensity: rir(2), balanceKcal: 250 }),
    ];
    case 'muscle': return [
      mk({ days: 3, template: 'full_body', intensity: rir(1), balanceKcal: 300 }),
      mk({ days: 4, template: 'custom_volume', sets: 'high', intensity: rir(1), balanceKcal: 300 }),
      mk({ days: 4, template: 'custom_volume', sets: 'medium', intensity: rir(1), balanceKcal: 300 }),
      mk({ days: 5, template: 'custom_volume', sets: 'high', intensity: rir(2), balanceKcal: 300 }),
    ];
    case 'fat_loss': return [
      mk({ days: 3, template: 'full_body', intensity: rir(2), cardio: 2, balanceKcal: -500 }),
      mk({ days: 4, template: 'full_body', intensity: rir(2), cardio: 2, balanceKcal: -500 }),
      mk({ days: 3, template: 'strength_focus', intensity: rir(2), cardio: 3, balanceKcal: -450 }),
      mk({ days: 4, template: 'custom_volume', sets: 'medium', intensity: rir(2), cardio: 3, balanceKcal: -600 }),
    ];
    case '5k': return [
      mk({ days: 2, template: 'full_body', intensity: rir(3), cardio: 3, balanceKcal: 100 }),
      mk({ days: 2, template: 'custom_volume', sets: 'low', intensity: rir(3), cardio: 3, balanceKcal: 0 }),
      mk({ days: 3, template: 'custom_volume', sets: 'low', intensity: rir(3), cardio: 3, balanceKcal: 100 }),
    ];
  }
}

/** Best outcome over the presets (computed lazily and cached on the state). */
export function bestOutcome(g: GameState): number {
  if (g.best === null) g.best = Math.max(...presetPlans(g.client.goal).map((p) => runOutcome(g.client, g.seed, p)));
  return g.best;
}

/** Locks the plan, runs the engine and returns player/best clamped to 0..1. */
export function evaluate(g: GameState): number {
  g.locked = true;
  g.outcome ??= runOutcome(g.client, g.seed, g.choice);
  return score(g);
}

export function score(g: GameState): number {
  if (g.outcome === null) return 0;
  const best = bestOutcome(g);
  if (best <= 0) return g.outcome >= best ? 1 : 0;
  return clamp(g.outcome / best, 0, 1);
}

export function describeOutcome(g: GameState): string {
  if (g.outcome === null) return '';
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const label: Record<Goal, string> = { strength: 'avg lift gain', muscle: 'lean mass gain / bodyweight', fat_loss: 'net fat loss / bodyweight', '5k': '5K time improvement' };
  return `${label[g.client.goal]}: ${pct(g.outcome)} (best plan ${pct(bestOutcome(g))})`;
}

