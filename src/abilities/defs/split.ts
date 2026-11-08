/**
 * Split mutation (press F). Engine hook: Player.trySplit emits abilityUsed{id:'split'} when
 * stats.splitCount > 0; we listen for it and spawn "satellite" pieces that eat on their own
 * (via Game.eat, so mass/essence flow to the main body), then fly back and re-merge.
 * No default export: helper module (ignored by the ability registry).
 */
import { Container, Graphics } from 'pixi.js';
import type { Game } from '../../core/Game';
import { events } from '../../core/events';
import type { Entity } from '../../entities/Entity';

interface Sat {
  x: number; y: number; vx: number; vy: number;
  angle: number; age: number; g: Graphics;
}

const installed = new WeakSet<Game>();
const tmp: Entity[] = [];

export function installSplit(game: Game) {
  if (installed.has(game)) return;
  installed.add(game);
  const layer = new Container({ label: 'splitSats' });
  game.layers.player.addChildAt(layer, 0);
  let sats: Sat[] = [];
  let remaining = 0;
  let cooldown = 0;

  const clear = () => {
    for (const s of sats) s.g.destroy();
    sats = [];
    remaining = 0;
  };

  const spawn = () => {
    const p = game.player;
    const n = Math.min(3, Math.max(0, Math.round(game.stats.splitCount) - 1));
    if (n <= 0 || sats.length || cooldown > 0 || !p.alive) return;
    const pal = game.tier.palette;
    for (let i = 0; i < n; i++) {
      const a = p.heading + ((i + 0.5) / n - 0.5) * Math.PI * 1.4 + (n === 1 ? 0 : 0);
      const g = new Graphics();
      g.circle(0, 0, 1.45).fill({ color: pal.playerGlow, alpha: 0.18 });
      g.circle(0, 0, 1).fill({ color: pal.player, alpha: 0.92 });
      g.circle(0, 0, 1).stroke({ color: pal.playerGlow, width: 0.08, alpha: 0.9 });
      layer.addChild(g);
      const sp = p.radius * 10;
      sats.push({ x: p.x, y: p.y, vx: p.vx + Math.cos(a) * sp, vy: p.vy + Math.sin(a) * sp, angle: (i / n) * Math.PI * 2, age: 0, g });
    }
    remaining = game.stats.splitDuration;
    game.fx.burst(p.x, p.y, { count: 22, color: pal.playerGlow, speed: p.radius * 6, size: p.radius * 0.3, life: 0.5 });
    game.fx.shake(0.15);
  };

  events.on('abilityUsed', (e) => { if (e.id === 'split') spawn(); });
  events.on('tierEnter', clear);
  events.on('death', clear);
  events.on('originRebased', ({ dx, dy }) => { for (const s of sats) { s.x -= dx; s.y -= dy; } });

  const step = (dt: number) => {
    cooldown = Math.max(0, cooldown - dt);
    if (!sats.length) return;
    const p = game.player;
    if (!p.alive) { clear(); return; }
    remaining -= dt;
    const maxV = p.maxSpeed(game) * 1.05;
    const r = p.radius * 0.6;
    const eatRatio = game.tier.eatRatio ?? game.stats.eatRatio;
    const returning = remaining < 1;
    for (let i = sats.length - 1; i >= 0; i--) {
      const s = sats[i];
      s.age += dt;
      let tx = 0, ty = 0, have = false, speed = maxV;
      if (s.age < 0.35) {
        const k = Math.exp(-3 * dt);
        s.vx *= k; s.vy *= k;
      } else {
        if (!returning) {
          game.world.within(s.x, s.y, p.radius * 9, tmp);
          let best = Infinity;
          for (const e of tmp) {
            if (e.intangible || e.arch.edible === 'never' || e.radius >= r * eatRatio) continue;
            const d = Math.hypot(e.x - s.x, e.y - s.y);
            if (d < best) { best = d; tx = e.x; ty = e.y; have = true; }
          }
        }
        if (!have) {
          const a = s.angle + game.tierTime * 0.9;
          const orbit = returning ? 0 : p.radius * 2.4;
          tx = p.x + Math.cos(a) * orbit;
          ty = p.y + Math.sin(a) * orbit;
          if (returning) speed = maxV * 1.8;
        }
        const dx = tx - s.x, dy = ty - s.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = 1 - Math.exp(-5 * dt);
        s.vx += ((dx / d) * speed * Math.min(1, d / (r * 3)) - s.vx) * k;
        s.vy += ((dy / d) * speed * Math.min(1, d / (r * 3)) - s.vy) * k;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // eat
      game.world.within(s.x, s.y, r, tmp);
      for (const e of tmp) {
        if (e.dead || e.intangible || e.popScale < 0.6 || e.arch.edible === 'never' || e.radius >= r * eatRatio) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) < r + e.radius * 0.35) game.eat(e, Math.min(0.9, e.radius / p.radius));
      }
      s.g.position.set(s.x, s.y);
      s.g.scale.set(r * (1 + 0.04 * Math.sin(game.tierTime * 8 + i)));
      if (remaining < 0 && Math.hypot(s.x - p.x, s.y - p.y) < p.radius * 0.9) {
        game.fx.burst(s.x, s.y, { count: 8, color: game.tier.palette.playerGlow, speed: p.radius * 3, size: p.radius * 0.2, life: 0.35 });
        s.g.destroy();
        sats.splice(i, 1);
        p.gulpV += 2;
      }
    }
    if (remaining < -3) clear();
    if (!sats.length) cooldown = 3;
  };

  events.on('simStep', ({ dt }) => {
    if (game.shifting) return;
    step(dt);
  });
}
