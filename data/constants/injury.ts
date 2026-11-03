// Connective tissue, bone, injury (spec 5.5).
import { design, k } from './define';

export const injuryDefs = {
  /** Base injury rates per 1000 training hours by activity (calibration targets). */
  ratePowerlifting: k(2.5, '/1000h', [1.0, 4.4], 'M', ['keoghWinwood2017'], true, 'Powerlifting 1.0-4.4.'),
  rateWeightlifting: k(2.8, '/1000h', [2.4, 3.3], 'M', ['keoghWinwood2017'], true, 'Weightlifting 2.4-3.3.'),
  rateStrongman: k(5.2, '/1000h', [4.5, 6.1], 'M', ['keoghWinwood2017'], true, 'Strongman 4.5-6.1.'),
  rateBodybuilding: k(0.6, '/1000h', [0.24, 1.0], 'M', ['keoghWinwood2017'], true, 'Bodybuilding 0.24-1.'),
  rateNoviceRunning: k(17.8, '/1000h', [16.7, 19.1], 'M', ['videbaek2015'], true, 'Novice runners.'),
  rateRecreationalRunning: k(7.7, '/1000h', [6.9, 8.7], 'M', ['videbaek2015'], true, 'Recreational runners.'),
  occupationalRatePer1000h: design(0.05, '/1000h', [0.02, 0.15], 'Occupational injuries at reference strain. BLS SOII shows ~3-6 recordable cases per 100 FTE-years in warehousing/construction (~0.015-0.03/1000 h); set higher to include minor time-loss strains. Not verified against a source file.'),
  /** Hazard multiplier at relative intensity 1.0 vs 0.7 (per-exposure). */
  intensityHazardExponent: design(2.0, 'exponent', [1.0, 3.0], 'Hazard ~ (load/0.7)^exp above 70%.'),
  /** Hazard multiplier at zero readiness. */
  fatigueHazardMax: design(2.0, 'multiplier', [1.3, 3.0], 'Fatigued lifters get hurt more.'),
  /** Hazard multiplier at skill 0 (technique deficit). */
  techniqueHazardMax: design(1.8, 'multiplier', [1.2, 3.0], 'Poor technique raises risk.'),
  /** Acute:chronic workload ratio above which the load-spike hazard rises. */
  acwrThreshold: k(1.5, 'ratio', [1.3, 2.0], 'L', ['gabbett2016', 'impellizzeri2020'], true, 'Contested model; tunable and labelled.'),
  acwrHazardPerUnit: k(1.0, 'multiplier/unit', [0.0, 2.0], 'L', ['gabbett2016', 'impellizzeri2020'], true, 'Hazard rises linearly above threshold; can be set to 0 to disable.'),
  /** Sleep <8 h injury multiplier (adolescents, OR 1.7); applied continuously below sleepNeed. */
  sleepHazardMax: k(1.7, 'multiplier', [1.0, 3.0], 'M', ['milewski2014'], true, 'OR 1.7 (CI 1.0-3.0).'),
  /** Tendon-muscle capacity gap: hazard multiplier at a 30% gap. */
  tissueGapHazardPer30pct: k(1.8, 'multiplier', [1.2, 3.0], 'M', ['bohm2015', 'heinemeier2013'], true, 'Tendon adapts slowly; big gaps raise tendinopathy risk.'),
  /** Prior injury multiplier for the same tissue (decays over a year). */
  priorInjuryMultiplier: design(1.8, 'multiplier', [1.2, 3.0], 'Re-injury risk.'),
  priorInjuryDecayDays: design(365, 'days', [180, 730], 'Prior-injury effect fades.'),
  /** Genetic proneness lognormal sigma. */
  pronenessSigma: design(0.35, 'ln-sd', [0.2, 0.6], 'Individual tissue quality.'),
  /** Tendon capacity adaptation time constant (days) under high-strain loading. */
  tendonTauDays: k(120, 'days', [84, 200], 'M', ['bohm2015'], true, '>=12 weeks of high-strain loading.'),
  /** Max tendon capacity gain per year as fraction (slow core turnover). */
  tendonMaxGainPerYear: k(0.25, 'ratio', [0.1, 0.4], 'M', ['bohm2015', 'heinemeier2013'], true, 'Stiffness rises; core collagen barely turns over.'),
  /** Bone: BMD gain per year at strong loading (fraction). */
  bmdGainPerYear: k(0.02, 'ratio/year', [0.01, 0.03], 'M', ['watson2018', 'turnerRobling2003'], true, '1-3%/year with heavy loads and impact.'),
  bmdLossPerYearLowEa: k(0.02, 'ratio/year', [0.01, 0.04], 'M', ['mountjoy2023', 'loucks2003'], true, 'Low EA lowers bone density.'),
  bmdDeficiencyVitDPenalty: design(0.5, 'ratio', [0.2, 0.8], 'Vitamin D/calcium deficiency halves bone gain.'),
  /** Stress-fracture hazard multiplier at BMD z = -1 and at low EA. */
  stressFractureBmdHazardPerSd: k(1.6, 'multiplier/SD', [1.3, 2.2], 'M', ['mountjoy2023'], true, 'Low BMD raises fracture risk.'),
  stressFractureLowEaMultiplier: k(2.5, 'multiplier', [1.5, 4.0], 'M', ['mountjoy2023'], true, 'REDs raises bone-stress injury risk (~2-4x in low-EA athletes).'),
  /** Prevention: Nordic curls weekly reduce hamstring strain hazard by this fraction. */
  nordicHamstringReduction: k(0.5, 'ratio', [0.4, 0.6], 'H', ['vanDyk2019'], true, 'RR 0.49.'),
  copenhagenGroinReduction: k(0.4, 'ratio', [0.3, 0.5], 'M', ['haroy2019'], true, '41% lower risk.'),
  preventionDoseSetsPerWeek: design(4, 'sets/week', [2, 8], 'Minimum weekly dose for the prevention effect.'),
  /** Injury durations (days) by type: median. */
  durationStrainDays: design(14, 'days', [7, 42], 'Muscle strain.'),
  durationTendinopathyDays: design(42, 'days', [21, 120], 'Tendinopathy.'),
  durationJointIrritationDays: design(10, 'days', [5, 21], 'Joint irritation.'),
  durationLowBackDays: design(14, 'days', [7, 42], 'Low-back strain.'),
  durationStressFractureDays: design(56, 'days', [42, 90], 'Bone stress injury.'),
  /** Injury severity lognormal sigma on duration. */
  durationSigma: design(0.4, 'ln-sd', [0.2, 0.7], 'Spread of injury durations.'),
  /** Rehab exercise: fraction of injury duration removed by daily rehab. */
  rehabSpeedup: design(0.25, 'ratio', [0.1, 0.4], 'Rehab shortens time to return.'),
  /** Age multiplier on hazard at 60 vs 25. */
  ageHazardAt60: design(1.4, 'multiplier', [1.1, 2.0], 'Older tissues are more injury prone.'),
} as const;
