// Playable game state: ties the engine (simulateDay), economy, groceries, jobs, time budget, supplements and lab tests together.
//
// CONTEXT: SimContext is NOT part of the state. The UI must create it from the saved setting,
//   const ctx = ctxForGame(game)   // = makeContext({ accelerated: game.settings.accelerated })
// and pass the same ctx to every call. Never run a game with a ctx of the other accelerated mode.
//
// MUTATION: all functions mutate the GameState they are given (the engine is in-place for speed); clone first
// with structuredClone if you need the old state. GameState is plain JSON-safe data (no functions, Maps, NaN).
//
// DESIGN NOTES
//  - Meals: when plan.meals is set it overrides the intake of every day (7 days, indexed by day % 7). When it is
//    null, or the day has no meals, the day's intake comes from plan.training.intake (the diet target fallback).
//    Plain water is assumed free and unlimited: waterL is raised to the default daily water (PLAN_DEFAULTS.waterL).
//  - Groceries are bought automatically at the store price when the pantry lacks a meal's ingredient (whole
//    purchase units, leftovers stay in the pantry). Spoiled food is thrown away (already paid for).
//  - Money can go negative (debt) for bills and food; purchases (labs, memberships, equipment, certification) refuse.
//  - Pay is gross (no tax model). Coaching is only a cost: no training effect is modelled.
//  - Financial stress is passed as DayInputs.financialStress (the `financial` input of stressStep).
//  - Access: exercises the character cannot train at (gymTier not unlocked) are dropped from the day's sessions and
//    reported in DayReport.events.
import { ARCHETYPES } from '../data/archetypes';
import { getExercise } from '../data/exercises';
import type { JobId } from '../data/jobs';
import { FULL_BODY_WEEK } from '../data/programs';
import { PLAN_DEFAULTS } from '../data/planDefaults';
import { SUPPLEMENTS } from '../data/supplements';
import { bodyFatFraction, bodyMass } from './body';
import { createCharacter } from './character';
import { makeContext, type SimContext } from './context';
import { createFromCreator, type CreatorInput } from './creator';
import {
  exerciseAllowed, HOME_GYM_COST_KEY, InsufficientFundsError, isMembership, financialStress, MEMBERSHIP_COST_KEY,
  monthlyCostBreakdown, newLedger, perDay, post, TIER_INCLUDES, trimLedger,
  type AccessItem, type GymAccess, type HomeGymTier, type Ledger, type MembershipTier,
} from './economy';
import { expenditure } from './energy';
import { buyGroceries, consumeMeal, emptyPantry, shoppingListForWeek, spoil, type Pantry } from './groceries';
import {
  canAutoResolve, certificationCost, CertificationRequiredError, isShiftDay, jobDayInputs, jobDef, recordPlay, resolveShift,
  type JobHistory,
} from './jobs';
import { LAB_TESTS, labTestCost, runLabTest, type LabResult, type LabTestId } from './labTests';
import { DAY_TEMPLATES, intakeFromMeals, type Meal } from './meals';
import { monthOf } from './nutrition';
import { countermovementJump, vo2maxRel } from './performance';
import { emptyIntake, inputsForDay, type DayInputsWithTarget, type WeeklyPlan } from './plan';
import { MAIN_LIFTS } from './runner';
import { simulateDay, type DayResult } from './sim';
import { testOneRepMax } from './strength';
import {
  defaultWeek, scheduleForDay, summarize, toDayInputsPatch, validateSchedule,
  type ScheduleIssue, type WeekTemplate,
} from './timeBudget';
import type { CharacterState, DayReport, Intake, Session } from './types';

export const GAME_VERSION = 1;
export const DEFAULT_JOB: JobId = 'data_entry';
/** Starting home: a commercial gym membership (the default program uses machines and cables). */
export const DEFAULT_ACCESS: GymAccess = ['home', 'commercial'];
export const DEFAULT_DAY_TEMPLATE = 'Omnivore training day';
export const DEFAULT_SUPPLEMENTS: string[] = [];

export interface GameSettings { accelerated: boolean; units: 'kg' | 'lb' }

export interface GamePlan {
  training: WeeklyPlan;
  /** 7 days of meals (index = day % 7), or null to use `training.intake` as the diet target. */
  meals: Meal[][] | null;
  job: { id: JobId; performanceMode: 'auto' | number } | null;
  time: WeekTemplate;
  /** Supplement ids from data/supplements.ts. */
  supplements: string[];
  coaching: boolean;
}

export interface DayLog {
  day: number;
  date: string;
  bodyMass: number;
  bodyFat: number;
  /** True 1RM (kg) of the main lifts (runner.MAIN_LIFTS). */
  lifts: Record<string, number>;
  readiness: number;
  fitness: number;
  fatigue: number;
  kcalIn: number;
  kcalOut: number;
  proteinG: number;
  proteinQuality: number;
  cash: number;
  financialStress: number;
  vo2maxRel: number;
  /** Countermovement jump (m), logged every cmjLogIntervalDays; null otherwise. */
  cmj: number | null;
}

export interface LabRecord { day: number; testId: LabTestId; readings: Record<string, number> }

export interface GameState {
  version: number;
  seed: string;
  settings: GameSettings;
  character: CharacterState;
  ledger: Ledger;
  pantry: Pantry;
  access: GymAccess;
  plan: GamePlan;
  jobHistory: JobHistory;
  /** Job ids the character holds a certification for. */
  certifications: string[];
  history: DayLog[];
  /** Most recent DayReports (economy.reportsKept). */
  reports: DayReport[];
  labResults: LabRecord[];
  /** Intake of the last simulated day (DayReport only carries intakeKcal). */
  lastIntake: Intake | null;
}

export function ctxForGame(game: Pick<GameState, 'settings'>): SimContext {
  return makeContext({ accelerated: game.settings.accelerated });
}

// ---- Default plan ------------------------------------------------------------------------------------------------

/** Scale every ingredient of a meal plan (grams) by a factor, rounded to whole grams. */
export function scaleMeals(meals: Meal[][], factor: number): Meal[][] {
  return meals.map((day) => day.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it, grams: Math.max(1, Math.round(it.grams * factor)) })) })));
}

function templateMeals(name: string): Meal[] {
  const t = DAY_TEMPLATES.find((d) => d.name === name);
  if (!t) throw new Error(`unknown day template ${name}`);
  return structuredClone(t.meals);
}

export function kcalOfMeals(ctx: SimContext, meals: Meal[], bodyMassKg: number): number {
  return intakeFromMeals(ctx, meals, bodyMassKg).kcal;
}

/** The same template day on all 7 days, scaled to land on `targetKcal` (before alcohol-free rounding). */
export function mealPlanForKcal(ctx: SimContext, templateName: string, targetKcal: number, bodyMassKg: number): Meal[][] {
  const day = templateMeals(templateName);
  const factor = targetKcal / kcalOfMeals(ctx, day, bodyMassKg);
  return scaleMeals(Array.from({ length: 7 }, () => day), factor);
}

/** Bed hour that fits a shift (early shifts pull bed time forward, late ones push it back). */
function bedHourFor(ctx: SimContext, jobId: JobId | null): number {
  const E = ctx.P.economy;
  const hoursPerDay = 24;
  if (!jobId) return E.defaultBedHour;
  const job = jobDef(jobId);
  const commute = E.commuteDefaultMin / 60;
  const endH = job.startHour + job.shiftHours + commute;
  if (endH > E.defaultBedHour) return endH % hoursPerDay;
  const wake = E.defaultBedHour + E.defaultSleepHours - hoursPerDay;
  if (wake > job.startHour - commute) return (job.startHour - commute - E.defaultSleepHours + hoursPerDay) % hoursPerDay;
  return E.defaultBedHour;
}

/** Default week: shifts on the job's first days of the week, training on days with sessions, cooking for the meal plan. */
export function buildTimeTemplate(ctx: SimContext, training: WeeklyPlan, job: GamePlan['job'], mealsPerDay: number): WeekTemplate {
  const E = ctx.P.economy;
  const def = job ? jobDef(job.id) : null;
  const days = Array.from({ length: 7 }, (_, i) => i);
  return defaultWeek({
    jobStartHour: def?.startHour ?? 0,
    jobHours: def?.shiftHours ?? 0,
    workDays: def ? days.filter((d) => isShiftDay(def.id, d)) : [],
    trainingDays: days.filter((d) => (training.week[d]?.sessions.length ?? 0) > 0),
    trainingStartHour: E.defaultTrainingStartHour,
    sessionMinutes: E.defaultSessionMinutes,
    sleepHours: E.defaultSleepHours,
    bedHour: bedHourFor(ctx, job?.id ?? null),
    cookMealsPerDay: mealsPerDay,
  });
}

export interface NewGameOptions {
  archetypeId?: string;
  creatorInput?: CreatorInput;
  seed: string;
  accelerated?: boolean;
  units?: 'kg' | 'lb';
}

export function newGame(ctx: SimContext, opts: NewGameOptions): GameState {
  const settings: GameSettings = { accelerated: opts.accelerated ?? false, units: opts.units ?? 'kg' };
  let character: CharacterState;
  if (opts.creatorInput) character = createFromCreator(ctx, opts.creatorInput, opts.seed);
  else if (opts.archetypeId) {
    const a = ARCHETYPES.find((x) => x.id === opts.archetypeId);
    if (!a) throw new Error(`unknown archetype ${opts.archetypeId}`);
    character = createCharacter(ctx, a.profile, opts.seed);
  } else throw new Error('newGame needs an archetypeId or a creatorInput');
  character.flags.accelerated = settings.accelerated;

  const bw = bodyMass(character, ctx.P);
  const rest = expenditure(ctx, character, emptyIntake(), 0, 0, PLAN_DEFAULTS.jobMet).total;
  const meals = mealPlanForKcal(ctx, DEFAULT_DAY_TEMPLATE, rest + ctx.P.economy.defaultMealPlanSurplusKcal, bw);
  const training: WeeklyPlan = {
    week: structuredClone(FULL_BODY_WEEK),
    sleepH: ctx.P.economy.defaultSleepHours,
    bedHour: ctx.P.economy.defaultBedHour,
    intake: { balanceKcal: ctx.P.economy.defaultMealPlanSurplusKcal, proteinGkg: ctx.P.nutrition.proteinPerMealTarget },
  };
  const job: GamePlan['job'] = { id: DEFAULT_JOB, performanceMode: ctx.P.economy.defaultJobPerformance };
  return {
    version: GAME_VERSION,
    seed: opts.seed,
    settings,
    character,
    ledger: newLedger(ctx.P.economy.startingCash),
    pantry: emptyPantry(),
    access: [...DEFAULT_ACCESS],
    plan: {
      training,
      meals,
      job,
      time: buildTimeTemplate(ctx, training, job, meals[0]?.length ?? 0),
      supplements: [...DEFAULT_SUPPLEMENTS],
      coaching: false,
    },
    jobHistory: {},
    certifications: [],
    history: [],
    reports: [],
    labResults: [],
    lastIntake: null,
  };
}

// ---- Daily tick --------------------------------------------------------------------------------------------------

export interface AdvanceOptions {
  /** Raw mini-game performance 0..1 of today's shift (recorded in the job history). Overrides the plan's mode. */
  jobPerformance?: number;
}

/** Drop exercises the character cannot train at; returns the remaining sessions. */
function sessionsWithAccess(access: GymAccess, sessions: Session[], events: string[]): Session[] {
  const out: Session[] = [];
  const blocked = (id: string): boolean => {
    if (exerciseAllowed(access, id)) return false;
    events.push(`${id} unavailable (no ${getExercise(id).gymTier} access)`);
    return true;
  };
  for (const sess of sessions) {
    if (sess.kind === 'cardio') {
      if (!blocked(sess.exerciseId)) out.push(sess);
      continue;
    }
    const exercises = sess.exercises.filter((rx) => !blocked(rx.exerciseId));
    if (exercises.length > 0) out.push({ ...sess, exercises });
  }
  return out;
}

export function advanceDay(ctx: SimContext, game: GameState, opts: AdvanceOptions = {}): DayResult {
  const s = game.character;
  const P = ctx.P;
  const E = P.economy;
  const day = s.day;
  const plan = game.plan;
  const events: string[] = [];
  const bw = bodyMass(s, P);

  // 1. Plan -> inputs (sessions limited to what the character can access).
  let inputs: DayInputsWithTarget = inputsForDay(plan.training, day);
  inputs.sessions = sessionsWithAccess(game.access, inputs.sessions, events);
  const trainHour = inputs.sessions.length > 0 ? Math.min(...inputs.sessions.map((x) => x.startHour)) : undefined;

  // 2. Meals replace the intake target; the pantry is topped up at store prices when an ingredient is missing.
  const dayMeals = plan.meals?.[day % 7];
  if (dayMeals && dayMeals.length > 0) {
    for (const meal of dayMeals) {
      const missing = consumeMeal(game.pantry, meal, day);
      if (missing.length > 0) {
        post(game.ledger, day, -buyGroceries(ctx, game.pantry, missing, day), 'groceries', `groceries for ${meal.name}`);
        consumeMeal(game.pantry, { name: meal.name, items: missing }, day);
      }
    }
    const intake = intakeFromMeals(ctx, dayMeals, bw);
    intake.waterL = Math.max(intake.waterL, PLAN_DEFAULTS.waterL);
    inputs = { ...inputs, intake };
    delete inputs.intakeTarget;
  }

  // 3. Job shift.
  let shiftHours = 0;
  const job = plan.job;
  if (job && isShiftDay(job.id, day)) {
    const mode = job.performanceMode === 'auto' ? (canAutoResolve(game.jobHistory, job.id) ? 'auto' : E.defaultJobPerformance) : job.performanceMode;
    const shift = resolveShift(ctx, s, job.id, opts.jobPerformance ?? mode, game.jobHistory, { certified: game.certifications.includes(job.id) });
    if (opts.jobPerformance !== undefined) game.jobHistory = recordPlay(game.jobHistory, job.id, opts.jobPerformance);
    post(game.ledger, day, shift.pay, 'income', jobDef(job.id).name);
    inputs = jobDayInputs(inputs, shift);
    shiftHours = shift.dayInputs.jobHours;
  }

  // 4. Time budget (the job fields above stay authoritative: the template only places the blocks).
  const month = monthOf(s.startDate, day);
  const summary = summarize(scheduleForDay(plan.time, day), scheduleForDay(plan.time, day - 1), month);
  inputs = { ...inputs, ...toDayInputsPatch(summary, month), jobHours: shiftHours };

  // 5. Supplements; caffeine is dosed at the first training hour.
  let sup = inputs.supplements;
  for (const id of plan.supplements) {
    const def = SUPPLEMENTS.find((x) => x.id === id);
    if (!def) throw new Error(`unknown supplement ${id}`);
    const next = def.apply(sup);
    if (next) sup = next;
    if (def.caffeineMgPerKg !== undefined && trainHour !== undefined) inputs.caffeine = [...inputs.caffeine, { mg: def.caffeineMgPerKg * bw, hour: trainHour }];
  }
  inputs.supplements = sup;

  // 6. Fixed costs, pro-rata per day, and the financial stress they imply.
  const costs = monthlyCostBreakdown(ctx, game.access, plan.supplements, plan.coaching);
  for (const cat of ['rent', 'utilities', 'gym', 'supplements', 'coaching'] as const) {
    if (costs[cat] > 0) post(game.ledger, day, -perDay(ctx, costs[cat]), cat, cat);
  }
  const fin = financialStress(ctx, game.ledger.cash, costs.total);
  inputs.financialStress = fin;

  // 7. Simulate (the character is mutated in place).
  const result = simulateDay(ctx, s, inputs);
  result.report.events.unshift(...events);

  // 8. Pantry spoilage.
  spoil(game.pantry, day, ctx);
  trimLedger(ctx, game.ledger);

  // 9. Logs.
  const r = result.report;
  const intake = inputs.intakeTarget ? null : inputs.intake;
  game.lastIntake = intake;
  const lifts: Record<string, number> = {};
  for (const l of MAIN_LIFTS) lifts[l] = testOneRepMax(ctx, s, l);
  game.history.push({
    day, date: r.date, bodyMass: bodyMass(s, P), bodyFat: bodyFatFraction(s, P), lifts, readiness: r.readiness,
    fitness: s.fatigue.fitStr, fatigue: s.fatigue.fatStr, kcalIn: r.intakeKcal, kcalOut: r.tdee.total,
    proteinG: intake?.proteinG ?? 0, proteinQuality: intake?.proteinQuality ?? 1,
    cash: game.ledger.cash, financialStress: fin, vo2maxRel: vo2maxRel(ctx, s),
    cmj: day % E.cmjLogIntervalDays === 0 ? countermovementJump(ctx, s) : null,
  });
  game.reports.push(r);
  if (game.reports.length > E.reportsKept) game.reports.splice(0, game.reports.length - E.reportsKept);
  return result;
}

export function advanceDays(ctx: SimContext, game: GameState, n: number, opts: AdvanceOptions = {}): DayReport[] {
  const out: DayReport[] = [];
  for (let i = 0; i < n; i++) out.push(advanceDay(ctx, game, opts).report);
  return out;
}

// ---- Purchases ---------------------------------------------------------------------------------------------------

function charge(game: GameState, amount: number, category: 'lab' | 'equipment' | 'certification', note: string): void {
  if (game.ledger.cash < amount) throw new InsufficientFundsError(`${note} costs $${amount.toFixed(0)}, you have $${game.ledger.cash.toFixed(0)}`);
  post(game.ledger, game.character.day, -amount, category, note);
}

/** Pay for a lab test, run it, and store the result. Throws InsufficientFundsError (nothing is charged) when cash is short. */
export function buyLabTest(ctx: SimContext, game: GameState, testId: LabTestId): LabResult {
  const meta = LAB_TESTS.find((t) => t.id === testId);
  if (!meta) throw new Error(`unknown lab test ${testId}`);
  charge(game, labTestCost(ctx, testId), 'lab', meta.name);
  const res = runLabTest(ctx, game.character, testId, game.seed, game.character.day);
  game.labResults.push({ day: game.character.day, testId, readings: res.readings });
  return res;
}

/**
 * Start a gym membership (first month is billed through the daily pro-rata charge, there is no signup fee).
 * Buying a tier that includes the equipment of memberships you already hold replaces them (no paying twice).
 */
export function buyMembership(game: GameState, tier: MembershipTier): void {
  if (!isMembership(tier)) throw new Error(`not a membership tier: ${tier}`);
  const inc = new Set<string>(TIER_INCLUDES[tier]);
  game.access = game.access.filter((a) => !(isMembership(a) && a !== tier && TIER_INCLUDES[a].every((t) => inc.has(t))));
  if (!game.access.includes(tier)) game.access.push(tier);
}

export function cancelMembership(game: GameState, tier: AccessItem): void {
  game.access = game.access.filter((a) => a !== tier);
}

/** One-off purchase of home gym equipment (no monthly fee). The full gym replaces the basic one. */
export function buyHomeGym(ctx: SimContext, game: GameState, tier: HomeGymTier): void {
  if (game.access.includes(tier)) return;
  charge(game, ctx.P.economy[HOME_GYM_COST_KEY[tier]], 'equipment', tier === 'homeFull' ? 'Full home gym' : 'Basic home gym');
  if (tier === 'homeFull') game.access = game.access.filter((a) => a !== 'homeBasic');
  game.access.push(tier);
}

/** Pay for the certification a job requires. Throws if the job needs none, it is already held, or cash is short. */
export function buyCertification(ctx: SimContext, game: GameState, jobId: JobId): void {
  const def = jobDef(jobId);
  if (!def.requiresCertification) throw new Error(`${def.name} needs no certification`);
  if (game.certifications.includes(jobId)) throw new Error(`already certified for ${def.name}`);
  charge(game, certificationCost(ctx, jobId), 'certification', `${def.name} certification`);
  game.certifications.push(jobId);
}

// ---- Plan changes ------------------------------------------------------------------------------------------------

export interface PlanCheck {
  schedule: Array<ScheduleIssue & { dayOfWeek: number }>;
  /** Exercise ids in the training plan the character cannot access (they are skipped when played). */
  blockedExercises: string[];
}

export interface SetPlanOptions {
  /** Rebuild the default time template for the new job/training. Default: true when the patch changes job or training and gives no time. */
  rebuildTime?: boolean;
}

/** Merge a plan patch. Throws CertificationRequiredError for an uncertified job. Returns schedule and access warnings. */
export function setPlan(ctx: SimContext, game: GameState, patch: Partial<GamePlan>, opts: SetPlanOptions = {}): PlanCheck {
  if (patch.job && jobDef(patch.job.id).requiresCertification && !game.certifications.includes(patch.job.id)) {
    throw new CertificationRequiredError(`${jobDef(patch.job.id).name} requires paid certification`);
  }
  if (patch.supplements) for (const id of patch.supplements) if (!SUPPLEMENTS.some((x) => x.id === id)) throw new Error(`unknown supplement ${id}`);
  const rebuild = opts.rebuildTime ?? (patch.time === undefined && (patch.job !== undefined || patch.training !== undefined));
  game.plan = { ...game.plan, ...patch };
  if (rebuild) game.plan.time = buildTimeTemplate(ctx, game.plan.training, game.plan.job, game.plan.meals?.[0]?.length ?? 0);
  return checkPlan(game);
}

export function checkPlan(game: GameState): PlanCheck {
  const { plan } = game;
  const schedule: PlanCheck['schedule'] = [];
  for (let d = 0; d < 7; d++) {
    const jobHours = plan.job && isShiftDay(plan.job.id, d) ? jobDef(plan.job.id).shiftHours : 0;
    for (const issue of validateSchedule(scheduleForDay(plan.time, d), { jobHours })) schedule.push({ ...issue, dayOfWeek: d });
  }
  const blocked = new Set<string>();
  for (const w of plan.training.week) {
    for (const sess of w.sessions) {
      const ids = sess.kind === 'cardio' ? [sess.exerciseId] : sess.exercises.map((x) => x.exerciseId);
      for (const id of ids) if (!exerciseAllowed(game.access, id)) blocked.add(id);
    }
  }
  return { schedule, blockedExercises: [...blocked] };
}

// ---- Groceries ---------------------------------------------------------------------------------------------------

/** Buy the week's shopping list for the meal plan, net of what the pantry already holds. Returns USD spent (0 without a meal plan). */
export function weeklyGroceryRun(ctx: SimContext, game: GameState): number {
  const meals = game.plan.meals;
  if (!meals) return 0;
  const stock = new Map<string, number>();
  for (const p of game.pantry.items) stock.set(p.foodId, (stock.get(p.foodId) ?? 0) + p.grams);
  const list = shoppingListForWeek(ctx, meals)
    .map((it) => ({ foodId: it.foodId, grams: Math.max(0, weekNeed(meals, it.foodId) - (stock.get(it.foodId) ?? 0)) }))
    .filter((it) => it.grams > 0);
  const usd = buyGroceries(ctx, game.pantry, list, game.character.day);
  if (usd > 0) post(game.ledger, game.character.day, -usd, 'groceries', 'weekly grocery run');
  return usd;
}

function weekNeed(meals: Meal[][], foodId: string): number {
  let g = 0;
  for (const day of meals) for (const m of day) for (const it of m.items) if (it.foodId === foodId) g += it.grams;
  return g;
}
