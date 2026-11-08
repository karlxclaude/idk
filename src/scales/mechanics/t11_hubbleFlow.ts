/**
 * Tier 11 mechanic "hubbleFlow":
 *  - Metric expansion: everything (hazards aside) farther than `horizon` player radii from the
 *    player recedes, faster with distance. Chase the cosmos or it slips beyond the horizon.
 *  - Rival universes (tag 'rival') bud baby universes every so often, and swallow any baby
 *    they touch, swelling up to `maxGrowth` x (a fat rival is a deadlier rival).
 *  - Eating a baby universe re-ignites it: a mini Big Bang of relic photons.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const tmp: Entity[] = [];

const def: MechanicDef = {
  id: 't11_hubbleFlow',
  defaults: { horizon: 7, hubble: 0.12, maxRecede: 3.2, budEvery: [10, 17] as [number, number], maxBabies: 7, maxGrowth: 1.5 },
  create(p, ctx) {
    let acc = 0;
    return {
      update(dt) {
        const pl = ctx.player;
        const world = ctx.world;
        // Hubble flow every step (cheap loop).
        if (pl.alive) {
          const H = pl.radius * p.horizon;
          for (const e of world.entities) {
            if (e.dead || !e.active || e.arch.edible === 'never') continue;
            const dx = e.x - pl.x, dy = e.y - pl.y;
            const d = Math.hypot(dx, dy);
            if (d < H) continue;
            const a = Math.min(p.maxRecede * pl.radius, p.hubble * (d - H)) * dt;
            e.vx += (dx / d) * a;
            e.vy += (dy / d) * a;
          }
        }
        acc += dt;
        if (acc < 0.1) return;
        const step = acc;
        acc = 0;
        let babies = 0;
        for (const e of world.entities) if (!e.dead && e.hasTag('baby')) babies++;
        for (let i = world.entities.length - 1; i >= 0; i--) {
          const e = world.entities[i];
          if (e.dead || !e.active || !e.hasTag('rival') || e.offscreen) continue;
          e.data.budT = (e.data.budT ?? ctx.rng.range(p.budEvery[0], p.budEvery[1])) - step;
          if (e.data.budT <= 0) {
            e.data.budT = ctx.rng.range(p.budEvery[0], p.budEvery[1]);
            if (babies < p.maxBabies) {
              const a = ctx.rng.angle();
              const off = e.radius * 1.05;
              const b = world.spawn('t11_baby', e.x + Math.cos(a) * off, e.y + Math.sin(a) * off, {
                radius: Math.max(ctx.player.radius * ctx.rng.range(0.25, 0.4), e.radius * 0.12),
                vx: Math.cos(a) * e.radius * 1.4, vy: Math.sin(a) * e.radius * 1.4,
              });
              if (b) {
                babies++;
                ctx.fx.burst(b.x, b.y, { count: 8, color: [0xffa86b, 0x8fb8ff], speed: e.radius * 2, size: e.radius * 0.07, life: 0.5 });
              }
            }
          }
          world.within(e.x, e.y, e.radius, tmp);
          for (const o of tmp) {
            if (o === e || o.dead || !o.hasTag('baby')) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) > e.radius * 0.85) continue;
            const cap = (e.data.baseR ??= e.baseRadius) * p.maxGrowth;
            const nr = Math.min(cap, Math.sqrt(e.radius * e.radius + o.radius * o.radius * 0.5));
            e.radius = e.baseRadius = nr;
            world.despawn(o, 'killed');
            babies--;
            ctx.fx.burst(o.x, o.y, { count: 8, color: [e.color, o.color], speed: e.radius * 1.5, size: e.radius * 0.05, life: 0.5 });
          }
        }
      },
      onEat(e) {
        if (!e.hasTag('baby')) return;
        const pl = ctx.player;
        for (let i = 0; i < 5; i++) {
          const a = ctx.rng.angle();
          ctx.world.spawn('t11_photon', e.x + Math.cos(a) * e.radius * 0.5, e.y + Math.sin(a) * e.radius * 0.5, {
            radius: pl.radius * ctx.rng.range(0.08, 0.14),
            vx: Math.cos(a) * pl.radius * 5, vy: Math.sin(a) * pl.radius * 5,
          });
        }
        ctx.fx.burst(e.x, e.y, { count: 20, color: [0xffa86b, 0x8fb8ff, 0xffffff], speed: pl.radius * 5, size: pl.radius * 0.1, life: 0.7 });
        ctx.fx.floatText(e.x, e.y - e.radius * 1.3, 'BIG BANG', { color: 0xffc080, size: 15 });
      },
      destroy() {},
    };
  },
};
export default def;
