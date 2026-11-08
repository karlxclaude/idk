/**
 * Tier 7 background layer types:
 *  - 't07_planetLimb': a huge banded planet whose curved limb fills the bottom of the sky, with a glowing atmosphere.
 *  - 't07_streaks': occasional shooting-star streaks.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { rimTex } from '../../entities/renderers/t07_common';
import type { BackgroundLayerType } from '../backgroundRegistry';

const limbTex = () =>
  bakeTexture('bg:t07:limb', 512, (c, s) => {
    const r = new Rng(2024);
    const m = s / 2;
    c.save();
    c.beginPath(); c.arc(m, m, m - 1, 0, 6.3); c.clip();
    c.fillStyle = '#9a9a9a'; c.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) { // latitudinal weather bands
      const v = Math.floor(150 + 105 * (0.5 + 0.5 * Math.sin(y * 0.045) * Math.sin(y * 0.013 + 1)));
      c.fillStyle = `rgba(${v},${v},${v},0.7)`;
      c.fillRect(0, y, s, 4);
    }
    for (let i = 0; i < 140; i++) { // swirling cloud streaks
      c.fillStyle = `rgba(255,255,255,${r.range(0.05, 0.22)})`;
      c.beginPath(); c.ellipse(r.range(0, s), r.range(0, s), r.range(20, 90), r.range(3, 10), r.range(-0.25, 0.25), 0, 6.3); c.fill();
    }
    for (let i = 0; i < 50; i++) { // darker continents/storms
      c.fillStyle = `rgba(20,30,50,${r.range(0.08, 0.22)})`;
      c.beginPath(); c.ellipse(r.range(0, s), r.range(0, s), r.range(20, 80), r.range(10, 40), r.range(0, 3), 0, 6.3); c.fill();
    }
    // night-side shading: lit from the upper right
    const g = c.createRadialGradient(s * 0.72, s * 0.18, s * 0.05, s * 0.55, s * 0.4, s * 0.85);
    g.addColorStop(0, 'rgba(0,0,10,0)');
    g.addColorStop(0.5, 'rgba(0,0,10,0.35)');
    g.addColorStop(1, 'rgba(0,0,10,0.96)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.restore();
  });

const limb: BackgroundLayerType = {
  id: 't07_planetLimb',
  create(def, tier) {
    const view = new Container();
    const cols = def.colors ?? [tier.palette.accent, tier.palette.glow];
    const halo = new Sprite(rimTex());
    halo.anchor.set(0.5);
    halo.blendMode = 'add';
    halo.tint = cols[1] ?? cols[0];
    const halo2 = new Sprite(Tex.glow());
    halo2.anchor.set(0.5);
    halo2.blendMode = 'add';
    halo2.tint = cols[0];
    const body = new Sprite(limbTex());
    body.anchor.set(0.5);
    body.tint = cols[0];
    view.addChild(halo2, body, halo);
    // a small, distant moon for scale
    const moon = new Sprite(Tex.orb());
    moon.anchor.set(0.5);
    moon.tint = 0x8a93a8;
    view.addChild(moon);
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const R = Math.max(W, H * 1.2) * 0.95 * (def.scale ?? 1);
        const px = Math.tanh((-cam.x * cam.zoom * def.depth) / (W * 2)) * W * 0.35;
        const py = Math.tanh((-cam.y * cam.zoom * def.depth) / (H * 2)) * H * 0.2;
        const cx = W * 0.32 + px, cy = H * 0.72 + R + py * 0.6;
        body.position.set(cx, cy);
        body.width = body.height = R * 2;
        body.alpha = def.alpha ?? 0.95;
        halo.position.set(cx, cy);
        halo.width = halo.height = R * 2 * 1.06;
        halo.alpha = 0.9;
        halo2.position.set(cx, cy);
        halo2.width = halo2.height = R * 2 * 1.2;
        halo2.alpha = 0.22 + 0.03 * Math.sin(cam.time * 0.4);
        moon.position.set(W * 0.82 + px * 0.5, H * 0.2 + py);
        moon.width = moon.height = Math.min(W, H) * 0.07;
        moon.alpha = 0.7;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const streakTex = () =>
  bakeTexture('bg:t07:streak', 128, (c, s) => {
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, s / 2); c.lineTo(s, s / 2 - 4); c.lineTo(s, s / 2 + 4); c.closePath(); c.fill();
  });

const streaks: BackgroundLayerType = {
  id: 't07_streaks',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(1, Math.round(def.density ?? 3));
    const rng = new Rng(555 + n);
    let W = 800, H = 600;
    const arm = (it: { t: number; life: number; x: number; y: number; a: number; len: number; v: number }) => {
      it.t = -rng.range(2, 8);
      it.life = rng.range(0.6, 1.3);
      it.x = rng.range(0.1, 0.9) * W;
      it.y = rng.range(0.0, 0.6) * H;
      it.a = rng.range(0.25, 0.9);
      it.len = rng.range(0.1, 0.22) * W;
      it.v = rng.range(0.5, 0.9) * W;
    };
    const items = Array.from({ length: n }, () => {
      const s = new Sprite(streakTex());
      s.anchor.set(1, 0.5);
      s.blendMode = 'add';
      s.tint = def.color ?? tier.palette.accent;
      s.visible = false;
      view.addChild(s);
      const it = { s, t: 0, life: 1, x: 0, y: 0, a: 0, len: 0, v: 0 };
      arm(it);
      return it;
    });
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const dt = Math.min(cam.realDt, 0.1) * (def.speed ?? 1);
        for (const it of items) {
          it.t += dt;
          if (it.t < 0) { it.s.visible = false; continue; }
          if (it.t > it.life) { arm(it); it.s.visible = false; continue; }
          const k = it.t / it.life;
          it.s.visible = true;
          it.s.position.set(it.x + Math.cos(it.a) * it.v * it.t, it.y + Math.sin(it.a) * it.v * it.t);
          it.s.rotation = it.a;
          it.s.width = it.len;
          it.s.height = 3;
          it.s.alpha = (def.alpha ?? 0.7) * Math.sin(Math.PI * k);
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [limb, streaks];
