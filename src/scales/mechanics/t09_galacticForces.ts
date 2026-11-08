/**
 * Tier 9 mechanic "galacticForces":
 *  - Galaxy mergers: nearby galaxies fall toward one another; when they collide the larger swallows the
 *    smaller, swells, and the collision throws out a starburst of edible star clusters.
 *  - Quasar jets: relativistic beams along the quasar axis fling anything (you included) outward.
 *  - Supermassive black holes swallow what crosses the horizon and warn you as the pull grows.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';
import { newHoleState, tickBlackHole, type HoleState } from './t08_blackhole';

const def: MechanicDef = {
  id: 't09_galacticForces',
  defaults: { pullRange: 4, pull: 0.5, mergeAt: 0.5, maxGrowth: 1.5, jet: 4.2, jetForce: 12, burst: [3, 5] as [number, number] },
  create(p, ctx) {
    let scan = 0;
    let jetCd = 0;
    const holes = new WeakMap<Entity, HoleState>();
    const gal: Entity[] = [];

    const merge = (big: Entity, small: Entity) => {
      const cap = ((big.data.baseR as number) ?? ((big.data.baseR = big.baseRadius), big.baseRadius)) * p.maxGrowth;
      const nr = Math.min(cap, Math.sqrt(big.radius * big.radius + small.radius * small.radius * 0.55));
      big.radius = big.baseRadius = Math.max(big.radius, nr);
      const mx = (big.x + small.x) / 2, my = (big.y + small.y) / 2;
      const n = ctx.rng.int(p.burst[0], p.burst[1]);
      for (let i = 0; i < n; i++) {
        const a = ctx.rng.angle();
        const sp = big.radius * ctx.rng.range(0.6, 1.6);
        ctx.world.spawn('t09_cluster', mx + Math.cos(a) * big.radius * 0.5, my + Math.sin(a) * big.radius * 0.5, {
          radius: big.radius * ctx.rng.range(0.1, 0.17), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        });
      }
      ctx.fx.burst(mx, my, { count: 24, color: [big.color, small.color, big.color2, 0xffffff], speed: big.radius * 4, size: big.radius * 0.1, life: 0.8 });
      if (Math.hypot(mx - ctx.player.x, my - ctx.player.y) < ctx.camera.viewRadius) {
        ctx.fx.floatText(mx, my - big.radius * 1.2, 'GALAXY MERGER!', { color: 0xe8b8ff, size: 18 });
        ctx.fx.shake(0.08);
        ctx.events.emit('mechanic', { mechanic: 't09_galacticForces', kind: 'merger', x: mx, y: my });
      }
      ctx.world.despawn(small, 'killed');
    };

    return {
      update(dt) {
        jetCd -= dt;
        const pl = ctx.player;
        // quasar jets (every step so the push is smooth)
        if (pl.alive) {
          for (const e of ctx.world.entities) {
            if (e.dead || !e.active || e.offscreen || !e.hasTag('quasar')) continue;
            const L = e.radius * p.jet, W = e.radius * 0.3 + pl.radius * 0.5;
            const ca = Math.cos(e.rotation), sa = Math.sin(e.rotation);
            const dx = pl.x - e.x, dy = pl.y - e.y;
            const t = dx * ca + dy * sa, pr = -dx * sa + dy * ca;
            if (Math.abs(t) < L && Math.abs(t) > e.radius * 0.45 && Math.abs(pr) < W * (0.35 + 0.65 * Math.abs(t) / L)) {
              const s = Math.sign(t);
              pl.vx += ca * s * p.jetForce * pl.radius * dt * 10;
              pl.vy += sa * s * p.jetForce * pl.radius * dt * 10;
              if (jetCd <= 0) {
                jetCd = 3;
                ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.8, 'JET BLAST!', { color: 0x9ad0ff, size: 18 });
                ctx.fx.flash(0.1, 0x9ad0ff, 5);
                ctx.fx.shake(0.15);
              }
            }
          }
        }
        scan += dt;
        if (scan < 0.1) return;
        const step = scan;
        scan = 0;
        gal.length = 0;
        for (const e of ctx.world.entities) {
          if (e.dead || !e.active) continue;
          if (e.hasTag('galaxy')) gal.push(e);
          else if (e.hasTag('blackhole')) {
            let st = holes.get(e);
            if (!st) { st = newHoleState(); holes.set(e, st); }
            tickBlackHole(ctx, e, st, step, 10);
          } else if (e.hasTag('quasar') && !e.offscreen) {
            // jets sweep smaller things out of the way
            const ca = Math.cos(e.rotation), sa = Math.sin(e.rotation), L = e.radius * p.jet;
            const tmp: Entity[] = [];
            ctx.world.within(e.x, e.y, L, tmp);
            for (const o of tmp) {
              if (o === e || o.dead || o.arch.edible === 'never') continue;
              const dx = o.x - e.x, dy = o.y - e.y;
              const t = dx * ca + dy * sa, pr = -dx * sa + dy * ca;
              if (Math.abs(pr) < e.radius * 0.4 + o.radius && Math.abs(t) > e.radius * 0.4) {
                o.vx += ca * Math.sign(t) * e.radius * 4 * step;
                o.vy += sa * Math.sign(t) * e.radius * 4 * step;
              }
            }
          }
        }
        // tidal attraction + mergers
        for (let i = 0; i < gal.length; i++) {
          const a = gal[i];
          for (let j = i + 1; j < gal.length; j++) {
            const b = gal[j];
            if (a.dead || b.dead || a.offscreen || b.offscreen) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            const rs = a.radius + b.radius;
            if (d > rs * p.pullRange) continue;
            if (d < rs * p.mergeAt) {
              if (a.radius >= b.radius) merge(a, b); else merge(b, a);
              continue;
            }
            const f = p.pull * Math.min(a.radius, b.radius) * step * 3 * (1 - d / (rs * p.pullRange));
            const ux = dx / d, uy = dy / d;
            const ma = b.radius / rs, mb = a.radius / rs;
            a.vx += ux * f * ma; a.vy += uy * f * ma;
            b.vx -= ux * f * mb; b.vy -= uy * f * mb;
          }
        }
      },
      destroy() { gal.length = 0; },
    };
  },
};
export default def;
