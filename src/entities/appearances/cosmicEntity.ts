/** Tiers 10-11: cosmic entity. A living spiral galaxy: counter-rotating star arms, bulge, dust ring and drifting sparks. */
import { Container } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, bakeUnits, rng, sprite } from './_kit';

const galaxyTex = (key: string, seed: number, arms: number, stars: number, twist: number) =>
  bakeUnits(key, 512, 2.6, (c) => {
    const r = rng(seed);
    // diffuse arm glow
    for (let a = 0; a < arms; a++) {
      for (let i = 0; i < 70; i++) {
        const u = i / 70, ang = (a / arms) * TAU + u * twist, rad = 0.12 + u * 1.05;
        const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad, sz = 0.07 + u * 0.14;
        const g = c.createRadialGradient(x, y, 0, x, y, sz);
        g.addColorStop(0, `rgba(255,255,255,${0.22 * (1 - u * 0.5)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x - sz, y - sz, sz * 2, sz * 2);
      }
    }
    // stars
    for (let i = 0; i < stars; i++) {
      const a = Math.floor(r() * arms), u = Math.pow(r(), 0.8);
      const ang = (a / arms) * TAU + u * twist + (r() - 0.5) * 0.5 * (1.2 - u), rad = 0.1 + u * 1.1;
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      c.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      c.beginPath();
      c.arc(x, y, 0.008 + r() * 0.016, 0, TAU);
      c.fill();
    }
    // edge fade
    c.globalCompositeOperation = 'destination-in';
    const m = c.createRadialGradient(0, 0, 0, 0, 0, 1.3);
    m.addColorStop(0, '#fff');
    m.addColorStop(0.75, '#fff');
    m.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = m;
    c.fillRect(-1.3, -1.3, 2.6, 2.6);
  });

const cosmicEntity: PlayerAppearanceDef = {
  id: 'cosmicEntity',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 6.5, { add: true, alpha: 0.5, tint: pal.playerGlow });
    const disc = R.tinted(sprite(Tex.glow(), 3.1, { add: true, alpha: 0.5 }), pal.player);
    const arms1 = sprite(galaxyTex('app:gx:a', 5, 2, 380, 4.2), 2.6, { add: true, alpha: 0.95, tint: pal.player });
    const arms2 = sprite(galaxyTex('app:gx:b', 19, 3, 300, 5.2), 2.1, { add: true, alpha: 0.85, tint: pal.playerGlow });
    const dust = sprite(Tex.ring(), 1.6, { add: true, alpha: 0.35, tint: pal.accent });
    const bulb = sprite(Tex.glow(), 1.5, { add: true, alpha: 0.9, tint: pal.accent });
    const core = sprite(Tex.glow(), 0.8, { add: true, alpha: 1 });
    const sparks = Array.from({ length: 5 }, () => sprite(Tex.spark(), 0.5, { add: true, alpha: 0.8, tint: 0xffffff }));
    view.addChild(halo, disc, arms1, arms2, dust, bulb, core, ...sparks);
    R.attach(view, pal.playerGlow, 2.8);
    let spin = 0;
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash;
        spin += dt * (0.3 + f * 2.2 + R.speed * 0.5);
        arms1.rotation = spin;
        arms2.rotation = -spin * 1.35 + 1;
        dust.rotation = spin * 0.6;
        dust.scale.y = dust.scale.x * 0.75;
        halo.width = halo.height = (6.5 + Math.sin(t * 1.3) * 0.3) * (1 + f * 0.25);
        halo.alpha = 0.45 + f * 0.4;
        bulb.alpha = 0.7 + Math.sin(t * 2.2) * 0.15 + f * 0.3;
        core.alpha = 0.85 + f * 0.15;
        sparks.forEach((s, i) => {
          const a = spin * (1.5 + i * 0.3) + i * 1.3, d = 0.55 + ((i * 0.37 + t * 0.12) % 0.6);
          s.position.set(Math.cos(a) * d, Math.sin(a) * d);
          s.alpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 + i * 2));
          s.rotation = a;
        });
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default cosmicEntity;
