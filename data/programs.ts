// Standard training programs used by benchmarks, archetype defaults and the UI's starter templates.
import type { LiftPrescription, Session } from '../engine/types';

const L = (exerciseId: string, sets: number, reps: number, targetRir: number, restS = 150, extra: Partial<LiftPrescription> = {}): LiftPrescription => ({ exerciseId, sets, reps, targetRir, restS, ...extra });

/** Full-body A/B, 3 days/week. ~12-18 effective sets per major muscle per week. Good-conditions benchmark program. */
export const FULL_BODY_A: Session = {
  kind: 'lift', startHour: 17,
  exercises: [
    L('back_squat_high_bar', 4, 8, 2, 180), L('bench_press', 4, 8, 2, 180), L('barbell_row', 3, 10, 2), L('romanian_deadlift', 3, 10, 2),
    L('overhead_press', 2, 10, 2), L('barbell_curl', 3, 12, 1, 90), L('overhead_cable_triceps', 3, 12, 1, 90), L('db_lateral_raise', 3, 15, 1, 60),
    L('standing_calf_raise', 3, 12, 1, 90), L('plank', 2, 1, 2, 60),
  ],
};
export const FULL_BODY_B: Session = {
  kind: 'lift', startHour: 17,
  exercises: [
    L('leg_press', 3, 10, 2), L('incline_db_press', 3, 10, 2), L('lat_pulldown', 3, 10, 2), L('seated_leg_curl', 3, 12, 1, 90),
    L('hip_thrust', 3, 10, 2), L('leg_extension', 2, 12, 1, 90), L('cable_row', 3, 12, 2), L('incline_db_curl', 2, 12, 1, 90),
    L('triceps_pushdown', 2, 12, 1, 90), L('db_lateral_raise', 2, 15, 1, 60),
  ],
};

/** Weekly schedule helper: sessions on the given weekday indices (0 = Mon). */
export function weekOf(sessionsByDay: Record<number, Session[]>): Array<{ sessions: Session[] }> {
  return Array.from({ length: 7 }, (_, i) => ({ sessions: sessionsByDay[i] ?? [] }));
}

export const FULL_BODY_WEEK = weekOf({ 0: [FULL_BODY_A], 2: [FULL_BODY_B], 4: [FULL_BODY_A] });
export const FULL_BODY_WEEK_ALT = weekOf({ 0: [FULL_BODY_B], 2: [FULL_BODY_A], 4: [FULL_BODY_B] });

/** Elbow-flexor-only program modelled on Hubal 2005 (12 weeks, 2x/week, progressive). */
export const ARM_ONLY: Session = { kind: 'lift', startHour: 17, exercises: [L('barbell_curl', 4, 10, 1, 120), L('incline_db_curl', 3, 10, 1, 120)] };
export const ARM_ONLY_WEEK = weekOf({ 1: [ARM_ONLY], 4: [ARM_ONLY] });

/** Volume-dose programs: 4 / 10 / 20 weekly sets for quads (leg extension) and biceps (curl), 2 days/week. */
export function volumeWeek(setsPerWeek: number): Array<{ sessions: Session[] }> {
  const perSession = setsPerWeek / 2;
  const s: Session = { kind: 'lift', startHour: 17, exercises: [L('leg_extension', perSession, 10, 1, 150), L('barbell_curl', perSession, 10, 1, 150)] };
  return weekOf({ 1: [s], 4: [s] });
}

/** Load comparison: sets to failure at a fixed %1RM. */
export function loadWeek(pct: number, sets: number): Array<{ sessions: Session[] }> {
  const s: Session = {
    kind: 'lift', startHour: 17,
    exercises: [
      { exerciseId: 'leg_press', sets, pct1rm: pct, targetRir: 0, restS: 150 },
      { exerciseId: 'barbell_curl', sets, pct1rm: pct, targetRir: 0, restS: 150 },
    ],
  };
  return weekOf({ 0: [s], 2: [s], 4: [s] });
}

export const PLYO_SESSION: Session = {
  kind: 'plyo', startHour: 17,
  exercises: [
    { exerciseId: 'pogo_hops', sets: 3, reps: 15, targetRir: 4, restS: 90 },
    { exerciseId: 'countermovement_jump', sets: 4, reps: 5, targetRir: 4, restS: 120 },
    { exerciseId: 'box_jump', sets: 3, reps: 5, targetRir: 4, restS: 120 },
    { exerciseId: 'depth_jump_40', sets: 3, reps: 5, targetRir: 4, restS: 150 },
  ],
};
export const PLYO_WEEK = weekOf({ 1: [PLYO_SESSION], 4: [PLYO_SESSION] });

export const EASY_RUN = (minutes: number, startHour = 7): Session => ({ kind: 'cardio', startHour, exerciseId: 'easy_run', minutes, zone: 1 });
export const TEMPO_RUN = (minutes: number, startHour = 7): Session => ({ kind: 'cardio', startHour, exerciseId: 'tempo_run', minutes, zone: 2 });
export const INTERVALS_4X4: Session = { kind: 'cardio', startHour: 7, exerciseId: 'norwegian_4x4', minutes: 38, zone: 3 };

/** Beginner endurance plan: 4 runs/week ~3 h total with one interval session. */
export const CARDIO_WEEK = weekOf({ 0: [EASY_RUN(40)], 2: [TEMPO_RUN(30)], 4: [INTERVALS_4X4], 5: [EASY_RUN(60)] });
/** High-volume trained runner: ~6 h/week. */
export const RUNNER_WEEK = weekOf({ 0: [EASY_RUN(60)], 1: [TEMPO_RUN(45)], 2: [EASY_RUN(50)], 3: [INTERVALS_4X4], 4: [EASY_RUN(45)], 5: [EASY_RUN(100)] });
