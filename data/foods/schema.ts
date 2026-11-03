import { z } from 'zod';

export const FOOD_GROUPS = [
  'dairyEggs', 'meat', 'seafood', 'legumesSoy', 'grains', 'fruit', 'vegetables', 'nutsSeedsFats', 'prepared', 'beverages', 'supplements',
] as const;

/** Hand-curated food spec (data/foods/spec/*.json). Nutrients are filled from USDA SR Legacy by scripts/build-foods.mjs. */
export const FoodSpecSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  group: z.enum(FOOD_GROUPS),
  /** USDA FoodData Central SR Legacy fdc_id (exact). null only for items absent from SR Legacy (then `manualPer100g` is required). */
  fdcId: z.number().int().nullable(),
  /** Retail price in USD (US average, ~2024-2025) for `priceUnitG` grams as sold. */
  priceUsd: z.number().positive(),
  priceUnitG: z.number().positive(),
  /** Typical serving in grams. */
  servingG: z.number().positive(),
  prepMinutes: z.number().min(0).max(180),
  shelfLifeDays: z.number().min(1).max(3650),
  /** Satiety index (white bread = 100). Holt 1995 value when available, else an estimate. */
  satietyIndex: z.number().min(30).max(400),
  satietySource: z.enum(['holt1995', 'estimated']),
  /** Digestible indispensable amino acid score (protein quality). */
  diaas: z.number().min(0).max(1.4),
  diaasSource: z.enum(['fao2013', 'rutherfurd2015', 'mathai2017', 'estimated']),
  /** Fraction of iron that is heme (meat/fish ~0.4; plants 0). */
  hemeFraction: z.number().min(0).max(1),
  /** True if this is a whole "prepared" item (ready-to-eat). */
  readyToEat: z.boolean(),
  tags: z.array(z.string()).default([]),
  /** Only when fdcId is null. Same keys as FoodNutrients. */
  manualPer100g: z.record(z.number()).optional(),
  notes: z.string().default(''),
});
export type FoodSpec = z.infer<typeof FoodSpecSchema>;

export const FoodNutrientsSchema = z.object({
  kcal: z.number(), proteinG: z.number(), fatG: z.number(), carbG: z.number(), fiberG: z.number(), waterG: z.number(), alcoholG: z.number(),
  sodiumMg: z.number(), potassiumMg: z.number(), calciumMg: z.number(), ironMg: z.number(), magnesiumMg: z.number(), zincMg: z.number(),
  b12Ug: z.number(), vitDIU: z.number(), omega3G: z.number(), leucineG: z.number(),
});
export type FoodNutrients = z.infer<typeof FoodNutrientsSchema>;

export const FoodSchema = FoodSpecSchema.extend({
  usdaDescription: z.string(),
  per100g: FoodNutrientsSchema,
  /** Price per 100 g (USD), national average before the regional multiplier. */
  pricePer100g: z.number(),
});
export type Food = z.infer<typeof FoodSchema>;
