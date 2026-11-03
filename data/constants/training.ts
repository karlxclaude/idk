// Per-set stimulus model constants (spec section 4).
import { curve, design, k } from './define';

export const trainingDefs = {
  /** Fractional set credit for synergists (Pelland fractional method). */
  synergistCredit: k(0.5, 'ratio', [0.3, 0.7], 'M', ['pelland2024'], true, 'Indirect sets count 0.5 of a direct set.'),
  /** A set counts as "hard" (full effective-set credit) at this RIR or lower. */
  hardSetRir: k(4, 'RIR', [3, 5], 'M', ['robinson2024', 'pelland2024'], true, 'Sets above this RIR are discounted by the RIR curve.'),
  /** Weekly effective-set saturation constant V0 for hypertrophy: R(V)=1-exp(-V/V0). */
  v0Hypertrophy: k(9, 'sets/week', [6, 14], 'M', ['schoenfeld2017volume', 'pelland2024'], true,
    'Chosen so 5->10 sets gives ~+0.37%/set growth and 10+ beats 5-9 with diminishing returns beyond 20.'),
  /** Weekly set saturation constant for strength. */
  v0Strength: k(4, 'sets/week', [3, 5], 'M', ['ralston2017', 'pelland2024'], true, 'Strength plateaus at lower weekly volume than hypertrophy.'),
  /** Per-session saturation: hard sets per muscle per session beyond which marginal stimulus falls sharply. */
  sessionSaturationSets: k(9, 'sets/session', [6, 12], 'L', ['schoenfeld2019freq', 'israetelSfr'], false,
    'Uncertain. Makes frequency matter at high volumes.'),
  /** Fraction of stimulus credited for sets beyond session saturation. */
  sessionSaturationTail: design(0.35, 'ratio', [0.1, 0.6], 'Marginal credit of post-saturation sets.'),
  /** Cross-education: untrained-limb strength gain as fraction of trained-limb gain. */
  crossEducation: k(0.1, 'ratio', [0.05, 0.16], 'L', ['carroll2006', 'manca2017'], true,
    'Carroll 2006 ~8%; Manca 2017 11.9%. Game uses 0.10.'),
  /** Max lengthened-position bias multiplier applied at lengthBias = 1. */
  lengthBiasMax: k(1.25, 'multiplier', [1.0, 1.5], 'M', ['maeo2021', 'maeo2023', 'pedrosa2022', 'wolf2023', 'kassiano2023'], true,
    'Single studies show 1.4-1.55x; meta-analytic pooling suggests smaller. Default 1.25.'),
  /** Hypertrophy multiplier for repetitions slower than tempoSlowThresholdS. */
  tempoSlowMultiplier: k(0.8, 'multiplier', [0.6, 1.0], 'M', ['schoenfeld2015tempo'], true, '>10 s reps inferior.'),
  tempoSlowThresholdS: k(10, 's', [8, 12], 'M', ['schoenfeld2015tempo'], true, '0.5-8 s similar; >10 s inferior.'),
  /** Power stimulus multiplier for sub-maximal concentric intent (vs maximal). */
  intentSubmaxPower: k(0.5, 'multiplier', [0.3, 0.7], 'M', ['gonzalezBadillo2014'], true, 'Half-velocity training gave roughly half the gain.'),
  /** Width (in %1RM) of the Gaussian power-stimulus window around each exercise's peak-power load. */
  powerLoadWindowPct: k(25, '%1RM', [15, 40], 'M', ['cormie2011'], true, 'Stimulus falls to 0.6 at one window width from peak-power load.'),
  /** Extra fatigue multiplier for sets to failure (RIR 0). */
  failureFatigueMultiplier: k(1.6, 'multiplier', [1.2, 2.2], 'M', ['moranNavarro2017'], true,
    'Failure added 24-48 h to recovery vs ~48 h baseline.'),
  /** Extra fatigue multiplier for RIR 1 sets (interpolates to 1.0 at RIR 2). */
  nearFailureFatigueMultiplier: design(1.25, 'multiplier', [1.0, 1.6], 'Interpolated between failure and RIR 2.'),
  /** Local muscle damage: half-life (hours) of the fast component. */
  damageHalfLifeH: k(30, 'h', [18, 48], 'M', ['hyldahlHubal2014', 'moranNavarro2017'], true, '24-96 h total time course.'),
  /** Novelty multiplier on damage for an exercise not performed recently. */
  noveltyDamageMultiplier: k(1.8, 'multiplier', [1.3, 2.5], 'M', ['mchugh2003', 'hyldahlHubal2014'], true, 'New exercises cause more soreness.'),
  /** Fraction of damage removed by the repeated-bout effect at full protection. */
  repeatedBoutProtection: k(0.5, 'ratio', [0.3, 0.7], 'L', ['mchugh2003'], true, 'Substantial protection; 50% used.'),
  /** Days for repeated-bout protection to decay by ~63%. */
  repeatedBoutDecayDays: design(35, 'days', [21, 60], 'RBE lasts weeks to months; tunable.'),
  /** Eccentric/lengthened emphasis raises damage by this fraction at lengthBias=1. */
  lengthenedDamageBonus: design(0.3, 'ratio', [0.1, 0.6], 'More damage from lengthened positions.'),
  /** Within-session rep loss: reps fall by this fraction per unit local fatigue. */
  sessionFatigueRepLoss: design(0.15, 'ratio', [0.08, 0.3], 'Force-capacity drop right after a set to failure (mechanical rep-loss model).'),
  /** Local fatigue recovered per minute of rest within a session (fraction of the accumulated set fatigue). */
  intraSetRecoveryPerMin: design(0.4, '1/min', [0.2, 0.6], 'Rest-dependent recovery between sets: 10RM sets lose ~1.5 reps at 3 min rest, ~3.5 at 1 min.'),
  /** Non-recovering session fatigue per hard set (fraction of force capacity, applied to all trained muscles). */
  sessionSlowFatiguePerSet: design(0.008, 'ratio/set', [0.0, 0.02], 'Accumulating fatigue across a long session.'),
  /** Velocity loss at failure (%) and curvature of VL vs reps/maxReps. */
  velocityLossAtFailure: k(55, '%', [40, 70], 'M', ['parejaBlanco2017'], false, 'VL20 ~ half of possible reps; VL40 ~ 80%.'),
  velocityLossExponent: design(1.3, 'exponent', [1.0, 2.0], 'VL = VLfail * (reps/maxReps)^exp.'),
  /** Weekly power-stimulus saturation (power sets). */
  v0Power: design(10, 'sets/week', [5, 20], 'Power adaptations saturate at moderate weekly volume.'),
  /** Fraction of force lost per unit local damage (EIMD strength loss). */
  damageForceLoss: k(0.25, 'ratio', [0.1, 0.4], 'M', ['hyldahlHubal2014', 'maeo2021'], true, 'Novel eccentric work: 1RM -12 to -24% at 24 h.'),
  /** Damage increment per hard set at full exercise.localDamage and activation 1. */
  damagePerSet: design(0.12, 'damage/set', [0.05, 0.25], 'Local damage scale; ~1 after a novel high-volume session.'),
  /** Systemic fatigue per hard set (impulse units) for a high-systemic exercise. */
  systemicFatiguePerSet: design(1.0, 'impulse/set', [0.5, 2], 'Scales exercise.systemicFatigue; feeds the Banister model.'),
  /** Minimum skill at which a novel exercise starts (relative to 1). */
  skillStart: design(0.3, 'ratio', [0.1, 0.5], 'Novel exercise skill at first exposure.'),
  /** Between-person SD of starting technique on an unfamiliar lift. */
  noviceSkillSd: k(0.12, 'ratio', [0.05, 0.2], 'L', ['hubal2005'], false, 'Some novices express far less of their capacity on a new lift; drives the long right tail of 1RM gains (0 to +250%).'),
  /** Skill time constant: sessions to reach ~63% of the remaining skill gap at learningRate 1. */
  skillSessionsTau: k(8, 'sessions', [5, 14], 'HEUR', ['moritaniDeVries1979'], true, '2-4 weeks at 2-3 sessions/week.'),
  /** Skill decay time constant (days) without practice. */
  skillDecayTauDays: design(240, 'days', [120, 500], 'Skill decays much slower than muscle.'),
  /** Fraction of a trained exercise's neural stimulus transferred to a different exercise of the same pattern at transfer=1. */
  neuralTransferScale: design(1.0, 'ratio', [0.5, 1.0], 'Transfer matrix coefficient scales neural transfer.'),
  /** Generated transfer matrix (HEUR): same pattern = base + overlap x cosine(muscle vectors); cross-pattern = patternTransfer x cosine x scale. */
  transferSamePatternBase: design(0.35, 'ratio', [0.1, 0.6], 'Transfer floor within a movement pattern.'),
  transferSamePatternOverlap: design(0.5, 'ratio', [0.2, 0.8], 'Transfer added by full muscle overlap within a pattern.'),
  transferCrossPatternScale: design(0.6, 'ratio', [0.2, 1], 'Scale for cross-pattern transfer.'),
  transferOtherEquipment: design(0.85, 'ratio', [0.6, 1], 'Different equipment lowers transfer.'),
  transferMax: design(0.95, 'ratio', [0.8, 1], 'Cap on transfer between distinct exercises.'),
  transferMin: design(0.05, 'ratio', [0, 0.2], 'Transfers below this are ignored.'),
} as const;

export const trainingCurves = {
  /** Hypertrophy stimulus vs %1RM (sets close to failure). */
  hypLoad: curve('training.hypLoad', '%1RM', 'multiplier',
    [[20, 0.5, 0.3, 0.7], [30, 1.0, 0.85, 1.0], [85, 1.0, 0.9, 1.0], [92, 0.85, 0.7, 1.0], [100, 0.75, 0.5, 1.0]],
    'H', ['schoenfeld2017load', 'lopez2021', 'lasevicius2018'], true,
    '30-85% similar when near failure; 20% about half; 1-3RM ~0.75 per set (volume-equated heavy work needed more sets).'),
  /** Hypertrophy stimulus vs repetitions in reserve. */
  hypRir: curve('training.hypRir', 'RIR', 'multiplier',
    [[0, 1.0, 0.9, 1.0], [1, 0.95, 0.85, 1.0], [2, 0.9, 0.8, 1.0], [3, 0.8, 0.65, 0.95], [4, 0.65, 0.5, 0.85], [5, 0.5, 0.35, 0.7], [7, 0.3, 0.15, 0.5], [10, 0.15, 0.05, 0.3]],
    'M', ['robinson2024', 'refalo2023'], true, 'Shape is a heuristic; direction (closer to failure = more growth) is supported.'),
  /** Strength stimulus vs %1RM. */
  strLoad: curve('training.strLoad', '%1RM', 'multiplier',
    [[20, 0.3, 0.1, 0.5], [30, 0.4, 0.25, 0.55], [60, 0.7, 0.55, 0.85], [80, 1.0, 0.9, 1.0], [100, 1.0, 0.9, 1.0]],
    'M', ['lopez2021', 'schoenfeld2017load'], true, 'Heavier loads give more 1RM strength.'),
  /** Strength stimulus vs RIR: flat 0-4 then declining. */
  strRir: curve('training.strRir', 'RIR', 'multiplier',
    [[0, 1.0, 0.9, 1.0], [4, 1.0, 0.85, 1.0], [6, 0.8, 0.6, 1.0], [8, 0.6, 0.4, 0.8], [10, 0.4, 0.2, 0.6]],
    'M', ['robinson2024'], true, 'Strength gains similar across a wide RIR range.'),
  /** Hypertrophy multiplier vs inter-set rest (seconds). */
  hypRest: curve('training.hypRest', 's', 'multiplier',
    [[30, 0.8, 0.65, 0.95], [60, 0.85, 0.75, 0.95], [90, 0.95, 0.85, 1.0], [120, 1.0, 0.95, 1.0], [300, 1.0, 1.0, 1.0]],
    'M', ['schoenfeld2016rest', 'singer2024'], true, 'Small benefit beyond 60 s, none beyond ~90-120 s. Rep loss from short rest is modelled mechanically as well.'),
  /** Power stimulus vs within-set velocity loss (%). */
  powVelocityLoss: curve('training.powVelocityLoss', '%', 'multiplier',
    [[0, 1.0, 0.9, 1.0], [20, 1.0, 0.85, 1.0], [30, 0.8, 0.6, 0.95], [40, 0.6, 0.4, 0.8], [60, 0.45, 0.25, 0.7]],
    'M', ['parejaBlanco2017'], true, '20% VL favours jump/power; 40% favours hypertrophy.'),
  /** Hypertrophy stimulus vs within-set velocity loss (%). */
} as const;
