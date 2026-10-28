// Pantry and grocery logistics: buy in whole purchase units, consume FIFO, spoil by shelf life.
// Pure functions that mutate only the pantry passed in. Pantry grams are MEAL grams (cooked weight for
// dry-priced foods), so consuming a meal needs no unit conversion.
import type { SimContext } from './context';
import { foodById, getFood, gramsPerPurchaseUnit, usdPerMealGram, type Meal, type MealItem } from './meals';

export interface PantryItem { foodId: string; grams: number; purchasedDay: number }
export interface Pantry { items: PantryItem[] }

const EPS = 1e-6;

export function emptyPantry(): Pantry {
  return { items: [] };
}

/** Whole purchase units needed to cover `grams` of meal weight. */
export function unitsFor(ctx: SimContext, foodId: string, grams: number): number {
  return Math.max(0, Math.ceil(grams / gramsPerPurchaseUnit(ctx, getFood(foodId)) - EPS));
}

/** Buy whole units for each list entry (rounded up); returns USD paid including the regional multiplier. */
export function buyGroceries(ctx: SimContext, pantry: Pantry, list: MealItem[], day: number): number {
  let usd = 0;
  for (const it of list) {
    const f = getFood(it.foodId);
    const units = unitsFor(ctx, it.foodId, it.grams);
    if (units === 0) continue;
    usd += units * f.priceUsd;
    pantry.items.push({ foodId: it.foodId, grams: units * gramsPerPurchaseUnit(ctx, f), purchasedDay: day });
  }
  return usd * ctx.P.economy.regionalPriceMultiplier;
}

/** Eat a meal from the pantry, oldest stock first. Returns the items (and grams) the pantry could not supply. */
export function consumeMeal(pantry: Pantry, meal: Meal, _day: number): MealItem[] {
  const missing: MealItem[] = [];
  pantry.items.sort((a, b) => a.purchasedDay - b.purchasedDay);
  for (const it of meal.items) {
    let need = it.grams;
    for (const p of pantry.items) {
      if (need <= EPS) break;
      if (p.foodId !== it.foodId || p.grams <= 0) continue;
      const take = Math.min(p.grams, need);
      p.grams -= take;
      need -= take;
    }
    if (need > EPS) missing.push({ foodId: it.foodId, grams: need });
  }
  pantry.items = pantry.items.filter((p) => p.grams > EPS);
  return missing;
}

/**
 * Remove items past shelfLifeDays (age >= shelfLifeDays) and return the USD value wasted.
 * Pass ctx to price the waste with the regional multiplier and cooked-yield handling; without it the
 * value uses cooked-weight price at yield 1 and no multiplier is applied.
 */
export function spoil(pantry: Pantry, day: number, ctx?: SimContext): number {
  let usd = 0;
  const keep: PantryItem[] = [];
  for (const p of pantry.items) {
    const f = foodById.get(p.foodId);
    if (f && day - p.purchasedDay >= f.shelfLifeDays) {
      usd += p.grams * (ctx ? usdPerMealGram(ctx, f) : f.pricePer100g / 100);
    } else keep.push(p);
  }
  pantry.items = keep;
  return ctx ? usd * ctx.P.economy.regionalPriceMultiplier : usd;
}

/** Aggregate a week of meals (days x meals) into a purchase list, grams rounded up to whole purchase units. */
export function shoppingListForWeek(ctx: SimContext, weekMeals: Meal[][]): MealItem[] {
  const totals = new Map<string, number>();
  for (const day of weekMeals) for (const meal of day) for (const it of meal.items) totals.set(it.foodId, (totals.get(it.foodId) ?? 0) + it.grams);
  return [...totals.entries()].map(([foodId, grams]) => ({
    foodId,
    grams: unitsFor(ctx, foodId, grams) * gramsPerPurchaseUnit(ctx, getFood(foodId)),
  }));
}

/** USD to buy a week's shopping list (whole units, regional multiplier). */
export function weeklyGroceryCost(ctx: SimContext, weekMeals: Meal[][]): number {
  return buyGroceries(ctx, emptyPantry(), shoppingListForWeek(ctx, weekMeals), 0);
}
