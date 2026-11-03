// Derived body-composition quantities. True values; measurement noise is applied in measure.ts.
import { MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { Params } from '../data/constants';
import type { CharacterState } from './types';
import { FFMI_REFERENCE_HEIGHT_M } from './units';

export function skeletalMuscle(s: CharacterState): number {
  let t = 0;
  for (const m of MUSCLE_REGIONS) t += s.muscles[m].mass;
  return t;
}

export function glycogenKg(s: CharacterState, P: Params): number {
  return (s.aerobic.glycogen * (1 + P.energy.waterPerGlycogen)) / 1000;
}

export function edemaKg(s: CharacterState, P: Params): number {
  let t = 0;
  for (const m of MUSCLE_REGIONS) {
    const st = s.muscles[m];
    t += Math.min(P.model.damageCap, st.damage) * st.mass * P.hypertrophy.edemaPerDamage;
  }
  return t;
}

/** Fat-free mass (kg): muscle + non-muscle lean + glycogen/water pools. */
export function fatFreeMass(s: CharacterState, P: Params): number {
  return skeletalMuscle(s) + s.body.nonMuscleLean + glycogenKg(s, P) + s.body.creatineWater + s.body.sodiumWater + edemaKg(s, P);
}

export function bodyMass(s: CharacterState, P: Params): number {
  return (fatFreeMass(s, P) + s.body.fatMass) * (1 - s.nutrition.hydration);
}

export function bodyFatFraction(s: CharacterState, P: Params): number {
  return s.body.fatMass / (fatFreeMass(s, P) + s.body.fatMass);
}

export function heightM(s: CharacterState): number {
  return s.anthro.heightCm / 100;
}

/** Normalized FFMI (Kouri 1995, correction 6.3 x (1.8 - h)). */
export function normalizedFfmi(s: CharacterState, P: Params): number {
  const h = heightM(s);
  return fatFreeMass(s, P) / (h * h) + P.hypertrophy.ffmiHeightCorrection * (FFMI_REFERENCE_HEIGHT_M - h);
}

/** Measured muscle size for a region (includes edema swelling, as imaging would). */
export function measuredMuscleSize(s: CharacterState, P: Params, m: MuscleId): number {
  const st = s.muscles[m];
  return st.mass * (1 + Math.min(P.model.damageCap, st.damage) * P.hypertrophy.edemaPerDamage);
}

/** Standing leg length (hip height) in metres. */
export function legLengthM(s: CharacterState, P: Params): number {
  return (s.anthro.thigh + s.anthro.shank + P.genetics.footHeightFraction) * heightM(s);
}

export function glycogenCapacity(s: CharacterState, P: Params, trainingStatus: number): number {
  return P.aerobic.glycogenPerKgMuscle * skeletalMuscle(s) * (1 + P.hypertrophy.trainedGlycogenBonus * trainingStatus) + P.aerobic.liverGlycogenG;
}
