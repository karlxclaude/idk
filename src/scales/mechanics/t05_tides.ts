/**
 * Tier 5 mechanic "tides": every so often a wave front rolls across the shore. A faint ripple warns
 * a couple of seconds ahead, then the crest sweeps everything it touches along its direction (small
 * things are flung, whales barely notice). Between waves a gentle swell nudges everything about.
 * Entities tagged 'tide' get carried further; the player is shoved too (and can surf the crest).
 */
import { Sprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { MechanicDef } from '../mechanicRegistry';

const foamTex = () =>
  bakeTexture('t05:foam', 512, (c, s) => {
    const r = new Rng(55);
    // trailing wash fading backwards (down), crisp scalloped crest on top
    const wash = c.createLinearGradient(0, s * 0.18, 0, s);
    wash.addColorStop(0, 'rgba(255,255,255,0.55)');
    wash.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = wash;
    c.fillRect(0, s * 0.18, s, s * 0.82);
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    c.moveTo(0, s * 0.3);
    for (let x = 0; x <= s; x += 4) {
      const y = s * 0.14 + Math.sin(x * 0.05) * s * 0.025 + Math.sin(x * 0.13 + 1) * s * 0.012;
      c.lineTo(x, y);
    }
    c.lineTo(s, s * 0.3);
    c.closePath();
    c.fill();
    for (let i = 0; i < 160; i++) {
      c.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.6)})`;
      c.beginPath();
      c.arc(r.range(0, s), s * r.range(0.14, 0.7) , r.range(1, 3.6), 0, Math.PI * 2);
      c.fill();
    }
    // fade the horizontal ends
    c.globalCompositeOperation = 'destination-in';
    const h = c.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,0)');
    h.addColorStop(0.12, 'rgba(255,255,255,1)');
    h.addColorStop(0.88, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h;
    c.fillRect(0, 0, s, s);
  });

type Phase = 'idle' | 'warn' | 'surge';

const def: MechanicDef = {
  id: 't05_tides',
  defaults: { period: [13, 19] as [number, number], warn: 2.4, surge: 4.2, swell: 0.35 },
  create(p, ctx) {
    let phase: Phase = 'idle';
    let timer = ctx.rng.range(5, 8);
    let dx = 1, dy = 0, ang = 0;
    let ax = 0, ay = 0;     // anchor: start of the front line
    let travel = 0;         // distance front has travelled from the anchor
    let span = 1;           // total travel distance
    let band = 1;           // half thickness of the crest
    let speed = 1;
    const wash = new Sprite(foamTex());
    wash.anchor.set(0.5, 0.14);
    wash.blendMode = 'add';
    wash.tint = 0xcff6ff;
    wash.visible = false;
    ctx.layers.worldUnder.addChild(wash);

    const start = () => {
      const cam = ctx.camera, pl = ctx.player;
      const vr = cam.viewRadius;
      // Waves come in from the sea: mostly from the left/bottom half.
      ang = ctx.rng.range(-0.7, 0.7) + (ctx.rng.chance(0.5) ? 0 : Math.PI * 0.5);
      dx = Math.cos(ang); dy = Math.sin(ang);
      ax = pl.x - dx * vr * 1.35;
      ay = pl.y - dy * vr * 1.35;
      span = vr * 2.8;
      band = vr * 0.12;
      travel = 0;
      speed = (span - vr * 0.38) / p.surge;
    };

    return {
      update(dt) {
        const pl = ctx.player;
        timer -= dt;
        const t = ctx.tierTime;
        // gentle swell
        const sx = Math.cos(t * 0.31) * p.swell, sy = Math.sin(t * 0.23 + 1) * p.swell;
        for (const e of ctx.world.entities) {
          if (e.dead || e.offscreen) continue;
          if (e.hasTag('tide')) {
            e.vx += sx * e.radius * dt * 1.2;
            e.vy += sy * e.radius * dt * 1.2;
          }
        }
        pl.vx += sx * pl.radius * dt * 0.2;
        pl.vy += sy * pl.radius * dt * 0.2;

        if (phase === 'warn') travel = ctx.camera.viewRadius * 0.38 * (1 - Math.max(0, timer) / p.warn);
        if (phase === 'idle' && timer <= 0) {
          start();
          phase = 'warn';
          timer = p.warn;
          ctx.fx.floatText(pl.x, pl.y - pl.radius * 2.2, 'TIDE IN', { color: 0x9ff0ff, size: 15 });
        } else if (phase === 'warn' && timer <= 0) {
          phase = 'surge';
          timer = p.surge;
        } else if (phase === 'surge') {
          travel += speed * dt;
          const fx = travel;
          for (const e of ctx.world.entities) {
            if (e.dead) continue;
            const along = (e.x - ax) * dx + (e.y - ay) * dy;
            const d = along - fx;
            if (d > band + e.radius || d < -band * 1.6 - e.radius) continue;
            const mass = Math.pow(e.radius / Math.max(pl.radius, 1), 0.7);
            const resist = 1 / (1 + mass * (e.hasTag('predator') ? 2.4 : 1) * 0.9);
            const k = Math.min(1, dt * 7) * resist * (e.hasTag('tide') ? 1.3 : 1);
            e.vx += (dx * speed * 0.95 - e.vx) * k;
            e.vy += (dy * speed * 0.95 - e.vy) * k;
          }
          if (pl.alive) {
            const along = (pl.x - ax) * dx + (pl.y - ay) * dy;
            const d = along - fx;
            if (d < band + pl.radius && d > -band * 1.6 - pl.radius) {
              const k = Math.min(1, dt * 4) * 0.55;
              pl.vx += (dx * speed * 0.8 - pl.vx) * k;
              pl.vy += (dy * speed * 0.8 - pl.vy) * k;
            }
          }
          if (timer <= 0 || travel > span) {
            phase = 'idle';
            timer = ctx.rng.range(p.period[0], p.period[1]);
          }
        }
      },
      render() {
        if (phase === 'idle') { wash.visible = false; return; }
        wash.visible = true;
        const cam = ctx.camera;
        const vr = cam.viewRadius;
        const pos = travel;
        // During the warning only a faint ripple creeps in at the start line.
        const warnK = phase === 'warn' ? 1 - Math.max(0, timer) / p.warn : 1;
        wash.position.set(ax + dx * pos, ay + dy * pos);
        wash.rotation = ang + Math.PI / 2;
        wash.width = vr * 3.6;
        wash.height = band * 7.5;
        wash.alpha = phase === 'warn' ? 0.08 + 0.2 * warnK : 0.85 * Math.min(1, (span - travel) / (band * 4) + 0.1);
      },
      rebase(rx, ry) {
        ax -= rx; ay -= ry;
      },
      destroy() {
        wash.destroy();
      },
    };
  },
};
export default def;
