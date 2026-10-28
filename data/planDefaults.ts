// Default values for weekly plans and the built-in diet controllers (design choices; see DECISIONS.md).
export const PLAN_DEFAULTS = {
  jobMet: 1.5, // sedentary-ish day without a job (Compendium: light activity)
  jobStrain: 0.2,
  sunMinutes: 20,
  minKcal: 600,
  minFoodKcal: 400,
  maxProteinShare: 0.6,
  fatFraction: 0.3,
  waterL: 2.5,
} as const;

export const DIET_CONTROLLER_DEFAULTS = {
  bandSurplus: 250,
  bandDeficit: -400,
  targetSurplus: 300,
  targetKcalPerPct: 120,
  maxDeficit: -500,
} as const;
