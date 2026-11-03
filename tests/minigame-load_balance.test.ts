import { describe, expect, it } from 'vitest';
import { botInput, createGame, paramsFor, score, step, type LoadBalanceInput, type LoadBalanceState } from '../minigames/load_balance/logic';

const DT = 1 / 60;
function run(seed: string, difficulty: number, pick: (s: LoadBalanceState) => LoadBalanceInput): LoadBalanceState {
  const s = createGame(seed, difficulty);
  while (!s.done) step(s, DT, pick(s));
  return s;
}
const bot = (s: LoadBalanceState) => botInput(s);
const idle = () => ({ dir: 0 });
const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
const mean = (d: number, f: (s: LoadBalanceState) => LoadBalanceInput) => seeds.reduce((t, x) => t + score(run(x, d, f)), 0) / seeds.length;

describe('load_balance', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 1), b = createGame('x', 1), c = createGame('y', 1);
    expect(a.sway).toEqual(b.sway);
    expect(a.sway).not.toEqual(c.sway);
    expect(score(run('x', 0.6, bot))).toBe(score(run('x', 0.6, bot)));
  });
  it('low difficulty is harder in parameters', () => {
    const hi = paramsFor(1), lo = paramsFor(0.3);
    expect(lo.noiseSd).toBeGreaterThan(hi.noiseSd);
    expect(lo.lagTau).toBeGreaterThan(hi.lagTau);
    expect(lo.dropTilt).toBeLessThan(hi.dropTilt);
  });
  it('bot scores >= 0.8 at difficulty 1', () => {
    expect(mean(1, bot)).toBeGreaterThanOrEqual(0.8);
  });
  it('same bot scores strictly less at difficulty 0.3', () => {
    expect(mean(0.3, bot)).toBeLessThan(mean(1, bot));
  });
  it('idle player scores <= 0.2', () => {
    for (const x of seeds) expect(score(run(x, 1, idle))).toBeLessThanOrEqual(0.2);
  });
  it('scores stay in [0, 1]', () => {
    for (const d of [0, 0.3, 1]) for (const f of [bot, idle]) {
      const v = score(run('z', d, f));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
