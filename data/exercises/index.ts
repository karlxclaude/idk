// Exercise registry. Phase 1 ships the core benchmark set; Phase 2 extends it to the full library.
import type { Exercise } from './schema';
import { validateExercises } from './define';
import { CORE_EXERCISES } from './core';
import { LIBRARY_EXERCISES } from './library';

export const EXERCISES: Exercise[] = validateExercises([...CORE_EXERCISES, ...LIBRARY_EXERCISES]);
export const EXERCISE_MAP: ReadonlyMap<string, Exercise> = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const e = EXERCISE_MAP.get(id);
  if (!e) throw new Error(`unknown exercise ${id}`);
  return e;
}

export type { Exercise } from './schema';
