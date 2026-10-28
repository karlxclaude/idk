import { describe, expect, it } from 'vitest';
import { makeRng } from '../engine/rng';
import { createGame, isDone, score, step, type Game } from '../minigames/rhythm_timing/logic';

const DT = 1 / 120;
const DURATION = 50;

/** Bot presses each note with gaussian timing jitter (sd seconds); idle bot presses nothing. */
function play(seed: string, difficulty: number, jitterSd: number, active = true): { g: Game; score: number } {
  const g = createGame(seed, difficulty, DURATION);
  const rng = makeRng(`bot:${seed}`);
  const plan = g.notes.map((n) => ({ lane: n.lane, at: n.time + rng.normal(0, jitterSd) - 0 }));
  let i = 0;
  const sorted = [...plan].sort((a, b) => a.at - b.at);
  while (!isDone(g)) {
    const presses: number[] = [];
    while (active && i < sorted.length && sorted[i]!.at <= g.t + DT) presses.push(sorted[i++]!.lane);
    step(g, DT, { presses });
  }
  return { g, score: score(g) };
}

const avg = (d: number, sd: number, active = true) => {
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
  return seeds.reduce((s, sd0) => s + play(sd0, d, sd, active).score, 0) / seeds.length;
};

describe('rhythm_timing', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 0.7, DURATION);
    const b = createGame('x', 0.7, DURATION);
    expect(a.notes).toEqual(b.notes);
    expect(createGame('y', 0.7, DURATION).notes).not.toEqual(a.notes);
    expect(a.notes.length).toBeGreaterThan(15);
  });

  it('a skilled bot scores >= 0.8 at difficulty 1', () => {
    expect(avg(1, 0.05)).toBeGreaterThanOrEqual(0.8);
  });

  it('the same bot scores strictly less at difficulty 0.3', () => {
    const hi = avg(1, 0.05);
    const lo = avg(0.3, 0.05);
    console.log('rhythm bot d=1', hi.toFixed(3), 'd=0.3', lo.toFixed(3));
    expect(lo).toBeLessThan(hi);
  });

  it('lower difficulty narrows windows and raises tempo', () => {
    const hi = createGame('s', 1, DURATION);
    const lo = createGame('s', 0.3, DURATION);
    expect(lo.window).toBeLessThan(hi.window);
    expect(lo.notes.length).toBeGreaterThan(hi.notes.length);
  });

  it('idle player scores <= 0.2', () => {
    expect(avg(1, 0.05, false)).toBeLessThanOrEqual(0.2);
  });

  it('button mashing does not beat a good player and scores stay within [0,1]', () => {
    const g = createGame('m', 1, DURATION);
    while (!isDone(g)) step(g, DT, { presses: [0, 1, 2, 3] });
    expect(score(g)).toBeGreaterThanOrEqual(0);
    expect(score(g)).toBeLessThan(0.8);
    for (const d of [0, 0.3, 1]) {
      const s = play('r', d, 0.2).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
