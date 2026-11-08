/**
 * Tier 10 background layer types:
 *  - 't10_deepField': tiling field of far-off galaxy smudges (tiny spirals and ellipticals).
 *  - 't10_voids': huge soft dark bubbles with a faint luminous skin, drifting at depth.
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const deepField: BackgroundLayerType = {
  id: 't10_deepField',
  create(def, tier) {
    const view = new Container();
    const density = def.density ?? 1;
    const seed = Math.floor(def.depth * 997 + density * 31 + (def.scale ?? 1) * 7);
    const tex = bakeTexture(`bg:t10:deep:${seed}:${density}`, 512, (c, s) => {
      const r = new Rng(seed);
      c.globalCompositeOperation = 'lighter';
      const n = Math.floor(density * 70);
      for (let i = 0; i < n; i++) {
        const x = r.range(0, s), y = r.range(0, s);
        const rad = r.range(2, 9) * (r.chance(0.1) ? 1.7 : 1);
        const rot = r.angle(), sq = r.range(0.25, 1);
        const a = r.range(0.3, 0.95);
        for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
          const px = x + ox, py = y + oy;
          if (px < -rad * 2 || py < -rad * 2 || px > s + rad * 2 || py > s + rad * 2) continue;
          c.save();
          c.translate(px, py);
          c.rotate(rot);
          c.scale(1, sq);
          const g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(0.3, `rgba(255,255,255,${a * 0.35})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(-rad, -rad, rad * 2, rad * 2);
          c.restore();
        }
      }
    });
    const ts = new TilingSprite({ texture: tex, width: 100, height: 100 });
    ts.tint = def.color ?? tier.palette.accent;
    ts.alpha = def.alpha ?? 0.6;
    ts.blendMode = 'add';
    view.addChild(ts);
    return {
      view,
      resize(w, h) { ts.width = w; ts.height = h; },
      update(cam) {
        const s = (def.scale ?? 1) * Math.pow(cam.zoomRatio, def.depth * 0.6);
        ts.tileScale.set(s);
        ts.tilePosition.set(-cam.x * cam.zoom * def.depth + cam.width / 2, -cam.y * cam.zoom * def.depth + cam.height / 2);
        ts.alpha = (def.alpha ?? 0.6) * (0.85 + 0.15 * Math.sin(cam.time * 0.6 + def.depth * 9));
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const voidTex = () =>
  bakeTexture('bg:t10:void', 256, (c, s) => {
    const m = s / 2;
    // luminous skin
    let g = c.createRadialGradient(m, m, m * 0.7, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    // dark interior
    c.globalCompositeOperation = 'destination-out';
    g = c.createRadialGradient(m, m, 0, m, m, m * 0.86);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.8, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

const voids: BackgroundLayerType = {
  id: 't10_voids',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 5));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 13);
    const colors = def.colors ?? [tier.palette.accent];
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(voidTex());
      s.anchor.set(0.5);
      s.tint = colors[i % colors.length];
      s.blendMode = 'add';
      view.addChild(s);
      return { s, bx: rng.next(), by: rng.next(), size: rng.range(0.25, 0.55), ph: rng.range(0, 10) };
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
          it.s.position.set(x - W * 0.3, y - H * 0.3);
          it.s.width = it.s.height = Math.max(W, H) * it.size * (def.scale ?? 1) * (1 + 0.02 * Math.sin(cam.time * 0.4 + it.ph));
          it.s.alpha = def.alpha ?? 0.2;
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default [deepField, voids];
