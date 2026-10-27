// Energy expenditure and body composition (spec 5.8, 5.9).
import { curve, design, k } from './define';

export const energyDefs = {
  /** Tissue-specific resting metabolic rates (kcal/kg/day). */
  rmrMuscle: k(13, 'kcal/kg/day', [12, 14], 'M', ['elia1992', 'wang2010'], true, 'Skeletal muscle.'),
  rmrAdipose: k(4.5, 'kcal/kg/day', [4, 5], 'M', ['elia1992', 'wang2010'], true, 'Adipose tissue.'),
  /** Organ + residual lean term for the reference 28 kg of non-muscle lean mass (liver, brain, heart, kidneys, residual). */
  rmrOrganRefKcal: k(1267, 'kcal/day', [1100, 1400], 'M', ['elia1992', 'wang2010', 'gallagher1998'], true,
    'Reference man: liver 1.8 kg x200, brain 1.4 x240, heart 0.33 x440, kidneys 0.31 x440, residual 24.2 kg x12.'),
  rmrOrganRefNonMuscleLeanKg: design(28, 'kg', [24, 32], 'Reference non-muscle lean mass.'),
  rmrOrganScalingExponent: design(0.6, 'exponent', [0.4, 0.8], 'Organs scale sub-linearly with body size (brain does not).'),
  /** Thermic effect of food by macronutrient (fraction of macro energy). */
  tefProtein: k(0.25, 'ratio', [0.2, 0.3], 'M', ['westerterp2004'], true, 'Protein 20-30%.'),
  tefCarb: k(0.075, 'ratio', [0.05, 0.1], 'M', ['westerterp2004'], true, 'Carbohydrate 5-10%.'),
  tefFat: k(0.02, 'ratio', [0.0, 0.03], 'M', ['westerterp2004'], true, 'Fat 0-3%.'),
  tefAlcohol: k(0.2, 'ratio', [0.1, 0.3], 'M', ['westerterp2004'], true, 'Alcohol high DIT.'),
  /** EPOC as a fraction of exercise energy cost. */
  epocFraction: k(0.1, 'ratio', [0.06, 0.15], 'M', ['laforgia2006'], true, '6-15% of net exercise cost.'),
  /** NEAT baseline (kcal/day) for a sedentary adult before job/activity. */
  neatBase: design(350, 'kcal/day', [200, 600], 'Fidgeting, posture, daily movement.'),
  /** NEAT responsiveness to energy surplus (kcal NEAT per kcal surplus), population mean. */
  neatResponsivenessMean: k(0.33, 'ratio', [0.2, 0.5], 'H', ['levine1999'], true,
    'NEAT change -98 to +692 kcal/day on a +1000 kcal/day overfeed (2/3 of TDEE increase).'),
  neatResponsivenessSd: k(0.22, 'ratio', [0.15, 0.3], 'H', ['levine1999', 'bouchard1990'], true, 'Range -0.1 to +0.7.'),
  /** NEAT suppression in a deficit (fraction of NEAT lost at -1000 kcal/day). */
  neatDeficitSuppression: k(0.3, 'ratio', [0.15, 0.45], 'L', ['rosenbaumLeibel2010', 'martins2020'], true, 'Adaptive thermogenesis mostly via reduced NEAT.'),
  /** Adaptive thermogenesis: max fraction of TDEE reduced beyond tissue-predicted after sustained deficit. */
  adaptiveThermogenesisMax: k(0.07, 'ratio', [0.03, 0.12], 'L', ['rosenbaumLeibel2010', 'martins2020'], true,
    'Rosenbaum 10-15%; Martins argues smaller. Default 5-10%.'),
  adaptiveThermogenesisTauDays: design(30, 'days', [14, 60], 'Builds up over weeks of deficit; reverses on refeeding.'),
  /** Constrained energy expenditure: fraction of activity energy above the threshold that is offset. */
  constrainedTeeOffset: k(0.15, 'ratio', [0.0, 0.3], 'L', ['pontzer2016'], true, 'Mild version of the constrained model.'),
  constrainedTeeThresholdKcal: design(900, 'kcal/day', [600, 1500], 'Activity energy above which constraint applies.'),
  /** Energy densities of tissue change. */
  kcalPerKgFat: k(9440, 'kcal/kg', [9300, 9500], 'H', ['hall2008'], true, 'Fat mass.'),
  kcalPerKgLean: k(1816, 'kcal/kg', [1700, 1900], 'H', ['hall2008'], true, 'Lean mass (mostly water + protein).'),
  /** Forbes constant: dFFM/dFM = C / FM. */
  forbesC: k(10.4, 'kg', [9, 12], 'M', ['hall2007'], true, 'Leaner people lose more lean mass.'),
  /** Lean sparing in a deficit from resistance training (fraction of Forbes lean loss prevented at full stimulus). */
  leanSparingTraining: k(0.6, 'ratio', [0.4, 0.8], 'M', ['garthe2011', 'helms2014', 'murphyKoehler2022'], true, 'Training largely preserves lean mass in moderate deficits.'),
  /** Additional lean sparing from protein >= 1.6 g/kg (fraction). */
  leanSparingProtein: k(0.25, 'ratio', [0.1, 0.4], 'M', ['helms2014', 'morton2018'], true, 'High protein spares lean in a deficit.'),
  /** Lean sparing penalty from short sleep: 5.5 h vs 8.5 h raised FFM loss 60%. */
  sleepLeanLossMultiplier: k(1.6, 'multiplier', [1.3, 2.0], 'H', ['nedeltcheva2010'], true, 'FFM loss +60% with 5.5 h sleep.'),
  sleepFatLossMultiplier: k(0.45, 'multiplier', [0.3, 0.7], 'H', ['nedeltcheva2010'], true, 'Fat loss -55% with 5.5 h sleep (energy shifted toward lean loss).'),
  /** Weekly loss rate (fraction of BW) above which extra lean loss accrues. */
  safeLossRatePerWeek: k(0.01, 'ratio/week', [0.005, 0.015], 'M', ['helms2014', 'garthe2011'], true, '0.5-1%/week preserves muscle better.'),
  fastLossLeanPenalty: design(0.5, 'ratio', [0.2, 1.0], 'Extra lean fraction per unit of loss rate above the safe rate.'),
  /** Water stored per gram of glycogen. */
  waterPerGlycogen: k(3, 'g/g', [2.5, 4], 'M', ['fernandezElias2015'], true, '~3 g water per g glycogen.'),
  /** Water retained per gram of sodium above baseline intake (kg per g). */
  waterPerSodiumG: design(0.15, 'kg/g', [0.05, 0.3], 'Sodium shifts extracellular water.'),
  /** Baseline (reference) sodium intake, g/day. */
  sodiumRefG: design(3.0, 'g/day', [2, 4], 'Typical intake ~3.4 g.'),
  /** Essential fat mass fraction floor (men / women). */
  essentialFatMen: design(0.04, 'ratio', [0.03, 0.05], 'Essential fat ~3-5%.'),
  essentialFatWomen: design(0.11, 'ratio', [0.09, 0.13], 'Essential fat ~10-13%.'),
  /** Fraction of surplus energy (after hypertrophy) stored as lean (Forbes) vs fat in untrained surplus. */
  surplusLeanFractionNoTraining: k(0.3, 'ratio', [0.2, 0.4], 'H', ['bouchard1990', 'hall2007'], true, 'Twins study: ~1/3 of gain was lean.'),
  /** Muscle protein energy cost: kcal of surplus needed per kg of muscle gained (energy + protein). */
  kcalPerKgMuscleGain: k(2000, 'kcal/kg', [1800, 2800], 'M', ['hall2008', 'slater2019'], true, '1,816 kcal/kg lean energy density plus synthesis cost.'),
  /** BMR genetic SD (fraction). */
  bmrGeneticSd: k(0.065, 'ratio', [0.05, 0.08], 'L', ['mifflin1990'], true, '+/-5-8% from predicted.'),
  /** Fraction of fat lost from the trunk vs limbs varies by genetics; visual only. */
  fatDistributionAndroidMen: design(0.55, 'ratio', [0.4, 0.7], 'Men store more trunk fat.'),
  fatDistributionAndroidWomen: design(0.4, 'ratio', [0.3, 0.55], 'Women store more gluteofemoral fat.'),
  /** Daily scale weight noise SD (kg). */
  scaleNoiseSd: k(0.7, 'kg', [0.5, 1.0], 'M', ['fernandezElias2015'], false, 'Day-to-day water, gut content.'),
  /** Measurement error SDs (body fat % points). */
  dxaErrorSd: k(1.5, '%points', [1, 2], 'M', ['toombs2012'], false, 'DXA +/-1-2%.'),
  biaErrorSd: k(4, '%points', [3, 5], 'M', ['toombs2012'], false, 'BIA +/-3-5%.'),
  skinfoldErrorSd: k(3.5, '%points', [3, 4], 'M', ['toombs2012'], false, 'Skinfold/tape +/-3-4%.'),
  /** 1RM estimate error SD (fraction) at 1 rep and per extra rep. */
  e1rmErrorBase: design(0.02, 'ratio', [0.01, 0.04], 'Direct 1RM tests have small error.'),
  e1rmErrorPerRep: design(0.006, 'ratio/rep', [0.003, 0.012], 'Estimated 1RM error grows with reps.'),
  /** VO2max test error SDs (fraction). */
  vo2LabErrorSd: design(0.03, 'ratio', [0.02, 0.05], 'Lab test.'),
  vo2FieldErrorSd: design(0.08, 'ratio', [0.05, 0.12], 'Field test (Cooper, beep).'),
} as const;

export const energyCurves = {
  /** Hunger multiplier vs energy balance (kcal/day). */
  hungerBalance: curve('energy.hungerBalance', 'kcal/day', 'ratio',
    [[-1000, 1.0, 0.8, 1.0], [-500, 0.7, 0.5, 0.9], [-250, 0.5, 0.3, 0.7], [0, 0.3, 0.2, 0.45], [500, 0.15, 0.05, 0.3]],
    'HEUR', ['nedeltcheva2010', 'holt1995'], false, 'Hunger rises in deficit (HEUR shape); satiety modifies.'),
} as const;
