import { describe, expect, it } from 'vitest';
import { FIELDS, createGame, currentRecord, currentField, makeRecord, pressKey, score, step, type GameState } from '../minigames/typing_accuracy/logic';

/** Blind bot: types the shown text at `cps` chars/sec with no error correction. */
function runBot(seed: string, difficulty: number, cps: number, durationSec = 50): GameState {
  const s = createGame(seed, difficulty, durationSec);
  const dt = 1 / 60;
  let acc = 0;
  let pending: string[] = [];
  while (!s.done) {
    acc += cps * dt;
    while (acc >= 1) {
      acc -= 1;
      if (pending.length === 0) {
        pending = [...currentRecord(s)[currentField(s)], 'Enter'];
      }
      pressKey(s, pending.shift() as string);
    }
    step(s, dt);
  }
  return s;
}

const avg = (d: number) => [1, 2, 3, 4, 5, 6].map((i) => score(runBot(`seed${i}`, d, 5))).reduce((a, b) => a + b, 0) / 6;

describe('typing_accuracy', () => {
  it('is deterministic per seed', () => {
    expect(makeRecord('x', 0.5, 3)).toEqual(makeRecord('x', 0.5, 3));
    expect(makeRecord('x', 0.5, 3)).not.toEqual(makeRecord('y', 0.5, 3));
    expect(score(runBot('a', 0.5, 5))).toBe(score(runBot('a', 0.5, 5)));
  });
  it('records are longer at low difficulty', () => {
    const len = (d: number) => Array.from({ length: 40 }, (_, i) => FIELDS.map((f) => makeRecord('l', d, i)[f].length).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0);
    expect(len(0.2)).toBeGreaterThan(len(1));
  });
  it('bot scores >= 0.8 at difficulty 1', () => {
    expect(avg(1)).toBeGreaterThanOrEqual(0.8);
  });
  it('same bot scores strictly less at difficulty 0.3', () => {
    expect(avg(0.3)).toBeLessThan(avg(1));
  });
  it('idle player scores <= 0.2', () => {
    const s = createGame('idle', 1, 50);
    for (let i = 0; i < 3000; i++) step(s, 1 / 60);
    expect(score(s)).toBeLessThanOrEqual(0.2);
  });
  it('scores stay within [0,1]', () => {
    for (const d of [0, 0.3, 1]) for (const cps of [1, 5, 40]) {
      const v = score(runBot('b', d, cps));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
