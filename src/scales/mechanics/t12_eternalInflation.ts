/**
 * Tier 12 mechanic "eternalInflation": every bubble universe (tag 'bubble') keeps inflating.
 *  - Bubbles swell exponentially; one that outgrows `popRatio` x the player pops into a spray of
 *    smaller bubbles (and a prismatic burst), so ignoring the foam only makes more of it.
 *  - Two bubbles that collide fuse: the smaller pops against the bigger, which swells and sheds
 *    froth from the contact point.
 *  - Inflaton storms (tag 'storm') swallow smaller bubbles and bloat.
 *  - Eating bubbles in quick succession builds a FOAM combo that boosts nutrition.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const tmp: Entity[] = [];
const RAINBOW = [0xff9bf0, 0x9be8ff, 0xffe69b, 0xb8a0ff, 0x9bffc8];
const CHILD = ['t12_bubble', 't12_froth', 't12_pocket'];

const def: MechanicDef = {
  id: 't12_eternalInflation',
  defaults: { growth: 0.05, popRatio: 3.2, maxBubbles: 46, maxStormGrowth: 1.5, comboWindow: 3.2 },
  create(p, ctx) {
    let acc = 0;
    let combo = 0;
    let comboT = 0;

    const count = () => {
      let n = 0;
      for (const e of ctx.world.entities) if (!e.dead && e.active && e.hasTag('bubble')) n++;
      return n;
    };

    function spray(x: number, y: number, r: number, n: number, kidScale: [number, number]) {
      const pl = ctx.player;
      for (let i = 0; i < n; i++) {
        const a = ctx.rng.angle() ;
        const id = ctx.rng.pick(CHILD);
        const kr = Math.min(r * ctx.rng.range(kidScale[0], kidScale[1]), pl.radius * 1.4);
        const e = ctx.world.spawn(id, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, {
          radius: Math.max(kr, pl.radius * 0.1),
          vx: Math.cos(a) * r * 1.6, vy: Math.sin(a) * r * 1.6,
        });
        if (!e) break;
      }
      ctx.fx.burst(x, y, { count: 18, color: RAINBOW, speed: r * 3, size: r * 0.07, life: 0.7 });
    }

    return {
      update(dt) {
        const world = ctx.world;
        const pl = ctx.player;
        comboT -= dt;
        if (comboT <= 0) combo = 0;
        // inflate
        for (const e of world.entities) {
          if (e.dead || !e.active || !e.hasTag('bubble')) continue;
          const g = (e.data.g ??= ctx.rng.range(0.6, 1.4));
          const r = e.radius * (1 + p.growth * g * dt);
          e.radius = e.baseRadius = r;
        }
        acc += dt;
        if (acc < 0.1) return;
        const step = acc;
        acc = 0;
        let n = count();
        for (let i = world.entities.length - 1; i >= 0; i--) {
          const e = world.entities[i];
          if (e.dead || !e.active) continue;
          e.data.cool = (e.data.cool ?? 0) - step;
          if (e.hasTag('bubble')) {
            // pop when it outgrows everything
            if (pl.alive && e.radius > pl.radius * p.popRatio && !e.offscreen) {
              if (n < p.maxBubbles) spray(e.x, e.y, e.radius, ctx.rng.int(3, 5), [0.18, 0.34]);
              else ctx.fx.burst(e.x, e.y, { count: 14, color: RAINBOW, speed: e.radius * 2, size: e.radius * 0.05, life: 0.6 });
              world.despawn(e, 'killed');
              n--;
              continue;
            }
            if (e.offscreen || e.data.cool > 0) continue;
            // collisions: smaller one pops into the bigger
            world.within(e.x, e.y, e.radius * 1.1, tmp);
            for (const o of tmp) {
              if (o === e || o.dead || !o.hasTag('bubble') || o.radius > e.radius) continue;
              if (Math.hypot(o.x - e.x, o.y - e.y) > (e.radius + o.radius) * 0.5) continue;
              const cx = (e.x + o.x) / 2, cy = (e.y + o.y) / 2;
              const nr = Math.sqrt(e.radius * e.radius + o.radius * o.radius * 0.4);
              e.radius = e.baseRadius = nr;
              e.data.cool = 1.5;
              world.despawn(o, 'killed');
              n--;
              if (n < p.maxBubbles) { spray(cx, cy, o.radius, 2, [0.35, 0.6]); n += 2; }
              ctx.fx.burst(cx, cy, { count: 10, color: RAINBOW, speed: e.radius * 1.5, size: e.radius * 0.04, life: 0.5 });
              break;
            }
          } else if (e.hasTag('storm') && !e.offscreen) {
            world.within(e.x, e.y, e.radius, tmp);
            for (const o of tmp) {
              if (o === e || o.dead || !o.hasTag('bubble')) continue;
              if (o.radius > e.radius * 0.6) continue;
              if (Math.hypot(o.x - e.x, o.y - e.y) > e.radius * 0.8) continue;
              const cap = (e.data.baseR ??= e.baseRadius) * p.maxStormGrowth;
              const nr = Math.min(cap, Math.sqrt(e.radius * e.radius + o.radius * o.radius * 0.5));
              e.radius = e.baseRadius = nr;
              world.despawn(o, 'killed');
              n--;
              ctx.fx.burst(o.x, o.y, { count: 6, color: [e.color, o.color], speed: e.radius, size: e.radius * 0.04, life: 0.4 });
            }
          }
        }
      },
      onEat(e) {
        if (!e.hasTag('bubble')) return;
        const pl = ctx.player;
        combo = Math.min(6, combo + 1);
        comboT = p.comboWindow;
        ctx.fx.burst(e.x, e.y, { count: 10 + combo * 2, color: RAINBOW, speed: pl.radius * 3, size: pl.radius * 0.1, life: 0.6 });
        if (combo >= 2) ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.6, `FOAM x${combo}`, { color: RAINBOW[combo % RAINBOW.length], size: 12 + combo });
        return 1 + (combo - 1) * 0.12;
      },
      destroy() {},
    };
  },
};
export default def;
