// Genetic / anthropometric distributions (spec 6).
import { design, k } from './define';

export const geneticsDefs = {
  /** Height (cm) NHANES 2015-2018 adults. */
  heightMeanMen: k(175.3, 'cm', [174, 177], 'H', ['fryar2021'], false, 'US men 20+.'),
  heightSdMen: k(7.4, 'cm', [6.5, 8], 'H', ['fryar2021'], false, 'SD.'),
  heightMeanWomen: k(161.3, 'cm', [160, 163], 'H', ['fryar2021'], false, 'US women 20+.'),
  heightSdWomen: k(6.9, 'cm', [6, 7.5], 'H', ['fryar2021'], false, 'SD.'),
  /** Winter segment proportions (fraction of height). */
  thighFraction: k(0.245, 'ratio', [0.23, 0.26], 'M', ['winter2009'], false, 'Greater trochanter to knee.'),
  shankFraction: k(0.246, 'ratio', [0.23, 0.26], 'M', ['winter2009'], false, 'Knee to ankle.'),
  upperArmFraction: k(0.186, 'ratio', [0.17, 0.2], 'M', ['winter2009'], false, 'Shoulder to elbow.'),
  forearmFraction: k(0.146, 'ratio', [0.13, 0.16], 'M', ['winter2009'], false, 'Elbow to wrist.'),
  torsoFraction: k(0.288, 'ratio', [0.27, 0.31], 'M', ['winter2009'], false, 'Hip to shoulder.'),
  footHeightFraction: k(0.039, 'ratio', [0.03, 0.05], 'M', ['winter2009'], false, 'Ankle height.'),
  /** Individual segment ratio variation (SD as fraction of segment). */
  segmentSd: k(0.04, 'ratio', [0.03, 0.05], 'L', ['winter2009'], false, '+/-3-5%.'),
  /** Leverage exponent clamp (per-exercise effect of segment ratios). */
  leverageClamp: design(0.15, 'ratio', [0.1, 0.2], 'Leverage effects clamped to +/-15%.'),
  /** Vastus lateralis type I fibre %: mean, SD, clamp. */
  typeIMean: k(50, '%', [45, 55], 'M', ['simoneauBouchard1989'], true, 'Mean ~50%.'),
  typeISd: k(13, '%', [10, 16], 'M', ['simoneauBouchard1989'], true, 'CV ~30%.'),
  typeIMin: k(15, '%', [15, 15], 'M', ['simoneauBouchard1989'], true, 'Observed range 15-85.'),
  typeIMax: k(85, '%', [85, 85], 'M', ['simoneauBouchard1989'], true, 'Observed range 15-85.'),
  /** Responder multipliers: lognormal sigma and cross-correlation. */
  responderSigmaStrength: k(0.6, 'ln-sd', [0.4, 0.8], 'H', ['hubal2005'], true, '1RM change CV ~1.0; 0-250%.'),
  responderCorrelation: design(0.4, 'r', [0.2, 0.6], 'Hypertrophy, strength and aerobic responsiveness partly correlated.'),
  /** Moment arm (insertion) variation SD (fraction). */
  momentArmSd: k(0.05, 'ratio', [0.03, 0.08], 'L', ['winter2009'], false, '+/-10% range; no effect on hypertrophy rate.'),
  /** Frame: wrist circumference SD (cm) and its effect on the muscle ceiling per cm. */
  wristCircMeanMen: design(17.0, 'cm', [16, 18], 'Typical.'),
  wristCircMeanWomen: design(15.0, 'cm', [14, 16], 'Typical.'),
  wristCircSd: design(1.0, 'cm', [0.7, 1.3], 'Frame variation.'),
  frameCeilingPerCm: design(0.3, 'kg/m2 per cm', [0.1, 0.5], 'HEUR: larger frame raises Mmax.'),
  /** Banister time constants: individual SD as fraction of mean. */
  banisterTauSd: design(0.2, 'ratio', [0.1, 0.3], 'Recovery genetics.'),
  /** Tendon stiffness genetic SD (fraction). */
  tendonStiffnessSd: design(0.12, 'ratio', [0.05, 0.2], 'Tissue quality.'),
  /** Caffeine half-life lognormal sigma (CYP1A2). */
  caffeineHalfLifeSigma: k(0.35, 'ln-sd', [0.2, 0.5], 'L', ['guest2021'], true, 'Fast vs slow metabolisers.'),
  /** ACTN3 XX genotype frequency and its tiny effect on power. */
  actn3XxFrequency: k(0.18, 'ratio', [0.1, 0.25], 'L', ['yang2003'], true, '~18% in Europeans.'),
  actn3XxPowerPenalty: k(0.02, 'ratio', [0.0, 0.04], 'L', ['yang2003'], true, 'Tiny effect.'),
  /** Starting body fat distributions (fraction), untrained. */
  bodyFatMeanMen: design(0.2, 'ratio', [0.15, 0.25], 'Untrained young men.'),
  bodyFatSdMen: design(0.05, 'ratio', [0.03, 0.07], 'Spread.'),
  bodyFatMeanWomen: design(0.3, 'ratio', [0.25, 0.35], 'Untrained young women.'),
  bodyFatSdWomen: design(0.05, 'ratio', [0.03, 0.07], 'Spread.'),
  /** Untrained FFMI distribution (men/women) mean and SD. */
  ffmiUntrainedMeanMen: k(18.5, 'kg/m2', [18, 20], 'M', ['schutz2002'], true, 'Schutz population median ~18.9 includes heavier adults; lean untrained beginners ~18.5.'),
  ffmiUntrainedSdMen: design(1.1, 'kg/m2', [0.8, 1.5], 'Spread.'),
  ffmiUntrainedMeanWomen: k(15.4, 'kg/m2', [14.5, 16.5], 'M', ['schutz2002'], true, 'Schutz: ~15.4.'),
  ffmiUntrainedSdWomen: design(1.0, 'kg/m2', [0.7, 1.4], 'Spread.'),
  /** Age effects on recovery: local recovery multiplier at 60 vs 25. */
  recoveryAt60: design(0.8, 'ratio', [0.65, 0.95], 'Slower recovery with age [L].'),
  /** Sex: baseline hemoglobin handled in aerobic; menstrual effect size on performance. */
  menstrualEffect: k(0.01, 'ratio', [0.0, 0.02], 'M', ['mcnulty2020'], true, 'Trivial (ES -0.06); optional and small.'),
} as const;
