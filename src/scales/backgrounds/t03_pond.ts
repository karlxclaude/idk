/**
 * Tier 3 background layer types:
 *  - 'lightShafts': slow, slanted god-rays falling from the surface (additive).
 *  - 'pondSilhouettes': big, soft, out-of-focus microbe silhouettes drifting in the murk.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const shaftTex = () =>
  bakeTexture('bg:t03:shaft', 256, (c, s) => {
    // trapezoid beam: soft sides, fades toward the bottom
    const v = c.createLinearGradient(0, 0, 0, s);
    v.addColorStop(0, 'rgba(255,255,255,0.9)');
    v.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    v.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = v;
    c.beginPath();
    c.moveTo(s * 0.38, 0); c.lineTo(s * 0.62, 0); c.lineTo(s * 0.95, s); c.lineTo(s * 0.05, s);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'destination-in';
    const h = c.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,0)');
    h.addColorStop(0.3, 'rgba(255,255,255,1)');
    h.addColorStop(0.7, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h;
    c.fillRect(0, 0, s, s);
  });

const siluetteTex = (i: number) =>
  bakeTexture(`bg:t03:sil:${i}`, 256, (c, s) => {
    const r = new Rng(40 + i);
    const m = s / 2;
    c.shadowColor = '#fff';
    c.shadowBlur = 18;
    c.fillStyle = '#fff';
    c.beginPath();
    if (i === 0) c.roundRect(40, m - 34, s - 80, 68, 34); // rod
    else if (i === 1) { // blob
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const rad = (0.5 + 0.12 * Math.sin(a * 3 + r.range(0, 1)) + 0.08 * Math.sin(a * 5)) * (m - 30);
        c.lineTo(m + Math.cos(a) * rad, m + Math.sin(a) * rad);
      }
    } else if (i === 2) c.arc(m, m, m - 50, 0, Math.PI * 2); // coccus / diatom
    else c.ellipse(m, m, m - 36, 44, 0.3, 0, Math.PI * 2); // paramecium-ish
    c.fill();
  });

const shafts: BackgroundLayerType = {
  id: 'lightShafts',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 5));
    const rng = new Rng(77 + n);
    const color = def.color ?? tier.palette.accent;
    const beams = Array.from({ length: n }, () => {
      const s = new Sprite(shaftTex());
      s.anchor.set(0.5, 0);
      s.blendMode = 'add';
      s.tint = color;
      view.addChild(s);
      return { s, bx: rng.next(), w: rng.range(0.15, 0.4), ph: rng.range(0, 10), sp: rng.range(0.15, 0.4), rot: rng.range(0.12, 0.3) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.5;
        const ox = -cam.x * cam.zoom * def.depth;
        for (const b of beams) {
          let x = (b.bx * pw + ox + Math.sin(cam.time * b.sp * (def.speed ?? 1) + b.ph) * 40) % pw; if (x < 0) x += pw;
          b.s.position.set(x - W * 0.25, -20);
          b.s.rotation = -b.rot + Math.sin(cam.time * 0.12 + b.ph) * 0.03;
          b.s.height = H * 1.5;
          b.s.width = W * b.w * (def.scale ?? 1);
          b.s.alpha = (def.alpha ?? 0.18) * (0.55 + 0.45 * Math.sin(cam.time * b.sp * 1.7 + b.ph * 2));
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const silhouettes: BackgroundLayerType = {
  id: 'pondSilhouettes',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 8));
    const rng = new Rng(Math.floor(def.depth * 1000) + n);
    const colors = def.colors ?? [tier.palette.glow];
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(siluetteTex(i % 4));
      s.anchor.set(0.5);
      s.tint = colors[i % colors.length];
      view.addChild(s);
      return { s, bx: rng.next(), by: rng.next(), size: rng.range(0.1, 0.24), rot: rng.range(0, 6.28), sp: rng.range(-0.08, 0.08), ph: rng.range(0, 10) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.4, ph = H * 1.4;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox + Math.sin(cam.time * 0.1 + it.ph) * 30) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy + Math.cos(cam.time * 0.08 + it.ph) * 30) % ph; if (y < 0) y += ph;
          it.s.position.set(x - W * 0.2, y - H * 0.2);
          it.s.width = it.s.height = Math.max(W, H) * it.size * (def.scale ?? 1);
          it.s.rotation = it.rot + cam.time * it.sp;
          it.s.alpha = def.alpha ?? 0.2;
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [shafts, silhouettes];
