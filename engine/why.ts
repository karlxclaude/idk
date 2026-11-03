// "Why?" panel: explains a metric change in terms of the factor multipliers recorded in DayReport.
//
// Method (multiplicative attribution). Every adaptation rate in the sim is (base rate) x product of factor
// multipliers (hypMods, readinessFactors, ...). For a window of days, factor f with multiplier m_f(d) on day d and
// stimulus weight w(d) (sets / response / cardio minutes: how much the day "mattered" for the metric) gets
//   effect_f = sum_d w(d) * (m_f(d) - 1) / sum_d w(d)
// i.e. the stimulus-weighted mean fractional change of the rate versus a neutral (all-ones) day. Days without
// stimulus carry no weight; if no day had stimulus, days are weighted equally. Because the rate is a product, the
// factors combine as sums of logs: logEffect_f = weighted mean of ln(m_f), and totalEffectPct = (exp(sum logEffect) - 1).
// effectPct (linear) is what the sentence quotes; logEffect is what adds up across factors.
import { modelDefs } from '../data/constants/model';
import { MUSCLE_REGIONS } from '../data/muscles';
import type { DayLog } from './game';
import type { DayReport } from './types';

const MIN_EFFECT_PCT = modelDefs.whyMinEffectPct.value;
const MAX_IN_SENTENCE = modelDefs.whyMaxFactorsInSentence.value;
const DAY_TOP = modelDefs.whyDayTopFactors.value;
const PCT = 100;

/** Friendly phrases. Negative phrase is used when the factor reduces the rate, positive when it boosts it. */
export const FACTOR_LABELS: Record<string, { label: string; low: string; high: string }> = {
  protein: { label: 'Protein intake', low: 'low protein', high: 'protein distribution' },
  energyBalance: { label: 'Energy balance', low: 'a calorie deficit', high: 'a calorie surplus' },
  sleep: { label: 'Sleep', low: 'short sleep', high: 'good sleep' },
  stress: { label: 'Stress', low: 'high stress', high: 'low stress' },
  age: { label: 'Age', low: 'age', high: 'youth' },
  alcohol: { label: 'Alcohol', low: 'alcohol', high: 'no alcohol' },
  creatine: { label: 'Creatine', low: 'no creatine', high: 'creatine' },
  energyAvailability: { label: 'Energy availability', low: 'low energy availability', high: 'ample energy availability' },
  overreach: { label: 'Overreaching', low: 'overreaching', high: 'a fresh training state' },
  interferenceHyp: { label: 'Cardio interference', low: 'concurrent cardio interference', high: 'no cardio interference' },
  interferenceStr: { label: 'Cardio interference', low: 'concurrent cardio interference', high: 'no cardio interference' },
  interferencePow: { label: 'Cardio interference', low: 'concurrent cardio interference', high: 'no cardio interference' },
  vitaminD: { label: 'Vitamin D', low: 'low vitamin D', high: 'vitamin D sufficiency' },
  fatIntake: { label: 'Dietary fat', low: 'too little dietary fat', high: 'enough dietary fat' },
  systemicFatigue: { label: 'Training fatigue', low: 'accumulated training fatigue', high: 'low fatigue' },
  sleepDebt: { label: 'Sleep debt', low: 'sleep debt', high: 'no sleep debt' },
  lastNightSleep: { label: 'Last night sleep', low: 'a poor night of sleep', high: 'a good night of sleep' },
  soreness: { label: 'Muscle soreness', low: 'muscle soreness', high: 'no soreness' },
  illness: { label: 'Illness', low: 'illness', high: 'health' },
};

const HYP_FACTORS = ['protein', 'energyBalance', 'sleep', 'stress', 'age', 'alcohol', 'creatine', 'energyAvailability', 'overreach', 'interferenceHyp', 'vitaminD', 'fatIntake'];
const STRENGTH_FACTORS = ['sleep', 'stress', 'interferenceStr', 'energyAvailability', 'overreach'];
const POWER_FACTORS = ['sleep', 'energyAvailability', 'overreach', 'interferencePow'];
const AEROBIC_FACTORS = ['sleep', 'stress', 'energyAvailability', 'overreach'];
const READINESS_FACTORS = ['systemicFatigue', 'sleepDebt', 'lastNightSleep', 'stress', 'soreness', 'illness', 'overreaching'];

type Source = 'hypMods' | 'readinessFactors';
type Weight = 'muscle' | 'sets' | 'cardio' | 'day';

interface MetricDef {
  label: string;
  unit: string;
  source: Source | null;
  factors: string[];
  weight: Weight;
}

export const METRICS: Record<string, MetricDef> = {
  leanMass: { label: 'Lean mass', unit: 'kg', source: 'hypMods', factors: HYP_FACTORS, weight: 'muscle' },
  muscle: { label: 'Muscle mass (per region: muscle:<region>)', unit: 'kg', source: 'hypMods', factors: HYP_FACTORS, weight: 'muscle' },
  strength: { label: 'Strength (per lift: strength:<liftId>)', unit: 'kg', source: 'hypMods', factors: STRENGTH_FACTORS, weight: 'sets' },
  e1rm: { label: 'Estimated 1RM (mean of main lifts)', unit: 'kg', source: 'hypMods', factors: STRENGTH_FACTORS, weight: 'sets' },
  vo2max: { label: 'VO2max', unit: 'ml/kg/min', source: 'hypMods', factors: AEROBIC_FACTORS, weight: 'cardio' },
  readiness: { label: 'Readiness', unit: '', source: 'readinessFactors', factors: READINESS_FACTORS, weight: 'day' },
  cmj: { label: 'Countermovement jump', unit: 'm', source: 'hypMods', factors: POWER_FACTORS, weight: 'sets' },
  // Energy partitioning (fat / total mass) records no multipliers in DayReport.
  fatMass: { label: 'Fat mass', unit: 'kg', source: null, factors: [], weight: 'day' },
  bodyMass: { label: 'Body mass', unit: 'kg', source: null, factors: [], weight: 'day' },
};

/** Metrics for which DayReport carries no factor breakdown. */
export const METRICS_WITHOUT_FACTORS = Object.keys(METRICS).filter((m) => METRICS[m]?.source === null);

export interface WhyFactor {
  name: string;
  label: string;
  /** Stimulus-weighted mean of (multiplier - 1), in percent: negative = reduced the rate, positive = boosted it. */
  effectPct: number;
  /** Stimulus-weighted mean of ln(multiplier); logEffects add across factors. */
  logEffect: number;
  detail: string;
}

export interface WhyResult {
  metric: string;
  change: number;
  unit: string;
  factors: WhyFactor[];
  /** Combined effect of all factors on the rate, percent ((exp(sum of logs) - 1) * 100). */
  totalEffectPct: number;
  sentence: string;
}

function parseMetric(metric: string): { base: string; arg: string | null } {
  const i = metric.indexOf(':');
  return i < 0 ? { base: metric, arg: null } : { base: metric.slice(0, i), arg: metric.slice(i + 1) };
}

function nearestLog(history: DayLog[], day: number): DayLog | undefined {
  let best: DayLog | undefined;
  for (const h of history) if (!best || Math.abs(h.day - day) < Math.abs(best.day - day)) best = h;
  return best;
}

function measure(reports: DayReport[], history: DayLog[], base: string, arg: string | null, from: number, to: number): number {
  const a = nearestLog(history, from);
  const b = nearestLog(history, to);
  if (base === 'muscle') {
    let sum = 0;
    for (const r of reports) {
      if (r.day < from || r.day > to) continue;
      for (const [m, v] of Object.entries(r.muscleStim)) if (arg === null || m === arg) sum += v?.deltaKg ?? 0;
    }
    return sum;
  }
  if (!a || !b) return 0;
  switch (base) {
    case 'leanMass': return b.bodyMass * (1 - b.bodyFat) - a.bodyMass * (1 - a.bodyFat);
    case 'fatMass': return b.bodyMass * b.bodyFat - a.bodyMass * a.bodyFat;
    case 'bodyMass': return b.bodyMass - a.bodyMass;
    case 'readiness': return b.readiness - a.readiness;
    case 'vo2max': return b.vo2maxRel - a.vo2maxRel;
    case 'cmj': return (b.cmj ?? a.cmj ?? 0) - (a.cmj ?? b.cmj ?? 0);
    case 'strength': return arg ? (b.lifts[arg] ?? 0) - (a.lifts[arg] ?? 0) : 0;
    case 'e1rm': {
      const ids = Object.keys(b.lifts);
      return ids.length ? ids.reduce((x, id) => x + (b.lifts[id] ?? 0) - (a.lifts[id] ?? 0), 0) / ids.length : 0;
    }
    default: return 0;
  }
}

function weightOf(r: DayReport, w: Weight, arg: string | null): number {
  switch (w) {
    case 'muscle': {
      let sum = 0;
      for (const [m, v] of Object.entries(r.muscleStim)) if (arg === null || m === arg) sum += v?.response ?? 0;
      return sum;
    }
    case 'sets': return r.sets.length;
    case 'cardio': return r.cardioMinutes;
    default: return 1;
  }
}

function describe(f: WhyFactor, defKey: string): string {
  const l = FACTOR_LABELS[defKey];
  return `${l?.label ?? defKey}: ${f.effectPct >= 0 ? '+' : ''}${f.effectPct.toFixed(1)}% on the rate`;
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

export function explainChange(reports: DayReport[], history: DayLog[], metric: string, fromDay: number, toDay: number): WhyResult {
  const { base, arg } = parseMetric(metric);
  const def = METRICS[base];
  const days = toDay - fromDay;
  if (!def) return { metric, change: 0, unit: '', factors: [], totalEffectPct: 0, sentence: `Unknown metric "${metric}".` };
  if (base === 'muscle' && arg !== null && !(MUSCLE_REGIONS as readonly string[]).includes(arg)) {
    return { metric, change: 0, unit: def.unit, factors: [], totalEffectPct: 0, sentence: `Unknown muscle region "${arg}".` };
  }
  const change = measure(reports, history, base, arg, fromDay, toDay);
  const name = def.label.replace(/ \(.*\)$/, '');
  if (def.source === null) {
    return { metric, change, unit: def.unit, factors: [], totalEffectPct: 0, sentence: `${name} changed ${change.toFixed(1)} ${def.unit} over these ${days} days; its drivers are not decomposed into factors in the daily report.` };
  }
  const win = reports.filter((r) => r.day >= fromDay && r.day <= toDay);
  let weights = win.map((r) => weightOf(r, def.weight, arg));
  if (!weights.some((w) => w > 0)) weights = win.map(() => 1);
  const wTot = weights.reduce((x, y) => x + y, 0);
  const factors: WhyFactor[] = [];
  const keyOf: Record<string, string> = {};
  if (wTot > 0) {
    for (const key of def.factors) {
      let lin = 0;
      let lg = 0;
      let seen = false;
      win.forEach((r, i) => {
        const m = (r[def.source as Source] as Record<string, number>)[key];
        if (typeof m !== 'number' || !(m > 0)) return;
        seen = true;
        lin += (weights[i] as number) * (m - 1);
        lg += (weights[i] as number) * Math.log(m);
      });
      if (!seen) continue;
      const f: WhyFactor = { name: key, label: FACTOR_LABELS[key]?.label ?? key, effectPct: (lin / wTot) * PCT, logEffect: lg / wTot, detail: '' };
      f.detail = describe(f, key);
      factors.push(f);
      keyOf[key] = key;
    }
  }
  factors.sort((x, y) => Math.abs(y.effectPct) - Math.abs(x.effectPct));
  const totalEffectPct = (Math.exp(factors.reduce((x, f) => x + f.logEffect, 0)) - 1) * PCT;
  const sig = factors.filter((f) => Math.abs(f.effectPct) >= MIN_EFFECT_PCT);
  const noun = base === 'leanMass' || base === 'muscle' ? 'Muscle gain' : name;
  const down = sig.filter((f) => f.effectPct < 0).slice(0, MAX_IN_SENTENCE).map((f) => `${Math.round(-f.effectPct)}% by ${FACTOR_LABELS[f.name]?.low ?? f.name}`);
  const up = sig.filter((f) => f.effectPct > 0).slice(0, MAX_IN_SENTENCE).map((f) => `${Math.round(f.effectPct)}% by ${FACTOR_LABELS[f.name]?.high ?? f.name}`);
  let sentence: string;
  if (!down.length && !up.length) sentence = `${noun} over these ${days} days was not meaningfully affected by any recorded factor.`;
  else {
    const parts: string[] = [];
    if (down.length) parts.push(`reduced ${joinList(down)}`);
    if (up.length) parts.push(`boosted ${joinList(up)}`);
    sentence = `${noun} over these ${days} days was ${parts.join('; ')}.`;
  }
  return { metric, change, unit: def.unit, factors, totalEffectPct, sentence };
}

export interface DayExplanation {
  day: number;
  readiness: WhyFactor[];
  hypertrophy: WhyFactor[];
  performance: WhyFactor[];
}

/** Top factors (largest absolute deviation from neutral) for one day, in three areas. */
export function explainDay(report: DayReport): DayExplanation {
  const top = (src: Record<string, number>, keys: string[]): WhyFactor[] =>
    keys
      .filter((k) => typeof src[k] === 'number' && (src[k] as number) > 0)
      .map((k) => {
        const m = src[k] as number;
        const f: WhyFactor = { name: k, label: FACTOR_LABELS[k]?.label ?? k, effectPct: (m - 1) * PCT, logEffect: Math.log(m), detail: '' };
        f.detail = describe(f, k);
        return f;
      })
      .filter((f) => Math.abs(f.effectPct) >= MIN_EFFECT_PCT)
      .sort((a, b) => Math.abs(b.effectPct) - Math.abs(a.effectPct))
      .slice(0, DAY_TOP);
  const perf = Array.from(new Set([...STRENGTH_FACTORS, ...POWER_FACTORS, ...AEROBIC_FACTORS]));
  return {
    day: report.day,
    readiness: top(report.readinessFactors, READINESS_FACTORS),
    hypertrophy: top(report.hypMods, HYP_FACTORS),
    performance: top(report.hypMods, perf),
  };
}
