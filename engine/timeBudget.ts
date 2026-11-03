// Time budget: 24 h a day in blockMinutes blocks. Schedules summarize into DayInputs fields
// (sleep, bed hour, job hours, social hours, sun minutes). All tunables live in data/constants/economy.ts.
import { DEFAULT_PARAMS } from '../data/constants';
import type { DayInputs } from './types';

export type Activity = 'sleep' | 'work' | 'commute' | 'training' | 'cooking' | 'shopping' | 'social' | 'recovery' | 'free' | 'outdoor';
export const ACTIVITIES: readonly Activity[] = ['sleep', 'work', 'commute', 'training', 'cooking', 'shopping', 'social', 'recovery', 'free', 'outdoor'];

const E = DEFAULT_PARAMS.economy;
const MIN_PER_H = 60;
const H_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;

export const BLOCK_MINUTES: number = E.blockMinutes;
export const BLOCKS_PER_HOUR: number = MIN_PER_H / E.blockMinutes;
export const BLOCKS_PER_DAY: number = H_PER_DAY * BLOCKS_PER_HOUR;

export type DaySchedule = Activity[];
export interface WeekTemplate {
  base: DaySchedule[];
  /** Absolute day index -> schedule replacing the base day. */
  overrides?: Record<number, DaySchedule>;
}

export const minutesToBlocks = (min: number): number => Math.ceil(min / BLOCK_MINUTES);
export const hourToBlock = (h: number): number => Math.round(h * BLOCKS_PER_HOUR);
const wrap = (i: number): number => ((i % BLOCKS_PER_DAY) + BLOCKS_PER_DAY) % BLOCKS_PER_DAY;

export function emptyDay(): DaySchedule {
  return Array.from({ length: BLOCKS_PER_DAY }, () => 'free' as Activity);
}

export function scheduleForDay(t: WeekTemplate, day: number): DaySchedule {
  const o = t.overrides?.[day];
  if (o) return o;
  return t.base[((day % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK] ?? emptyDay();
}

/** Blocks needed to cook the given number of meals (rounded up). */
export function cookingTimeNeeded(mealsCooked: number): number {
  return minutesToBlocks(Math.max(0, mealsCooked) * E.cookingMinPerMeal);
}

export interface ScheduleDemand {
  /** Planned training minutes (sum of sessions). */
  trainingMinutes?: number;
  jobHours?: number;
  /** Minimum sleep in hours (defaults to the sleepMinHours constant). */
  minSleepH?: number;
  commuteMinutes?: number;
  cookingMinutes?: number;
  shoppingMinutes?: number;
  socialHours?: number;
}
export interface ScheduleIssue {
  code: 'length' | 'training' | 'work' | 'sleep' | 'overbooked' | 'commute' | 'cooking';
  message: string;
}

const count = (s: DaySchedule, a: Activity): number => s.filter((x) => x === a).length;

export function validateSchedule(s: DaySchedule, required: ScheduleDemand = {}): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  if (s.length !== BLOCKS_PER_DAY) {
    issues.push({ code: 'length', message: `schedule has ${s.length} blocks, expected ${BLOCKS_PER_DAY}` });
    return issues;
  }
  if (required.trainingMinutes !== undefined && count(s, 'training') < minutesToBlocks(required.trainingMinutes)) {
    issues.push({ code: 'training', message: `training blocks ${count(s, 'training')} < required ${minutesToBlocks(required.trainingMinutes)}` });
  }
  if (required.jobHours !== undefined && count(s, 'work') !== hourToBlock(required.jobHours)) {
    issues.push({ code: 'work', message: `work blocks ${count(s, 'work')} != job shift ${hourToBlock(required.jobHours)}` });
  }
  if (required.commuteMinutes !== undefined && count(s, 'commute') < minutesToBlocks(required.commuteMinutes)) {
    issues.push({ code: 'commute', message: `commute blocks ${count(s, 'commute')} < required ${minutesToBlocks(required.commuteMinutes)}` });
  }
  if (required.cookingMinutes !== undefined && count(s, 'cooking') < minutesToBlocks(required.cookingMinutes)) {
    issues.push({ code: 'cooking', message: `cooking blocks ${count(s, 'cooking')} < required ${minutesToBlocks(required.cookingMinutes)}` });
  }
  const minSleep = required.minSleepH ?? E.sleepMinHours;
  if (summarize(s).sleepH < minSleep) issues.push({ code: 'sleep', message: `sleep ${summarize(s).sleepH} h < minimum ${minSleep} h` });
  const demandedH =
    (required.trainingMinutes ?? 0) / MIN_PER_H + (required.jobHours ?? 0) + minSleep + (required.commuteMinutes ?? 0) / MIN_PER_H +
    (required.cookingMinutes ?? 0) / MIN_PER_H + (required.shoppingMinutes ?? 0) / MIN_PER_H + (required.socialHours ?? 0);
  if (demandedH > H_PER_DAY) issues.push({ code: 'overbooked', message: `demands total ${demandedH.toFixed(1)} h > ${H_PER_DAY} h` });
  return issues;
}

export interface DaySummary {
  hours: Record<Activity, number>;
  /** Night sleep hours including the wrap from the previous day's tail. */
  sleepH: number;
  /** Start hour of the longest sleep run (0..24), wrapping across midnight. */
  bedHour: number;
  /** Blocks (indices) that are outdoor or commute, for daylight filtering. */
  sunBlocks: number[];
  /** Outdoor + commute minutes in daylight for `month`; all such minutes if month is omitted. */
  sunMinutes: number;
  socialHours: number;
  jobHours: number;
}

/** Fraction of the way from winter to summer daylight for a month (0 in the solstice month, 1 six months later). */
function summerWeight(month: number): number {
  const d = Math.abs(month - E.daylightSolsticeMonthWinter);
  return Math.min(d, MONTHS_PER_YEAR - d) / (MONTHS_PER_YEAR / 2);
}

/** Daylight window in hours for a month (1..12). */
export function daylightHours(month: number): { start: number; end: number } {
  const w = summerWeight(month);
  return {
    start: E.daylightStartHourWinter + (E.daylightStartHourSummer - E.daylightStartHourWinter) * w,
    end: E.daylightEndHourWinter + (E.daylightEndHourSummer - E.daylightEndHourWinter) * w,
  };
}

function sunMinutesFor(blocks: number[], month?: number): number {
  let n = 0;
  const d = month === undefined ? undefined : daylightHours(month);
  for (const b of blocks) {
    const h = b / BLOCKS_PER_HOUR;
    if (!d || (h >= d.start && h < d.end)) n += BLOCK_MINUTES;
  }
  return n;
}

/**
 * Summarize a day. `prev` is the previous day's schedule (defaults to `s`, i.e. a repeating day) so the
 * overnight sleep run spanning midnight is counted whole.
 */
export function summarize(s: DaySchedule, prev: DaySchedule = s, month?: number): DaySummary {
  const hours = Object.fromEntries(ACTIVITIES.map((a) => [a, count(s, a) / BLOCKS_PER_HOUR])) as Record<Activity, number>;
  const ext = [...prev, ...s];
  let bestLen = 0;
  let bestStart = 0;
  let i = 0;
  while (i < ext.length) {
    if (ext[i] !== 'sleep') { i++; continue; }
    let j = i;
    while (j < ext.length && ext[j] === 'sleep') j++;
    // Only runs that touch today's blocks count; ties prefer the later (night-before-wake) run.
    if (j > BLOCKS_PER_DAY && j - i >= bestLen) { bestLen = j - i; bestStart = i; }
    i = j;
  }
  const sunBlocks: number[] = [];
  s.forEach((a, b) => { if (a === 'outdoor' || a === 'commute') sunBlocks.push(b); });
  return {
    hours,
    sleepH: bestLen / BLOCKS_PER_HOUR,
    bedHour: bestLen ? (bestStart % BLOCKS_PER_DAY) / BLOCKS_PER_HOUR : 0,
    sunBlocks,
    sunMinutes: sunMinutesFor(sunBlocks, month),
    socialHours: hours.social,
    jobHours: hours.work,
  };
}

export function toDayInputsPatch(summary: DaySummary, month: number): Partial<DayInputs> {
  return {
    sleepH: summary.sleepH,
    bedHour: summary.bedHour,
    socialHours: summary.socialHours,
    sunMinutes: sunMinutesFor(summary.sunBlocks, month),
    jobHours: summary.jobHours,
  };
}

export interface DefaultWeekOpts {
  jobStartHour: number;
  jobHours: number;
  /** Day-of-week indices (0..6) with a shift. */
  workDays: number[];
  trainingDays: number[];
  trainingStartHour: number;
  sessionMinutes: number;
  sleepHours: number;
  bedHour: number;
  cookMealsPerDay: number;
}

/** Fill `n` free blocks starting at `start`, skipping occupied blocks and wrapping at midnight. */
function place(s: DaySchedule, a: Activity, start: number, n: number): void {
  let left = n;
  for (let k = 0; k < BLOCKS_PER_DAY && left > 0; k++) {
    const b = wrap(start + k);
    if (s[b] === 'free') { s[b] = a; left--; }
  }
}

export function defaultWeek(o: DefaultWeekOpts): WeekTemplate {
  const commute = minutesToBlocks(E.commuteDefaultMin);
  const base: DaySchedule[] = [];
  for (let d = 0; d < DAYS_PER_WEEK; d++) {
    const s = emptyDay();
    place(s, 'sleep', hourToBlock(o.bedHour), hourToBlock(o.sleepHours));
    if (o.workDays.includes(d) && o.jobHours > 0) {
      const w = hourToBlock(o.jobStartHour);
      const n = hourToBlock(o.jobHours);
      place(s, 'work', w, n);
      place(s, 'commute', w - commute, commute);
      place(s, 'commute', w + n, commute);
    }
    if (o.trainingDays.includes(d)) place(s, 'training', hourToBlock(o.trainingStartHour), minutesToBlocks(o.sessionMinutes));
    place(s, 'cooking', hourToBlock(E.cookStartHour), cookingTimeNeeded(o.cookMealsPerDay));
    if (d === E.shoppingDay) place(s, 'shopping', hourToBlock(E.shoppingStartHour), minutesToBlocks(DEFAULT_PARAMS.economy.shoppingMinPerWeek));
    place(s, 'outdoor', hourToBlock(E.outdoorStartHour), E.outdoorBlocksPerDay);
    place(s, 'recovery', hourToBlock(E.recoveryStartHour), E.recoveryBlocksPerDay);
    place(s, 'social', hourToBlock(E.socialStartHour), E.socialBlocksPerDay);
    base.push(s);
  }
  return { base };
}
