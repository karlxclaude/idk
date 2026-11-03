// Constant registry: validates every constant against the mandatory schema and exposes typed params.
import { ConstantSchema, type Constant } from '../schemas';
import type { ConstantBody, CurveDef } from './define';
import { trainingDefs, trainingCurves } from './training';
import { hypertrophyDefs, hypertrophyCurves } from './hypertrophy';
import { strengthDefs, strengthCurves } from './strength';
import { powerDefs, powerCurves } from './power';
import { fatigueDefs, fatigueCurves } from './fatigue';
import { aerobicDefs, aerobicCurves } from './aerobic';
import { energyDefs, energyCurves } from './energy';
import { injuryDefs } from './injury';
import { nutritionDefs, nutritionCurves } from './nutrition';
import { geneticsDefs } from './genetics';
import { economyDefs } from './economy';
import { modelDefs } from './model';

export const constantGroups = {
  training: trainingDefs,
  hypertrophy: hypertrophyDefs,
  strength: strengthDefs,
  power: powerDefs,
  fatigue: fatigueDefs,
  aerobic: aerobicDefs,
  energy: energyDefs,
  injury: injuryDefs,
  nutrition: nutritionDefs,
  genetics: geneticsDefs,
  economy: economyDefs,
  model: modelDefs,
} as const;

export const curveGroups = {
  training: trainingCurves,
  hypertrophy: hypertrophyCurves,
  strength: strengthCurves,
  power: powerCurves,
  fatigue: fatigueCurves,
  aerobic: aerobicCurves,
  energy: energyCurves,
  nutrition: nutritionCurves,
} as const;

type GroupValues<G extends Record<string, ConstantBody>> = { [K in keyof G]: number };
export type Params = { [G in keyof typeof constantGroups]: GroupValues<(typeof constantGroups)[G]> };

export interface CurveTable {
  id: string;
  xs: number[];
  ys: number[];
}
export type Curves = { [G in keyof typeof curveGroups]: { [K in keyof (typeof curveGroups)[G]]: CurveTable } };

/** Flat list of every constant (including curve points) with its full id. */
export function allConstants(): Constant[] {
  const out: Constant[] = [];
  for (const [g, defs] of Object.entries(constantGroups)) {
    for (const [key, body] of Object.entries(defs as Record<string, ConstantBody>)) {
      out.push({ id: `${g}.${key}`, ...body });
    }
  }
  for (const defs of Object.values(curveGroups)) {
    for (const c of Object.values(defs as Record<string, CurveDef>)) {
      for (const p of c.points) {
        out.push({
          id: `${c.id}@${p.x}`,
          value: p.y,
          unit: c.unit,
          range: p.range,
          confidence: c.confidence,
          sourceIds: c.sourceIds,
          verified: c.verified,
          note: `${c.note} (x=${p.x} ${c.xUnit})`,
        });
      }
    }
  }
  return out;
}

/** Validate every constant; throws with a readable message listing all problems. */
export function validateConstants(): Constant[] {
  const all = allConstants();
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of all) {
    if (seen.has(c.id)) problems.push(`${c.id}: duplicate id`);
    seen.add(c.id);
    const r = ConstantSchema.safeParse(c);
    if (!r.success) problems.push(`${c.id}: ${r.error.issues.map((i) => i.message).join('; ')}`);
  }
  if (problems.length) throw new Error(`Constant validation failed:\n${problems.join('\n')}`);
  return all;
}

export function buildParams(): Params {
  const p: Record<string, Record<string, number>> = {};
  for (const [g, defs] of Object.entries(constantGroups)) {
    p[g] = {};
    for (const [key, body] of Object.entries(defs as Record<string, ConstantBody>)) p[g][key] = body.value;
  }
  return p as unknown as Params;
}

export function buildCurves(): Curves {
  const c: Record<string, Record<string, CurveTable>> = {};
  for (const [g, defs] of Object.entries(curveGroups)) {
    c[g] = {};
    for (const [key, def] of Object.entries(defs as Record<string, CurveDef>)) {
      c[g][key] = { id: def.id, xs: def.points.map((pt) => pt.x), ys: def.points.map((pt) => pt.y) };
    }
  }
  return c as unknown as Curves;
}

/** Deep-clone params with overrides applied (used for tuning and accelerated mode). */
export function withOverrides(base: Params, overrides: Partial<{ [G in keyof Params]: Partial<Params[G]> }>): Params {
  const out = JSON.parse(JSON.stringify(base)) as Params;
  for (const [g, vals] of Object.entries(overrides)) {
    if (!vals) continue;
    Object.assign((out as unknown as Record<string, Record<string, number>>)[g] as Record<string, number>, vals);
  }
  return out;
}

/** Default parameter set: constants validated once at module load. */
export const DEFAULT_PARAMS: Params = buildParams();
export const DEFAULT_CURVES: Curves = buildCurves();
