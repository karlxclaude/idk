// Weekly plan templates -> per-day inputs. Intake can be explicit or a target the engine resolves after
// computing the day's expenditure (a perfect food tracker).
import { DIET_TEMPLATES } from '../data/diets';
import { PLAN_DEFAULTS } from '../data/planDefaults';
import type { SimContext } from './context';
import { bodyMass } from './body';
import { clamp } from './math';
import type { CharacterState, DayInputs, Intake, Session } from './types';
import { KCAL_PER_G_FAT, KCAL_PER_G_PROTEIN, KCAL_PER_G_CARB } from './units';

export interface IntakeTarget {
  /** Daily energy balance target (kcal). Ignored if fixedKcal is set. */
  balanceKcal: number;
  /** Fixed daily intake (kcal) regardless of expenditure. */
  fixedKcal?: number;
  proteinGkg: number;
  fatFraction?: number;
  diet?: keyof typeof DIET_TEMPLATES;
  meals?: number;
  alcoholDrinks?: number;
  waterL?: number;
}

export interface WeeklyPlan {
  /** 7 entries, index 0 = day 0 of the week. */
  week: Array<{ sessions: Session[]; sleepH?: number; jobHours?: number; socialHours?: number; alcoholDrinks?: number }>;
  sleepH: number;
  bedHour: number;
  intake: IntakeTarget;
  caffeine?: Array<{ mg: number; hour: number }>;
  jobHours?: number;
  jobMet?: number;
  jobStrain?: number;
  socialHours?: number;
  sunMinutes?: number;
  supplements?: Partial<DayInputs['supplements']>;
  disableRandomEvents?: boolean;
}

export const NO_SUPPLEMENTS: DayInputs['supplements'] = { creatine: false, betaAlanine: false, nitrate: false, bicarb: false, vitDIU: 0, ironMg: 0, b12: false, magnesium: false };

export type DayInputsWithTarget = DayInputs & { intakeTarget?: IntakeTarget };

export function inputsForDay(plan: WeeklyPlan, day: number): DayInputsWithTarget {
  const w = plan.week[day % 7] ?? { sessions: [] };
  return {
    sessions: w.sessions,
    sleepH: w.sleepH ?? plan.sleepH,
    bedHour: plan.bedHour,
    intake: emptyIntake(),
    intakeTarget: { ...plan.intake, alcoholDrinks: w.alcoholDrinks ?? plan.intake.alcoholDrinks ?? 0 },
    caffeine: plan.caffeine ?? [],
    jobHours: w.jobHours ?? plan.jobHours ?? 0,
    jobMet: plan.jobMet ?? PLAN_DEFAULTS.jobMet,
    jobStrain: plan.jobStrain ?? PLAN_DEFAULTS.jobStrain,
    stressEvents: 0,
    socialHours: w.socialHours ?? plan.socialHours ?? 1,
    sunMinutes: plan.sunMinutes ?? PLAN_DEFAULTS.sunMinutes,
    ambientTempC: Number.NaN,
    supplements: { ...NO_SUPPLEMENTS, ...(plan.supplements ?? {}) },
    disableRandomEvents: plan.disableRandomEvents ?? false,
  };
}

export function emptyIntake(): Intake {
  return {
    kcal: 0, proteinG: 0, carbG: 0, fatG: 0, fiberG: 0, alcoholDrinks: 0, sodiumG: 3, waterL: 2,
    ironHemeMg: 0, ironNonHemeMg: 0, vitDIU: 0, magnesiumMg: 0, b12Ug: 0, calciumMg: 0,
    proteinQuality: 1, proteinMeals: 3, leucineG: 0, satiety: 100,
  };
}

/** Build a full intake from a target and today's expenditure. */
export function intakeFromTarget(ctx: SimContext, s: CharacterState, t: IntakeTarget, tdee: number): Intake {
  const bw = bodyMass(s, ctx.P);
  const diet = DIET_TEMPLATES[t.diet ?? 'omnivore'] ?? DIET_TEMPLATES.omnivore;
  if (!diet) throw new Error('diet template missing');
  const alcohol = t.alcoholDrinks ?? 0;
  const kcal = Math.max(PLAN_DEFAULTS.minKcal, t.fixedKcal ?? tdee + t.balanceKcal);
  const alcoholKcal = alcohol * ctx.P.nutrition.kcalPerDrink;
  const foodKcal = Math.max(PLAN_DEFAULTS.minFoodKcal, kcal - alcoholKcal);
  const proteinG = Math.min(t.proteinGkg * bw, (foodKcal * PLAN_DEFAULTS.maxProteinShare) / KCAL_PER_G_PROTEIN);
  const fatG = ((t.fatFraction ?? PLAN_DEFAULTS.fatFraction) * foodKcal) / KCAL_PER_G_FAT;
  const carbG = Math.max(0, (foodKcal - proteinG * KCAL_PER_G_PROTEIN - fatG * KCAL_PER_G_FAT) / KCAL_PER_G_CARB);
  const k = foodKcal / 1000;
  const meals = t.meals ?? 4;
  const perMealGkg = proteinG / bw / meals;
  const n = diet.per1000;
  return {
    kcal,
    proteinG,
    carbG,
    fatG,
    fiberG: n.fiberG * k,
    alcoholDrinks: alcohol,
    sodiumG: n.sodiumG * k,
    waterL: t.waterL ?? PLAN_DEFAULTS.waterL,
    ironHemeMg: n.ironHemeMg * k,
    ironNonHemeMg: n.ironNonHemeMg * k,
    vitDIU: n.vitDIU * k,
    magnesiumMg: n.magnesiumMg * k,
    b12Ug: n.b12Ug * k,
    calciumMg: n.calciumMg * k,
    proteinQuality: diet.proteinQuality,
    proteinMeals: perMealGkg >= ctx.P.nutrition.proteinPerMealTarget ? meals : Math.floor(clamp(proteinG / (bw * ctx.P.nutrition.proteinPerMealTarget), 0, meals)),
    leucineG: proteinG * diet.leucineFraction,
    satiety: diet.satiety,
  };
}
