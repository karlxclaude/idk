// Meals: food database access, nutrient/cost/prep aggregation and the Intake the engine consumes.
// All numeric model values live in data/constants (nutrition.* / economy.*); template grams are written as
// "foodId grams" strings so the data stays readable and free of magic-number literals.
import { z } from 'zod';
import foodsJson from '../data/foods/foods.generated.json';
import { FoodSchema, type Food, type FoodNutrients } from '../data/foods/schema';
import type { SimContext } from './context';
import { emptyIntake } from './plan';
import type { Intake } from './types';

export const FOODS: Food[] = z.array(FoodSchema).parse(foodsJson);
export const foodById: ReadonlyMap<string, Food> = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: string): Food {
  const f = foodById.get(id);
  if (!f) throw new Error(`unknown food id: ${id}`);
  return f;
}

export interface MealItem { foodId: string; grams: number }
export interface Meal { name: string; items: MealItem[]; hour?: number }

/**
 * Foods whose retail price is per DRY weight while the nutrient row (and meal grams) are COOKED/boiled.
 * Chosen from the spec notes ("Price is for dry ...", "Price per ... dry", "nutrients cooked"). Explicit id list, no tags.
 * Their cost per meal gram is divided by nutrition.cookedYieldDryPriced.
 */
export const DRY_PRICED_COOKED_IDS: ReadonlySet<string> = new Set([
  'white_rice_cooked', 'brown_rice_cooked', 'oatmeal_cooked', 'spaghetti_cooked', 'whole_wheat_spaghetti_cooked',
  'quinoa_cooked', 'couscous_cooked',
  'black_beans_boiled', 'chickpeas_boiled', 'lentils_boiled', 'kidney_beans_boiled', 'pinto_beans_boiled',
  'navy_beans_boiled', 'split_peas_boiled',
]);

/** Meal grams obtained per gram of purchased (dry) product. 1 for foods priced as eaten. */
export function cookedYield(ctx: SimContext, food: Food): number {
  return DRY_PRICED_COOKED_IDS.has(food.id) ? ctx.P.nutrition.cookedYieldDryPriced : 1;
}

/** Meal grams in one purchase unit (priceUnitG, scaled by cooked yield). */
export function gramsPerPurchaseUnit(ctx: SimContext, food: Food): number {
  return food.priceUnitG * cookedYield(ctx, food);
}

/** USD (before regional multiplier) per meal gram. */
export function usdPerMealGram(ctx: SimContext, food: Food): number {
  return food.priceUsd / gramsPerPurchaseUnit(ctx, food);
}

const NUTRIENT_KEYS = Object.keys(FoodSchema.shape.per100g.shape) as Array<keyof FoodNutrients>;

export function zeroNutrients(): FoodNutrients {
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0])) as unknown as FoodNutrients;
}

/** Total nutrients of a meal (all FoodNutrients fields). */
export function mealNutrients(meal: Meal): FoodNutrients {
  const t = zeroNutrients();
  for (const it of meal.items) {
    const f = getFood(it.foodId);
    const scale = it.grams / 100;
    for (const key of NUTRIENT_KEYS) t[key] += f.per100g[key] * scale;
  }
  return t;
}

/** Build a day's Intake from its meals. bodyMassKg sets the per-meal protein target (g/kg x mass). */
export function intakeFromMeals(ctx: SimContext, meals: Meal[], bodyMassKg: number): Intake {
  const N = ctx.P.nutrition;
  const out = emptyIntake();
  const target = N.proteinPerMealTarget * bodyMassKg;
  let diaasProtein = 0;
  let satietyKcal = 0;
  let waterG = 0;
  let sodiumMg = 0;
  let alcoholG = 0;
  let proteinMeals = 0;
  out.kcal = out.proteinG = out.carbG = out.fatG = out.fiberG = 0;
  for (const meal of meals) {
    let mealProtein = 0;
    for (const it of meal.items) {
      const f = getFood(it.foodId);
      const n = f.per100g;
      const s = it.grams / 100;
      const protein = n.proteinG * s;
      const kcal = n.kcal * s;
      mealProtein += protein;
      out.kcal += kcal;
      out.proteinG += protein;
      out.carbG += n.carbG * s;
      out.fatG += n.fatG * s;
      out.fiberG += n.fiberG * s;
      out.ironHemeMg += n.ironMg * s * f.hemeFraction;
      out.ironNonHemeMg += n.ironMg * s * (1 - f.hemeFraction);
      out.vitDIU += n.vitDIU * s;
      out.magnesiumMg += n.magnesiumMg * s;
      out.b12Ug += n.b12Ug * s;
      out.calciumMg += n.calciumMg * s;
      out.leucineG += n.leucineG * s;
      sodiumMg += n.sodiumMg * s;
      // Only drinks count toward waterL: hydrationStep already credits a fixed amount of water from solid food.
      if (f.group === 'beverages') waterG += n.waterG * s;
      alcoholG += n.alcoholG * s;
      diaasProtein += f.diaas * protein;
      satietyKcal += f.satietyIndex * kcal;
    }
    if (mealProtein >= target) proteinMeals += 1;
  }
  out.alcoholDrinks = alcoholG / N.gramsEthanolPerDrink;
  out.sodiumG = sodiumMg / 1000;
  out.waterL = waterG / 1000;
  out.proteinMeals = proteinMeals;
  if (out.proteinG > 0) out.proteinQuality = Math.min(1, diaasProtein / out.proteinG);
  if (out.kcal > 0) out.satiety = satietyKcal / out.kcal;
  return out;
}

/** Cost in USD of the food in a meal (pro-rata, with regional multiplier). */
export function mealCost(ctx: SimContext, meal: Meal): number {
  let usd = 0;
  for (const it of meal.items) usd += it.grams * usdPerMealGram(ctx, getFood(it.foodId));
  return usd * ctx.P.economy.regionalPriceMultiplier;
}

/** Active prep minutes: the longest single-item prep plus an increment per ingredient. */
export function mealPrepMinutes(ctx: SimContext, meal: Meal): number {
  if (meal.items.length === 0) return 0;
  let longest = 0;
  for (const it of meal.items) longest = Math.max(longest, getFood(it.foodId).prepMinutes);
  return longest + ctx.P.nutrition.mealPrepMinPerItem * meal.items.length;
}

// ---- Templates -----------------------------------------------------------------------------------------------

function tpl(name: string, hourStr: string, items: string[]): Meal {
  return {
    name, hour: Number(hourStr),
    items: items.map((s) => {
      const [foodId, g] = s.split(' ');
      if (!foodId || !g || !foodById.has(foodId)) throw new Error(`bad template item "${s}" in ${name}`);
      return { foodId, grams: Number(g) };
    }),
  };
}

export const MEAL_TEMPLATES: Meal[] = [
  tpl('Oats + whey + banana breakfast', '8', ['rolled_oats_dry 80', 'whey_isolate_powder 30', 'banana 120', 'milk_2pct 244', 'peanut_butter_smooth 16']),
  tpl('Vegan oats + soy breakfast', '8', ['rolled_oats_dry 80', 'pea_protein_powder 30', 'banana 120', 'soy_milk_unsweetened 244', 'peanut_butter_smooth 16']),
  tpl('Eggs + toast breakfast', '8', ['egg_fried 138', 'whole_wheat_bread 84', 'orange_juice 240', 'butter_salted 7']),
  tpl('Chicken, rice, broccoli', '13', ['chicken_breast_roasted 180', 'white_rice_cooked 300', 'broccoli_cooked 150', 'olive_oil 10']),
  tpl('Vegan lentil bowl', '13', ['lentils_boiled 300', 'brown_rice_cooked 200', 'spinach_cooked 100', 'olive_oil 10', 'tofu_firm 126']),
  tpl('Salmon, potato, green beans dinner', '19', ['salmon_atlantic_farmed_cooked 150', 'potato_baked 250', 'green_beans_cooked 150', 'olive_oil 10']),
  tpl('Beef pasta dinner', '19', ['ground_beef_90_10_cooked 150', 'spaghetti_cooked 350', 'tomatoes_raw 150', 'mixed_vegetables_frozen_cooked 100', 'parmesan_hard 15']),
  tpl('PB sandwich budget lunch', '13', ['whole_wheat_bread 112', 'peanut_butter_smooth 48', 'banana 118', 'milk_2pct 244']),
  tpl('Fast food day', '12', ['cheeseburger_fast_food 238', 'french_fries_fast_food 117', 'cola_regular 355', 'pizza_pepperoni_slice 115', 'chicken_nuggets_fast_food 100', 'glazed_doughnut 60']),
];

export interface DayTemplate { name: string; meals: Meal[] }

const byName = (n: string): Meal => {
  const m = MEAL_TEMPLATES.find((x) => x.name === n);
  if (!m) throw new Error(`no template ${n}`);
  return m;
};

/** Ready-made full days (home cooking) for the sim and tests. */
export const DAY_TEMPLATES: DayTemplate[] = [
  { name: 'Omnivore training day', meals: [byName('Oats + whey + banana breakfast'), byName('Chicken, rice, broccoli'), byName('Beef pasta dinner')] },
  { name: 'Vegan day', meals: [byName('Vegan oats + soy breakfast'), byName('Vegan lentil bowl'), byName('Vegan lentil bowl')] },
  { name: 'Budget day', meals: [byName('Eggs + toast breakfast'), byName('PB sandwich budget lunch'), byName('Chicken, rice, broccoli')] },
];
