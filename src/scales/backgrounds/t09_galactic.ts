/**
 * Tier 9 background layer types:
 *  - 't09_galaxyField': a scatter of tiny distant galaxies (spirals and ellipticals) with parallax.
 *  - 't09_dustLanes': glowing dust lanes with dark, back-lit silhouettes crossing the sky.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const farGalaxyTex = (i: number) =>
  bakeTexture(`bg:t09:gal:${i}`, 128, (c, s) => {
    const r = new Rng(i * 29 + 5);
    const m = s / 2;
    const glow = c.createRadialGradient(m, m, 0, m, m, m);
    glow.addColorStop(0, 'rgba(255,255,255,1)');
    glow.addColorStop(0.15, 'rgba(255,255,255,0.55)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, s, s);
    if (i % 2 === 0) { // spiral
      for (let k = 0; k < 260; k++) {
        const t = Math.pow(r.next(), 0.8), rad = (0.12 + t * 0.85) * m;
        const a = (k % 2) * Math.PI + t * 3.4 + r.range(-0.3, 0.3);
        c.fillStyle = `rgba(255,255,255,${r.range(0.15, 0.7)})`;
        c.fillRect(m + Math.cos(a) * rad, m + Math.sin(a) * rad, 1.6, 1.6);
      }
    }
  });

const field: BackgroundLayerType = {
  id: 't09_galaxyField',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(3, Math.round(def.density ?? 16));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 11);
    const colors = def.colors ?? [tier.palette.accent];
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(farGalaxyTex(i % 6));
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = colors[i % colors.length];
      view.addChild(s);
      return { s, bx: rng.next(), by: rng.next(), size: rng.range(0.025, 0.08), rot: rng.range(0, 6.3), sq: rng.range(0.35, 1), ph: rng.range(0, 10) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.3, ph = H * 1.3;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy) % ph; if (y < 0) y += ph;
          it.s.position.set(x - W * 0.15, y - H * 0.15);
          const d = Math.max(W, H) * it.size * (def.scale ?? 1);
          it.s.width = d;
          it.s.height = d * it.sq;
          it.s.rotation = it.rot;
          it.s.alpha = (def.alpha ?? 0.6) * (0.75 + 0.25 * Math.sin(cam.time * 0.4 + it.ph));
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const laneTex = (i: number) =>
  bakeTexture(`bg:t09:lane:${i}`, 512, (c, s) => {
    const r = new Rng(i * 41 + 9);
    const m = s / 2;
    c.lineCap = 'round';
    for (let k = 0; k < 90; k++) { // soft streaky smear along a wavy band
      const x0 = r.range(0.04, 0.5) * s;
      const y0 = m + Math.sin(x0 * 0.012 + i) * 45 + r.range(-30, 30);
      const len = r.range(0.2, 0.5) * s;
      const g = c.createLinearGradient(x0, 0, x0 + len, 0);
      const a = r.range(0.03, 0.12);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = g;
      c.lineWidth = r.range(6, 28);
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(x0 + len / 2, y0 + r.range(-26, 26), x0 + len, y0 + Math.sin((x0 + len) * 0.012 + i) * 45 - (y0 - m + Math.sin(x0 * 0.012 + i) * 45) * 0.3);
      c.stroke();
    }
    c.globalCompositeOperation = 'destination-in'; // fade the rim so it never shows an edge
    const f = c.createRadialGradient(m, m, m * 0.25, m, m, m);
    f.addColorStop(0, 'rgba(255,255,255,1)'); f.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = f; c.fillRect(0, 0, s, s);
  });

const lanes: BackgroundLayerType = {
  id: 't09_dustLanes',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 5));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 3);
    const colors = def.colors ?? [tier.palette.glow, 0x050008];
    const items = Array.from({ length: n }, (_, i) => {
      const glowS = new Sprite(laneTex(i % 3));
      glowS.anchor.set(0.5);
      glowS.blendMode = 'add';
      glowS.tint = colors[0];
      const darkS = new Sprite(laneTex(i % 3));
      darkS.anchor.set(0.5);
      darkS.tint = colors[1] ?? 0x050008;
      view.addChild(glowS, darkS);
      return { glowS, darkS, bx: rng.next(), by: rng.next(), size: rng.range(0.6, 1.2), rot: rng.range(-0.5, 0.5), ph: rng.range(0, 10) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.6, ph = H * 1.6;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy) % ph; if (y < 0) y += ph;
          const d = Math.max(W, H) * it.size * (def.scale ?? 1);
          const dx = x - W * 0.3, dy = y - H * 0.3;
          it.glowS.position.set(dx + 6, dy - 8);
          it.darkS.position.set(dx, dy);
          it.glowS.width = it.glowS.height = it.darkS.width = it.darkS.height = d;
          it.glowS.rotation = it.darkS.rotation = it.rot + Math.sin(cam.time * 0.05 + it.ph) * 0.02;
          it.glowS.alpha = (def.alpha ?? 0.3) * 0.6;
          it.darkS.alpha = Math.min(1, (def.alpha ?? 0.3) * 2.6);
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [field, lanes];
