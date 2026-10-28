// Enforces the spec rule: every model constant lives in /data, never as a magic number in engine code.
// Structural numbers (unit conversions, indices, 0/1/2, percent, days/week) are allow-listed in scripts/magic-numbers.mjs;
// physical constants and published formula coefficients live in engine/units.ts and engine/rng.ts.
import { describe, expect, it } from 'vitest';
import path from 'node:path';
// @ts-expect-error untyped helper script
import { scan } from '../scripts/magic-numbers.mjs';

describe('no magic numbers in engine code', () => {
  it('engine/*.ts contains only allow-listed numeric literals', () => {
    const found = (scan(path.join(__dirname, '..', 'engine')) as string[]).filter((l) => !l.startsWith('rng.ts') && !l.startsWith('units.ts'));
    expect(found).toEqual([]);
  });
});
