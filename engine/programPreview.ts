// Program builder live previews: weekly effective sets per muscle, a predicted adaptation profile, systemic load
// and interference / volume warnings for a week of sessions.
//
// HEURISTIC PREVIEW, NOT THE SIMULATION. Nothing here touches a CharacterState: it applies the engine's own dose
// functions (hypRir / hypLoad / strRir curves, hypResponse = 1 - exp(-V/V0), zone weights, interference gap) to the
// prescription as written, assuming the lifter hits the prescribed RIR. The real sim additionally models skill,
// readiness, within-session fatigue, session saturation and genetics, so use these numbers for relative comparison
// between programs, not as a forecast of gains.
import { MUSCLE_MASS_FRACTIONS, MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { Exercise } from '../data/exercises/schema';
import { exerciseOf, type SimContext } from './context';
import { hypResponse } from './adaptation';
import { interp, saturate } from './math';
import type { LiftPrescription, Session } from './types';

/** Any 7-entry week of sessions (a `WeeklyPlan['week']`, or the helpers in data/programs.ts). */
export type PreviewWeek = ReadonlyArray<{ sessions: readonly Session[] }>;

export type MuscleSets = Record<MuscleId, number>;

export interface AdaptationProfile {
  hypertrophy: number;
  maxStrength: number;
  power: number;
  speed: number;
  jump: number;
  aerobic: number;
  muscularEndurance: number;
}

export interface DayLoad {
  /** Sum of exercise.systemicFatigue x sets (cardio: x minutes / previewCardioMinPerSetEq). */
  systemic: number;
  /** Sum of exercise.axialLoad x sets. */
  axial: number;
  /** Estimated session time including warm-up, work and rests. */
  minutes: number;
}

export interface SystemicLoad {
  weeklyTotal: number;
  weeklyAxial: number;
  weeklyMinutes: number;
  /** 7 entries. */
  perDay: DayLoad[];
}

export type Severity = 'low' | 'moderate' | 'high';
export interface PreviewWarning {
  kind: 'interference-timing' | 'interference-volume' | 'consecutive-days' | 'low-volume' | 'high-volume';
  severity: Severity;
  message: string;
  day?: number;
  muscle?: MuscleId;
}

export interface WeekPreview {
  effectiveSets: MuscleSets;
  profile: AdaptationProfile;
  load: SystemicLoad;
  interference: PreviewWarning[];
  volume: PreviewWarning[];
}

const zeroSets = (): MuscleSets => Object.fromEntries(MUSCLE_REGIONS.map((m) => [m, 0])) as MuscleSets;

interface Item {
  day: number;
  sess: Exclude<Session, { kind: 'cardio' }>;
  rx: LiftPrescription;
  e: Exercise;
}

function setItems(ctx: SimContext, week: PreviewWeek): Item[] {
  const out: Item[] = [];
  week.forEach((d, day) => {
    for (const sess of d.sessions) {
      if (sess.kind === 'cardio') continue;
      for (const rx of sess.exercises) out.push({ day, sess, rx, e: exerciseOf(ctx, rx.exerciseId) });
    }
  });
  return out;
}

/** RIR the engine assumes for a set: unloaded work (plyo, sprints) is resolved at the hard-set RIR. */
function setRir(ctx: SimContext, it: Item): number {
  return it.e.loadType === 'none' ? ctx.P.training.hardSetRir : it.rx.targetRir;
}

/** Same intent factor as engine/session.ts. */
function intentFactor(ctx: SimContext, it: Item): number {
  const { e, rx } = it;
  const intent = rx.intent ?? (e.category === 'plyometric' || e.category === 'sprint' || e.category === 'olympic' ? 'max' : 'controlled');
  const T = ctx.P.training;
  return intent === 'max' ? 1 : intent === 'slow' ? T.intentSubmaxPower * ctx.P.model.slowIntentPowerFactor : T.intentSubmaxPower;
}

/** Hypertrophy weight of one set: the engine's RIR curve (and load curve when a %1RM is fixed). 1 = a set at failure. */
function setWeight(ctx: SimContext, it: Item): number {
  let w = interp(ctx.C.training.hypRir, setRir(ctx, it));
  if (it.e.loadType === 'none') w *= ctx.P.model.noneLoadHypFactor;
  else if (it.rx.pct1rm !== undefined) w *= interp(ctx.C.training.hypLoad, it.rx.pct1rm);
  return w;
}

/** Fractional set credit for a muscle (full set at primary activation, synergists at synergistCredit), as in the engine. */
function credit(ctx: SimContext, a: number): number {
  return a >= ctx.P.model.creditPrimaryThreshold ? a : a * (ctx.P.training.synergistCredit / 0.5);
}

function accumulate(ctx: SimContext, week: PreviewWeek, perSet: (it: Item) => number): { weekly: MuscleSets; byDay: MuscleSets[] } {
  const weekly = zeroSets();
  const byDay = week.map(() => zeroSets());
  for (const it of setItems(ctx, week)) {
    const w = perSet(it) * it.rx.sets;
    const ms = it.e.muscles as Partial<Record<MuscleId, number>>;
    for (const k in ms) {
      const m = k as MuscleId;
      const v = credit(ctx, ms[m] as number) * w;
      weekly[m] += v;
      const d = byDay[it.day];
      if (d) d[m] += v;
    }
  }
  return { weekly, byDay };
}

/**
 * Fractional hard sets per muscle region over the week. A set contributes activation x hypRir(RIR) (x hypLoad when a
 * %1RM is fixed): RIR 0 counts fully and sets far from failure fade toward zero.
 */
export function weeklyEffectiveSets(ctx: SimContext, week: PreviewWeek): MuscleSets {
  return accumulate(ctx, week, (it) => setWeight(ctx, it)).weekly;
}

/**
 * Relative 0..1 adaptation scores for the week. Each is a saturating dose 1 - exp(-V/V0) using the engine's dose
 * constants and the exercises' adaptationBias; hypertrophy is the mass-weighted mean of R(V) over all muscles
 * (so a program that skips muscles scores lower). Heuristic preview, not the simulation.
 */
export function adaptationProfile(ctx: SimContext, week: PreviewWeek): AdaptationProfile {
  const T = ctx.P.training;
  const M = ctx.P.model;
  const A = ctx.P.aerobic;
  const items = setItems(ctx, week);

  const hyp = accumulate(ctx, week, (it) => setWeight(ctx, it) * it.e.adaptationBias.hypertrophy).weekly;
  let massSum = 0;
  let hypSum = 0;
  for (const m of MUSCLE_REGIONS) {
    massSum += MUSCLE_MASS_FRACTIONS[m];
    hypSum += MUSCLE_MASS_FRACTIONS[m] * hypResponse(ctx, hyp[m]);
  }

  let strength = 0;
  let power = 0;
  let speed = 0;
  let jump = 0;
  let endurance = 0;
  for (const it of items) {
    const { e, rx } = it;
    const n = rx.sets;
    const bias = e.adaptationBias;
    const reps = rx.reps ?? M.defaultTargetReps;
    const intentF = intentFactor(ctx, it);
    if (e.loadType !== 'none') {
      const heavy = (rx.pct1rm !== undefined && rx.pct1rm >= M.previewHeavyPct) || (rx.pct1rm === undefined && reps + rx.targetRir <= M.previewHeavyMaxReps);
      if (heavy) strength += n * bias.maxStrength * interp(ctx.C.training.strRir, rx.targetRir);
      if (reps >= M.previewEnduranceMinReps) endurance += n * bias.muscularEndurance * interp(ctx.C.training.hypRir, rx.targetRir);
    }
    if (bias.power > M.powerBiasThreshold) power += n * bias.power * intentF;
    if (e.category === 'plyometric') jump += n * bias.jump * intentF;
    if (e.sprint || e.category === 'plyometric') speed += n * bias.speed * intentF * (e.sprint ? e.sprint.vmax : 1);
  }

  let aeroWeighted = 0;
  for (const d of week) {
    for (const s of d.sessions) {
      if (s.kind !== 'cardio') continue;
      const w = s.zone === 1 ? A.zone1Weight : s.zone === 2 ? A.zone2Weight : A.zone3Weight;
      aeroWeighted += s.minutes * w * exerciseOf(ctx, s.exerciseId).adaptationBias.aerobic;
    }
  }

  return {
    hypertrophy: hypSum / massSum,
    maxStrength: saturate(strength, T.v0Strength * M.previewStrengthPatterns),
    power: saturate(power, T.v0Power),
    speed: saturate(speed, T.v0Power),
    jump: saturate(jump, T.v0Power),
    aerobic: saturate(aeroWeighted, M.previewAerobicV0Min),
    muscularEndurance: saturate(endurance, T.v0Hypertrophy),
  };
}

function sessionSeconds(ctx: SimContext, it: Item): number {
  const M = ctx.P.model;
  const { e, rx } = it;
  const tempo = rx.tempoS ?? e.secondsPerRep;
  const work = e.sprint ? (rx.distanceM ?? M.sprintRefDistanceM) / M.sprintMeanSpeed : (rx.reps ?? 1) * tempo;
  return rx.sets * work + Math.max(0, rx.sets - 1) * rx.restS + M.restAfterLastSetS;
}

/** Weekly and per-day systemic fatigue, axial load and estimated session duration. */
export function systemicLoad(ctx: SimContext, week: PreviewWeek): SystemicLoad {
  const M = ctx.P.model;
  const perDay: DayLoad[] = week.map(() => ({ systemic: 0, axial: 0, minutes: 0 }));
  week.forEach((d, day) => {
    const row = perDay[day] as DayLoad;
    for (const sess of d.sessions) {
      if (sess.kind === 'cardio') {
        const e = exerciseOf(ctx, sess.exerciseId);
        row.systemic += (e.systemicFatigue * sess.minutes) / M.previewCardioMinPerSetEq;
        row.minutes += sess.minutes;
        continue;
      }
      row.minutes += M.warmupMinutes;
      for (const rx of sess.exercises) {
        const it: Item = { day, sess, rx, e: exerciseOf(ctx, rx.exerciseId) };
        row.systemic += it.e.systemicFatigue * rx.sets;
        row.axial += it.e.axialLoad * rx.sets;
        row.minutes += sessionSeconds(ctx, it) / 60;
      }
    }
  });
  return {
    weeklyTotal: perDay.reduce((a, r) => a + r.systemic, 0),
    weeklyAxial: perDay.reduce((a, r) => a + r.axial, 0),
    weeklyMinutes: perDay.reduce((a, r) => a + r.minutes, 0),
    perDay,
  };
}

/**
 * Interference warnings (concurrent training): cardio starting within the interference gap of a lifting session the
 * same day (Schumann 2022; gap and weighting as in engine/sim.ts), high weekly running alongside a hypertrophy focus
 * (Wilson 2012: running interferes most), and one muscle trained hard on consecutive days.
 */
export function interferenceWarnings(ctx: SimContext, week: PreviewWeek): PreviewWarning[] {
  const M = ctx.P.model;
  const A = ctx.P.aerobic;
  const out: PreviewWarning[] = [];

  week.forEach((d, day) => {
    const liftHours = d.sessions.filter((s) => s.kind === 'lift').map((s) => s.startHour);
    for (const s of d.sessions) {
      if (s.kind !== 'cardio') continue;
      const gap = liftHours.map((h) => Math.abs(h - s.startHour)).reduce((a, b) => Math.min(a, b), Infinity);
      if (gap >= A.interferenceGapHours) continue;
      const e = exerciseOf(ctx, s.exerciseId);
      const zoneMult = s.zone === 3 ? M.interferenceZone3Mult : s.zone === 2 ? M.interferenceZone2Mult : 1;
      const weighted = s.minutes * zoneMult * (e.cardio?.modality === 'running' ? A.interferenceRunning : A.interferenceCycling);
      out.push({
        kind: 'interference-timing', day,
        severity: weighted >= M.previewHighInterferenceMin ? 'high' : 'moderate',
        message: `Day ${day + 1}: ${s.minutes} min of ${e.name} starts ${gap.toFixed(1)} h from a lifting session (under ${A.interferenceGapHours} h). Same-session endurance work blunts explosive-strength gains (Schumann 2022; Wilson 2012). Separate them by at least ${A.interferenceGapHours} h, ideally lifting first or on another day.`,
      });
    }
  });

  let runMin = 0;
  for (const d of week) for (const s of d.sessions) if (s.kind === 'cardio' && exerciseOf(ctx, s.exerciseId).cardio?.modality === 'running') runMin += s.minutes;
  const hypScore = adaptationProfile(ctx, week).hypertrophy;
  if (runMin >= M.previewHighRunMin && hypScore >= M.previewHypFocusScore) {
    out.push({
      kind: 'interference-volume',
      severity: runMin >= A.interferenceSaturationMin ? 'high' : 'moderate',
      message: `${Math.round(runMin)} min/week of running alongside a hypertrophy-focused program. Running is the modality that interferes most with muscle and strength gains, and the penalty grows with weekly volume up to about ${A.interferenceSaturationMin} min (Wilson 2012; Schumann 2022). Consider cycling or fewer run minutes.`,
    });
  }

  const { byDay } = accumulate(ctx, week, (it) => setWeight(ctx, it));
  const days = week.length;
  for (const m of MUSCLE_REGIONS) {
    for (let d = 0; d < days; d++) {
      const next = (d + 1) % days;
      if (next === d) continue;
      if (((byDay[d] as MuscleSets)[m] >= M.previewHardDaySets) && ((byDay[next] as MuscleSets)[m] >= M.previewHardDaySets)) {
        out.push({
          kind: 'consecutive-days', day: d, muscle: m, severity: 'low',
          message: `${m} is trained hard on day ${d + 1} and day ${next + 1}. Local damage and fatigue (about ${ctx.P.training.damageHalfLifeH} h half-life) will still be present, so the second session is likely to be compromised.`,
        });
      }
    }
  }
  return out;
}

/** Weekly volume warnings for muscles that are trained but below the minimum useful dose, or past diminishing returns. */
export function volumeWarnings(ctx: SimContext, week: PreviewWeek): PreviewWarning[] {
  const M = ctx.P.model;
  const V0 = ctx.P.training.v0Hypertrophy;
  const sets = weeklyEffectiveSets(ctx, week);
  const out: PreviewWarning[] = [];
  for (const m of MUSCLE_REGIONS) {
    const v = sets[m];
    if (v > 0 && v < M.previewMinWeeklySets) {
      out.push({ kind: 'low-volume', severity: 'low', muscle: m, message: `${m}: ${v.toFixed(1)} effective sets/week is below about ${M.previewMinWeeklySets}, roughly maintenance dose. Add sets for growth (Pelland 2024).` });
    } else if (v > M.previewMaxWeeklySets) {
      const marginal = Math.exp(-v / V0) * 100;
      out.push({
        kind: 'high-volume', severity: v > ctx.P.hypertrophy.mrvSets ? 'high' : 'moderate', muscle: m,
        message: `${m}: ${v.toFixed(1)} effective sets/week is past about ${M.previewMaxWeeklySets}, where each extra set adds only ~${marginal.toFixed(0)}% of the first set's benefit and recovery cost keeps rising (Pelland 2024; Schoenfeld 2017).`,
      });
    }
  }
  return out;
}

/** All previews for a week. */
export function previewWeek(ctx: SimContext, week: PreviewWeek): WeekPreview {
  return {
    effectiveSets: weeklyEffectiveSets(ctx, week),
    profile: adaptationProfile(ctx, week),
    load: systemicLoad(ctx, week),
    interference: interferenceWarnings(ctx, week),
    volume: volumeWarnings(ctx, week),
  };
}
