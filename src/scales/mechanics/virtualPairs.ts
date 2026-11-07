/**
 * Tier 1 mechanic: virtual particle-antiparticle pairs pop out of the vacuum, fly apart, then
 * fall back together and annihilate in a flash - unless the player eats one first, which makes
 * its partner "real" (stays around, bonus essence).
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

interface Pair {
  a: Entity; au: number; b: Entity; bu: number; t: number;
}

const def: MechanicDef = {
  id: 'virtualPairs',
  defaults: { interval: [0.5, 1.4], particle: 't01_virtualParticle', anti: 't01_antiParticle', size: [0.22, 0.5], speed: 4, life: 2.6, maxPairs: 8 },
  create(p, ctx) {
    const pairs: Pair[] = [];
    let timer = 0.5;
    const alive = (e: Entity, uid: number) => e.active && !e.dead && e.uid === uid;
    return {
      update(dt) {
        timer -= dt;
        if (timer <= 0 && pairs.length < p.maxPairs) {
          timer = ctx.rng.range(p.interval[0], p.interval[1]);
          const pl = ctx.player;
          const viewR = ctx.camera.gameplayViewRadius(pl.radius);
          const a = ctx.rng.angle();
          const d = ctx.rng.range(pl.radius * 3, viewR * 0.9);
          const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
          const r = ctx.rng.range(p.size[0], p.size[1]) * pl.radius;
          const dir = ctx.rng.angle();
          const v = p.speed * r;
          const e1 = ctx.world.spawn(p.particle, x, y, { radius: r, vx: Math.cos(dir) * v, vy: Math.sin(dir) * v });
          const e2 = ctx.world.spawn(p.anti, x, y, { radius: r, vx: -Math.cos(dir) * v, vy: -Math.sin(dir) * v });
          if (e1 && e2) {
            pairs.push({ a: e1, au: e1.uid, b: e2, bu: e2.uid, t: 0 });
            ctx.fx.burst(x, y, { count: 6, color: [e1.color, e2.color], speed: r * 4, size: r * 0.6, life: 0.35 });
          }
        }
        for (let i = pairs.length - 1; i >= 0; i--) {
          const pr = pairs[i];
          const aOk = alive(pr.a, pr.au), bOk = alive(pr.b, pr.bu);
          if (!aOk || !bOk) {
            // One was eaten: the survivor becomes a real particle.
            const s = aOk ? pr.a : bOk ? pr.b : null;
            if (s) {
              s.essenceBonus += 1;
              s.lifetime = Infinity;
              ctx.fx.floatText(s.x, s.y, 'REAL!', { color: s.color, size: 16 });
            }
            pairs.splice(i, 1);
            continue;
          }
          pr.t += dt;
          if (pr.t > p.life * 0.45) {
            // Fall back together.
            const dx = pr.b.x - pr.a.x, dy = pr.b.y - pr.a.y;
            const d = Math.hypot(dx, dy) || 1;
            const k = pr.a.radius * 9 * dt;
            pr.a.vx += (dx / d) * k; pr.a.vy += (dy / d) * k;
            pr.b.vx -= (dx / d) * k; pr.b.vy -= (dy / d) * k;
            if (d < pr.a.radius + pr.b.radius || pr.t > p.life * 1.6) {
              const mx = (pr.a.x + pr.b.x) / 2, my = (pr.a.y + pr.b.y) / 2;
              ctx.fx.burst(mx, my, { count: 14, color: 0xffffff, speed: pr.a.radius * 8, size: pr.a.radius * 0.8, life: 0.4 });
              ctx.world.despawn(pr.a, 'killed');
              ctx.world.despawn(pr.b, 'killed');
              ctx.events.emit('mechanic', { mechanic: 'virtualPairs', kind: 'annihilate', x: mx, y: my });
              pairs.splice(i, 1);
            }
          }
        }
      },
      destroy() {
        pairs.length = 0;
      },
    };
  },
};
export default def;
