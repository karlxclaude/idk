// Hypertrophy adaptation constants (spec 5.1) and muscle ceilings.
import { curve, design, k } from './define';

export const hypertrophyDefs = {
  /**
   * Base daily approach rate toward the genetic ceiling at full stimulus and neutral modifiers.
   * dM/dt = kHyp * responder * R(V) * (Mmax - M)^p/Mmax^(p-1) * mods. With p=1 this is an exponential approach
   * with time constant 1/kHyp days (~1.6 years), which reproduces the year-1 / halving pattern.
   */
  kHypPerDay: k(0.00195, '1/day', [0.0012, 0.0032], 'HEUR', ['mcdonaldAragon', 'hubal2005', 'schoenfeld2017volume'], false,
    'Calibrated against benchmark bands: 12-wk +5-15% CSA, year-1 lean +6-11 kg (men).'),
  /** Exponent on the ceiling gap. 1 = exponential approach. */
  ceilingExponent: design(1.0, 'exponent', [0.8, 1.6], 'Produces training-age slowdown without categories.'),
  /** Untrained starting muscle mass as a fraction of the genetic ceiling (men). */
  untrainedCeilingFraction: design(0.70, 'ratio', [0.6, 0.8], 'Sets the initial gap; interacts with kHyp to set year-1 gains.'),
  /** Normalized FFMI ceiling: population mean (men). */
  ffmiCeilingMeanMen: k(23, 'kg/m2', [22, 24], 'L', ['kouri1995', 'schutz2002'], true,
    'Most natural ceilings 21-25; ~1-2% exceed 25.'),
  ffmiCeilingSdMen: design(1.0, 'kg/m2', [0.7, 1.5], 'SD 1.0 gives ~2% above 25.'),
  /** Normalized FFMI ceiling: population mean (women). */
  ffmiCeilingMeanWomen: k(19.5, 'kg/m2', [18.5, 21], 'L', ['schutz2002', 'roberts2020'], false,
    'Women reach ~80-85% of men absolute FFM; relative hypertrophy similar.'),
  ffmiCeilingSdWomen: design(0.9, 'kg/m2', [0.6, 1.3], 'Spread of female ceilings.'),
  /** Kouri height normalisation: FFMI + c * (1.8 - height m). */
  ffmiHeightCorrection: k(6.3, 'kg/m2 per m', [6.0, 6.5], 'M', ['kouri1995'], true,
    'CORRECTION: spec said 6.1; Kouri 1995 uses 6.3.'),
  /** Skeletal muscle mass as a fraction of fat-free mass (untrained men). */
  smmFractionOfFfmMen: k(0.53, 'ratio', [0.48, 0.58], 'M', ['janssen2000'], true, 'Janssen 2000: ~33 kg SMM of ~62 kg FFM.'),
  smmFractionOfFfmWomen: k(0.47, 'ratio', [0.42, 0.52], 'M', ['janssen2000'], true, 'Women ~21 kg SMM of ~45 kg FFM.'),
  /** Fraction of hypertrophy-associated early lean gain that is water/glycogen (first ~3 weeks). */
  earlyWaterGainKg: k(1.0, 'kg', [0.5, 2.0], 'M', ['damas2016', 'seynnes2007', 'fernandezElias2015'], true,
    'Early size increase is partly swelling/glycogen; real hypertrophy visible after ~3 weeks.'),
  earlyWaterTauDays: design(14, 'days', [7, 28], 'Time constant for the early water/glycogen pool.'),
  /** Lognormal sigma of the hypertrophy responder multiplier. */
  responderSigma: k(0.5, 'ln-sd', [0.35, 0.7], 'H', ['hubal2005'], true, 'CV of CSA change ~0.5; range -2 to +59%.'),
  /** Multiplier on growth rate when regaining toward a previous high-water mark (muscle memory). */
  muscleMemoryMultiplier: k(2.5, 'multiplier', [1.5, 3.5], 'L', ['ogasawara2013', 'seaborne2018', 'bruusgaard2010', 'psilander2019'], true,
    'Mechanism contested in humans (Psilander 2019); regain is faster than first gain in practice.'),
  /** Days without stimulus before muscle begins to atrophy. */
  atrophyGraceDays: k(17, 'days', [14, 21], 'L', ['bosquet2013', 'mujika2000'], true, 'Mass loss begins after ~2-3 weeks off.'),
  /** Time constant (days) for trained muscle to decay toward the untrained baseline. */
  atrophyTauDays: k(450, 'days', [250, 800], 'L', ['mujika2000', 'bickel2011'], false,
    'Gradual: ~12% of the trained gain lost after 8 weeks of inactivity beyond the grace period.'),
  /** Creatine: multiplier on hypertrophy rate (mostly via extra reps and cell volume). */
  creatineHypertrophyBonus: k(1.05, 'multiplier', [1.0, 1.12], 'M', ['kreider2017', 'rawsonVolek2003'], true, 'Small direct effect; most benefit via training performance.'),
  /** Age at which untrained sarcopenia begins. */
  sarcopeniaOnsetAge: k(50, 'years', [45, 60], 'M', ['mitchell2012'], true, 'Loss ~0.5-1%/yr after ~50 if untrained.'),
  /** Untrained muscle loss per year after onset (fraction). */
  sarcopeniaRatePerYear: k(0.007, '1/year', [0.004, 0.012], 'M', ['mitchell2012'], true, 'Median 0.47%/yr cross-sectional; 0.8-1%/yr at 75.'),
  /** Multiplier on interference penalty for hypertrophy at high endurance volume. */
  interferenceHypertrophy: k(0.1, 'ratio', [0.0, 0.25], 'L', ['wilson2012', 'schumann2022'], true, 'Wilson: ES 1.23->0.85; Schumann: ~0.'),
} as const;

export const hypertrophyCurves = {
  /** Protein multiplier vs effective protein intake (g/kg/day). */
  protein: curve('hypertrophy.protein', 'g/kg/day', 'multiplier',
    [[0.4, 0.6, 0.4, 0.75], [0.8, 0.78, 0.65, 0.88], [1.2, 0.9, 0.82, 0.96], [1.6, 1.0, 1.0, 1.0], [2.2, 1.02, 1.0, 1.06], [3.0, 1.02, 1.0, 1.06]],
    'H', ['morton2018'], true, 'Plateau ~1.6 g/kg (95% CI to 2.2). Modest effect (+0.3 kg FFM over a study).'),
  /** Energy-balance multiplier on hypertrophy vs daily balance (kcal/day). Net lean change also includes partitioning losses. */
  energyBalance: curve('hypertrophy.energyBalance', 'kcal/day', 'multiplier',
    [[-1000, 0.1, 0.0, 0.3], [-500, 0.4, 0.2, 0.6], [-250, 0.75, 0.6, 0.9], [0, 1.0, 0.95, 1.0], [250, 1.1, 1.0, 1.2], [500, 1.15, 1.05, 1.3], [1500, 1.15, 1.05, 1.3]],
    'M', ['murphyKoehler2022', 'helms2023', 'slater2019'], true,
    '~500 kcal deficit nets zero lean gain (with partitioning losses); surplus beyond ~5% adds fat, not muscle.'),
  /** Sleep multiplier vs habitual hours. */
  sleep: curve('hypertrophy.sleep', 'h', 'multiplier',
    [[4, 0.75, 0.6, 0.85], [5.5, 0.82, 0.7, 0.9], [6, 0.88, 0.8, 0.95], [7, 0.97, 0.9, 1.0], [8, 1.0, 1.0, 1.0], [10, 1.0, 1.0, 1.0]],
    'M', ['lamon2021', 'nedeltcheva2010'], true, 'Chronic restriction ~0.8-0.9 (HEUR); one night total deprivation cut MPS 18%.'),
  /** Alcohol multiplier vs standard drinks on a training day. */
  alcohol: curve('hypertrophy.alcohol', 'drinks', 'multiplier',
    [[0, 1.0, 1.0, 1.0], [2, 0.95, 0.9, 1.0], [5, 0.82, 0.7, 0.9], [12, 0.68, 0.6, 0.76]],
    'M', ['parr2014'], true, '12 drinks post-exercise cut MPS 24-37%.'),
  /** Stress multiplier vs stress level (0-1). */
  stress: curve('hypertrophy.stress', 'level', 'multiplier',
    [[0, 1.0, 1.0, 1.0], [0.5, 0.95, 0.9, 1.0], [1, 0.85, 0.7, 0.95]],
    'M', ['bartholomew2008', 'stultsKolehmainen2014'], true, 'High life stress blunted strength gains and slowed recovery.'),
  /** Age multiplier on hypertrophy rate. */
  age: curve('hypertrophy.age', 'years', 'multiplier',
    [[18, 1.0, 1.0, 1.0], [35, 1.0, 0.95, 1.0], [50, 0.88, 0.8, 0.95], [60, 0.78, 0.65, 0.88], [70, 0.7, 0.55, 0.8]],
    'M', ['breenPhillips2011', 'peterson2011'], true, 'Anabolic resistance; older adults still gain ~1 kg lean in typical programs.'),
} as const;
