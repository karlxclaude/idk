/**
 * Tier 4 mechanic "darkness": the deep is black. Creatures tagged 'dark' only show up near a light
 * (your own glow, jellyfish, anglerfish lures) or when sonar-pinged (data.pingUntil); bioluminescent
 * 'blink' prey flash on their own. Eating blinking prey flares your light for a few seconds.
 * Stinging jellies ('stinger') sting anything dangling in their tentacle zone.
 * Draws the player's light pool (world) and a vignette (screen).
 */
import { Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { blinkLevel } from '../../entities/renderers/t04_kit';
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const vignetteTex = () =>
  bakeTexture('t04:vignette', 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s * 0.72);
    g.addColorStop(0, 'rgba(0,4,14,0)');
    g.addColorStop(0.6, 'rgba(0,4,14,0.35)');
    g.addColorStop(1, 'rgba(0,2,8,0.88)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

interface Light { x: number; y: number; r: number }
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

const def: MechanicDef = {
  id: 't04_darkness',
  defaults: { lightMul: 7, flareMul: 1.8, flareTime: 4.5, minHidden: 0.04, minPredator: 0.26, stingCooldown: 0.9 },
  create(p, ctx) {
    const lights: Light[] = [];
    let flare = 0;
    let sting = 0;
    const pool = new Sprite(Tex.glow());
    pool.anchor.set(0.5);
    pool.blendMode = 'add';
    pool.tint = ctx.tier.palette.glow;
    ctx.layers.worldUnder.addChild(pool);
    const vig = new Sprite(vignetteTex());
    vig.anchor.set(0.5);
    ctx.layers.foreground.addChild(vig);

    return {
      update(dt) {
        const pl = ctx.player;
        if (flare > 0) flare -= dt;
        if (sting > 0) sting -= dt;
        const t = ctx.tierTime;
        lights.length = 0;
        const R = pl.radius * p.lightMul * (flare > 0 ? p.flareMul : 1);
        lights.push({ x: pl.x, y: pl.y, r: R });
        const ents = ctx.world.entities;
        for (const e of ents) {
          if (e.dead || e.offscreen) continue;
          if (e.hasTag('light')) lights.push({ x: e.x, y: e.y - e.radius * 0.6, r: e.radius * 9 });
          else if (e.hasTag('glow')) lights.push({ x: e.x, y: e.y, r: e.radius * 4.2 });
          if (e.hasTag('stinger') && pl.alive && !e.dead && sting <= 0) {
            const dx = pl.x - e.x, dy = pl.y - e.y;
            if (dy > e.radius * 0.5 && dy < e.radius * 2.7 && Math.abs(dx) < e.radius * 0.9 + pl.radius * 0.5) {
              sting = p.stingCooldown;
              (ctx as unknown as { hurt?: (e: Entity, r: number, f: number) => void }).hurt?.(e, e.radius / pl.radius, (e.arch.damage ?? 0.14) * 0.6);
              ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.6, 'STUNG', { color: 0xff6aa0, size: 14 });
            }
          }
        }
        for (const e of ents) {
          if (e.dead || e.offscreen) continue;
          const dark = e.hasTag('dark');
          if (!dark) continue;
          let vis = 0;
          for (const l of lights) {
            const d = Math.hypot(e.x - l.x, e.y - l.y) - e.radius;
            if (d < l.r) vis = Math.max(vis, smooth(1 - d / l.r));
          }
          const ping = e.data.pingUntil;
          if (typeof ping === 'number' && ping > t) vis = 1;
          const floor = e.hasTag('predator') ? p.minPredator : p.minHidden;
          let a = floor + (1 - floor) * vis;
          if (e.hasTag('blink')) a = Math.max(a, 0.12 + 0.88 * blinkLevel(e));
          e.alpha += (a - e.alpha) * 0.18;
        }
      },
      render() {
        const pl = ctx.player;
        const cam = ctx.camera;
        const R = pl.radius * p.lightMul * (flare > 0 ? p.flareMul : 1);
        pool.position.set(pl.x, pl.y);
        pool.width = pool.height = R * 2.4;
        pool.alpha = (flare > 0 ? 0.3 : 0.17) * (0.92 + 0.08 * Math.sin(ctx.tierTime * 2));
        vig.position.set(cam.width / 2, cam.height / 2);
        vig.width = cam.width * 1.5;
        vig.height = cam.height * 1.5;
      },
      onEat(e) {
        if (e.hasTag('blink') || e.hasTag('jelly')) {
          if (flare <= 0) ctx.fx.floatText(ctx.player.x, ctx.player.y - ctx.player.radius * 1.8, 'LIGHT UP', { color: ctx.tier.palette.accent, size: 13 });
          flare = p.flareTime;
        }
      },
      destroy() {
        pool.destroy();
        vig.destroy();
      },
    };
  },
};
export default def;
