import { describe, expect, it } from 'vitest';
import { act, createGame, idealAction, isOver, score, step, type GameState } from '../minigames/sorting/logic';

const DT = 0.05;
/** Bot that always picks the right action, after a fixed reaction delay per product. */
function runBot(seed: string, d: number, reaction: number, errEvery = 0): GameState {
  const s = createGame(seed, d, 50);
  let ready = -1;
  let n = 0;
  while (!isOver(s)) {
    step(s, DT);
    const lead = s.belt[0];
    if (lead) {
      if (ready < 0) ready = Math.max(s.time, lead.t) + reaction;
      if (s.time >= ready) {
        let a = idealAction(s)!;
        if (errEvery && ++n % errEvery === 0) a = { kind: 'bin' };
        act(s, a);
        ready = -1;
      }
    } else ready = -1;
  }
  return s;
}

describe('sorting mini-game', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 0.8, 50), b = createGame('x', 0.8, 50), c = createGame('y', 0.8, 50);
    expect(a.schedule).toEqual(b.schedule);
    expect(a.sales).toEqual(b.sales);
    expect(a.schedule).not.toEqual(c.schedule);
  });
  it('bot scores >= 0.8 at difficulty 1', () => {
    for (const seed of ['a', 'b', 'c']) expect(score(runBot(seed, 1, 1.15))).toBeGreaterThanOrEqual(0.8);
  });
  it('same bot scores less at difficulty 0.3', () => {
    for (const seed of ['a', 'b', 'c']) expect(score(runBot(seed, 0.3, 1.15))).toBeLessThan(score(runBot(seed, 1, 1.15)));
  });
  it('lower difficulty is harder in concrete ways', () => {
    const hi = createGame('a', 1, 50), lo = createGame('a', 0.3, 50);
    expect(lo.params.cats).toBeGreaterThan(hi.params.cats);
    expect(lo.params.travel).toBeLessThan(hi.params.travel);
    expect(lo.schedule.length).toBeGreaterThan(hi.schedule.length);
  });
  it('idle player scores <= 0.2', () => {
    for (const d of [1, 0.3]) {
      const s = createGame('idle', d, 50);
      while (!isOver(s)) step(s, DT);
      expect(score(s)).toBeLessThanOrEqual(0.2);
    }
  });
  it('mistakes cost score and scores stay in [0,1]', () => {
    const bad = runBot('a', 1, 0.5, 2);
    expect(score(bad)).toBeLessThan(score(runBot('a', 1, 0.5)));
    for (const sc of [score(bad), score(runBot('a', 0, 0.1)), score(createGame('q', 1))]) {
      expect(sc).toBeGreaterThanOrEqual(0);
      expect(sc).toBeLessThanOrEqual(1);
    }
  });
});
