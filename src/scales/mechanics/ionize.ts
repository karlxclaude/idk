/**
 * Tier 1 mechanic: eating an electron (tag 'electron') strips charge from the nearest shelled
 * atom (tag 'atom') nearby - it shrinks (ionizes), cracking it open to be eaten sooner.
 * An atom can lose up to `maxStrip` of its size this way.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const tmp: Entity[] = [];

const def: MechanicDef = {
  id: 'ionize',
  defaults: { range: 8, strip: 0.12, maxStrip: 0.4 },
  create(p, ctx) {
    return {
      onEat(e) {
        if (!e.hasTag('electron')) return;
        const pl = ctx.player;
        ctx.world.within(pl.x, pl.y, pl.radius * p.range, tmp);
        let best: Entity | null = null, bd = Infinity;
        for (const a of tmp) {
          if (a === e || !a.hasTag('atom') || a.radius <= a.baseRadius * (1 - p.maxStrip) + 1e-6) continue;
          const d = (a.x - pl.x) ** 2 + (a.y - pl.y) ** 2;
          if (d < bd) { bd = d; best = a; }
        }
        if (!best) return;
        best.radius = Math.max(best.baseRadius * (1 - p.maxStrip), best.radius - best.baseRadius * p.strip);
        ctx.fx.burst(best.x, best.y, { count: 8, color: [best.color2, 0xffffff], speed: best.radius * 5, size: best.radius * 0.25, life: 0.35 });
        ctx.fx.floatText(best.x, best.y - best.radius * 1.4, best.radius < pl.radius * ctx.stats.eatRatio ? 'CRACKED!' : 'ION+', { color: best.color2, size: 14 });
        ctx.events.emit('mechanic', { mechanic: 'ionize', kind: 'strip', x: best.x, y: best.y });
      },
      destroy() {},
    };
  },
};
export default def;
