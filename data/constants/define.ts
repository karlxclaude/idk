// Helpers for declaring tunable constants. Every model constant lives in /data/constants and is
// accessed by the engine through a typed Params object. No magic numbers in engine code.
import type { Confidence, Constant } from '../schemas';

export type ConstantBody = Omit<Constant, 'id'>;

/**
 * Declare a constant.
 * @param value default value
 * @param unit unit string
 * @param range documented plausible range; tuning must stay inside it
 * @param confidence H | M | L | HEUR
 * @param sourceIds ids into data/sources.json ("design" for pure design choices)
 * @param verified whether the value was checked against the source
 * @param note free text: what it is, where it comes from, corrections
 */
export function k(
  value: number,
  unit: string,
  range: [number, number],
  confidence: Confidence,
  sourceIds: string[],
  verified: boolean,
  note: string,
): ConstantBody {
  return { value, unit, range, confidence, sourceIds, verified, note };
}

/** Shorthand for a pure game-design choice (no physiology claim). */
export function design(value: number, unit: string, range: [number, number], note: string): ConstantBody {
  return { value, unit, range, confidence: 'HEUR', sourceIds: ['design'], verified: true, note: `Design choice. ${note}` };
}

export type GroupDefs = Record<string, ConstantBody>;

export interface CurveDef {
  id: string;
  xUnit: string;
  unit: string;
  points: Array<{ x: number; y: number; range: [number, number] }>;
  confidence: Confidence;
  sourceIds: string[];
  verified: boolean;
  note: string;
}

/**
 * Declare a piecewise-linear curve. Each point becomes its own constant `${id}@${x}`
 * so every point is individually tunable and validated.
 */
export function curve(
  id: string,
  xUnit: string,
  unit: string,
  points: Array<[x: number, y: number, min: number, max: number]>,
  confidence: Confidence,
  sourceIds: string[],
  verified: boolean,
  note: string,
): CurveDef {
  return {
    id,
    xUnit,
    unit,
    points: points.map(([x, y, min, max]) => ({ x, y, range: [min, max] })),
    confidence,
    sourceIds,
    verified,
    note,
  };
}
