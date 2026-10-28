// Jobs (phase 4): mini-game difficulty, shift resolution and DayInputs merging. Tuning in data/jobs.ts (JOB_MODEL).
import { JOB_BY_ID, JOB_MODEL as JM, type JobDef, type JobId } from '../data/jobs';
import type { SimContext } from './context';
import { clamp } from './math';
import type { CardioSession, CharacterState, DayInputs } from './types';

/** Per-job play record: number of plays and sum of raw performances. */
export type JobHistory = Partial<Record<JobId, { plays: number; sumPerformance: number }>>;

export interface ShiftResult {
  jobId: JobId;
  /** Raw performance as given/derived, 0..1, before difficulty. */
  performance: number;
  /** Difficulty-adjusted performance used for pay and stress. */
  effectivePerformance: number;
  pay: number;
  hours: number;
  dayInputs: Pick<DayInputs, 'jobHours' | 'jobMet' | 'jobStrain' | 'stressEvents' | 'jobTissues'>;
  /** Cycling cardio session (bike delivery); its hours are removed from jobHours to avoid double counting. */
  cardio?: CardioSession;
  legRecoveryCost: number;
}

export class CertificationRequiredError extends Error {}
export class AutoResolveUnavailableError extends Error {}

export function jobDef(id: JobId): JobDef {
  const j = JOB_BY_ID.get(id);
  if (!j) throw new Error(`unknown job ${id}`);
  return j;
}

/** 0..1 multiplier on mini-game performance: sleep-deprived, low-readiness or stressed characters play worse. */
export function miniGameDifficulty(ctx: SimContext, s: CharacterState): number {
  const f = s.fatigue;
  const readinessLoss = ctx.P.economy.minigameReadinessPenalty * (1 - clamp(f.readiness, 0, 1));
  const sleepLoss = JM.sleepDebtWeight.value * clamp(f.sleepDebtH / JM.sleepDebtSpanH.value, 0, 1);
  const stressLoss = JM.stressWeight.value * clamp(f.stress, 0, 1);
  return clamp(1 - readinessLoss - sleepLoss - stressLoss, JM.difficultyFloor.value, 1);
}

export function certificationCost(ctx: SimContext, jobId: JobId): number {
  const key = jobDef(jobId).certificationCostKey;
  return key ? ctx.P.economy[key] : 0;
}

export function recordPlay(history: JobHistory, jobId: JobId, performance: number): JobHistory {
  const prev = history[jobId] ?? { plays: 0, sumPerformance: 0 };
  return { ...history, [jobId]: { plays: prev.plays + 1, sumPerformance: prev.sumPerformance + clamp(performance, 0, 1) } };
}

export function canAutoResolve(history: JobHistory, jobId: JobId): boolean {
  return (history[jobId]?.plays ?? 0) >= JM.minPlaysForAuto.value;
}

/** Mean past raw performance, or null before the mini-game has been played. */
export function autoResolve(history: JobHistory, jobId: JobId): number | null {
  const h = history[jobId];
  if (!h || !canAutoResolve(history, jobId)) return null;
  return h.sumPerformance / h.plays;
}

export function resolveShift(
  ctx: SimContext, s: CharacterState, jobId: JobId, performance: number | 'auto', history: JobHistory, opts: { certified?: boolean } = {},
): ShiftResult {
  const job = jobDef(jobId);
  if (job.requiresCertification && !opts.certified) throw new CertificationRequiredError(`${job.name} requires paid certification`);
  let raw: number;
  if (performance === 'auto') {
    const avg = autoResolve(history, jobId);
    if (avg === null) throw new AutoResolveUnavailableError(`${job.name} must be played at least once before auto-resolve`);
    raw = avg;
  } else raw = clamp(performance, 0, 1);
  const eff = clamp(raw * miniGameDifficulty(ctx, s), 0, 1);
  const wage = ctx.P.economy[job.wageKey];
  const payMult = JM.payFloor.value + (JM.payCeiling.value - JM.payFloor.value) * eff;
  const pay = wage * job.shiftHours * payMult;
  const cardio: CardioSession | undefined = job.aerobicStimulus
    ? { kind: 'cardio', startHour: job.startHour, exerciseId: job.aerobicStimulus.exerciseId, minutes: job.aerobicStimulus.minutesPerShift, zone: job.aerobicStimulus.zone }
    : undefined;
  const legCost = job.legRecoveryCost ?? 0;
  const jobHours = job.shiftHours - (cardio ? cardio.minutes / 60 : 0);
  return {
    jobId, performance: raw, effectivePerformance: eff, pay, hours: job.shiftHours, cardio, legRecoveryCost: legCost,
    dayInputs: {
      jobHours,
      jobMet: ctx.P.economy[job.metKey],
      jobStrain: clamp(job.strain + JM.legStrainWeight.value * legCost, 0, 1),
      jobTissues: [...job.riskTissues],
      stressEvents: JM.stressEventScale.value * job.stress * (1 - eff),
    },
  };
}

/** True when the job has a shift on this day of the week (shifts fill the first days of the week). */
export function isShiftDay(jobId: JobId, day: number): boolean {
  return (day % 7) < jobDef(jobId).shiftsPerWeek;
}

/** Merge a resolved shift into DayInputs (cardio session appended, job fields overwritten). */
export function jobDayInputs<T extends DayInputs>(base: T, shift: ShiftResult): T {
  return { ...base, ...shift.dayInputs, sessions: shift.cardio ? [...base.sessions, shift.cardio] : base.sessions };
}
