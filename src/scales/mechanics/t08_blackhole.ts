/** Shared black-hole behaviour for tiers 8 and 9 (helper module: no default export). */
import type { Entity } from '../../entities/Entity';
import type { GameContext } from '../../core/context';

export interface HoleState { warnCd: number; fxT: number }
export const newHoleState = (): HoleState => ({ warnCd: 0, fxT: 0 });

/**
 * Per scan-tick: swallow anything inside the horizon, trickle inflow sparkles and warn the player.
 * `range` is in hole radii (should match the gravityWell range).
 */
export function tickBlackHole(ctx: GameContext, h: Entity, st: HoleState, step: number, range = 9) {
  const world = ctx.world;
  const pl = ctx.player;
  const near: Entity[] = [];
  world.within(h.x, h.y, h.radius * 0.72, near);
  for (const o of near) {
    if (o === h || o.dead || !o.active || o.hasTag('blackhole') || o.hasTag('quasar')) continue;
    world.despawn(o, 'killed');
    ctx.fx.burst(h.x, h.y, { count: 5, color: [h.color, h.color2], speed: h.radius * 2, size: h.radius * 0.08, life: 0.4 });
  }
  if (h.offscreen) return;
  st.fxT -= step;
  if (st.fxT <= 0 && Math.hypot(h.x - ctx.camera.x, h.y - ctx.camera.y) < ctx.camera.viewRadius * 1.2) {
    st.fxT = 0.09;
    for (let i = 0; i < 2; i++) {
      const a = ctx.rng.angle();
      const d = h.radius * ctx.rng.range(2.4, 3.6);
      ctx.fx.burst(h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, {
        count: 1, color: [h.color, h.color2, 0xffffff], speed: h.radius * 3.2, size: h.radius * 0.07, life: 0.7,
        spread: 0.03, angle: a + Math.PI + 0.9, drag: 0,
      });
    }
  }
  st.warnCd -= step;
  if (pl.alive) {
    const d = Math.hypot(pl.x - h.x, pl.y - h.y);
    const R = h.radius * range * 0.55;
    if (d < R) {
      ctx.fx.shake(0.035 * (1 - d / R));
      if (st.warnCd <= 0) {
        st.warnCd = 7;
        ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.8, 'GRAVITY WELL!', { color: 0xff9a4a, size: 18 });
        ctx.events.emit('mechanic', { mechanic: 'blackhole', kind: 'pull', x: h.x, y: h.y });
      }
    }
  }
}
