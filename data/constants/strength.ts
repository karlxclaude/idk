// Strength expression and rep-max constants (spec 4.3, 5.2).
import { curve, design, k } from './define';

export const strengthDefs = {
  /** Exponent relating muscle mass to force capacity (3D mass -> 2D area). */
  massToForceExponent: k(0.667, 'exponent', [0.6, 0.75], 'M', ['jaric2002'], true, 'Allometric scaling ~0.67.'),
  /** 1RM multiplier at skill 0 (full skill = 1.0). */
  skillFloor: design(0.72, 'ratio', [0.6, 0.85], 'Unskilled lift expresses ~72% of skilled capacity.'),
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
  neuralDecayTauDays: k(120, 'days', [60, 240], 'M', ['bosquet2013', 'mujika2000'], false, 'Measurable loss at 8 weeks, far from total.'),
  /** Maintenance: weekly strength stimulus (in V0 units) that fully prevents neural decay. */
  maintenanceStimulusFraction: k(0.35, 'ratio', [0.2, 0.5], 'M', ['spiering2021', 'bickel2011'], true, 'One hard session/week maintains strength.'),
  /** Creatine: extra strength gain fraction over a training block (relative). */
  creatineStrengthBonus: k(0.08, 'ratio', [0.04, 0.12], 'M', ['rawsonVolek2003'], true, '+8% greater 1RM gain than placebo (20 vs 12%).'),
  /** Creatine: extra reps at a given load (relative). */
  creatineRepsBonus: k(0.14, 'ratio', [0.08, 0.2], 'M', ['rawsonVolek2003'], true, '+14% greater rep performance.'),
  /** Interference multiplier for strength at high endurance volume. */
  interferenceStrength: k(0.1, 'ratio', [0.0, 0.25], 'L', ['wilson2012', 'schumann2022'], true, 'Wilson ES 1.76->1.44; Schumann -0.06.'),
  /** Squat-to-bodyweight ratio above which strength transfer to sprint diminishes. */
  transferSaturationSquatBw: k(2.0, 'ratio', [1.6, 2.5], 'L', ['suchomel2016'], true, 'Diminishing transfer above ~2x BW squat.'),
} as const;

export const strengthCurves = {
  /** Age multiplier on neural/strength gain rate. */
  ageNeural: curve('strength.ageNeural', 'years', 'multiplier',
    [[18, 1.0, 1.0, 1.0], [40, 1.0, 0.9, 1.0], [55, 0.92, 0.8, 1.0], [65, 0.85, 0.7, 0.95]],
    'L', ['peterson2011', 'mitchell2012'], false, 'Older adults gain strength well; slightly slower.'),
} as const;
