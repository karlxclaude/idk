/** Tier 7: planet-like mass. Banded surface, drifting clouds, lit-sphere shading, atmosphere rim, orbiting moon, glowing maw. */
import { Container } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, blotchTex, rimTex, rng, shadeTex, sprite } from './_kit';

const bandsTex = () =>
  bakeTexture('app:planet:bands', 256, (c, s) => {
    const r = rng(77);
    c.save();
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 1, 0, TAU);
    c.clip();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(0, 0, s, s);
    let y = 0;
    while (y < s) {
      const h = 6 + r() * 22;
      c.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.1 + r() * 0.28})`;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) c.lineTo(x, y + Math.sin(x * 0.05 + y) * 2.5);
      for (let x = s; x >= 0; x -= 16) c.lineTo(x, y + h + Math.sin(x * 0.07 + y) * 2.5);
      c.fill();
      y += h;
    }
    // storm eye
    const g = c.createRadialGradient(s * 0.62, s * 0.6, 0, s * 0.62, s * 0.6, s * 0.1);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.restore();
  });

const planet: PlayerAppearanceDef = {
  id: 'planet',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 6, { add: true, alpha: 0.5, tint: pal.playerGlow });
    const atmo = sprite(Tex.glow(), 3.1, { add: true, alpha: 0.7, tint: pal.playerGlow });
    const base = R.tinted(sprite(Tex.orb(), 2), pal.player);
    const bands = R.tinted(sprite(bandsTex(), 1.98, { alpha: 0.55 }), pal.accent);
    const clouds = sprite(blotchTex('app:planet:clouds', 31, 34, 0.05, 0.14, 0.7), 1.98, { alpha: 0.4, tint: 0xffffff });
    const clouds2 = sprite(blotchTex('app:planet:clouds2', 53, 30, 0.04, 0.12, 0.7), 1.98, { alpha: 0.28, tint: pal.playerGlow });
    const shade = sprite(shadeTex(), 2.02);
    const city = sprite(blotchTex('app:planet:lava', 5, 12, 0.03, 0.07, 1), 1.9, { add: true, alpha: 0.5, tint: pal.accent });
    const rim = sprite(rimTex(), 2.5, { add: true, alpha: 0.95, tint: pal.playerGlow });
    const maw = sprite(Tex.glow(), 1, { add: true, alpha: 0.3, tint: pal.accent });
    maw.position.set(0.9, 0);
    const mawCore = sprite(Tex.glow(), 0.4, { add: true, alpha: 0.5 });
    mawCore.position.copyFrom(maw.position);
    const moon = R.tinted(sprite(Tex.orb(), 0.3), pal.accent);
    const moonGlow = sprite(Tex.glow(), 0.8, { add: true, alpha: 0.6, tint: pal.accent });
    view.addChild(halo, atmo, base, bands, clouds, clouds2, city, shade, rim, maw, mawCore, moonGlow, moon);
    R.attach(view, pal.playerGlow, 2.5);
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash;
        const inv = -p.heading; // keep the light direction fixed on screen
        halo.alpha = 0.45 + f * 0.4;
        atmo.width = atmo.height = 3.1 + Math.sin(t * 1.6) * 0.1 + f * 0.5;
        bands.rotation = Math.sin(t * 0.3) * 0.08 + t * 0.03;
        clouds.rotation = t * 0.12;
        clouds2.rotation = -t * 0.07 + 2;
        city.rotation = t * 0.12;
        city.alpha = 0.3 + f * 0.5;
        shade.rotation = inv;
        rim.alpha = 0.8 + f * 0.2;
        const open = Math.max(R.eat, 0.1);
        maw.width = maw.height = 0.7 + open * 1.0;
        maw.alpha = 0.25 + open * 0.7;
        mawCore.alpha = 0.3 + open * 0.7;
        const a = t * 0.9;
        moon.position.set(Math.cos(a) * 1.42, Math.sin(a) * 0.55 * 1.42);
        moonGlow.position.copyFrom(moon.position);
        const depth = Math.sin(a) > 0 ? 1 : 0.6;
        moon.alpha = depth;
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default planet;
