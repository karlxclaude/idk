// Strength expression and rep-max constants (spec 4.3, 5.2).
import { curve, design, k } from './define';

export const strengthDefs = {
  /** Exponent relating muscle mass to force capacity (3D mass -> 2D area). */
  massToForceExponent: k(0.667, 'exponent', [0.6, 0.75], 'M', ['jaric2002'], true, 'Allometric scaling ~0.67.'),
  /** 1RM multiplier at skill 0 (full skill = 1.0). */
  skillFloor: design(0.88, 'ratio', [0.6, 0.95], 'Unskilled lift expresses ~88% of skilled capacity; skill learns in weeks.'),
  /**
   * Max contribution of the slow "neuromuscular quality" pool to 1RM: factor = 1 + gain * pool.
   * Lumps neural drive, specific tension, lateral force transmission and architecture: everything that makes
   * strength rise 2-5x faster than CSA (Hubal 2005; Mitchell 2012).
   */
  neuralQualityGainMax: k(0.5, 'ratio', [0.3, 1.1], 'HEUR', ['hubal2005', 'moritaniDeVries1979', 'openpowerlifting'], false,
    'Sized so a natural lifter at the muscle ceiling reaches ~2.5-2.7x untrained 1RM.'),
  /** Early neural adaptation: median max 1RM gain, between-person spread, and time constant. */
  neuralFastGainMedian: k(0.1, 'ratio', [0.05, 0.25], 'M', ['moritaniDeVries1979', 'seynnes2007'], false, 'Neural factors dominate the first 3-5 weeks: MVC +39% vs CSA +6.5% in 35 days (Seynnes 2007).'),
  neuralFastGainSigma: k(0.45, 'ln-sd', [0.2, 0.8], 'H', ['hubal2005'], false, 'Multiplies responderStr; together they reproduce 1RM changes from ~0 to >+150% in novices.'),
  neuralFastTauDays: k(18, 'days', [10, 30], 'M', ['moritaniDeVries1979'], false, 'Weeks.'),
  neuralFastQualitySaturation: design(0.6, 'ratio', [0.3, 1.0], 'Load quality at which the fast pool fully saturates (lighter training saturates it less).'),
  /** Regain multiplier on the neuromuscular pool when below its previous high-water mark. */
  neuralMemoryMultiplier: k(2.0, 'multiplier', [1.0, 3.0], 'L', ['ogasawara2013', 'mujika2000'], false, 'Strength is regained faster than first built.'),
  /** Exponent of the strength responder multiplier on skill learning rate. */
  skillResponderExponent: design(1.0, 'exponent', [0.3, 1.0], 'Low strength responders also learn technique more slowly (Hubal: some subjects gained ~0% 1RM).'),
  /** Weekly strength-stimulus saturation for skill load specificity: skill learned at light loads transfers less to 1RM. */
  skillLoadSpecificity: design(0.5, 'ratio', [0.0, 1.0], 'Skill gain rate x (1 - s + s * strLoad quality).'),
  /** Time constant (days) of the neuromuscular-quality pool under full weekly strength stimulus. */
  neuralQualityTauDays: k(500, 'days', [300, 800], 'HEUR', ['moritaniDeVries1979', 'hubal2005'], false,
    'With skill learning, gives +20-50% on main lifts in 12 weeks and continued strength gains after hypertrophy slows.'),
  /** Readiness penalty on 1RM at readiness 0 (linear). */
  readinessStrengthPenalty: k(0.12, 'ratio', [0.05, 0.2], 'M', ['craven2022', 'moranNavarro2017'], true,
    'Sleep loss cut performance ~7.6% on average; heavy fatigue reduces more.'),
  /** Strength bonus per +0.1 type-II fraction above 0.5 (and penalty below). */
  fiberStrengthPerTenth: k(0.015, 'ratio', [0.0, 0.03], 'L', ['simoneauBouchard1989', 'costill1976'], false, 'Small effect of fibre type on max force.'),
  /** Reps-at-%1RM modifier per +0.1 type-II fraction (negative: fewer reps). */
  fiberRepsPerTenth: k(-0.04, 'ratio', [-0.08, 0.0], 'L', ['simoneauBouchard1989'], false, 'Type-II dominant lifters get fewer reps at a given %.'),
  /** Reps-at-%1RM multiplier for women vs men. */
  femaleRepsMultiplier: k(1.1, 'multiplier', [1.0, 1.2], 'M', ['hunter2014'], true, 'Women are more fatigue resistant at matched relative intensity.'),
  /** Reps-at-%1RM multiplier for lower-body / machine exercises (applied via exercise.repsModifier). */
  lowerBodyRepsMultiplier: k(1.15, 'multiplier', [1.05, 1.3], 'M', ['shimano2006'], true, 'Squat allows more reps at 60-90% than bench or curl.'),
  /** Weight on Epley (vs Brzycki) in the base reps model. */
  epleyWeight: design(0.5, 'ratio', [0, 1], 'Average of the two classic formulas.'),
  /** Detraining grace period (days) before neural strength starts to decay. */
  neuralGraceDays: k(18, 'days', [14, 24], 'M', ['bosquet2013', 'spiering2021'], true, 'Strength largely maintained ~3 weeks.'),
  /** Neural decay time constant (days) after the grace period. */
  neuralDecayTauDays: k(90, 'days', [60, 240], 'M', ['bosquet2013', 'mujika2000'], false, 'Measurable loss at 8 weeks, far from total.'),
  /** Maintenance: weekly strength stimulus (in V0 units) that fully prevents neural decay. */
  maintenanceStimulusFraction: k(0.35, 'ratio', [0.2, 0.5], 'M', ['spiering2021', 'bickel2011'], true, 'One hard session/week maintains strength.'),
  /** Creatine: acute 1RM increase when saturated (PCr availability). */
  creatineAcuteStrength: k(0.04, 'ratio', [0.02, 0.06], 'M', ['kreider2017', 'rawsonVolek2003'], true, 'Part of the +8 percentage-point 1RM gain vs placebo (20 vs 12%).'),
  /** Creatine: multiplier on neuromuscular adaptation rate when saturated (training quality). */
  creatineAdaptationBonus: k(0.35, 'ratio', [0.0, 0.6], 'M', ['rawsonVolek2003'], false, 'Calibrated so creatine adds ~8 percentage points of 1RM gain over ~12 weeks on average.'),
  /** Creatine: extra reps at a given load (relative). */
  creatineRepsBonus: k(0.14, 'ratio', [0.08, 0.2], 'M', ['rawsonVolek2003'], true, '+14% greater rep performance.'),
  /** Interference multiplier for strength at high endurance volume. */
  interferenceStrength: k(0.1, 'ratio', [0.0, 0.25], 'L', ['wilson2012', 'schumann2022'], true, 'Wilson ES 1.76->1.44; Schumann -0.06.'),
} as const;

export const strengthCurves = {
  /** Age multiplier on neural/strength gain rate. */
  ageNeural: curve('strength.ageNeural', 'years', 'multiplier',
    [[18, 1.0, 1.0, 1.0], [40, 1.0, 0.9, 1.0], [55, 0.92, 0.8, 1.0], [65, 0.85, 0.7, 0.95]],
    'L', ['peterson2011', 'mitchell2012'], false, 'Older adults gain strength well; slightly slower.'),
} as const;
