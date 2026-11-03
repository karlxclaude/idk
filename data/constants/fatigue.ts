// Systemic fatigue, readiness, sleep, stress, overreaching (spec 5.4).
import { curve, design, k } from './define';

export const fatigueDefs = {
  /** Banister fitness time constant (days), population mean. */
  fitnessTauDays: k(42, 'days', [30, 50], 'M', ['banister1975', 'busso2003'], true, 'Individualised as genetics.'),
  /** Banister fatigue time constant (days), population mean. */
  fatigueTauDays: k(10, 'days', [5, 15], 'M', ['banister1975', 'busso2003'], true, 'Individualised as genetics.'),
  /** Fatigue gain relative to fitness gain (k2/k1) at moderate load. */
  fatigueGainRatio: k(1.8, 'ratio', [1.2, 3.0], 'M', ['busso2003'], true, 'Fatigue impulse is larger but decays faster.'),
  /** Fatigue gain rises with load: k2 scales by (1 + fatigueLoadExponent * (load/refLoad - 1)) above refLoad. */
  fatigueLoadExponent: k(0.5, 'ratio', [0.2, 1.0], 'M', ['busso2003'], true, 'Variable dose-response.'),
  /** Reference daily systemic load (impulse units) at which fatigue gain is nominal. */
  refDailyLoad: design(12, 'impulse', [6, 24], 'About one hard full-body session.'),
  /** Readiness weight of normalised systemic fatigue. */
  readinessFatigueWeight: design(0.35, 'ratio', [0.2, 0.5], 'Readiness = 1 - sum of weighted deficits.'),
  /** Readiness weight of sleep debt (per hour of debt, capped). */
  readinessSleepDebtPerHour: k(0.05, '1/h', [0.03, 0.08], 'M', ['craven2022', 'mah2011'], true, 'Sleep loss cut performance ~7.6%; extension improved sprint 4%.'),
  readinessSleepDebtCapH: design(8, 'h', [4, 14], 'Cap on counted sleep debt.'),
  /** Readiness weight of stress (0-1). */
  readinessStressWeight: k(0.12, 'ratio', [0.05, 0.25], 'M', ['stultsKolehmainen2014'], true, 'Stress slows recovery of muscular function.'),
  /** Readiness weight of average local muscle damage (0-1). */
  readinessDamageWeight: design(0.25, 'ratio', [0.1, 0.4], 'Sore legs reduce whole-body readiness.'),
  /** Readiness weight of illness severity. */
  readinessIllnessWeight: design(0.5, 'ratio', [0.3, 0.8], 'Illness reduces readiness substantially.'),
  /** Sleep need (h) for a full night of recovery. */
  sleepNeedH: k(8.0, 'h', [7, 9], 'M', ['mah2011', 'milewski2014'], true, '7-9 h recommended; 8 h for athletes.'),
  /** Sleep debt decay per night (fraction of debt repaid by sleeping more than need). */
  sleepDebtDecay: design(0.5, 'ratio', [0.3, 0.8], 'Sleep debt is a rolling balance.'),
  sleepDebtMaxH: design(20, 'h', [10, 40], 'Maximum tracked sleep debt.'),
  /** Caffeine elimination half-life (h), population mean. */
  caffeineHalfLifeH: k(5, 'h', [3, 8], 'M', ['drake2013', 'guest2021'], true, 'Varies with CYP1A2 genotype.'),
  /** Sleep lost (h) per 100 mg caffeine remaining in the body at bedtime. */
  caffeineSleepLossPer100mg: k(0.5, 'h/100mg', [0.3, 0.8], 'M', ['drake2013'], true,
    '400 mg at 6 h before bed (~175 mg remaining) cut sleep >1 h.'),
  /** Stress recovery: fraction of stress dissipated per day baseline. */
  stressDecayPerDay: design(0.15, '1/day', [0.08, 0.3], 'Stress is a slow-moving state.'),
  /** Stress reduction from an hour of social/leisure activity. */
  stressReliefPerSocialHour: design(0.04, '1/h', [0.02, 0.08], 'Social activities reduce stress.'),
  /** Stress multiplier on local recovery rate (at stress 1). */
  stressRecoveryPenalty: k(0.25, 'ratio', [0.1, 0.4], 'M', ['stultsKolehmainen2014'], true, 'Higher stress -> slower MIF recovery over 96 h.'),
  /** Overreaching: fatigue/fitness ratio above which functional overreaching accumulates. */
  forThreshold: design(1.3, 'ratio', [1.1, 1.6], 'Functional overreaching band.'),
  /** Days above threshold before non-functional overreaching sets in. */
  nforDays: k(21, 'days', [14, 35], 'M', ['meeusen2013'], true, 'Weeks of sustained overload with poor recovery.'),
  /** Days in NFOR with continued abuse before overtraining syndrome. */
  otsDays: k(70, 'days', [42, 120], 'M', ['meeusen2013'], true, 'OTS is rare; months to recover.'),
  /** Adaptation multiplier during NFOR. */
  nforAdaptationMultiplier: design(0.5, 'multiplier', [0.2, 0.7], 'Blunted adaptation when overreached.'),
  /** Adaptation multiplier during OTS. */
  otsAdaptationMultiplier: design(0.15, 'multiplier', [0.0, 0.4], 'Near-zero adaptation during OTS.'),
  /** Days of reduced load needed to exit NFOR / OTS (time constants). */
  nforRecoveryDays: k(21, 'days', [14, 42], 'M', ['meeusen2013'], true, 'Weeks.'),
  otsRecoveryDays: k(120, 'days', [60, 240], 'M', ['meeusen2013'], true, 'Months.'),
  /** Readiness penalty while overreached. */
  nforReadinessPenalty: design(0.15, 'ratio', [0.05, 0.3], 'NFOR state reduces readiness.'),
  /** Supercompensation bonus after functional overreaching is resolved (multiplier on fitness pool). */
  forSupercompensation: design(0.03, 'ratio', [0.0, 0.08], 'Small supercompensation after a planned overreach.'),
  /** Local damage recovery multiplier at readiness 1 vs 0.5. */
  localRecoverySleepWeight: k(0.3, 'ratio', [0.1, 0.5], 'M', ['lamon2021'], true, 'Sleep affects local recovery.'),
  /** Illness: baseline daily probability. */
  illnessBaseDaily: design(0.004, '1/day', [0.001, 0.01], '~1.5 colds per year.'),
  /** Illness probability multiplier at zero readiness/high stress (open-window effect). */
  illnessStressMultiplier: design(2.5, 'multiplier', [1.5, 4], 'Low readiness and high stress raise illness risk.'),
  illnessDurationDays: design(5, 'days', [3, 10], 'Typical cold.'),
} as const;

export const fatigueCurves = {
  /** Acute performance multiplier vs previous night's sleep (h). */
  acuteSleepPerformance: curve('fatigue.acuteSleepPerformance', 'h', 'multiplier',
    [[0, 0.88, 0.8, 0.95], [4, 0.93, 0.88, 0.98], [6, 0.97, 0.94, 1.0], [7.5, 1.0, 1.0, 1.0], [10, 1.01, 1.0, 1.03]],
    'M', ['craven2022', 'mah2011'], true, 'Sleep loss <=6 h: -7.6% mean; extension +4% sprint.'),
} as const;
