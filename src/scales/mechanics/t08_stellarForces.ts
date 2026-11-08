/**
 * Tier 8 mechanic "stellarForces":
 *  - Solar flares: red dwarfs and blue giants charge (glowing brighter), then lash out plasma tongues
 *    (blue giants aim at you, red dwarfs spit wildly).
 *  - Black holes swallow whatever crosses the horizon and warn you as the pull grows.
 *  - Pulsar beams sweep the sky and shove you sideways when they catch you.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';
import { newHoleState, tickBlackHole, type HoleState } from './t08_blackhole';

const def: MechanicDef = {
  id: 't08_stellarForces',
  defaults: { flareEvery: [5, 10] as [number, number], charge: 1.5, beam: 4.5, shove: 5.5 },
  create(p, ctx) {
    let scan = 0;
    const holes = new WeakMap<Entity, HoleState>();
    let pulsarCd = 0;

    const fire = (s: Entity) => {
      const pl = ctx.player;
      const big = s.hasTag('blueGiant');
      const n = big ? 1 : ctx.rng.int(1, 3);
      const toP = Math.atan2(pl.y - s.y, pl.x - s.x);
      for (let i = 0; i < n; i++) {
        const a = big ? toP + ctx.rng.range(-0.12, 0.12) : ctx.rng.chance(0.5) ? toP + ctx.rng.range(-0.6, 0.6) : ctx.rng.angle();
        const r = s.radius * (big ? 0.3 : 0.26);
        const sp = Math.min(pl.radius * (big ? 3.6 : 3.1), r * 14);
        const f = ctx.world.spawn('t08_flare', s.x + Math.cos(a) * s.radius * 1.05, s.y + Math.sin(a) * s.radius * 1.05, {
          radius: r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, popIn: false,
        });
        if (f) f.rotation = f.prevRotation = a;
      }
      ctx.fx.burst(s.x, s.y, { count: 14, color: [s.color2, 0xffffff], speed: s.radius * 3, size: s.radius * 0.1, life: 0.5 });
      if (Math.hypot(s.x - pl.x, s.y - pl.y) < ctx.camera.viewRadius) ctx.fx.shake(0.1);
    };

    return {
      update(dt) {
        pulsarCd -= dt;
        scan += dt;
        // flare charge animation needs fine timing
        const view = ctx.camera.viewRadius;
        const pl = ctx.player;
        for (const e of ctx.world.entities) {
          if (e.dead || !e.active) continue;
          if (e.hasTag('flarer')) {
            if (e.offscreen || Math.hypot(e.x - ctx.camera.x, e.y - ctx.camera.y) > view * 1.3) { e.data.charge = 0; continue; }
            e.data.fT = (e.data.fT ?? ctx.rng.range(p.flareEvery[0], p.flareEvery[1])) - dt;
            e.data.charge = e.data.fT < p.charge ? 1 - Math.max(0, e.data.fT) / p.charge : 0;
            if (e.data.fT <= 0) {
              fire(e);
              e.data.fT = ctx.rng.range(p.flareEvery[0], p.flareEvery[1]) * (e.hasTag('blueGiant') ? 1.1 : 0.8);
              e.data.charge = 0;
            }
          } else if (e.hasTag('pulsar') && pl.alive && !e.offscreen) {
            const L = e.radius * p.beam, W = e.radius * 0.38 + pl.radius * 0.5;
            const ca = Math.cos(e.rotation), sa = Math.sin(e.rotation);
            const dx = pl.x - e.x, dy = pl.y - e.y;
            const t = dx * ca + dy * sa, pr = -dx * sa + dy * ca;
            if (Math.abs(t) < L && Math.abs(pr) < W * (1 - 0.5 * Math.abs(t) / L) && Math.abs(t) > e.radius * 0.5) {
              const dir = Math.sign(e.spin) || 1; // beam sweeps this way
              pl.vx += -sa * dir * p.shove * pl.radius * dt * 10;
              pl.vy += ca * dir * p.shove * pl.radius * dt * 10;
              if (pulsarCd <= 0) {
                pulsarCd = 3;
                ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.8, 'PULSAR BEAM!', { color: 0x7affea, size: 16 });
                ctx.fx.flash(0.07, 0x7affea, 6);
              }
            }
          }
        }
        if (scan < 0.1) return;
        const step = scan;
        scan = 0;
        for (const e of ctx.world.entities) {
          if (e.dead || !e.active || !e.hasTag('blackhole')) continue;
          let st = holes.get(e);
          if (!st) { st = newHoleState(); holes.set(e, st); }
          tickBlackHole(ctx, e, st, step, 9);
        }
      },
      destroy() {},
    };
  },
};
export default def;
