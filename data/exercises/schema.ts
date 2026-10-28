import { z } from 'zod';
import { MOVEMENT_PATTERNS, MUSCLE_REGIONS } from '../muscles';

export const GYM_TIERS = ['home', 'budget', 'commercial', 'powerlifting', 'strongman', 'track', 'outdoor', 'pool'] as const;
export type GymTier = (typeof GYM_TIERS)[number];

export const EXERCISE_CATEGORIES = [
  'horizontalPress', 'verticalPress', 'row', 'pull', 'squat', 'hinge', 'kneeFlexion', 'adductor', 'lowerLeg', 'arms',
  'shoulders', 'core', 'calisthenics', 'isometric', 'olympic', 'plyometric', 'sprint', 'strongman', 'grip', 'neck', 'cardio', 'prehab',
] as const;

export const CARDIO_MODALITIES = ['running', 'cycling', 'rowing', 'swimming', 'skiErg', 'airBike', 'walking', 'rucking', 'stairs', 'jumpRope', 'elliptical', 'other'] as const;
export type CardioModality = (typeof CARDIO_MODALITIES)[number];

const muscleMap = z.record(z.enum(MUSCLE_REGIONS), z.number().min(0).max(1));

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  category: z.enum(EXERCISE_CATEGORIES),
  movementPattern: z.enum(MOVEMENT_PATTERNS),
  equipment: z.array(z.string()),
  gymTier: z.enum(GYM_TIERS),
  /** Activation per region: 1.0 primary, ~0.5 synergist (fractional set credit). */
  muscles: muscleMap,
  /** Stretch emphasis per region (0 = shortened bias, 1 = fully lengthened). */
  lengthBias: muscleMap.default({}),
  resistanceProfile: z.enum(['ascending', 'descending', 'flat', 'bell']),
  axialLoad: z.number().min(0).max(1),
  systemicFatigue: z.number().min(0).max(1),
  localDamage: z.number().min(0).max(1),
  skillDemand: z.number().min(0).max(1),
  learningRate: z.number().min(0.1).max(3),
  baseInjuryRisk: z.number().min(0).max(1),
  riskTissues: z.array(z.string()),
  adaptationBias: z.object({
    hypertrophy: z.number().min(0).max(2),
    maxStrength: z.number().min(0).max(2),
    power: z.number().min(0).max(2),
    muscularEndurance: z.number().min(0).max(2),
    speed: z.number().min(0).max(2),
    jump: z.number().min(0).max(2),
    aerobic: z.number().min(0).max(2),
  }),
  leverageExponents: z.object({
    femurTorso: z.number().optional(),
    armLength: z.number().optional(),
    torsoLength: z.number().optional(),
  }).default({}),
  metValue: z.number().min(0.9).max(25),
  peakPowerLoadPct: z.number().min(0).max(100).optional(),
  evidenceNotes: z.string(),
  verified: z.boolean(),
  // --- engine fields ---
  /** How load is expressed. 'external' = kg on bar; 'bodyweight' = BW (+ optional external); 'none' = no load (plyo, sprint, cardio). */
  loadType: z.enum(['external', 'bodyweight', 'none']).default('external'),
  /** Expected 1RM (kg) of the reference untrained 75 kg man at starting skill. Required for 'external' exercises. */
  refLoad: z.number().positive().optional(),
  /** Fraction of body weight lifted in a bodyweight exercise (e.g. push-up ~0.64, pull-up 1.0). */
  bodyweightFraction: z.number().min(0).max(1.2).optional(),
  /** Multiplier on reps achievable at a given %1RM (lower-body/machine > 1). */
  repsModifier: z.number().min(0.7).max(1.5).default(1),
  /** Cardio-only fields. */
  cardio: z.object({ modality: z.enum(CARDIO_MODALITIES), defaultZone: z.union([z.literal(1), z.literal(2), z.literal(3)]), impact: z.number().min(0).max(1) }).optional(),
  /** Sprint-only: specific adaptation bias. */
  sprint: z.object({ f0h: z.number().min(0).max(1), vmax: z.number().min(0).max(1), technique: z.number().min(0).max(1) }).optional(),
  /** Prevention tags (e.g. 'nordic', 'copenhagen'). */
  prevention: z.array(z.string()).default([]),
  /** Lower-body contribution to an upper-body press (bench leg drive), 0-1. Affects load expression, not hypertrophy. */
  legDrive: z.number().min(0).max(1).default(0),
  /** Unilateral exercises deliver cross-education. */
  unilateral: z.boolean().default(false),
  /** Sides: exercises performed per-side double the time cost. */
  secondsPerRep: z.number().min(0.5).max(120).default(3),
});
export type Exercise = z.infer<typeof ExerciseSchema>;
export type ExerciseInput = z.input<typeof ExerciseSchema>;

/** Stimulus-to-fatigue ratio computed from fields, never hand-labelled (Israetel/RP heuristic). */
export function stimulusToFatigueRatio(e: Exercise): number {
  const stim = Object.values(e.muscles).reduce((a, b) => a + b, 0) * (0.5 + 0.5 * e.adaptationBias.hypertrophy);
  const cost = e.systemicFatigue + e.localDamage + e.axialLoad + 0.2;
  return stim / cost;
}
