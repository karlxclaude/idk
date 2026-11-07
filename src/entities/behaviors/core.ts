/**
 * Built-in behaviors. Speeds are in OWN RADII per second; ranges in PLAYER RADII unless noted.
 * Convention: per-entity state lives in e.data under a behavior-specific key.
 * Keys `anchorX`/`anchorY` in e.data are shifted automatically on floating-origin rebase.
 */
import type { Entity } from '../Entity';
import type { GameContext } from '../../core/context';
import { defineBehaviors } from '../define';

const tmp: Entity[] = [];

function playerEatRatio(ctx: GameContext) {
  return ctx.tier.eatRatio ?? ctx.stats.eatRatio;
}
function playerDangerRatio(ctx: GameContext) {
  return ctx.tier.dangerRatio ?? ctx.stats.dangerRatio;
}

export default defineBehaviors([
  {
    /** Constant slow drift in a random direction. */
    id: 'drift',
    defaults: { speed: 0.6, jitter: 0.2 },
    init(e, p, ctx) {
      const a = ctx.rng.angle();
      const s = p.speed * e.radius * ctx.rng.range(0.5, 1);
      e.data.driftX = Math.cos(a) * s;
      e.data.driftY = Math.sin(a) * s;
      e.vx += e.data.driftX;
      e.vy += e.data.driftY;
    },
    update(e, p, ctx, dt) {
      // Push velocity back toward the drift vector (counteracts drag).
      e.vx += (e.data.driftX - e.vx) * dt * 0.8 + (ctx.rng.next() - 0.5) * p.jitter * e.radius * dt * 10;
      e.vy += (e.data.driftY - e.vy) * dt * 0.8 + (ctx.rng.next() - 0.5) * p.jitter * e.radius * dt * 10;
    },
  },
  {
    /** Smooth random wandering. */
    id: 'wander',
    defaults: { speed: 1.5, turn: 2.0 },
    init(e, p, ctx) {
      e.data.wa = ctx.rng.angle();
      e.data.ws = ctx.rng.range(0.6, 1.2);
    },
    update(e, p, ctx, dt) {
      e.data.wa += (ctx.rng.next() - 0.5) * p.turn * dt * 6;
      const s = p.speed * e.data.ws * e.radius;
      e.vx += (Math.cos(e.data.wa) * s - e.vx) * dt * 1.5;
      e.vy += (Math.sin(e.data.wa) * s - e.vy) * dt * 1.5;
    },
  },
  {
    /** Flee the player when it could eat us (when: 'edible') or always. */
    id: 'flee',
    defaults: { speed: 3, range: 5, when: 'edible' as 'edible' | 'always' },
    update(e, p, ctx, dt) {
      const pl = ctx.player;
      if (!pl.alive) return;
      if (p.when === 'edible' && e.radius >= pl.radius * playerEatRatio(ctx)) return;
      const dx = e.x - pl.x, dy = e.y - pl.y;
      const range = p.range * pl.radius + e.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > range * range) return;
      const d = Math.sqrt(d2) || 1;
      const urgency = 1 - d / range;
      const a = p.speed * e.radius * (0.5 + urgency) * 3 * dt;
      e.vx += (dx / d) * a;
      e.vy += (dy / d) * a;
    },
  },
  {
    /** Chase the player when we could hurt it (when: 'dangerous') or always. */
    id: 'chase',
    defaults: { speed: 1.2, range: 7, when: 'dangerous' as 'dangerous' | 'always' },
    update(e, p, ctx, dt) {
      const pl = ctx.player;
      if (!pl.alive || pl.invuln > 0) return;
      if (p.when === 'dangerous' && e.radius <= pl.radius * playerDangerRatio(ctx)) return;
      const dx = pl.x - e.x, dy = pl.y - e.y;
      const range = p.range * pl.radius + e.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > range * range) return;
      const d = Math.sqrt(d2) || 1;
      const a = p.speed * e.radius * 2.5 * dt;
      e.vx += (dx / d) * a;
      e.vy += (dy / d) * a;
    },
  },
  {
    /** Pop in and out of existence. Intangible while out. */
    id: 'flicker',
    defaults: { on: [1.2, 3.5] as [number, number], off: [0.4, 1.4] as [number, number], fade: 0.18, startOn: false },
    init(e, p, ctx) {
      e.data.flOn = p.startOn ? true : ctx.rng.chance(0.6);
      e.data.flT = ctx.rng.range(0, p.on[1]);
      e.data.flA = e.data.flOn ? 1 : 0;
    },
    update(e, p, ctx, dt) {
      e.data.flT -= dt;
      if (e.data.flT <= 0) {
        e.data.flOn = !e.data.flOn;
        const r = e.data.flOn ? p.on : p.off;
        e.data.flT = ctx.rng.range(r[0], r[1]);
      }
      const target = e.data.flOn ? 1 : 0;
      e.data.flA += (target - e.data.flA) * Math.min(1, dt / Math.max(0.01, p.fade));
      e.alpha = e.data.flA * (e.age < e.lifetime ? 1 : e.alpha);
      e.scaleX = e.scaleY = 0.5 + 0.5 * e.data.flA;
      e.intangible = e.data.flA < 0.5;
    },
  },
  {
    /** Orbit an anchor point (spawn position by default). */
    id: 'orbit',
    defaults: { speed: 0.8, distance: 3 },
    init(e, p, ctx) {
      e.data.anchorX = e.x;
      e.data.anchorY = e.y;
      e.data.orbA = ctx.rng.angle();
      e.data.orbDir = ctx.rng.sign();
    },
    update(e, p, ctx, dt) {
      e.data.orbA += p.speed * e.data.orbDir * dt;
      const R = p.distance * e.radius;
      const tx = e.data.anchorX + Math.cos(e.data.orbA) * R;
      const ty = e.data.anchorY + Math.sin(e.data.orbA) * R;
      e.vx += ((tx - e.x) * 3 - e.vx) * dt * 4;
      e.vy += ((ty - e.y) * 3 - e.vy) * dt * 4;
    },
  },
  {
    /** Boids-lite: align/cohere/separate with nearby entities of the same archetype. */
    id: 'schooling',
    defaults: { speed: 2, neighbor: 6, align: 1, cohere: 0.6, separate: 1.4 },
    init(e, p, ctx) {
      const a = ctx.rng.angle();
      e.vx = Math.cos(a) * p.speed * e.radius;
      e.vy = Math.sin(a) * p.speed * e.radius;
    },
    update(e, p, ctx, dt) {
      const nr = p.neighbor * e.radius;
      ctx.world.within(e.x, e.y, nr, tmp);
      let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0;
      for (const o of tmp) {
        if (o === e || o.arch !== e.arch) continue;
        n++;
        ax += o.vx;
        ay += o.vy;
        cx += o.x;
        cy += o.y;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d2 = dx * dx + dy * dy + 1e-3;
        const minD = (e.radius + o.radius) * 1.6;
        if (d2 < minD * minD) {
          sx += dx / d2;
          sy += dy / d2;
        }
      }
      const target = p.speed * e.radius;
      if (n > 0) {
        ax /= n; ay /= n; cx = cx / n - e.x; cy = cy / n - e.y;
        e.vx += ((ax - e.vx) * p.align + cx * p.cohere + sx * p.separate * e.radius * e.radius * 2) * dt;
        e.vy += ((ay - e.vy) * p.align + cy * p.cohere + sy * p.separate * e.radius * e.radius * 2) * dt;
      }
      // Keep cruising speed.
      const sp = Math.hypot(e.vx, e.vy) || 1;
      e.vx += (e.vx / sp) * (target - sp) * dt * 2;
      e.vy += (e.vy / sp) * (target - sp) * dt * 2;
    },
  },
  {
    /** Angler-style lure: pulls smaller entities (and optionally a smaller player) toward itself. Range in OWN radii. */
    id: 'lure',
    defaults: { range: 8, strength: 1.2, affectsPlayer: true },
    update(e, p, ctx, dt) {
      const R = p.range * e.radius;
      ctx.world.within(e.x, e.y, R, tmp);
      for (const o of tmp) {
        if (o === e || o.radius >= e.radius) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        const a = p.strength * o.radius * 3 * dt;
        o.vx += (dx / d) * a;
        o.vy += (dy / d) * a;
      }
      const pl = ctx.player;
      if (p.affectsPlayer && pl.alive && pl.radius < e.radius) {
        const dx = e.x - pl.x, dy = e.y - pl.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          const a = p.strength * pl.radius * 0.9 * dt * (1 - d / R);
          pl.vx += (dx / d) * a;
          pl.vy += (dy / d) * a;
        }
      }
    },
  },
  {
    /** Gravity well: pulls everything (incl. player) within range (OWN radii), inverse-distance. */
    id: 'gravityWell',
    defaults: { range: 10, strength: 1.0, affectsPlayer: true },
    update(e, p, ctx, dt) {
      const R = p.range * e.radius;
      ctx.world.within(e.x, e.y, R, tmp);
      for (const o of tmp) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.max(Math.hypot(dx, dy), e.radius);
        const a = (p.strength * e.radius * e.radius * 4 * dt) / d;
        o.vx += (dx / d) * a;
        o.vy += (dy / d) * a;
      }
      const pl = ctx.player;
      if (p.affectsPlayer && pl.alive) {
        const dx = e.x - pl.x, dy = e.y - pl.y;
        const d = Math.max(Math.hypot(dx, dy), e.radius);
        if (d < R) {
          const a = (p.strength * e.radius * e.radius * 2 * dt) / d;
          pl.vx += (dx / d) * a;
          pl.vy += (dy / d) * a;
        }
      }
    },
  },
  {
    /** Breathing radius oscillation. */
    id: 'pulse',
    defaults: { amount: 0.12, speed: 2.5 },
    init(e, p, ctx) {
      e.data.pulseT = ctx.rng.range(0, 10);
    },
    update(e, p, ctx, dt) {
      e.data.pulseT += dt * p.speed;
      e.radius = e.baseRadius * (1 + Math.sin(e.data.pulseT) * p.amount);
    },
  },
  {
    /** Rotate to face the direction of travel. */
    id: 'faceVelocity',
    defaults: { turn: 8 },
    update(e, p, ctx, dt) {
      if (e.vx * e.vx + e.vy * e.vy < 1e-4) return;
      const target = Math.atan2(e.vy, e.vx);
      let d = target - e.rotation;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      e.rotation += d * Math.min(1, p.turn * dt);
    },
  },
  {
    /** Gentle repulsion from overlapping neighbours (keeps clumps readable). */
    id: 'separate',
    defaults: { strength: 2 },
    update(e, p, ctx, dt) {
      ctx.world.within(e.x, e.y, e.radius, tmp);
      for (const o of tmp) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        const overlap = e.radius + o.radius - d;
        if (overlap > 0) {
          e.vx += (dx / d) * overlap * p.strength * dt * 10;
          e.vy += (dy / d) * overlap * p.strength * dt * 10;
        }
      }
    },
  },
]);
