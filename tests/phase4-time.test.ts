import { describe, expect, it } from 'vitest';
import {
  BLOCKS_PER_DAY, cookingTimeNeeded, defaultWeek, emptyDay, scheduleForDay, summarize, toDayInputsPatch, validateSchedule,
  type DaySchedule, type WeekTemplate,
} from '../engine/timeBudget';
import { DEFAULT_PARAMS } from '../data/constants';

const opts = { jobStartHour: 9, jobHours: 8, workDays: [0, 1, 2, 3, 4], trainingDays: [0, 2, 4], trainingStartHour: 17.5, sessionMinutes: 60, sleepHours: 8, bedHour: 23, cookMealsPerDay: 1 };

function sleepOnly(bed: number, wake: number): DaySchedule {
  const s = emptyDay();
  for (let b = 0; b < wake * 2; b++) s[b] = 'sleep';
  for (let b = bed * 2; b < BLOCKS_PER_DAY; b++) s[b] = 'sleep';
  return s;
}

describe('Phase 4: time budget', () => {
  it('default week has 7 full days that validate', () => {
    const w = defaultWeek(opts);
    expect(BLOCKS_PER_DAY).toBe((24 * 60) / DEFAULT_PARAMS.economy.blockMinutes);
    expect(w.base).toHaveLength(7);
    w.base.forEach((s, d) => {
      expect(s).toHaveLength(BLOCKS_PER_DAY);
      const work = opts.workDays.includes(d);
      const issues = validateSchedule(s, {
        jobHours: work ? opts.jobHours : 0,
        trainingMinutes: opts.trainingDays.includes(d) ? opts.sessionMinutes : 0,
        cookingMinutes: cookingTimeNeeded(opts.cookMealsPerDay) * DEFAULT_PARAMS.economy.blockMinutes,
      });
      expect(issues).toEqual([]);
      expect(summarize(s).sleepH).toBe(opts.sleepHours);
      expect(summarize(s).hours.work).toBe(work ? opts.jobHours : 0);
    });
  });

  it('rounds cooking time up to blocks', () => {
    expect(cookingTimeNeeded(0)).toBe(0);
    expect(cookingTimeNeeded(1)).toBe(Math.ceil(DEFAULT_PARAMS.economy.cookingMinPerMeal / DEFAULT_PARAMS.economy.blockMinutes));
    expect(cookingTimeNeeded(3)).toBe(Math.ceil((3 * DEFAULT_PARAMS.economy.cookingMinPerMeal) / DEFAULT_PARAMS.economy.blockMinutes));
  });

  it('computes overnight sleep wrap: 23:00-07:00 is 8 h with bedHour 23', () => {
    const s = sleepOnly(23, 7);
    const sum = summarize(s);
    expect(sum.sleepH).toBe(8);
    expect(sum.bedHour).toBe(23);
    // A different previous night shortens the wrapped part.
    const prev = emptyDay();
    expect(summarize(s, prev).sleepH).toBe(7);
  });

  it('per-day override replaces only that day', () => {
    const base = defaultWeek(opts).base;
    const alt = emptyDay();
    const t: WeekTemplate = { base, overrides: { 9: alt } };
    expect(scheduleForDay(t, 9)).toBe(alt);
    expect(scheduleForDay(t, 2)).toBe(base[2]);
    expect(scheduleForDay(t, 8)).toBe(base[1]);
    expect(scheduleForDay(t, 16)).toBe(base[2]);
  });

  it('flags overlapping demands and short sleep', () => {
    const issues = validateSchedule(emptyDay(), { jobHours: 12, trainingMinutes: 180, commuteMinutes: 180, cookingMinutes: 120, socialHours: 4 });
    const codes = issues.map((i) => i.code);
    expect(codes).toContain('overbooked');
    expect(codes).toContain('sleep');
    expect(codes).toContain('work');
    expect(codes).toContain('training');
    expect(validateSchedule(emptyDay().slice(0, 10), {}).map((i) => i.code)).toEqual(['length']);
  });

  it('social hours and sun propagate to the DayInputs patch', () => {
    const s = emptyDay();
    s[40] = 'social'; s[41] = 'social'; s[42] = 'social';
    s[24] = 'outdoor'; s[25] = 'outdoor'; // 12:00-13:00
    s[2] = 'commute'; // 01:00, never daylight
    const sum = summarize(s);
    const summer = toDayInputsPatch(sum, 6);
    const winter = toDayInputsPatch(sum, 12);
    expect(summer.socialHours).toBe(1.5);
    expect(summer.sunMinutes).toBe(2 * DEFAULT_PARAMS.economy.blockMinutes);
    expect(winter.sunMinutes).toBe(summer.sunMinutes);
    expect(summer).toHaveProperty('sleepH');
    expect(summer).toHaveProperty('bedHour');
    expect(summer).toHaveProperty('jobHours');
  });

  it('daylight shrinks in winter for dawn commutes', () => {
    const s = emptyDay();
    s[12] = 'commute'; // 06:00
    expect(toDayInputsPatch(summarize(s), 6).sunMinutes).toBe(DEFAULT_PARAMS.economy.blockMinutes);
    expect(toDayInputsPatch(summarize(s), 12).sunMinutes).toBe(0);
  });
});
