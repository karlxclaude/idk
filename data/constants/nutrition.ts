// Nutrition, hydration, micronutrients, supplements (spec 7).
import { curve, design, k } from './define';

export const nutritionDefs = {
  /** Protein per-meal target for the distribution bonus (g/kg). */
  proteinPerMealTarget: k(0.4, 'g/kg', [0.3, 0.55], 'L', ['schoenfeldAragon2018'], true, '3-4 feedings of ~0.4 g/kg.'),
  proteinMealsTarget: design(3, 'meals', [2, 5], 'Feedings at target to earn the full bonus.'),
  proteinDistributionBonus: k(0.03, 'ratio', [0.0, 0.06], 'L', ['schoenfeldAragon2018', 'schoenfeld2013timing', 'trommelen2023'], true,
    'Small bonus; timing barely matters when total matched; big doses still work.'),
  /** Leucine threshold per meal (g) for a full anabolic response (optional mechanic). */
  leucineThresholdG: k(2.5, 'g', [2, 3], 'L', ['breenPhillips2011', 'schoenfeldAragon2018'], true, '2-3 g per meal; higher in older adults.'),
  leucineThresholdOlderG: k(3.0, 'g', [2.5, 4], 'M', ['breenPhillips2011'], true, 'Older adults need more per meal.'),
  /** Quality weight floor: protein from DIAAS 0.4 sources counts this much (interpolates to 1.0 at DIAAS >= 1). */
  qualityFloorAtDiaas04: design(0.75, 'ratio', [0.6, 0.9], 'Quality matters less at high totals (Hevia-Larrain 2021).'),
  /** Carbohydrate targets by training load (g/kg/day). */
  carbLightGkg: k(4, 'g/kg', [3, 5], 'M', ['burke2011'], true, 'Light.'),
  carbModerateGkg: k(6, 'g/kg', [5, 7], 'M', ['burke2011'], true, 'Moderate (~1 h/day).'),
  carbHighGkg: k(8, 'g/kg', [6, 10], 'M', ['burke2011'], true, 'High (1-3 h/day).'),
  carbVeryHighGkg: k(10, 'g/kg', [8, 12], 'M', ['burke2011'], true, 'Very high (>4-5 h/day).'),
  /** Lifting: session length (min) beyond which carbohydrate availability matters. */
  liftingCarbSessionMin: k(45, 'min', [30, 60], 'M', ['henselmans2022'], true, 'Only long/high-volume sessions are carb-sensitive.'),
  liftingCarbSetsThreshold: k(10, 'sets', [8, 15], 'M', ['henselmans2022'], true, '>10 sets per session.'),
  /** Fat intake floor as fraction of calories; below it a mild health/hormonal penalty applies. */
  fatMinFraction: k(0.2, 'ratio', [0.15, 0.25], 'L', ['helms2014'], true, 'Below ~20% of calories, mild penalty.'),
  fatLowPenalty: design(0.05, 'ratio', [0.02, 0.1], 'Mild penalty on recovery/hormonal health.'),
  /** Energy availability threshold (kcal/kg FFM/day). */
  eaThreshold: k(30, 'kcal/kg FFM', [25, 35], 'M', ['loucks2003', 'mountjoy2023'], true, 'LH pulsatility disrupted below 30.'),
  eaSevereThreshold: k(15, 'kcal/kg FFM/day', [10, 20], 'L', ['loucks2003'], false, 'EA at which REDs severity is maximal; Loucks 2003 showed graded bone-formation suppression at 30, 20 and 10.'),
  eaOptimal: k(45, 'kcal/kg FFM', [40, 50], 'M', ['loucks2003'], true, 'Healthy EA ~45.'),
  /** Low-EA effects at EA = 15: adaptation multiplier, injury multiplier, performance. */
  lowEaAdaptationPenalty: k(0.4, 'ratio', [0.2, 0.6], 'M', ['mountjoy2023'], true, 'Hormonal disruption blunts adaptation.'),
  lowEaPerformancePenalty: k(0.08, 'ratio', [0.03, 0.15], 'M', ['mountjoy2023'], true, 'Worse performance.'),
  lowEaDaysToEffect: design(14, 'days', [7, 28], 'Effects build over weeks of low EA.'),
  /** Hunger: satiety index effect per 100 units above/below 100 on hunger (fraction). */
  satietyEffect: k(0.25, 'ratio', [0.1, 0.4], 'M', ['holt1995'], true, 'High-satiety foods reduce hunger.'),
  proteinHungerReduction: k(0.2, 'ratio', [0.1, 0.3], 'M', ['westerterp2004'], true, 'Protein is satiating.'),
  fiberHungerReductionPer30g: design(0.15, 'ratio', [0.05, 0.25], 'Fiber reduces hunger.'),
  /** Probability of an unplanned meal at hunger 1.0 (per day). */
  unplannedMealProbAtMaxHunger: design(0.5, '1/day', [0.2, 0.8], 'Player-facing adherence tradeoff.'),
  unplannedMealKcal: design(600, 'kcal', [300, 1000], 'Typical unplanned snack/meal.'),
  /** Sweat rate (L/h) at moderate intensity, 20 C, population mean and SD. */
  sweatRateBase: k(1.0, 'L/h', [0.5, 2.0], 'M', ['baker2017'], true, '0.5-2 L/h.'),
  sweatRateSd: design(0.3, 'L/h', [0.15, 0.5], 'Individual variation.'),
  sweatSodiumMmol: k(45, 'mmol/L', [10, 90], 'M', ['baker2017'], true, 'Sweat sodium 10-90 mmol/L.'),
  sweatSodiumSd: design(20, 'mmol/L', [10, 30], 'Individual variation.'),
  sweatTempCoefficientPerC: design(0.03, '1/C', [0.01, 0.05], 'Sweat rate rises ~3%/C above 20 C.'),
  /** Dehydration thresholds. */
  dehydrationAerobicThreshold: k(0.02, 'ratio BM', [0.015, 0.03], 'M', ['cheuvrontKenefick2014'], true, '>=2% impairs aerobic performance.'),
  dehydrationStrengthAt3pct: k(0.02, 'ratio', [0.01, 0.04], 'M', ['judelson2007'], true, 'Strength -2%.'),
  dehydrationPowerAt3pct: k(0.03, 'ratio', [0.02, 0.05], 'M', ['judelson2007'], true, 'Power -3%.'),
  dehydrationEnduranceAt3pct: k(0.1, 'ratio', [0.05, 0.15], 'M', ['judelson2007'], true, 'High-intensity endurance -10%.'),
  /** Iron: ferritin dynamics. Absorption fractions. */
  ironAbsorptionHeme: k(0.25, 'ratio', [0.15, 0.35], 'M', ['hurrellEgli2010'], true, 'Heme iron ~25%.'),
  ironAbsorptionNonHeme: k(0.1, 'ratio', [0.02, 0.2], 'M', ['hurrellEgli2010'], true, 'Non-heme 2-20%; 10% mixed diet.'),
  ironLossMgPerDayMen: design(1.0, 'mg/day', [0.8, 1.2], 'Basal losses ~1 mg.'),
  ironLossMgPerDayWomen: design(1.6, 'mg/day', [1.3, 2.0], 'Menstrual losses add ~0.5-1 mg/day averaged.'),
  ironLossPerRunningKm: k(0.03, 'mg/km', [0.01, 0.06], 'L', ['peeling2008'], true, 'Foot-strike haemolysis, sweat, GI losses.'),
  ironHepcidinAbsorptionPenalty: k(0.3, 'ratio', [0.15, 0.5], 'M', ['peeling2008'], true, 'Exercise raises hepcidin, cutting absorption for hours.'),
  /** Ferritin-equivalent store (mg iron) at which deficiency begins and anaemia begins. */
  ironStoreDeficientMg: design(300, 'mg', [200, 400], 'Ferritin ~<30 ng/mL equivalent.'),
  ironStoreAnemicMg: design(0, 'mg', [0, 0], 'Stores exhausted: haemoglobin falls.'),
  ironStoreFullMg: design(1000, 'mg', [800, 1200], 'Replete stores (~100 ng/mL).'),
  ironStoreStartMen: design(900, 'mg', [600, 1200], 'Typical male stores.'),
  ironStoreStartWomen: design(400, 'mg', [200, 700], 'Typical female stores (lower).'),
  /** Haemoglobin loss per day of exhausted stores (fraction of Hb mass). */
  hbLossPerDayAnemic: design(0.003, '1/day', [0.001, 0.006], 'Anaemia develops over months.'),
  hbRegainPerDay: design(0.004, '1/day', [0.002, 0.008], 'Recovery with iron repletion.'),
  hbMinFraction: design(0.7, 'ratio', [0.5, 0.85], 'Floor on Hb mass fraction in the game.'),
  idnaPerformancePenalty: k(0.03, 'ratio', [0.01, 0.06], 'M', ['burden2015'], true, 'Non-anaemic deficiency: small aerobic effect (treatment g=0.61).'),
  /** Vitamin D: serum 25(OH)D (ng/mL) dynamics. */
  vitDDeficient: k(20, 'ng/mL', [20, 20], 'H', ['ross2011', 'iom2011'], true, 'IOM: <20 ng/mL deficient.'),
  vitDBaselineNgMl: design(10, 'ng/mL', [5, 15], 'Serum 25(OH)D sustained by body stores with no sun or intake (winter trough floor).'),
  vitDSufficient: design(30, 'ng/mL', [25, 40], 'Target.'),
  vitDPerIuPerDay: k(0.007, 'ng/mL per IU/day', [0.005, 0.01], 'M', ['heaney2003'], true, '~0.7 ng/mL per 100 IU/day at steady state.'),
  vitDHalfLifeDays: design(45, 'days', [30, 60], '25(OH)D half-life 2-3 weeks; body stores longer. Game uses 45 d for the pool.'),
  vitDSunIuPerMinSummer: design(100, 'IU/min', [50, 200], 'Midday summer sun ~ thousands of IU per 15-30 min.'),
  vitDNoSynthesisStartMonth: k(11, 'month', [10, 11], 'H', ['webb1988'], true, 'Boston: none from November.'),
  vitDNoSynthesisEndMonth: k(2, 'month', [2, 3], 'H', ['webb1988'], true, '...through February.'),
  vitDStartNgMl: design(26, 'ng/mL', [15, 40], 'Typical starting level.'),
  vitDMusclePenalty: design(0.03, 'ratio', [0.01, 0.06], 'Mild muscle function penalty when deficient.'),
  /** Magnesium: deficiency raises energy cost of exercise. */
  magnesiumRdaMg: design(400, 'mg/day', [310, 420], 'RDA 310-420 mg.'),
  magnesiumDeficiencyEconomyPenalty: design(0.05, 'ratio', [0.02, 0.1], 'Energy cost of exercise rises when deficient [L].'),
  magnesiumStoreDays: design(60, 'days', [30, 120], 'Status moves slowly.'),
  /** B12 and calcium. */
  b12RdaUg: design(2.4, 'ug/day', [2, 3], 'RDA.'),
  b12StoreMonthsToDeplete: design(18, 'months', [12, 36], 'Stores last 1-3 years; game accelerates to 18 months.'),
  calciumRdaMg: design(1000, 'mg/day', [1000, 1200], 'RDA.'),
  /** Alcohol: kcal per standard drink. */
  kcalPerDrink: design(140, 'kcal', [100, 200], 'Standard drink ~14 g ethanol = 98 kcal + mixer.'),
  /** Supplements. */
  creatineLoadingDays: k(6, 'days', [5, 7], 'H', ['hultman1996'], true, '20 g/day for 5-7 days.'),
  creatineMaintenanceSaturationDays: k(28, 'days', [21, 35], 'H', ['hultman1996'], true, '3-5 g/day saturates in ~28 days.'),
  creatineWaterGainKg: k(1.5, 'kg', [1, 2], 'M', ['kreider2017'], true, '+1-2 kg in the first week.'),
  creatineNonResponderRate: k(0.25, 'ratio', [0.2, 0.3], 'M', ['syrotuikBell2004'], true, '20-30% non-responders.'),
  creatineDailyDoseG: design(5, 'g', [3, 5], 'Maintenance dose.'),
  caffeineStrengthEffect: k(0.02, 'ratio', [0.01, 0.035], 'M', ['grgic2018caffeine', 'guest2021'], true, 'ES ~0.2 maps to ~+2% 1RM.'),
  caffeinePowerEffect: k(0.025, 'ratio', [0.01, 0.04], 'M', ['grgic2018caffeine'], true, 'ES ~0.2.'),
  caffeineDoseMgPerKg: k(4.5, 'mg/kg', [3, 6], 'M', ['guest2021'], true, '3-6 mg/kg.'),
  caffeineToleranceFactor: k(0.7, 'ratio', [0.5, 1.0], 'L', ['guest2021'], true, 'Tolerance debated; habitual users get ~70% effect.'),
  betaAlanineEffect: k(0.03, 'ratio', [0.02, 0.04], 'M', ['saunders2017', 'hobson2012'], true, '~3% in 0.5-10 min efforts after loading.'),
  betaAlanineLoadingDays: k(28, 'days', [14, 42], 'M', ['saunders2017'], true, '2-4+ weeks at 4-6 g/day.'),
  nitrateEnduranceEffect: k(0.015, 'ratio', [0.005, 0.03], 'M', ['jones2014'], true, 'Small; smaller in elites.'),
  nitrateEliteAttenuation: design(0.4, 'ratio', [0.2, 0.7], 'Elite benefit fraction.'),
  bicarbEffect: k(0.02, 'ratio', [0.01, 0.03], 'M', ['grgic2021bicarb'], true, '1-7 min efforts.'),
  bicarbGutDistressProb: k(0.3, 'ratio', [0.1, 0.5], 'M', ['grgic2021bicarb'], true, 'GI side effects common.'),
  betaAlanineMinEffortMin: k(0.5, 'min', [0.5, 1], 'M', ['saunders2017'], true, 'Lower bound of effort duration that benefits (0.5-10 min).'),
  betaAlanineMaxEffortMin: k(10, 'min', [4, 10], 'M', ['saunders2017'], true, 'Upper bound of effort duration that benefits.'),
  bicarbMinEffortMin: k(1, 'min', [0.5, 1], 'M', ['grgic2021bicarb'], true, 'Bicarbonate helps 1-7 min efforts.'),
  bicarbMaxEffortMin: k(7, 'min', [4, 10], 'M', ['grgic2021bicarb'], true, 'Bicarbonate helps 1-7 min efforts.'),
  bicarbGutDistressPenalty: design(0.03, 'ratio', [0.01, 0.08], 'Performance lost when GI distress strikes; applied as an expected value in headless event estimates.'),
  nitrateMinEffortMin: k(5, 'min', [2, 10], 'L', ['jones2014'], false, 'Nitrate benefit shown mainly for ~5-30+ min endurance efforts.'),
  nitrateEliteVo2: k(60, 'mL/kg/min', [55, 65], 'L', ['jones2014'], false, 'Above this VO2max the benefit is attenuated (well-trained athletes respond less).'),
  hmbTrainedEffect: design(0.0, 'ratio', [0.0, 0.01], 'Trivial in trained people (Maughan 2018).'),
  /** Meals / groceries (engine/meals.ts, engine/groceries.ts). */
  gramsEthanolPerDrink: design(14, 'g', [10, 14], 'US standard drink = 14 g ethanol (NIAAA definition); converts food alcoholG to drinks.'),
  cookedYieldDryPriced: design(2.5, 'g cooked per g dry', [2, 3.5], 'Boiled legumes/rice/pasta/oats are priced per dry weight but their nutrient rows are cooked; ~2.5x is a mid value (lentils ~2.3, beans ~2.5, rice ~3, pasta ~2.3, oats ~4). HEUR single factor.'),
  mealPrepMinPerItem: design(2, 'min', [0, 5], 'Extra handling time per distinct ingredient on top of the longest single prep time.'),
} as const;

export const nutritionCurves = {
  /** Protein quality weight vs DIAAS. */
  qualityWeight: curve('nutrition.qualityWeight', 'DIAAS', 'ratio',
    [[0.3, 0.7, 0.5, 0.85], [0.4, 0.75, 0.6, 0.9], [0.7, 0.9, 0.8, 1.0], [1.0, 1.0, 1.0, 1.0], [1.3, 1.0, 1.0, 1.0]],
    'L', ['rutherfurd2015', 'mathai2017', 'heviaLarrain2021'], true, 'Quality matters less at high totals.'),
  /** Low energy availability multiplier on adaptation vs EA (kcal/kg FFM/day). */
  eaAdaptation: curve('nutrition.eaAdaptation', 'kcal/kg FFM', 'multiplier',
    [[10, 0.5, 0.3, 0.7], [20, 0.7, 0.5, 0.85], [30, 1.0, 0.95, 1.0], [45, 1.0, 1.0, 1.0]],
    'M', ['loucks2003', 'mountjoy2023'], true, 'Below 30 kcal/kg FFM hormonal disruption.'),
} as const;
