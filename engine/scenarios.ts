// Scenarios and goals (phase 5). A scenario picks a recommended start, optionally edits the new game (setup), and is
// judged by `check` (progress/done) and `failIf`. GameState has no slot for scenario state, so it lives in a separate
// JSON-safe ScenarioRun returned by startScenario. Goals that need a test use TRUE values (testOneRepMax,
// runFieldTest trueValue at full readiness), not noisy measurements; the detail text says so.
import { bodyFatFraction, bodyMass, fatFreeMass } from './body';
import type { SimContext } from './context';
import { runFieldTest } from './events';
import { ctxForGame, newGame, type GameState } from './game';
import { clamp } from './math';
import { MAIN_LIFTS } from './runner';
import { testOneRepMax } from './strength';
import type { Injury } from './types';

export type ScenarioStatus = 'active' | 'completed' | 'failed';

export interface ScenarioRun {
  scenarioId: string;
  startDay: number;
  /** Values recorded right after setup: liftTotal, leanKg, fatKg, bodyFat. */
  baseline: Record<string, number>;
  status: ScenarioStatus;
}

export interface ScenarioCheck { done: boolean; progress: number; detail: string }

export interface Scenario {
  id: string;
  name: string;
  description: string;
  /** Recommended starting archetype. */
  archetypeId: string;
  setup?: (game: GameState) => void;
  timeLimitDays: number | null;
  /** Absent for the sandbox. `run` is passed so goals can compare with the baseline. */
  check?: (ctx: SimContext, game: GameState, run: ScenarioRun) => ScenarioCheck;
  failIf?: (ctx: SimContext, game: GameState, run: ScenarioRun) => string | null;
}

const SQUAT = 'back_squat_high_bar';
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;
const MONTHS_HALF_YEAR = 6;

function liftTotal(ctx: SimContext, game: GameState): number {
  let t = 0;
  for (const l of MAIN_LIFTS) t += testOneRepMax(ctx, game.character, l);
  return t;
}

function leanKg(ctx: SimContext, game: GameState): number { return fatFreeMass(game.character, ctx.P); }

function fieldTrue(ctx: SimContext, game: GameState, id: 'sprint40yd' | 'run5k'): number {
  return runFieldTest(ctx, game.character, id, { seed: game.seed, day: game.character.day, readiness: 1 }).trueValue;
}

/** Progress for a "lower is better" target. */
function timeProgress(value: number, target: number): number { return clamp(target / value, 0, 1); }

function baselineOf(ctx: SimContext, game: GameState): Record<string, number> {
  return {
    liftTotal: liftTotal(ctx, game),
    leanKg: leanKg(ctx, game),
    fatKg: game.character.body.fatMass,
    bodyFat: bodyFatFraction(game.character, ctx.P),
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'squat_2x_bw',
    name: '2x bodyweight squat',
    description: 'Squat twice your body mass for a single.',
    archetypeId: 'stocky_powerlifter_build',
    timeLimitDays: 2 * DAYS_PER_YEAR,
    check: (ctx, game) => {
      const k = ctx.P.model.scnSquatBwMultiple;
      const ratio = testOneRepMax(ctx, game.character, SQUAT) / bodyMass(game.character, ctx.P);
      return { done: ratio >= k, progress: clamp(ratio / k, 0, 1), detail: `true 1RM; verify with a test day: squat ${ratio.toFixed(2)}x body mass (goal ${k}x)` };
    },
  },
  {
    id: 'sprint_40yd_sub5',
    name: 'Sub-5.0 s 40-yard dash',
    description: 'Run the 40 yard dash faster than five seconds.',
    archetypeId: 'former_sprinter_35',
    timeLimitDays: DAYS_PER_YEAR,
    check: (ctx, game) => {
      const target = ctx.P.model.scnSprint40Sec;
      const t = fieldTrue(ctx, game, 'sprint40yd');
      return { done: t < target, progress: timeProgress(t, target), detail: `true time, rested; verify with a test day: ${t.toFixed(2)} s (goal under ${target.toFixed(1)} s)` };
    },
  },
  {
    id: 'run_5k_sub20',
    name: 'Sub-20 minute 5K',
    description: 'Run a 5K in under twenty minutes.',
    archetypeId: 'endurance_runner',
    timeLimitDays: DAYS_PER_YEAR,
    check: (ctx, game) => {
      const target = ctx.P.model.scn5kSec;
      const t = fieldTrue(ctx, game, 'run5k');
      return { done: t < target, progress: timeProgress(t, target), detail: `true time, rested; verify with a test day: ${(t / 60).toFixed(1)} min (goal under ${(target / 60).toFixed(0)} min)` };
    },
  },
  {
    id: 'cut_12_bf',
    name: 'Cut to 12% body fat',
    description: 'Start near 20% body fat and reach 12% without losing strength.',
    archetypeId: 'detrained_wrestler',
    setup: (game) => {
      const ctx = ctxForGame(game);
      const bf = ctx.P.model.scnCutStartBf;
      game.character.body.fatMass = (bf * fatFreeMass(game.character, ctx.P)) / (1 - bf);
    },
    timeLimitDays: DAYS_PER_YEAR,
    check: (ctx, game, run) => {
      const target = ctx.P.model.scnCutTargetBf;
      const bf = bodyFatFraction(game.character, ctx.P);
      const start = run.baseline.bodyFat ?? bf;
      const lost = liftTotal(ctx, game) / (run.baseline.liftTotal || 1);
      return {
        done: bf <= target,
        progress: clamp((start - bf) / (start - target), 0, 1),
        detail: `true body fat ${(bf * 100).toFixed(1)}% (goal ${(target * 100).toFixed(0)}%), main-lift total ${(lost * 100).toFixed(0)}% of start (true 1RMs)`,
      };
    },
    failIf: (ctx, game, run) => {
      const loss = ctx.P.model.scnCutMaxStrengthLoss;
      const rel = liftTotal(ctx, game) / (run.baseline.liftTotal || 1);
      return rel < 1 - loss ? `Strength fell more than ${(loss * 100).toFixed(0)}% below the start (true 1RM total)` : null;
    },
  },
  {
    id: 'beginner_recomp',
    name: 'Beginner recomposition',
    description: 'Gain lean mass and lose fat mass at the same time, each by at least 1 kg, within six months.',
    archetypeId: 'beginner_50',
    timeLimitDays: MONTHS_HALF_YEAR * DAYS_PER_MONTH,
    check: (ctx, game, run) => {
      const need = ctx.P.model.scnRecompMinKg;
      const lean = leanKg(ctx, game) - (run.baseline.leanKg ?? 0);
      const fat = (run.baseline.fatKg ?? 0) - game.character.body.fatMass;
      return {
        done: lean >= need && fat >= need,
        progress: (clamp(lean / need, 0, 1) + clamp(fat / need, 0, 1)) / 2,
        detail: `true values: lean ${lean >= 0 ? '+' : ''}${lean.toFixed(1)} kg, fat ${fat >= 0 ? '-' : '+'}${Math.abs(fat).toFixed(1)} kg (need +${need} / -${need})`,
      };
    },
  },
  {
    id: 'return_from_injury',
    name: 'Return from injury',
    description: 'Start with a hamstring strain. Heal fully and get your main lifts back to 95% of where they were.',
    archetypeId: 'detrained_wrestler',
    setup: (game) => {
      const s = game.character;
      const ctx = ctxForGame(game);
      const inj: Injury = {
        id: s.nextInjuryId, type: 'strain', tissue: 'hamstrings', muscles: ['hamstrings'],
        startDay: s.day, durationDays: ctx.P.model.scnInjuryDurationDays, severity: ctx.P.model.scnInjurySeverity,
      };
      s.nextInjuryId += 1;
      s.injuries.push(inj);
    },
    timeLimitDays: DAYS_PER_YEAR,
    check: (ctx, game, run) => {
      const frac = ctx.P.model.scnInjuryRecoverFraction;
      const rel = liftTotal(ctx, game) / (run.baseline.liftTotal || 1);
      const active = game.character.injuries.length;
      return {
        done: active === 0 && rel >= frac,
        progress: clamp(rel / frac, 0, 1) * (active === 0 ? 1 : 1 / 2),
        detail: `${active === 0 ? 'healed' : `${active} active injury`}; true 1RM total ${(rel * 100).toFixed(0)}% of pre-injury (goal ${(frac * 100).toFixed(0)}%)`,
      };
    },
  },
  {
    id: 'lean_gain_5kg',
    name: 'Gain 5 kg lean mass in a year',
    description: 'Add five kilograms of fat-free mass within a year.',
    archetypeId: 'lanky_hardgainer',
    timeLimitDays: DAYS_PER_YEAR,
    check: (ctx, game, run) => {
      const goal = ctx.P.model.scnLeanGainKg;
      const gain = leanKg(ctx, game) - (run.baseline.leanKg ?? 0);
      return { done: gain >= goal, progress: clamp(gain / goal, 0, 1), detail: `true fat-free mass (includes water and glycogen): ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} kg of ${goal} kg` };
    },
  },
  {
    id: 'sandbox',
    name: 'Sandbox',
    description: 'No goal and no time limit. Play freely.',
    archetypeId: 'desk_worker',
    timeLimitDays: null,
  },
];

export function getScenario(id: string): Scenario {
  const sc = SCENARIOS.find((x) => x.id === id);
  if (!sc) throw new Error(`unknown scenario ${id}`);
  return sc;
}

/** New game with the scenario's recommended archetype, setup applied, and the baseline recorded. */
export function startScenario(ctx: SimContext, scenarioId: string, seed: string): { game: GameState; run: ScenarioRun } {
  const sc = getScenario(scenarioId);
  const game = newGame(ctx, { archetypeId: sc.archetypeId, seed });
  sc.setup?.(game);
  const run: ScenarioRun = { scenarioId, startDay: game.character.day, baseline: baselineOf(ctx, game), status: 'active' };
  return { game, run };
}

export interface ScenarioResult extends ScenarioCheck { status: ScenarioStatus; failure: string | null; daysLeft: number | null }

/** Evaluate the scenario, update run.status (a finished run stays finished) and return the result. */
export function checkScenario(ctx: SimContext, game: GameState, run: ScenarioRun): ScenarioResult {
  const sc = getScenario(run.scenarioId);
  const elapsed = game.character.day - run.startDay;
  const daysLeft = sc.timeLimitDays === null ? null : Math.max(0, sc.timeLimitDays - elapsed);
  const c: ScenarioCheck = sc.check ? sc.check(ctx, game, run) : { done: false, progress: 0, detail: 'Sandbox: no goal' };
  let failure: string | null = null;
  if (run.status === 'active') {
    failure = sc.failIf?.(ctx, game, run) ?? null;
    if (!failure && !c.done && daysLeft === 0) failure = 'Time limit reached';
    if (failure) run.status = 'failed';
    else if (c.done) run.status = 'completed';
  }
  return { ...c, status: run.status, failure, daysLeft };
}
