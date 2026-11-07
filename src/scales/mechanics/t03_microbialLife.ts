/**
 * Tier 3 mechanic "microbialLife":
 *  - Bacteria (tag 'bacterium') left alone for a while divide in two (up to `maxBacteria` alive),
 *    so ignoring the shoals lets them bloom.
 *  - Amoebas (tag 'amoeba') engulf any smaller non-hazard microbe they touch and grow (up to
 *    `maxGrowth` x their spawn size). A fat amoeba is a deadlier amoeba.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const tmp: Entity[] = [];

const def: MechanicDef = {
  id: 't03_microbialLife',
  defaults: { divideEvery: [9, 15] as [number, number], maxBacteria: 36, maxGrowth: 1.6, engulfRatio: 0.55 },
  create(p, ctx) {
    let acc = 0;
    return {
      update(dt) {
        acc += dt;
        if (acc < 0.1) return;
        const step = acc;
        acc = 0;
        const world = ctx.world;
        const ents = world.entities;
        let bacteria = 0;
        for (const e of ents) if (!e.dead && e.hasTag('bacterium')) bacteria++;
        for (let i = ents.length - 1; i >= 0; i--) {
          const e = ents[i];
          if (e.dead || !e.active) continue;
          if (e.hasTag('bacterium')) {
            e.data.divT = (e.data.divT ?? ctx.rng.range(p.divideEvery[0], p.divideEvery[1])) - step;
            if (e.data.divT <= 0) {
              e.data.divT = ctx.rng.range(p.divideEvery[0], p.divideEvery[1]);
              if (bacteria < p.maxBacteria && !e.offscreen) {
                const a = ctx.rng.angle();
                const off = e.radius * 0.9;
                const c = world.spawn('t03_bacterium', e.x + Math.cos(a) * off, e.y + Math.sin(a) * off, {
                  radius: e.radius, color: e.color, color2: e.color2, vx: Math.cos(a) * e.radius * 2, vy: Math.sin(a) * e.radius * 2,
                });
                if (c) {
                  bacteria++;
                  e.x -= Math.cos(a) * off;
                  e.y -= Math.sin(a) * off;
                  ctx.fx.burst(e.x, e.y, { count: 5, color: [e.color, 0xffffff], speed: e.radius * 3, size: e.radius * 0.15, life: 0.3 });
                }
              }
            }
          } else if (e.hasTag('amoeba') && !e.offscreen) {
            world.within(e.x, e.y, e.radius, tmp);
            for (const o of tmp) {
              if (o === e || o.dead || o.arch.edible === 'never' || o.hasTag('amoeba')) continue;
              if (o.radius > e.radius * p.engulfRatio) continue;
              if (Math.hypot(o.x - e.x, o.y - e.y) > e.radius * 0.8) continue;
              const cap = (e.data.baseR ??= e.baseRadius) * p.maxGrowth;
              const nr = Math.min(cap, Math.sqrt(e.radius * e.radius + o.radius * o.radius * 0.6));
              e.radius = e.baseRadius = nr;
              world.despawn(o, 'killed');
              ctx.fx.burst(o.x, o.y, { count: 6, color: [e.color2, o.color], speed: e.radius * 2, size: e.radius * 0.1, life: 0.4 });
              if (nr < cap) ctx.fx.floatText(e.x, e.y - e.radius * 1.3, 'GULP', { color: e.color2, size: 11 });
            }
          }
        }
      },
      destroy() {},
    };
  },
};
export default def;
