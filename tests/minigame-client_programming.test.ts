import { describe, expect, it } from 'vitest';
import {
  GOALS, bestOutcome, createGame, evaluate, lockPlan, presetPlans, runOutcome, score, setChoice, step, type GameState,
} from '../minigames/client_programming/logic';

const SEEDS = Array.from({ length: 12 }, (_, i) => `t${i}`);

/** Bot: picks the best preset (by simulation) after `thinkSec` of decision time, if the clock allows. */
function playBot(g: GameState, thinkSec: number): number {
  const plans = presetPlans(g.client.goal);
  let best = plans[0]!;
  let bo = -Infinity;
  for (const p of plans) {
    const o = runOutcome(g.client, g.seed, p);
    if (o > bo) { bo = o; best = p; }
  }
  step(g, thinkSec);
  if (!g.locked) setChoice(g, best);
  lockPlan(g);
  return evaluate(g);
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('client programming logic', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 0.5);
    const b = createGame('x', 0.5);
    expect(a.client).toEqual(b.client);
    expect(a.form).toEqual(b.form);
    expect(runOutcome(a.client, 'x', a.choice)).toBe(runOutcome(b.client, 'x', b.choice));
    expect(new Set(SEEDS.map((s) => createGame(s, 1).client.goal)).size).toBeGreaterThan(1);
    expect(GOALS.length).toBe(4);
  });

  it('bot choosing a preset scores >= 0.8 at difficulty 1 (all goals)', () => {
    const scores = SEEDS.map((s) => playBot(createGame(s, 1), 20));
    expect(new Set(SEEDS.map((s) => createGame(s, 1).client.goal)).size).toBe(4);
    for (const x of scores) expect(x).toBeGreaterThanOrEqual(0.8);
  }, 120000);

  it('same bot (needs 30 s to decide) scores strictly less at difficulty 0.3: clock runs out', () => {
    const hi = mean(SEEDS.map((s) => playBot(createGame(s, 1), 30)));
    const lo = mean(SEEDS.map((s) => playBot(createGame(s, 0.3), 30)));
    expect(createGame('a', 0.3).decisionSec).toBeLessThan(createGame('a', 1).decisionSec);
    expect(lo).toBeLessThan(hi);
  }, 120000);

  it('lower difficulty gives noisier / missing intake info', () => {
    const err = (d: number) => {
      let sum = 0, n = 0, missing = 0, total = 0;
      for (let i = 0; i < 200; i++) {
        const g = createGame(`n${i}`, d);
        total++;
        if (g.form.bodyFat === null) missing++;
        else { sum += Math.abs(g.form.bodyFat - g.client.bodyFat); n++; }
      }
      return { err: sum / n, missing: missing / total };
    };
    expect(err(1)).toEqual({ err: 0, missing: 0 });
    expect(err(0.3).err).toBeGreaterThan(0.02);
    expect(err(0.3).missing).toBeGreaterThan(0.2);
  });

  it('idle player (defaults, never touches the plan) scores <= 0.85 and stays in [0,1]', () => {
    const scores = SEEDS.map((s) => {
      const g = createGame(s, 1);
      step(g, 1000);
      return evaluate(g);
    });
    for (const x of scores) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(0.85); }
    console.log('idle mean', mean(scores).toFixed(3), 'max', Math.max(...scores).toFixed(3));
  }, 120000);

  it('edits are ignored after lock and sim is fast', () => {
    const g = createGame('f', 1);
    const t = Date.now();
    evaluate(g);
    bestOutcome(g);
    expect(Date.now() - t).toBeLessThan(400);
    const before = { ...g.choice };
    setChoice(g, { days: 5 });
    expect(g.choice).toEqual(before);
    expect(score(g)).toBeGreaterThanOrEqual(0);
    expect(score(g)).toBeLessThanOrEqual(1);
  });
});
