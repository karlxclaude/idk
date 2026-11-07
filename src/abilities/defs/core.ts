/** Example abilities. The upgrade agent adds the per-tier ones in new files. */
import type { AbilityDef } from '../registry';
import type { Entity } from '../../entities/Entity';

const tmp: Entity[] = [];

const abilities: AbilityDef[] = [
  {
    id: 'pulse',
    name: 'Hunger Pulse',
    description: 'A shockwave that pulls nearby food in and shoves bigger things away.',
    cooldown: 6,
    icon: '◎',
    activate(ctx) {
      const p = ctx.player;
      const R = p.radius * 7;
      ctx.world.within(p.x, p.y, R, tmp);
      for (const e of tmp) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const edible = e.radius < p.radius * ctx.stats.eatRatio && e.arch.edible !== 'never';
        const k = (edible ? -1 : 1) * p.radius * 9 * (1 - d / (R + e.radius));
        e.vx += (dx / d) * k;
        e.vy += (dy / d) * k;
      }
      ctx.fx.burst(p.x, p.y, { count: 30, color: ctx.tier.palette.playerGlow, speed: p.radius * 10, size: p.radius * 0.35, life: 0.5 });
      ctx.fx.shake(0.2);
      return true;
    },
  },
  {
    id: 'quantumTunnel',
    name: 'Quantum Tunnel',
    description: 'Blink a short distance in your steering direction, passing through anything.',
    cooldown: 4,
    icon: '⟿',
    activate(ctx) {
      const p = ctx.player;
      let dx = ctx.input.steerX, dy = ctx.input.steerY;
      let l = Math.hypot(dx, dy);
      if (l < 0.1) { dx = Math.cos(p.heading); dy = Math.sin(p.heading); l = 1; }
      const dist = p.radius * 5;
      ctx.fx.burst(p.x, p.y, { count: 16, color: ctx.tier.palette.playerGlow, speed: p.radius * 4, size: p.radius * 0.4, life: 0.4 });
      p.x += (dx / l) * dist;
      p.y += (dy / l) * dist;
      p.prevX = p.x; p.prevY = p.y;
      p.invuln = Math.max(p.invuln, 0.35);
      ctx.fx.burst(p.x, p.y, { count: 16, color: 0xffffff, speed: p.radius * 4, size: p.radius * 0.4, life: 0.4 });
      return true;
    },
  },
];
export default abilities;
