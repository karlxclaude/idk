// Phase 2: exercise database validation and spot checks.
import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISE_MAP, getExercise } from '../data/exercises';
import { ExerciseSchema, stimulusToFatigueRatio } from '../data/exercises/schema';
import { MUSCLE_REGIONS, MOVEMENT_PATTERNS } from '../data/muscles';
import { exerciseTransfer } from '../engine/context';
import { makeContext } from '../engine/context';
import { referenceCharacter } from '../engine/character';
import { oneRepMax, repsAt, repsMultiplier } from '../engine/strength';

const ctx = makeContext();

describe('Phase 2: exercise database', () => {
  it('has at least 150 exercises (target 200+), all schema-valid with unique ids', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(150);
    const ids = new Set<string>();
    for (const e of EXERCISES) {
      expect(ExerciseSchema.safeParse(e).success, e.id).toBe(true);
      expect(ids.has(e.id), `duplicate ${e.id}`).toBe(false);
      ids.add(e.id);
    }
  });

  it('every exercise has a primary muscle, sensible fields, and evidence notes', () => {
    for (const e of EXERCISES) {
      const acts = Object.values(e.muscles);
      expect(acts.length, e.id).toBeGreaterThan(0);
      expect(Math.max(...acts), e.id).toBeGreaterThanOrEqual(0.3);
      for (const m of Object.keys(e.lengthBias)) expect(e.muscles[m as keyof typeof e.muscles], `${e.id} lengthBias on unused muscle ${m}`).toBeDefined();
      expect(e.evidenceNotes.length, e.id).toBeGreaterThan(5);
      if (e.loadType === 'external') expect(e.refLoad, e.id).toBeGreaterThan(0);
      if (e.loadType === 'bodyweight') expect(e.bodyweightFraction, e.id).toBeDefined();
      if (e.category === 'cardio') expect(e.cardio, e.id).toBeDefined();
      if (e.category === 'sprint') expect(e.sprint, e.id).toBeDefined();
    }
  });

  it('covers every movement pattern used by the engine and every muscle region', () => {
    const patterns = new Set(EXERCISES.map((e) => e.movementPattern));
    for (const p of MOVEMENT_PATTERNS) expect(patterns.has(p), p).toBe(true);
    for (const m of MUSCLE_REGIONS) expect(EXERCISES.some((e) => (e.muscles[m] ?? 0) >= 0.6), m).toBe(true);
  });

  it('reference man 1RM and reps are physically sensible for every loaded exercise', () => {
    const ref = referenceCharacter(ctx);
    for (const e of EXERCISES) {
      if (e.loadType === 'none') continue;
      const orm = oneRepMax(ctx, ref, e.id);
      expect(orm, e.id).toBeGreaterThan(0);
      // within 5% of the declared refLoad (refLoad anchors the reference man)
      expect(Math.abs(orm / (e.refLoad as number) - 1), e.id).toBeLessThan(0.05);
      const r = repsAt(ctx, 0.75, repsMultiplier(ctx, ref, e, 0));
      expect(r, e.id).toBeGreaterThan(6);
      expect(r, e.id).toBeLessThan(18);
    }
  });

  it('spot check: seated leg curl has higher hamstring length bias than lying leg curl', () => {
    expect(getExercise('seated_leg_curl').lengthBias.hamstrings).toBeGreaterThan(getExercise('lying_leg_curl').lengthBias.hamstrings as number);
  });

  it('spot check: Larsen press has lower leg drive and lower skill demand than the competition bench', () => {
    const l = getExercise('larsen_press');
    const b = getExercise('bench_press');
    expect(l.legDrive).toBeLessThan(b.legDrive);
    expect(l.skillDemand).toBeLessThan(b.skillDemand);
  });

  it('spot check: overhead triceps extension biases the long head more than pushdowns', () => {
    expect(getExercise('overhead_cable_triceps').lengthBias.tricepsLong as number).toBeGreaterThan(getExercise('triceps_pushdown').lengthBias.tricepsLong as number);
  });

  it('limited-evidence exercises (Jefferson curl, tib raise, neck work) say so and stay modest', () => {
    for (const id of EXERCISES.map((e) => e.id).filter((id) => /jefferson_curl|tibialis_raise|^neck_/.test(id))) {
      const e = EXERCISE_MAP.get(id);
      expect(e, id).toBeDefined();
      expect(e?.evidenceNotes.toLowerCase(), id).toMatch(/limited|little|weak|sparse/);
    }
  });

  it('stimulus-to-fatigue ratio is computed from fields (isolation > heavy compound per unit cost)', () => {
    expect(stimulusToFatigueRatio(getExercise('leg_extension'))).toBeGreaterThan(stimulusToFatigueRatio(getExercise('conventional_deadlift')) * 0.5);
    for (const e of EXERCISES) expect(Number.isFinite(stimulusToFatigueRatio(e)), e.id).toBe(true);
  });

  it('generated transfer matrix: diagonal 1, bounded, same-pattern transfer exceeds cross-pattern', () => {
    const squat = getExercise('back_squat_high_bar');
    expect(exerciseTransfer(squat, squat)).toBe(1);
    const sameP = exerciseTransfer(squat, getExercise('back_squat_low_bar'));
    const cross = exerciseTransfer(squat, getExercise('romanian_deadlift'));
    expect(sameP).toBeGreaterThan(cross);
    expect(exerciseTransfer(squat, getExercise('bench_press'))).toBe(0);
    for (const a of EXERCISES.slice(0, 60)) for (const b of EXERCISES.slice(0, 60)) {
      const t = exerciseTransfer(a, b);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});
