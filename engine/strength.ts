// Strength expression: force index, 1RM, reps at a given load, autoregulated load selection.
import { MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { Exercise } from '../data/exercises/schema';
import { referenceCharacter } from './character';
import { exerciseOf, type SimContext } from './context';
import { bodyMass, heightM } from './body';
import { clamp } from './math';
import type { CharacterState } from './types';
import { BRZYCKI_A, BRZYCKI_B, EPLEY_DIVISOR, REF_HEIGHT_M } from './units';

let refCache: { ctx: SimContext; state: CharacterState } | null = null;
function refState(ctx: SimContext): CharacterState {
  if (refCache && refCache.ctx === ctx) return refCache.state;
  const st = referenceCharacter(ctx);
  for (const m of MUSCLE_REGIONS) st.muscles[m].momentArm = 1;
  refCache = { ctx, state: st };
  return st;
}

/**
 * Muscle force index for an exercise: sum of activation x mass x moment arm, divided by segment length
 * (force ~ CSA = volume / length; across geometrically similar bodies this gives mass^0.67, Jaric 2002).
 */
export function forceIndex(ctx: SimContext, s: CharacterState, e: Exercise, inSession: boolean, ignoreDamage = false): number {
  const P = ctx.P;
  const lengthScale = (heightM(s) / REF_HEIGHT_M) ** (3 * (1 - P.strength.massToForceExponent));
  let fi = 0;
  const muscles = e.muscles as Partial<Record<MuscleId, number>>;
  for (const k in muscles) {
    const m = k as MuscleId;
    const a = muscles[m] as number;
    const st = s.muscles[m];
    let f = a * st.mass * st.momentArm * (ignoreDamage ? 1 : 1 - P.training.damageForceLoss * Math.min(1, st.damage));
    if (inSession) f *= 1 - Math.min(P.model.maxSessionFatigue, st.sessionFatigue);
    fi += f;
  }
  return fi / lengthScale;
}

function refForceIndex(ctx: SimContext, e: Exercise): number {
  let v = ctx.refForce.get(e.id);
  if (v === undefined) {
    v = forceIndex(ctx, refState(ctx), e, false);
    ctx.refForce.set(e.id, v);
  }
  return v;
}

export function skillOf(ctx: SimContext, s: CharacterState, id: string): number {
  return s.skills[id]?.skill ?? s.genetics.noviceSkill;
}

export function skillFactor(ctx: SimContext, skill: number): number {
  const f = ctx.P.strength.skillFloor;
  return f + (1 - f) * skill;
}

/** Leverage multiplier from segment ratios and exercise leverage exponents, clamped to +/- leverageClamp. */
export function leverageFactor(ctx: SimContext, s: CharacterState, e: Exercise): number {
  const G = ctx.P.genetics;
  const a = s.anthro;
  const ex = e.leverageExponents;
  let m = 1;
  if (ex.femurTorso) m *= ((a.thigh / a.torso) / (G.thighFraction / G.torsoFraction)) ** ex.femurTorso;
  if (ex.armLength) m *= ((a.upperArm + a.forearm) / (G.upperArmFraction + G.forearmFraction)) ** ex.armLength;
  if (ex.torsoLength) m *= (a.torso / G.torsoFraction) ** ex.torsoLength;
  return clamp(m, 1 - G.leverageClamp, 1 + G.leverageClamp);
}

/** Activation-weighted fast-twitch fraction of the muscles used by an exercise. */
export function exerciseTypeII(s: CharacterState, e: Exercise): number {
  let w = 0;
  let t = 0;
  const muscles = e.muscles as Partial<Record<MuscleId, number>>;
  for (const k in muscles) {
    const m = k as MuscleId;
    const a = muscles[m] as number;
    w += a;
    t += a * s.muscles[m].typeII;
  }
  return w > 0 ? t / w : 0.5;
}

export interface AcuteModifiers {
  readiness: number; // 0..1
  caffeine: number; // multiplier
  creatine: number; // multiplier
  hydration: number; // multiplier
  other: number;
}
export const NEUTRAL_ACUTE: AcuteModifiers = { readiness: 1, caffeine: 1, creatine: 1, hydration: 1, other: 1 };

/** Neuromuscular-quality factor from the movement-pattern pool. */
export function neuralFactor(ctx: SimContext, s: CharacterState, e: Exercise): number {
  const ps = s.patterns[e.movementPattern];
  return (1 + s.genetics.neuralFastGain * ps.fast) * (1 + ctx.P.strength.neuralQualityGainMax * ps.neural);
}

/**
 * True one-rep max (kg of system load). For bodyweight exercises this includes body weight.
 * `inSession` applies within-session local fatigue. Readiness and acute modifiers apply as given.
 */
export function oneRepMax(ctx: SimContext, s: CharacterState, exerciseId: string, acute: AcuteModifiers = NEUTRAL_ACUTE, inSession = false, ignoreDamage = false): number {
  const e = exerciseOf(ctx, exerciseId);
  if (e.loadType === 'none' || !e.refLoad) return 0;
  const P = ctx.P;
  const fi = forceIndex(ctx, s, e, inSession, ignoreDamage) / refForceIndex(ctx, e);
  const skill = skillFactor(ctx, skillOf(ctx, s, e.id)) / skillFactor(ctx, P.training.skillStart);
  const neural = neuralFactor(ctx, s, e);
  const lev = leverageFactor(ctx, s, e);
  const fiber = 1 + P.strength.fiberStrengthPerTenth * (exerciseTypeII(s, e) - 0.5) * 10;
  const ready = 1 - P.strength.readinessStrengthPenalty * (1 - clamp(acute.readiness, 0, 1));
  return e.refLoad * fi * skill * neural * lev * fiber * ready * acute.caffeine * acute.creatine * acute.hydration * acute.other;
}

/**
 * Test-day 1RM: fully rested (readiness 1, no soreness), including chronic acute effects such as creatine
 * saturation. This is the "true strength" used for benchmarks and PR days.
 */
export function testOneRepMax(ctx: SimContext, s: CharacterState, exerciseId: string): number {
  const acute: AcuteModifiers = { ...NEUTRAL_ACUTE, creatine: 1 + ctx.P.strength.creatineAcuteStrength * s.body.creatineSaturation };
  return oneRepMax(ctx, s, exerciseId, acute, false, true);
}

/** Base reps achievable at fraction p of 1RM: Epley/Brzycki blend; reps(1.0) = 1. */
export function baseReps(ctx: SimContext, p: number): number {
  const M = ctx.P.model;
  if (p > M.failPctTolerance) return 0;
  if (p <= M.minRepsPct) return M.maxReps;
  const w = ctx.P.strength.epleyWeight;
  const epley = Math.max(1, EPLEY_DIVISOR * (1 / p - 1));
  const brzycki = Math.max(1, (BRZYCKI_A - p) / BRZYCKI_B);
  return Math.min(M.maxReps, w * epley + (1 - w) * brzycki);
}

/** Individual and exercise modifiers on the rep curve (applied to reps beyond the first). */
export function repsMultiplier(ctx: SimContext, s: CharacterState, e: Exercise, creatineSat: number): number {
  const P = ctx.P;
  const fiber = 1 + P.strength.fiberRepsPerTenth * (exerciseTypeII(s, e) - 0.5) * 10;
  const sex = s.sex === 'female' ? P.strength.femaleRepsMultiplier : 1;
  const cr = 1 + P.strength.creatineRepsBonus * creatineSat;
  return e.repsModifier * fiber * sex * cr;
}

export function repsAt(ctx: SimContext, p: number, mult: number): number {
  const r = baseReps(ctx, p);
  if (r <= 0) return 0;
  return 1 + (r - 1) * mult;
}

/** Inverse of repsAt: fraction of 1RM at which `reps` reps are the maximum. */
export function pctForReps(ctx: SimContext, reps: number, mult: number): number {
  if (reps <= 1) return 1;
  let lo = 0.1;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (repsAt(ctx, mid, mult) > reps) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function roundLoad(ctx: SimContext, kg: number, e: Exercise): number {
  const M = ctx.P.model;
  const step = e.equipment.includes('dumbbell') ? M.loadStepDumbbell : e.equipment.includes('machine') || e.equipment.includes('cable') ? M.loadStepMachine : M.loadStepBarbell;
  return Math.max(step, Math.round(kg / step) * step);
}

/** External load (kg added) for bodyweight exercises equals system load minus the bodyweight share. */
export function bodyweightLoad(ctx: SimContext, s: CharacterState, e: Exercise): number {
  return e.loadType === 'bodyweight' ? bodyMass(s, ctx.P) * (e.bodyweightFraction ?? 1) : 0;
}

/** Estimated 1RM from a set (Epley) for display; error grows with reps (measure.ts adds noise). */
export function estimateOneRm(loadKg: number, reps: number): number {
  return reps <= 1 ? loadKg : loadKg * (1 + reps / EPLEY_DIVISOR);
}
