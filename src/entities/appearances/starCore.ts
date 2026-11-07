/** Tiers 8-9: star-like core. Churning plasma, white-hot centre, corona, rays and flaring prominences. */
import { Container } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, bakeUnits, blotchTex, rimTex, rng, sprite } from './_kit';

/** Tapered flame/prominence pointing along +x from the origin. */
const flareTex = () =>
  bakeUnits('app:star:flare', 256, 2, (c) => {
    const g = c.createLinearGradient(0, 0, 1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -0.22);
    c.bezierCurveTo(0.4, -0.2, 0.7, -0.12, 1, 0);
    c.bezierCurveTo(0.7, 0.12, 0.4, 0.2, 0, 0.22);
    c.fill();
  });
const raysTex = () =>
  bakeUnits('app:star:rays', 512, 6, (c) => {
    const r = rng(3);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + r() * 0.2, len = 1.6 + r() * 1.3, w = 0.04 + r() * 0.05;
      c.save();
      c.rotate(a);
      const g = c.createLinearGradient(0.8, 0, len, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0.8, -w);
      c.lineTo(len, 0);
      c.lineTo(0.8, w);
      c.fill();
      c.restore();
    }
  });

const starCore: PlayerAppearanceDef = {
  id: 'starCore',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const corona = sprite(Tex.glow(), 7, { add: true, alpha: 0.6, tint: pal.playerGlow });
    const rays = sprite(raysTex(), 6, { add: true, alpha: 0.45, tint: pal.playerGlow });
    const rays2 = sprite(raysTex(), 5, { add: true, alpha: 0.3, tint: pal.accent });
    const N = 7;
    const flares = Array.from({ length: N }, (_, i) => {
      const f = sprite(flareTex(), 2, { add: true, alpha: 0.7, tint: i % 2 ? pal.accent : pal.playerGlow });
      f.rotation = (i / N) * TAU;
      return f;
    });
    const body = R.tinted(sprite(Tex.orb(), 2), pal.player);
    const plasma1 = sprite(blotchTex('app:star:p1', 41, 36, 0.08, 0.22, 0.9), 1.95, { add: true, alpha: 0.75, tint: pal.playerGlow });
    const plasma2 = sprite(blotchTex('app:star:p2', 87, 30, 0.06, 0.18, 0.9), 1.9, { add: true, alpha: 0.6, tint: pal.accent });
    const hot = sprite(Tex.glow(), 1.5, { add: true, alpha: 0.95 });
    const rim = sprite(rimTex(), 2.4, { add: true, alpha: 0.9, tint: pal.accent });
    const arc = sprite(Tex.ring(), 2.5, { add: true, alpha: 0.4, tint: pal.playerGlow });
    view.addChild(corona, rays, rays2, ...flares, body, plasma1, plasma2, hot, rim, arc);
    R.attach(view, pal.playerGlow, 2.6);
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash;
        corona.width = corona.height = (7 + Math.sin(t * 1.7) * 0.4) * (1 + f * 0.25);
        corona.alpha = 0.5 + f * 0.4;
        rays.rotation = t * 0.12;
        rays2.rotation = -t * 0.08;
        rays.alpha = 0.4 + f * 0.4 + Math.sin(t * 3) * 0.05;
        flares.forEach((fl, i) => {
          const k = 0.55 + 0.45 * Math.sin(t * (1.1 + i * 0.23) + i * 2.1);
          const len = (0.7 + k * 0.7 + f * 0.7 + R.eat * 0.5) * (1 + R.speed * 0.2);
          fl.rotation = (i / N) * TAU + Math.sin(t * 0.4 + i) * 0.25 + t * 0.1;
          fl.width = len * 2;
          fl.height = 0.5 + k * 0.4;
          fl.alpha = 0.35 + k * 0.5;
        });
        plasma1.rotation = t * 0.35;
        plasma2.rotation = -t * 0.5;
        plasma1.alpha = 0.6 + Math.sin(t * 2.3) * 0.15;
        hot.alpha = 0.8 + Math.sin(t * 4) * 0.1 + f * 0.2;
        hot.width = hot.height = 1.5 + f * 0.6;
        arc.rotation = t * 0.4;
        arc.width = arc.height = 2.5 + Math.sin(t * 2.2) * 0.08;
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default starCore;
