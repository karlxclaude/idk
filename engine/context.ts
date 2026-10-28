// Simulation context: resolved params, curves, exercise registry and cached reference values.
import { DEFAULT_CURVES, DEFAULT_PARAMS, withOverrides, type Curves, type Params } from '../data/constants';
import { EXERCISES } from '../data/exercises';
import type { Exercise } from '../data/exercises/schema';
import { MUSCLE_REGIONS, patternTransfer, type MuscleId } from '../data/muscles';

export interface SimContext {
  P: Params;
  C: Curves;
  exercises: ReadonlyMap<string, Exercise>;
  /** Reference force index per exercise (reference untrained 75 kg man). Filled lazily. */
  refForce: Map<string, number>;
  /** Transfer coefficient cache between exercise ids. */
  transfer: Map<string, Array<[string, number]>>;
}

export function makeContext(opts: { params?: Params; curves?: Curves; exercises?: Exercise[]; accelerated?: boolean } = {}): SimContext {
  let P = opts.params ?? DEFAULT_PARAMS;
  if (opts.accelerated) {
    const m = P.economy.acceleratedGainMultiplier;
    P = withOverrides(P, {
      hypertrophy: { kHypPerDay: P.hypertrophy.kHypPerDay * m },
      strength: { neuralQualityTauDays: P.strength.neuralQualityTauDays / m },
      aerobic: { kAerPerDay: P.aerobic.kAerPerDay * m },
    });
  }
  const list = opts.exercises ?? EXERCISES;
  return { P, C: opts.curves ?? DEFAULT_CURVES, exercises: new Map(list.map((e) => [e.id, e])), refForce: new Map(), transfer: new Map() };
}

export function exerciseOf(ctx: SimContext, id: string): Exercise {
  const e = ctx.exercises.get(id);
  if (!e) throw new Error(`unknown exercise ${id}`);
  return e;
}

/** Muscle activation vector as a dense array over MUSCLE_REGIONS. */
function activationVector(e: Exercise): number[] {
  return MUSCLE_REGIONS.map((m) => (e.muscles as Partial<Record<MuscleId, number>>)[m] ?? 0);
}

/**
 * Generated transfer coefficient between two exercises (0-1): pattern similarity x muscle-overlap cosine.
 * Same exercise = 1. Used for skill and neural transfer. [HEUR]
 */
export function exerciseTransfer(a: Exercise, b: Exercise, T = DEFAULT_PARAMS.training): number {
  if (a.id === b.id) return 1;
  const pt = patternTransfer(a.movementPattern, b.movementPattern);
  if (pt <= 0) return 0;
  const va = activationVector(a);
  const vb = activationVector(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < va.length; i++) {
    const x = va[i] as number;
    const y = vb[i] as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  const cos = dot / Math.sqrt(na * nb);
  const sameEquipment = a.equipment.some((q) => b.equipment.includes(q)) ? 1 : T.transferOtherEquipment;
  // Same pattern: high transfer scaled by overlap; cross-pattern: weaker.
  const base = a.movementPattern === b.movementPattern ? T.transferSamePatternBase + T.transferSamePatternOverlap * cos : pt * cos * T.transferCrossPatternScale;
  return Math.max(0, Math.min(T.transferMax, base * sameEquipment));
}

/** Exercises that receive transfer from training `id`, with coefficients (excluding itself). Cached. */
export function transfersFrom(ctx: SimContext, id: string): Array<[string, number]> {
  const cached = ctx.transfer.get(id);
  if (cached) return cached;
  const a = exerciseOf(ctx, id);
  const out: Array<[string, number]> = [];
  for (const b of ctx.exercises.values()) {
    if (b.id === id) continue;
    const t = exerciseTransfer(a, b, ctx.P.training);
    if (t > ctx.P.training.transferMin) out.push([b.id, t]);
  }
  ctx.transfer.set(id, out);
  return out;
}
