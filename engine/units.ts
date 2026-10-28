// Physical constants, unit conversions and published formula coefficients. These are definitions, not
// tunable model parameters, so they live here rather than in /data/constants.

export const KCAL_PER_G_PROTEIN = 4;
export const KCAL_PER_G_CARB = 4;
export const KCAL_PER_G_FAT = 9;
/** 1 MET = 3.5 mL O2 / kg / min (resting oxygen uptake by definition). */
export const ML_O2_PER_KG_MIN_PER_MET = 3.5;
/** Energy equivalent of oxygen: ~5 kcal per litre O2 (mixed fuel). */
export const KCAL_PER_L_O2 = 5;
/** ~20.9 kJ per litre O2. */
export const KJ_PER_L_O2 = 20.9;
export const METERS_40_YARDS = 36.576;
/** Kouri 1995 normalisation reference height (m). */
export const FFMI_REFERENCE_HEIGHT_M = 1.8;
/** Reference man used to anchor exercise refLoad values. */
export const REF_HEIGHT_M = 1.75;
export const REF_BODY_MASS_KG = 75;
export const REF_BODY_FAT = 0.2;
export const REF_AGE = 25;
/** Brzycki (1993): 1RM = w / (1.0278 - 0.0278 r). */
export const BRZYCKI_A = 1.0278;
export const BRZYCKI_B = 0.0278;
/** Epley (1985): 1RM = w (1 + r / 30). */
export const EPLEY_DIVISOR = 30;
/** Mifflin-St Jeor (1990) coefficients. */
export const MIFFLIN = { weight: 10, height: 6.25, age: 5, male: 5, female: -161 } as const;
/** Concept2 ergometer pace relationship: watts = 2.8 / (pace per metre)^3. */
export const CONCEPT2_K = 2.8;
export const DAYS_PER_YEAR = 365.25;
export const ROW_2K_M = 2000;
export const HOURS_PER_DAY = 24;
