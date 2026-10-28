// Physics-based performance: force-velocity profile, jumps (Samozino 2008), sprints (Samozino 2016),
// endurance races (VO2max x fractional utilisation x economy, Joyner & Coyle 2008), rowing.
import { LEG_EXTENSOR_WEIGHTS, type MuscleId } from '../data/muscles';
import type { SimContext } from './context';
import { bodyMass, heightM, legLengthM } from './body';
import { referenceCharacter } from './character';
import { clamp } from './math';
import { vo2maxAbs } from './session';
import type { CharacterState } from './types';
import { ROW_2K_M, CONCEPT2_K, KJ_PER_L_O2, METERS_40_YARDS, REF_BODY_MASS_KG, REF_HEIGHT_M } from './units';

/** Ballistic lower-body strength relative to the reference man (muscle force x neuromuscular quality). */
export function legStrengthRel(ctx: SimContext, s: CharacterState): number {
  const ref = refLeg(ctx);
  return legStrength(ctx, s) / ref;
}

function legStrength(ctx: SimContext, s: CharacterState): number {
  const P = ctx.P;
  const lengthScale = (heightM(s) / REF_HEIGHT_M) ** (3 * (1 - P.strength.massToForceExponent));
  let f = 0;
  for (const k in LEG_EXTENSOR_WEIGHTS) {
    const m = k as MuscleId;
    const st = s.muscles[m];
    f += (LEG_EXTENSOR_WEIGHTS[m] as number) * st.mass * st.momentArm * (1 - P.training.damageForceLoss * Math.min(1, st.damage));
  }
  const p = s.patterns;
  const M = P.model;
  const pool = Math.max(M.jumpPoolSquat * p.squat.neural, M.jumpPoolHinge * p.hinge.neural, M.jumpPoolLunge * p.lunge.neural, p.jump.neural, p.ballistic.neural, M.jumpPoolOlympic * p.olympic.neural, M.jumpPoolSprint * p.sprint.neural);
  const fast = Math.max(M.jumpPoolSquat * p.squat.fast, M.jumpPoolHinge * p.hinge.fast, M.jumpPoolLunge * p.lunge.fast, p.jump.fast, p.ballistic.fast, M.jumpPoolOlympic * p.olympic.fast);
  return (f / lengthScale) * (1 + P.strength.neuralQualityGainMax * pool) * (1 + s.genetics.neuralFastGain * fast);
}

let refLegCache: { ctx: SimContext; v: number } | null = null;
function refLeg(ctx: SimContext): number {
  if (refLegCache && refLegCache.ctx === ctx) return refLegCache.v;
  const v = legStrength(ctx, referenceCharacter(ctx));
  refLegCache = { ctx, v };
  return v;
}

export interface FvProfile {
  f0N: number; // N
  f0Rel: number; // N/kg
  v0: number; // m/s
  pmax: number; // W
}

export interface PerfMods {
  readiness: number;
  power: number; // caffeine, dehydration etc.
}
export const NEUTRAL_PERF: PerfMods = { readiness: 1, power: 1 };

export function lowerFv(ctx: SimContext, s: CharacterState, mods: PerfMods = NEUTRAL_PERF): FvProfile {
  const W = ctx.P.power;
  const bw = bodyMass(s, ctx.P);
  const rel = legStrengthRel(ctx, s);
  const ready = 1 - ctx.P.strength.readinessStrengthPenalty * (1 - mods.readiness);
  const f0N = W.f0RefLower * REF_BODY_MASS_KG * rel ** W.f0StrengthExponent * (1 + W.rfdTrainableMax * s.power.rfd) * ready * mods.power;
  const tII = (s.muscles.vasti.typeII + s.muscles.gluteMax.typeII + s.muscles.gastrocnemius.typeII) / 3;
  const legRef = (ctx.P.genetics.thighFraction + ctx.P.genetics.shankFraction + ctx.P.genetics.footHeightFraction) * REF_HEIGHT_M;
  const v0 = W.v0RefLower
    * (1 + (W.v0FiberPerTenth / W.v0RefLower) * (tII - 0.5) * 10)
    * (1 + W.v0TrainableMax * s.power.v0Lower)
    * (s.genetics.actn3xx ? 1 - ctx.P.genetics.actn3XxPowerPenalty : 1)
    * (legLengthM(s, ctx.P) / legRef) ** W.v0LegLengthExponent
    * (1 - ctx.P.model.v0ReadinessShare + ctx.P.model.v0ReadinessShare * ready);
  return { f0N, f0Rel: f0N / bw, v0, pmax: (f0N * v0) / 4 };
}

/** Squat jump height (m) from the F-v profile (Samozino 2008): h = hPO (F/(mg) - 1) with F on the F-v line at mean push-off velocity. */
export function squatJump(ctx: SimContext, s: CharacterState, mods: PerfMods = NEUTRAL_PERF, extraMassKg = 0): number {
  const W = ctx.P.power;
  const g = W.gravity;
  const m = bodyMass(s, ctx.P) + extraMassKg;
  const fv = lowerFv(ctx, s, mods);
  const hpo = W.pushOffFractionOfLeg * legLengthM(s, ctx.P);
  // m (a + g) = F0 (1 - vbar/V0), vbar = sqrt(a hpo / 2). Solve for x = sqrt(a).
  const b = (fv.f0N * Math.sqrt(hpo / 2)) / fv.v0;
  const c = m * g - fv.f0N;
  const disc = b * b - 4 * m * c;
  if (disc < 0 || c >= 0) return 0;
  const x = (-b + Math.sqrt(disc)) / (2 * m);
  const a = x * x;
  return (a * hpo) / g;
}

export function countermovementJump(ctx: SimContext, s: CharacterState, mods: PerfMods = NEUTRAL_PERF, armSwing = false, extraMassKg = 0): number {
  const W = ctx.P.power;
  const sj = squatJump(ctx, s, mods, extraMassKg);
  const cmj = sj * (1 + W.cmjBonusBase + W.cmjBonusTrainable * s.power.ssc);
  return armSwing ? cmj * (1 + W.armSwingBonus) : cmj;
}

/** Standing broad jump distance (m): projectile from take-off velocity of the CMJ at ~40 degrees, plus reach. */
export function broadJump(ctx: SimContext, s: CharacterState, mods: PerfMods = NEUTRAL_PERF): number {
  const g = ctx.P.power.gravity;
  const M = ctx.P.model;
  const h = countermovementJump(ctx, s, mods, true);
  const v = Math.sqrt(2 * g * h) * M.broadJumpVelocityFactor;
  const angle = (M.broadJumpAngleDeg * Math.PI) / 180;
  return (v * v * Math.sin(2 * angle)) / g + M.broadJumpReachFraction * heightM(s);
}

export interface SprintProfile {
  vmax: number; // m/s
  f0h: number; // N/kg
  tau: number; // s
}

export function sprintProfile(ctx: SimContext, s: CharacterState, mods: PerfMods = NEUTRAL_PERF): SprintProfile {
  const W = ctx.P.power;
  const bw = bodyMass(s, ctx.P);
  const rel = legStrengthRel(ctx, s);
  const fv = lowerFv(ctx, s, mods);
  const tech = 1 + W.rfF0hGain * (s.power.rf - W.rfStart);
  const M = ctx.P.model;
  const f0hN = W.f0hRef * REF_BODY_MASS_KG * rel ** W.f0hStrengthExponent * tech * (1 + W.f0hTrainableMax * s.power.f0hPool) * mods.power;
  const f0h = f0hN / bw;
  const refRel = W.f0RefLower; // reference man's F0 per kg (75 kg)
  const legRef = (ctx.P.genetics.thighFraction + ctx.P.genetics.shankFraction + ctx.P.genetics.footHeightFraction) * REF_HEIGHT_M;
  const vmax = W.vmaxRef
    * clamp(fv.f0Rel / refRel, M.sprintRelForceMin, M.sprintRelForceMax) ** W.vmaxStrengthExponent
    * (fv.v0 / W.v0RefLower) ** M.vmaxV0Exponent
    * (1 + W.vmaxTrainableMax * s.power.vmaxPool)
    * (legLengthM(s, ctx.P) / legRef) ** M.vmaxLegExponent
    * (1 + M.vmaxTechniqueShare * W.rfF0hGain * (s.power.rf - W.rfStart));
  return { vmax, f0h, tau: vmax / f0h };
}

/** Time (s) to cover distance d (m) from a standing start with the mono-exponential model. */
export function sprintTime(p: SprintProfile, d: number): number {
  // x(t) = vmax (t + tau e^{-t/tau}) - vmax tau. Newton iterations.
  let t = d / p.vmax + p.tau;
  for (let i = 0; i < 30; i++) {
    const x = p.vmax * (t + p.tau * Math.exp(-t / p.tau)) - p.vmax * p.tau;
    const v = p.vmax * (1 - Math.exp(-t / p.tau));
    const dt = (x - d) / Math.max(0.1, v);
    t -= dt;
    if (Math.abs(dt) < 1e-6) break;
  }
  return t;
}

export const YARDS_40 = METERS_40_YARDS;

/** Relative VO2max (mL/kg/min) expressed today. */
export function vo2maxRel(ctx: SimContext, s: CharacterState, perf = 1): number {
  return (vo2maxAbs(ctx, s) * 1000 * perf) / bodyMass(s, ctx.P);
}

/** Sustainable fraction of VO2max for a race lasting tMin minutes, anchored on LT2 (~60 min) and LT1 (~4 h). */
export function sustainableFraction(ctx: SimContext, s: CharacterState, tMin: number): number {
  const M = ctx.P.model;
  const lt1 = s.aerobic.lt1 + M.raceLt1Offset;
  const lt2 = s.aerobic.lt2 + M.raceLt2Offset;
  const t0 = M.raceVo2maxMinutes;
  if (tMin <= t0) return 1 + M.raceAnaerobicBonus * clamp((t0 - tMin) / M.raceAnaerobicSpanMin, 0, 1);
  if (tMin <= M.raceLt2Minutes) return 1 + (lt2 - 1) * (Math.log(tMin / t0) / Math.log(M.raceLt2Minutes / t0));
  const f = clamp(Math.log(tMin / M.raceLt2Minutes) / Math.log(M.raceLt1Minutes / M.raceLt2Minutes), 0, M.raceUltraCap);
  return lt2 + (lt1 - lt2) * f;
}

/** Running race time (s) for distance (m). `perf` multiplies the VO2 expressed (caffeine, hydration, iron...). */
export function runTime(ctx: SimContext, s: CharacterState, distanceM: number, perf = 1): number {
  const vo2 = vo2maxRel(ctx, s, perf);
  const vV = vo2 / (s.aerobic.economyRun / 1000); // m/min at VO2max
  let t = distanceM / (vV * ctx.P.model.raceInitialFraction);
  for (let i = 0; i < 40; i++) {
    const f = sustainableFraction(ctx, s, t);
    const tn = distanceM / (vV * f);
    if (Math.abs(tn - t) < 1e-4) break;
    t = tn;
  }
  return t * 60;
}

/** 2 km rowing ergometer time (s): mechanical power from absolute VO2 and gross efficiency (Concept2 pace formula). */
export function row2kTime(ctx: SimContext, s: CharacterState, perf = 1, extraAnaerobic = 0): number {
  const vo2 = vo2maxAbs(ctx, s) * perf; // L/min
  const M = ctx.P.model;
  const efficiency = M.rowEfficiencyBase + M.rowEfficiencyTrainable * s.aerobic.economyRow;
  const anaerobic = M.rowAnaerobicBase + M.rowAnaerobicRfd * s.power.rfd + extraAnaerobic;
  const metabolicW = (vo2 * KJ_PER_L_O2 * 1000) / 60;
  const watts = metabolicW * efficiency * anaerobic;
  // Concept2: watts = 2.8 / (seconds per metre)^3
  return ROW_2K_M * (CONCEPT2_K / watts) ** (1 / 3);
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
