// Nutrient density templates used when a day's intake is specified as a target (kcal + protein) rather than
// as a list of foods. Values per 1000 kcal of a typical US diet pattern (USDA FoodData Central-style averages). [L]
// The full food database (Phase 4) computes these exactly from foods; templates keep headless sims cheap.

export interface DietTemplate {
  id: string;
  label: string;
  per1000: {
    fiberG: number;
    sodiumG: number;
    waterL: number;
    ironHemeMg: number;
    ironNonHemeMg: number;
    vitDIU: number;
    magnesiumMg: number;
    b12Ug: number;
    calciumMg: number;
  };
  proteinQuality: number; // mean DIAAS
  leucineFraction: number; // leucine g per g protein
  satiety: number; // mean satiety index (white bread = 100)
}

export const DIET_TEMPLATES: Record<string, DietTemplate> = {
  omnivore: {
    id: 'omnivore', label: 'Mixed omnivore',
    per1000: { fiberG: 11, sodiumG: 1.6, waterL: 0.4, ironHemeMg: 0.9, ironNonHemeMg: 6, vitDIU: 90, magnesiumMg: 150, b12Ug: 2.2, calciumMg: 420 },
    proteinQuality: 1.0, leucineFraction: 0.085, satiety: 120,
  },
  wholeFoodOmnivore: {
    id: 'wholeFoodOmnivore', label: 'Whole-food omnivore',
    per1000: { fiberG: 16, sodiumG: 1.2, waterL: 0.5, ironHemeMg: 1.1, ironNonHemeMg: 7, vitDIU: 120, magnesiumMg: 200, b12Ug: 2.6, calciumMg: 450 },
    proteinQuality: 1.05, leucineFraction: 0.088, satiety: 150,
  },
  vegetarian: {
    id: 'vegetarian', label: 'Lacto-ovo vegetarian',
    per1000: { fiberG: 16, sodiumG: 1.4, waterL: 0.45, ironHemeMg: 0, ironNonHemeMg: 8, vitDIU: 50, magnesiumMg: 190, b12Ug: 1.1, calciumMg: 480 },
    proteinQuality: 0.88, leucineFraction: 0.08, satiety: 135,
  },
  vegan: {
    id: 'vegan', label: 'Vegan',
    per1000: { fiberG: 20, sodiumG: 1.3, waterL: 0.5, ironHemeMg: 0, ironNonHemeMg: 9, vitDIU: 15, magnesiumMg: 220, b12Ug: 0.1, calciumMg: 320 },
    proteinQuality: 0.78, leucineFraction: 0.075, satiety: 140,
  },
  fastFood: {
    id: 'fastFood', label: 'Fast food heavy',
    per1000: { fiberG: 6, sodiumG: 2.2, waterL: 0.3, ironHemeMg: 0.7, ironNonHemeMg: 4, vitDIU: 40, magnesiumMg: 100, b12Ug: 1.5, calciumMg: 330 },
    proteinQuality: 0.95, leucineFraction: 0.08, satiety: 80,
  },
};
