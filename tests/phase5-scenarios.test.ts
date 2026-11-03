import { describe, expect, it } from 'vitest';
import { makeContext } from '../engine/context';
import { advanceDays } from '../engine/game';
import { MUSCLE_REGIONS } from '../data/muscles';
import { checkScenario, SCENARIOS, startScenario } from '../engine/scenarios';

const ctx = makeContext({ accelerated: false });

describe('Phase 5: scenarios', () => {
  it('every scenario starts without throwing and has an id', () => {
    expect(SCENARIOS.map((s) => s.id)).toContain('sandbox');
    expect(SCENARIOS.length).toBe(8);
    for (const sc of SCENARIOS) {
      const { game, run } = startScenario(ctx, sc.id, 'seed-a');
      expect(run.status).toBe('active');
      expect(game.character.day).toBe(run.startDay);
      const r = checkScenario(ctx, game, run);
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
    }
  });

  it('sandbox never completes', () => {
    const { game, run } = startScenario(ctx, 'sandbox', 's');
    advanceDays(ctx, game, 10);
    const r = checkScenario(ctx, game, run);
    expect(r.done).toBe(false);
    expect(r.status).toBe('active');
  });

  it('lean gain: ~0 at day 0, rises with added lean mass', () => {
    const { game, run } = startScenario(ctx, 'lean_gain_5kg', 's');
    const r0 = checkScenario(ctx, game, run);
    expect(r0.progress).toBeCloseTo(0, 2);
    game.character.body.nonMuscleLean += 2.5;
    const r1 = checkScenario(ctx, game, run);
    expect(r1.progress).toBeGreaterThan(0.4);
    game.character.body.nonMuscleLean += 3;
    const r2 = checkScenario(ctx, game, run);
    expect(r2.done).toBe(true);
    expect(run.status).toBe('completed');
  });

  it('cut starts near 20% bf and fails when strength drops', () => {
    const { game, run } = startScenario(ctx, 'cut_12_bf', 's');
    expect(run.baseline.bodyFat).toBeCloseTo(ctx.P.model.scnCutStartBf, 1);
    expect(checkScenario(ctx, game, run).status).toBe('active');
    const clone = structuredClone(game);
    for (const m of MUSCLE_REGIONS) clone.character.muscles[m].mass *= 0.8;
    const r = checkScenario(ctx, clone, run);
    expect(r.failure).not.toBeNull();
    expect(run.status).toBe('failed');
  });

  it('return from injury begins with an active injury', () => {
    const { game, run } = startScenario(ctx, 'return_from_injury', 's');
    expect(game.character.injuries.length).toBe(1);
    expect(game.character.injuries[0]?.tissue).toBe('hamstrings');
    const r = checkScenario(ctx, game, run);
    expect(r.done).toBe(false);
  });

  it('is deterministic', () => {
    const a = startScenario(ctx, 'beginner_recomp', 'same');
    const b = startScenario(ctx, 'beginner_recomp', 'same');
    advanceDays(ctx, a.game, 5);
    advanceDays(ctx, b.game, 5);
    expect(a.run).toEqual(b.run);
    expect(checkScenario(ctx, a.game, a.run)).toEqual(checkScenario(ctx, b.game, b.run));
  });
});
