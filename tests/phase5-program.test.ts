import { describe, expect, it } from 'vitest';
import { makeContext } from '../engine/context';
import { adaptationProfile, interferenceWarnings, previewWeek, systemicLoad, volumeWarnings, weeklyEffectiveSets } from '../engine/programPreview';
import { EASY_RUN, FULL_BODY_WEEK, PLYO_WEEK, weekOf } from '../data/programs';
import type { LiftPrescription, Session } from '../engine/types';

const ctx = makeContext();
const lift = (exs: LiftPrescription[], startHour = 17): Session => ({ kind: 'lift', startHour, exercises: exs });
const legDay = (hour: number) => lift([{ exerciseId: 'back_squat_high_bar', sets: 4, reps: 8, targetRir: 2, restS: 180 }], hour);

describe('program preview', () => {
  it('full-body template gives effective sets on quads, chest and back', () => {
    const s = weeklyEffectiveSets(ctx, FULL_BODY_WEEK);
    expect(s.vasti).toBeGreaterThan(4);
    expect(s.midLowerChest).toBeGreaterThan(4);
    expect(s.lats).toBeGreaterThan(4);
  });

  it('doubling sets raises hypertrophy by less than 2x', () => {
    const wk = (n: number) => weekOf({ 0: [lift([{ exerciseId: 'leg_extension', sets: n, reps: 10, targetRir: 1, restS: 120 }])], 3: [lift([{ exerciseId: 'barbell_curl', sets: n, reps: 10, targetRir: 1, restS: 120 }])] });
    const a = adaptationProfile(ctx, wk(4)).hypertrophy;
    const b = adaptationProfile(ctx, wk(8)).hypertrophy;
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(2 * a);
  });

  it('a run 1 h after legs warns; a 9 h gap does not', () => {
    const close = weekOf({ 0: [legDay(17), EASY_RUN(60, 18)] });
    const far = weekOf({ 0: [legDay(17), EASY_RUN(60, 8)] });
    expect(interferenceWarnings(ctx, close).some((w) => w.kind === 'interference-timing' && /Schumann 2022/.test(w.message))).toBe(true);
    expect(interferenceWarnings(ctx, far).some((w) => w.kind === 'interference-timing')).toBe(false);
  });

  it('a pure plyo week scores higher on jump and power than hypertrophy', () => {
    const p = adaptationProfile(ctx, PLYO_WEEK);
    expect(p.jump).toBeGreaterThan(p.hypertrophy);
    expect(p.power).toBeGreaterThan(p.hypertrophy);
  });

  it('RIR-5 sets give fewer effective sets than RIR-1', () => {
    const wk = (rir: number) => weekOf({ 0: [lift([{ exerciseId: 'bench_press', sets: 4, reps: 8, targetRir: rir, restS: 150 }])] });
    expect(weeklyEffectiveSets(ctx, wk(5)).midLowerChest).toBeLessThan(weeklyEffectiveSets(ctx, wk(1)).midLowerChest);
  });

  it('flags low and excessive volume, and systemic load is positive', () => {
    const few = weekOf({ 0: [lift([{ exerciseId: 'barbell_curl', sets: 2, reps: 10, targetRir: 1, restS: 90 }])] });
    expect(volumeWarnings(ctx, few).some((w) => w.kind === 'low-volume' && w.muscle === 'biceps')).toBe(true);
    const many = weekOf({ 0: [lift([{ exerciseId: 'barbell_curl', sets: 14, reps: 10, targetRir: 0, restS: 90 }])], 3: [lift([{ exerciseId: 'barbell_curl', sets: 14, reps: 10, targetRir: 0, restS: 90 }])] });
    expect(volumeWarnings(ctx, many).some((w) => w.kind === 'high-volume' && w.muscle === 'biceps')).toBe(true);
    const l = systemicLoad(ctx, FULL_BODY_WEEK);
    expect(l.weeklyTotal).toBeGreaterThan(0);
    expect(l.perDay).toHaveLength(7);
    expect(l.perDay[1]?.minutes).toBe(0);
    expect(l.perDay[0]?.minutes).toBeGreaterThan(30);
  });

  it('consecutive-day training of one muscle warns', () => {
    const wk = weekOf({ 0: [legDay(17)], 1: [legDay(17)] });
    expect(interferenceWarnings(ctx, wk).some((w) => w.kind === 'consecutive-days' && w.muscle === 'vasti')).toBe(true);
  });

  it('is deterministic', () => {
    expect(previewWeek(ctx, FULL_BODY_WEEK)).toEqual(previewWeek(makeContext(), FULL_BODY_WEEK));
  });
});
