import { describe, expect, it } from 'vitest';
import { SpatialHash, type Circle } from '../../src/core/spatialHash';

const c = (x: number, y: number, radius: number): Circle => ({ x, y, radius, _qstamp: 0 });

describe('SpatialHash', () => {
  it('finds nearby items and ignores far ones', () => {
    const h = new SpatialHash<Circle>(64);
    const a = c(10, 10, 5), b = c(500, 500, 5);
    h.insert(a); h.insert(b);
    const out: Circle[] = [];
    h.query(12, 12, 10, out);
    expect(out).toContain(a);
    expect(out).not.toContain(b);
  });

  it('de-duplicates items spanning several cells', () => {
    const h = new SpatialHash<Circle>(16);
    const big = c(0, 0, 100);
    h.insert(big);
    const out: Circle[] = [];
    h.query(0, 0, 200, out);
    expect(out.filter((i) => i === big)).toHaveLength(1);
  });

  it('works with negative coordinates', () => {
    const h = new SpatialHash<Circle>(64);
    const a = c(-100, -100, 5);
    h.insert(a);
    const out: Circle[] = [];
    h.query(-98, -98, 10, out);
    expect(out).toEqual([a]);
  });

  it('clear() empties the grid and allows reuse', () => {
    const h = new SpatialHash<Circle>(64);
    const a = c(0, 0, 5);
    h.insert(a);
    h.clear();
    const out: Circle[] = [];
    expect(h.query(0, 0, 50, out)).toHaveLength(0);
    h.insert(a);
    expect(h.query(0, 0, 50, out)).toEqual([a]);
  });

  it('handles giant items without flooding (guard path)', () => {
    const h = new SpatialHash<Circle>(4);
    const giant = c(0, 0, 100000);
    h.insert(giant);
    const out: Circle[] = [];
    expect(h.query(0, 0, 1, out)).toEqual([giant]);
  });
});
