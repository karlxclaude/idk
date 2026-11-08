import { describe, expect, it, vi } from 'vitest';
import { Pool } from '../../src/core/pool';

describe('Pool', () => {
  it('prewarms and reuses released items', () => {
    let n = 0;
    const p = new Pool(() => ({ id: ++n }), undefined, 2);
    expect(p.size).toBe(2);
    const a = p.acquire();
    expect(p.size).toBe(1);
    p.release(a);
    expect(p.acquire()).toBe(a);
    expect(n).toBe(2);
  });

  it('creates new items when empty and calls onRelease', () => {
    const onRelease = vi.fn();
    const p = new Pool(() => ({}), onRelease);
    const a = p.acquire();
    p.release(a);
    expect(onRelease).toHaveBeenCalledWith(a);
    expect(p.size).toBe(1);
  });

  it('drain empties the pool and visits items', () => {
    const p = new Pool(() => ({}), undefined, 3);
    const fn = vi.fn();
    p.drain(fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(p.size).toBe(0);
  });
});
