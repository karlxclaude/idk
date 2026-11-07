/**
 * Player-vs-entity collision rules (eat / hurt / bump) + magnet / lure / gravity-well pulls.
 * Broadphase: World spatial hash. Narrowphase: circle vs circle.
 */
import type { GameContext } from '../core/context';
import type { Entity } from './Entity';

const scratch: Entity[] = [];

export interface CollisionCallbacks {
  eat(e: Entity, ratio: number): void;
  hurt(e: Entity, ratio: number, fraction: number): void;
  bump(e: Entity, ratio: number): void;
}

export function resolvePlayerCollisions(ctx: GameContext, cb: CollisionCallbacks) {
  const p = ctx.player;
  if (!p.alive) return;
  const stats = ctx.stats;
  const tier = ctx.tier;
  const eatRatio = tier.eatRatio ?? stats.eatRatio;
  const dangerRatio = tier.dangerRatio ?? stats.dangerRatio;
  const dt = ctx.loop.fixedDt;

  // --- Pull effects (magnet / lure / gravity well) ---
  const pullR = Math.max(stats.magnetRadius, stats.glowLure, stats.gravityWell > 0 ? 6 : 0) * p.radius;
  if (pullR > 0) {
    ctx.world.within(p.x, p.y, pullR, scratch);
    for (const e of scratch) {
      if (e.intangible || e.arch.edible === 'never' || e.radius >= p.radius * eatRatio) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let pull = 0;
      if (d < stats.magnetRadius * p.radius) pull += stats.magnetStrength;
      if (d < stats.glowLure * p.radius) pull += 0.8;
      if (stats.gravityWell > 0) pull += (stats.gravityWell * p.radius) / Math.max(d, p.radius);
      const a = pull * p.radius * 4 * dt;
      e.vx += (dx / d) * a;
      e.vy += (dy / d) * a;
    }
  }

  // --- Contacts ---
  ctx.world.query(p.x, p.y, p.radius, scratch);
  for (const e of scratch) {
    if (e.dead || e.intangible || e.popScale < 0.6) continue;
    const er = e.radius * (e.arch.hitScale ?? 1);
    const dx = e.x - p.x, dy = e.y - p.y;
    const d2 = dx * dx + dy * dy;
    const touch = p.radius + er;
    if (d2 > touch * touch) continue;
    const d = Math.sqrt(d2);
    const ratio = e.radius / p.radius;
    const rule = e.arch.edible ?? 'normal';

    if (rule !== 'never' && ratio < eatRatio) {
      // Engulf once the entity overlaps enough (feels like swallowing, not touching).
      if (d < p.radius + er * 0.35) cb.eat(e, ratio);
      continue;
    }
    if (ratio > dangerRatio || rule === 'never') {
      if ((e.arch.damage ?? 0.15) > 0 && ratio > dangerRatio) cb.hurt(e, ratio, e.arch.damage ?? 0.15);
      else cb.bump(e, ratio);
      continue;
    }
    // Close in size.
    if (rule === 'closeInSizeOnly') {
      if (d < p.radius + er * 0.2) {
        cb.hurt(e, ratio, e.arch.closeDamage ?? 0.05);
        cb.eat(e, ratio);
      }
      continue;
    }
    const cbh = e.arch.closeBehavior ?? 'bump';
    if (cbh === 'bump') cb.bump(e, ratio);
    else if (cbh === 'hurt') cb.hurt(e, ratio, e.arch.damage ?? 0.15);
  }
}

/** Physically separate player and entity and exchange momentum. */
export function bumpApart(ctx: GameContext, e: Entity) {
  const p = ctx.player;
  const dx = e.x - p.x, dy = e.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d, ny = dy / d;
  const overlap = p.radius + e.radius - d;
  if (overlap <= 0) return;
  const mp = p.radius * p.radius, me = e.radius * e.radius;
  const tot = mp + me;
  p.x -= nx * overlap * (me / tot);
  p.y -= ny * overlap * (me / tot);
  e.x += nx * overlap * (mp / tot);
  e.y += ny * overlap * (mp / tot);
  const rel = (p.vx - e.vx) * nx + (p.vy - e.vy) * ny;
  if (rel > 0) {
    const j = rel * (1 + 0.6 * (e.arch.bounce ?? 1));
    p.vx -= nx * j * (me / tot);
    p.vy -= ny * j * (me / tot);
    e.vx += nx * j * (mp / tot);
    e.vy += ny * j * (mp / tot);
  }
}
