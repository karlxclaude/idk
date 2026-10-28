// Aerobic system (spec 5.7).
import { curve, design, k } from './define';

export const aerobicDefs = {
  /** Untrained VO2max (mL/kg/min) men in their 20s (ACSM 50th percentile approx). */
  vo2BaseMen20s: k(42, 'mL/kg/min', [38, 45], 'M', ['acsm2021', 'milanovic2015'], false, 'Milanovic pooled baseline 40.8.'),
  vo2BaseWomen20s: k(34, 'mL/kg/min', [30, 36], 'M', ['acsm2021'], false, 'ACSM norms.'),
  /** Fraction of VO2max difference attributable to haemoglobin mass (men ~12% higher). */
  hbMassSexDiff: k(0.12, 'ratio', [0.08, 0.15], 'M', ['schmidtPrommer2010'], true, 'Men have ~12% higher Hb concentration.'),
  /** Haemoglobin mass per kg body mass, men. */
  hbMassPerKgMen: k(11, 'g/kg', [9, 13], 'M', ['schmidtPrommer2010'], true, '~750-850 g in 75 kg men.'),
  hbMassPerKgWomen: k(9.5, 'g/kg', [8, 11.5], 'M', ['schmidtPrommer2010'], true, '~12% lower.'),
  /** Elasticity of VO2max with respect to haemoglobin mass. */
  vo2HbElasticity: k(0.8, 'exponent', [0.5, 1.0], 'M', ['schmidtPrommer2010'], true, '~4 mL/min per g Hb.'),
  /** Trainable gain ceiling for an average responder: ceiling = baseline * (1 + vo2TrainableFraction). */
  vo2TrainableFraction: k(0.45, 'ratio', [0.3, 0.7], 'M', ['bouchard1999', 'joynerCoyle2008'], true,
    'Average long-term trainability ~+40-50%; short-term +15-20% over 3-6 months.'),
  /** Lognormal sigma of aerobic responder multiplier (applied to rate and partly to ceiling). */
  responderSigma: k(0.5, 'ln-sd', [0.35, 0.7], 'H', ['bouchard1999'], true, 'Response from ~0 to >1 L/min; heritability 47%.'),
  /** Base daily approach rate toward the VO2max ceiling at full stimulus. */
  kAerPerDay: k(0.0075, '1/day', [0.004, 0.012], 'M', ['milanovic2015', 'bouchard1999'], false,
    'Calibrated: 12 weeks of moderate training +10-20%.'),
  /** Weekly aerobic load (zone-weighted minutes) saturation constant. */
  v0AerobicLoad: k(240, 'weighted min/week', [150, 400], 'M', ['seiler2010', 'milanovic2015'], false, 'Diminishing returns beyond ~4 h/week of weighted work.'),
  /** Zone weights (stimulus per minute) for VO2max adaptation. */
  zone1Weight: design(1.0, 'ratio', [0.6, 1.2], 'Low-intensity minute.'),
  zone2Weight: design(1.6, 'ratio', [1.2, 2.2], 'Threshold minute.'),
  zone3Weight: k(2.6, 'ratio', [2.0, 3.5], 'M', ['milanovic2015', 'stogglSperlich2014'], true, 'HIIT gives slightly larger VO2max gains per time.'),
  /** Lactate threshold fractions of VO2max: untrained start. */
  lt1StartFraction: k(0.55, 'ratio', [0.5, 0.65], 'M', ['seiler2010', 'joynerCoyle2008'], false, 'Untrained LT1 ~55% VO2max.'),
  lt2StartFraction: k(0.72, 'ratio', [0.65, 0.78], 'M', ['seiler2010', 'joynerCoyle2008'], false, 'Untrained LT2 ~72%.'),
  lt1MaxFraction: k(0.78, 'ratio', [0.7, 0.85], 'M', ['joynerCoyle2008'], false, 'Elite LT1 ~75-80%.'),
  lt2MaxFraction: k(0.9, 'ratio', [0.85, 0.93], 'M', ['joynerCoyle2008'], false, 'Elite LT2 ~88-92%.'),
  /** Threshold adaptation rate per day at full stimulus (fraction of remaining gap). */
  kThresholdPerDay: design(0.004, '1/day', [0.002, 0.008], 'Thresholds keep improving after VO2max plateaus.'),
  /** Running economy baseline (mL O2/kg/km) untrained and elite. */
  economyRunStart: k(215, 'mL/kg/km', [200, 230], 'M', ['saunders2004'], true, 'Recreational ~210-220.'),
  economyRunBest: k(180, 'mL/kg/km', [170, 190], 'M', ['saunders2004', 'joynerCoyle2008'], true, 'Elite ~175-185.'),
  /** Economy improvement rate per day at full modality-specific stimulus. */
  kEconomyPerDay: design(0.002, '1/day', [0.001, 0.004], 'Economy improves slowly with volume.'),
  /** Economy bonus from strength/plyo stimulus (fraction of max improvement contributed). */
  economyStrengthBonus: k(0.3, 'ratio', [0.1, 0.5], 'M', ['balsalobre2016'], true, 'Strength and plyometric training improve economy.'),
  /** Detraining: fast (central) fraction of VO2max gain and its time constant. */
  detrainFastFraction: k(0.5, 'ratio', [0.4, 0.7], 'M', ['coyle1984'], true, 'Early loss from stroke volume.'),
  detrainFastTauDays: k(18, 'days', [12, 30], 'M', ['coyle1984'], true, '-7% at 21 d.'),
  detrainSlowTauDays: k(200, 'days', [120, 400], 'M', ['coyle1984'], true, 'Stabilised ~-16% at 56 d; capillaries persist.'),
  /** Weekly aerobic response R at or above which the full VO2max target is sustained (maintenance dose). */
  targetSaturationResponse: k(0.5, 'ratio', [0.3, 0.7], 'M', ['hickson1985', 'hickson1981', 'hickson1982', 'spiering2021'], false,
    'Cutting frequency/duration by up to 2/3 at constant intensity keeps R above this, so VO2max is maintained; cutting intensity lowers weighted minutes faster.'),
  /** Weekly running km at which economy stimulus saturates. */
  economyRunVolumeKm: design(25, 'km/week', [10, 60], 'Economy improves with running volume.'),
  /** Glycogen capacity per kg skeletal muscle (g). */
  glycogenPerKgMuscle: k(15, 'g/kg', [12, 20], 'M', ['burke2011', 'fernandezElias2015'], false, '~400-500 g whole body in trained adults.'),
  liverGlycogenG: design(100, 'g', [80, 120], 'Liver store.'),
  /** Glycogen used per kcal of exercise at zone 1 / zone 3 (g/kcal). */
  glycogenUseZ1PerKcal: design(0.08, 'g/kcal', [0.05, 0.12], 'Mostly fat at low intensity.'),
  glycogenUseZ3PerKcal: design(0.22, 'g/kcal', [0.15, 0.25], 'Almost all carbohydrate at high intensity.'),
  /** Performance penalty at zero glycogen for high-intensity work. */
  glycogenPerformancePenalty: k(0.2, 'ratio', [0.1, 0.35], 'M', ['burke2011'], true, 'Low glycogen impairs high-intensity endurance.'),
  /** Interference: weekly endurance minutes at which the penalty saturates. */
  interferenceSaturationMin: design(300, 'min/week', [180, 480], 'High endurance volume (~5 h/week).'),
  /** Modality factors for interference. */
  interferenceRunning: k(1.0, 'ratio', [0.8, 1.0], 'M', ['wilson2012'], true, 'Running worst.'),
  interferenceRowing: design(0.7, 'ratio', [0.5, 0.9], 'Rowing ~ swimming.'),
  interferenceSwimming: design(0.7, 'ratio', [0.5, 0.9], 'Non-weight-bearing.'),
  interferenceCycling: k(0.5, 'ratio', [0.3, 0.7], 'M', ['wilson2012'], true, 'Cycling did not significantly impair.'),
  /** Same-session / short-gap multiplier and the gap below which it applies. */
  interferenceSameSessionMultiplier: k(1.5, 'multiplier', [1.2, 2.0], 'M', ['schumann2022'], true, 'Explosive-strength attenuation when in the same session.'),
  interferenceGapHours: k(3, 'h', [3, 6], 'M', ['schumann2022'], true, 'CORRECTION: spec said 6 h; Schumann used >=3 h separation.'),
  /** VO2max age decline: see curve. Faster after 70. */
  caffeineEnduranceBonus: k(0.03, 'ratio', [0.02, 0.04], 'M', ['guest2021'], true, 'Endurance +2-4%.'),
} as const;

export const aerobicCurves = {
  /** Cumulative VO2max decline factor vs age (longitudinal, Fleg 2005). */
  ageFactor: curve('aerobic.ageFactor', 'years', 'multiplier',
    [[20, 1.0, 1.0, 1.0], [30, 0.96, 0.94, 0.98], [40, 0.91, 0.88, 0.94], [50, 0.84, 0.8, 0.88], [60, 0.74, 0.68, 0.8], [70, 0.62, 0.55, 0.7], [80, 0.48, 0.4, 0.58]],
    'M', ['fleg2005'], true, 'Decline accelerates: 3-6%/decade in the 20s-30s to >20%/decade in the 70s.'),
} as const;
