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
  // --- Character creator slider bounds (engine/creator.ts) ---
  creatorAgeMin: design(18, 'years', [18, 18], 'Creator slider: adults only.'),
  creatorAgeMax: design(65, 'years', [60, 70], 'Creator slider upper age.'),
  creatorAgeDefault: design(25, 'years', [18, 40], 'Creator slider default.'),
  creatorYearsMax: design(30, 'years', [20, 47], 'Creator slider max for lifting/endurance training history.'),
  creatorSegmentRange: design(0.06, 'ratio', [0.03, 0.1], 'Segment-ratio multipliers span 1 +/- 6% (about 1.5 SD of segmentSd).'),
  creatorMultStep: design(0.01, 'ratio', [0.005, 0.02], 'Slider step for ratio multipliers.'),
  creatorBodyFatStep: design(0.005, 'ratio', [0.001, 0.01], 'Slider step for body fat fraction.'),
  creatorMultiplierMin: design(0.4, 'ratio', [0.2, 0.6], 'Lower clamp for custom-lab responder and proneness multipliers.'),
  creatorMultiplierMax: design(2.5, 'ratio', [2, 4], 'Upper clamp for custom-lab responder and proneness multipliers.'),
  // --- Lab tests (engine/labTests.ts) ---
  labBiopsyTypeISd: design(4, '%points', [2, 8], 'HEUR: single vastus lateralis needle biopsy sampling error in type I %; sampled-site variation is a few points.'),
  labVo2ErrorSd: design(0.03, 'ratio', [0.02, 0.05], 'HEUR: laboratory VO2max test-retest error, about 3% of the value.'),
  labDxaLeanErrorSd: design(0.02, 'ratio', [0.01, 0.03], 'HEUR: DXA lean mass relative error (fat error is energy.dxaErrorSd).'),
  labCeilingNoiseSd: design(0.5, 'kg/m2', [0.25, 1], 'HEUR: uncertainty of the ceiling estimate read out by DXA after sufficient training.'),
  labCeilingMinTrainingHours: design(200, 'h', [100, 400], 'HEUR: about 2 years of training (sessionsPerYear x ~1 h) before the FFMI ceiling is readable; below this only current FFMI is reported.'),
  labFerritinMgPerNgMl: design(10, 'mg per ng/mL', [8, 12], 'Conversion implied by nutrition.ironStoreDeficientMg (300 mg ~ ferritin 30 ng/mL).'),
  labFerritinNoiseCv: design(0.1, 'ratio', [0.05, 0.2], 'HEUR: assay plus biological day-to-day variation in ferritin.'),
  labVitDNoiseCv: design(0.08, 'ratio', [0.04, 0.15], 'HEUR: 25(OH)D assay variation.'),
  labResponseNoiseSd: design(0.35, 'ratio', [0.2, 0.6], 'HEUR: polygenic/DNA panels predict training response poorly; the readout has large noise around the true multiplier.'),
  labBmrNoiseSd: design(0.05, 'ratio', [0.02, 0.1], 'HEUR: indirect calorimetry variation in the BMR factor readout.'),
  labResponseProfileCost: design(300, 'USD', [100, 600], 'Consumer genetic + metabolic panel (no economy constant exists).'),
} as const;
