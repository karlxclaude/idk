import { describe, expect, it } from 'vitest';
import { act, createGame, findPlacement, frontItem, score, step, type PackState } from '../minigames/spatial_packing/logic';

const ACTION_COST = 0.5; // seconds per key press for the scripted bot

/** Greedy bot: rejects distractors, packs real items at the best-contact spot. */
function runBot(seed: string, difficulty: number): { s: PackState; score: number } {
  const s = createGame(seed, difficulty);
  const press = (a: Parameters<typeof act>[1], n = 1) => {
    for (let i = 0; i < n && !s.finished; i++) { act(s, a); step(s, ACTION_COST); }
  };
  let guard = 0;
  while (!s.finished && guard++ < 5000) {
    const item = frontItem(s);
    if (!item || !s.piece) break;
    if (item.distractor) { press('reject'); continue; }
    const pl = findPlacement(s.grid, item.cells);
    if (!pl) { press('seal'); continue; }
    press('rotate', pl.rot);
    const dx = pl.x - s.piece.x;
    const dy = pl.y - s.piece.y;
    press(dx < 0 ? 'left' : 'right', Math.abs(dx));
    press(dy < 0 ? 'up' : 'down', Math.abs(dy));
    press('place');
  }
  return { s, score: score(s) };
}

const avg = (d: number) => [1, 2, 3, 4, 5].reduce((a, i) => a + runBot(`seed${i}`, d).score, 0) / 5;

describe('spatial_packing', () => {
  it('is deterministic per seed', () => {
    const a = createGame('x', 1);
    const b = createGame('x', 1);
    expect(a.queue).toEqual(b.queue);
    expect(createGame('y', 1).queue).not.toEqual(a.queue);
  });
  it('a bot scores >= 0.8 at difficulty 1', () => {
    for (let i = 1; i <= 5; i++) expect(runBot(`seed${i}`, 1).score).toBeGreaterThanOrEqual(0.8);
  });
  it('the same bot scores strictly less at difficulty 0.3', () => {
    expect(avg(0.3)).toBeLessThan(avg(1));
    const hard = createGame('seed1', 0.3);
    const easy = createGame('seed1', 1);
    expect(hard.totalTime).toBeLessThan(easy.totalTime);
    expect(hard.queue.filter((i) => i.distractor).length).toBeGreaterThan(easy.queue.filter((i) => i.distractor).length);
  });
  it('an idle player scores <= 0.2', () => {
    const s = createGame('idle', 1);
    for (let i = 0; i < 1000; i++) step(s, 0.1);
    expect(s.finished).toBe(true);
    expect(score(s)).toBeLessThanOrEqual(0.2);
  });
  it('wrong picks are penalised and scores stay in [0, 1]', () => {
    const clean = runBot('seed1', 1);
    const s = createGame('w', 0);
    for (let i = 0; i < 200; i++) act(s, 'place');
    expect(score(s)).toBeGreaterThanOrEqual(0);
    expect(score(s)).toBeLessThanOrEqual(1);
    expect(clean.score).toBeLessThanOrEqual(1);
    const t = createGame('seed1', 0.3);
    while (!frontItem(t)?.distractor) act(t, 'place');
    const before = score(t);
    act(t, 'place');
    expect(t.wrong).toBe(1);
    expect(score(t)).toBeLessThan(before);
  });
});
