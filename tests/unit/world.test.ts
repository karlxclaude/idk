import { describe, expect, it } from 'vitest';
import { World } from '../../src/sim/World';
import { SoftBody } from '../../src/sim/SoftBody';

function makeWorld() {
  const events = { eats: 0, engulfed: 0, divides: 0 };
  const world = new World({
    onEat: () => events.eats++,
    onPlayerEngulfed: () => events.engulfed++,
    onDivide: () => events.divides++,
  });
  world.viewRadius = 600;
  return { world, events };
}

describe('SoftBody', () => {
  it('holds its area and stays finite under load', () => {
    const b = new SoftBody();
    b.reset(0, 0, 20, 24);
    const a0 = b.area();
    for (let i = 0; i < 300; i++) {
      b.pushOutOfCircle(15, 0, 12);
      b.step(Math.sin(i * 0.1) * 5, 0, 1 / 60, i / 60);
    }
    expect(b.area()).toBeGreaterThan(a0 * 0.7);
    expect(b.area()).toBeLessThan(a0 * 1.3);
    for (let i = 0; i < b.n; i++) expect(Number.isFinite(b.px[i]) && Number.isFinite(b.py[i])).toBe(true);
  });
});

describe('World', () => {
  it('runs a few seconds with a swimming player and stays sane', () => {
    const { world, events } = makeWorld();
    world.start();
    const p = world.player!;
    for (let i = 0; i < 600; i++) {
      // Swim toward the nearest free food.
      let best = null as null | { x: number; y: number }, bd = Infinity;
      for (const f of world.food) {
        if (f.state !== 'free') continue;
        const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
        if (d < bd) { bd = d; best = f; }
      }
      if (best) { const d = Math.hypot(best.x - p.x, best.y - p.y) || 1; p.steerX = (best.x - p.x) / d; p.steerY = (best.y - p.y) / d; }
      world.step(1 / 60);
    }
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(events.eats).toBeGreaterThan(0);
    expect(p.mass).toBeGreaterThan(24 * 24);
    for (const o of world.organisms) expect(Number.isFinite(o.radius)).toBe(true);
  });

  it('divides into a kin cell when big enough and can be engulfed by a bigger predator', () => {
    const { world, events } = makeWorld();
    world.start();
    const p = world.player!;
    p.addMass(world.divideRadius ** 2 - p.mass + 100);
    for (let i = 0; i < 400 && events.divides === 0; i++) world.step(1 / 60);
    expect(events.divides).toBe(1);
    expect(world.generation).toBe(1);
    expect(world.organisms.some((o) => o.kind === 'kin')).toBe(true);
    world.graceTimer = 0;
    world.spawnOrganism('predator', p.x, p.y, p.radius * 3);
    for (let i = 0; i < 120 && events.engulfed === 0; i++) world.step(1 / 60);
    expect(events.engulfed).toBe(1);
    expect(p.state).toBe('engulfed');
  });
});
