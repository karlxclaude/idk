import { describe, expect, it } from 'vitest';
import { botInput, createGame, score, step } from '../minigames/route_timing/logic';

const DT = 0.05;
function play(seed: string, d: number, bot: boolean, dur = 55): number {
  const s = createGame(seed, d, dur);
  while (!s.done) step(s, DT, bot ? botInput(s) : null);
  return score(s);
}
const avg = (d: number, bot: boolean) => {
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
  return seeds.reduce((t, k) => t + play(k, d, bot), 0) / seeds.length;
};

describe('route_timing logic', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 0.7), b = createGame('x', 0.7), c = createGame('y', 0.7);
    expect(a.cars).toEqual(b.cars);
    expect(a.lights).toEqual(b.lights);
    expect(a.order).toEqual(b.order);
    expect(a.cars).not.toEqual(c.cars);
    expect(play('x', 0.7, true)).toBe(play('x', 0.7, true));
  });
  it('bot scores >= 0.8 at difficulty 1', () => {
    const v = avg(1, true);
    console.log('bot d=1', v, 'd=0.3', avg(0.3, true));
    expect(v).toBeGreaterThanOrEqual(0.8);
  });
  it('same bot scores strictly less at difficulty 0.3', () => {
    expect(avg(0.3, true)).toBeLessThan(avg(1, true));
  });
  it('idle player scores <= 0.2', () => {
    expect(avg(1, false)).toBeLessThanOrEqual(0.2);
    expect(avg(0.3, false)).toBeLessThanOrEqual(0.2);
  });
  it('scores stay within [0,1]', () => {
    for (const d of [0, 0.3, 1]) for (const bot of [true, false]) {
      const v = play('r', d, bot);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
