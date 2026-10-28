// Validate a single exercise module in isolation (used while authoring; independent of other library files).
// Usage: npx vite-node scripts/check-exercises.ts data/exercises/lib/<file>.ts
import path from 'node:path';
import { ExerciseSchema, type Exercise } from '../data/exercises/schema';
import { CORE_EXERCISES } from '../data/exercises/core';
import { MUSCLE_REGIONS, MOVEMENT_PATTERNS } from '../data/muscles';
import { makeContext } from '../engine/context';
import { referenceCharacter } from '../engine/character';
import { oneRepMax, repsAt, repsMultiplier } from '../engine/strength';

const file = process.argv[2];
if (!file) throw new Error('usage: check-exercises <module>');
const mod = (await import(path.resolve(file))) as Record<string, Exercise[]>;
const list = Object.values(mod).find(Array.isArray) ?? [];
const errors: string[] = [];
const coreIds = new Set(CORE_EXERCISES.map((e) => e.id));
const ids = new Set<string>();
const ctx = makeContext({ exercises: [...CORE_EXERCISES, ...list] });
const ref = referenceCharacter(ctx);
for (const e of list) {
  const r = ExerciseSchema.safeParse(e);
  if (!r.success) errors.push(`${e.id}: schema ${r.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
  if (coreIds.has(e.id)) errors.push(`${e.id}: duplicates a core.ts id`);
  if (ids.has(e.id)) errors.push(`${e.id}: duplicate id in file`);
  ids.add(e.id);
  for (const m of Object.keys(e.muscles)) if (!(MUSCLE_REGIONS as readonly string[]).includes(m)) errors.push(`${e.id}: unknown muscle ${m}`);
  for (const m of Object.keys(e.lengthBias)) if (!(m in e.muscles)) errors.push(`${e.id}: lengthBias on unlisted muscle ${m}`);
  if (!(MOVEMENT_PATTERNS as readonly string[]).includes(e.movementPattern)) errors.push(`${e.id}: unknown pattern`);
  if (Math.max(...(Object.values(e.muscles) as number[])) < 0.3) errors.push(`${e.id}: no muscle >= 0.3`);
  if (e.evidenceNotes.length < 6) errors.push(`${e.id}: missing evidenceNotes`);
  if (e.loadType === 'external' && !e.refLoad) errors.push(`${e.id}: external needs refLoad`);
  if (e.loadType === 'bodyweight' && e.bodyweightFraction === undefined) errors.push(`${e.id}: bodyweight needs bodyweightFraction`);
  if (e.category === 'cardio' && !e.cardio) errors.push(`${e.id}: cardio field required`);
  if (e.category === 'sprint' && !e.sprint) errors.push(`${e.id}: sprint field required`);
  if (/jefferson_curl|tibialis_raise|^neck_/.test(e.id) && !/limited|little|weak|sparse/i.test(e.evidenceNotes)) errors.push(`${e.id}: must state evidence is limited`);
  if (e.loadType !== 'none' && e.refLoad) {
    const orm = oneRepMax(ctx, ref, e.id);
    if (!(Math.abs(orm / e.refLoad - 1) < 0.05)) errors.push(`${e.id}: reference 1RM ${orm.toFixed(1)} vs refLoad ${e.refLoad}`);
    const reps = repsAt(ctx, 0.75, repsMultiplier(ctx, ref, e, 0));
    if (reps <= 6 || reps >= 18) errors.push(`${e.id}: reps at 75% = ${reps.toFixed(1)} (want 6-18; adjust repsModifier)`);
  }
}
console.log(`${list.length} exercises checked; ${errors.length} problems`);
for (const e of errors) console.log(' -', e);
if (errors.length) process.exit(1);
