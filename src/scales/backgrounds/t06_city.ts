/**
 * Tier 6 background layer types:
 *  - 't06_grid': a tiling top-down city map (blocks, streets, rooftops) whose windows and street
 *    lamps light up as tier progress grows.
 *  - 't06_skyline': lit skyline silhouettes along the bottom edge; window sets switch on one after
 *    another as you grow.
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng, clamp } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const night = (progress: number) => clamp(0.1 + progress * 1.15, 0, 1.2);

/** Top-down block map. mode 'base' = roofs + streets (white, tinted), 'lights' = lamps + windows (additive). */
const gridTex = (seed: number, mode: 'base' | 'lights') =>
  bakeTexture(`bg:t06:grid:${seed}:${mode}`, 512, (c, s) => {
    const r = new Rng(seed);
    const street = 54;
    // streets are the gaps between block rects; blocks inset from the tile edge
    const cols = 2, rows = 2;
    const bw = s / cols, bh = s / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x0 = i * bw + street / 2, y0 = j * bh + street / 2, w = bw - street, h = bh - street;
        // subdivide the block into lots
        const lots: [number, number, number, number][] = [];
        const split = (x: number, y: number, ww: number, hh: number, d: number) => {
          if (d === 0 || (ww < 60 && hh < 60) || r.chance(0.18)) { lots.push([x, y, ww, hh]); return; }
          if (ww > hh) { const k = r.range(0.35, 0.65) * ww; split(x, y, k, hh, d - 1); split(x + k, y, ww - k, hh, d - 1); }
          else { const k = r.range(0.35, 0.65) * hh; split(x, y, ww, k, d - 1); split(x, y + k, ww, hh - k, d - 1); }
        };
        split(x0, y0, w, h, 3);
        for (const [x, y, ww, hh] of lots) {
          const g = 3;
          if (mode === 'base') {
            const a = r.range(0.35, 1);
            c.fillStyle = `rgba(255,255,255,${a})`;
            c.fillRect(x + g, y + g, ww - g * 2, hh - g * 2);
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.fillRect(x + g + (ww - g * 2) * 0.55, y + g + (hh - g * 2) * 0.5, (ww - g * 2) * 0.35, (hh - g * 2) * 0.3);
          } else {
            const n = Math.floor((ww * hh) / 900);
            for (let k = 0; k < n; k++) {
              if (!r.chance(0.7)) continue;
              c.fillStyle = r.chance(0.8) ? 'rgba(255,215,130,0.95)' : 'rgba(150,215,255,0.95)';
              c.fillRect(x + g + 4 + r.next() * (ww - 18), y + g + 4 + r.next() * (hh - 18), 4, 4);
            }
          }
        }
      }
    }
    if (mode === 'lights') {
      // street lamps along the street centre lines
      for (let k = 0; k < 2; k++) {
        for (let t = 0; t < s; t += 36) {
          for (const lines of [k * (s / 2)]) {
            c.fillStyle = 'rgba(255,190,90,0.95)';
            c.beginPath(); c.arc(t, lines, 2.4, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(lines, t + 18, 2.4, 0, Math.PI * 2); c.fill();
          }
        }
      }
    }
  });

const grid: BackgroundLayerType = {
  id: 't06_grid',
  create(def, tier, ctx) {
    const view = new Container();
    const seed = (def.params?.seed as number) ?? Math.floor(def.depth * 100) + 3;
    const base = new TilingSprite({ texture: gridTex(seed, 'base'), width: 100, height: 100 });
    base.tint = def.color ?? 0x2a3a6a;
    const lights = new TilingSprite({ texture: gridTex(seed, 'lights'), width: 100, height: 100 });
    lights.blendMode = 'add';
    lights.tint = def.colors?.[0] ?? 0xffffff;
    view.addChild(base, lights);
    return {
      view,
      resize(w, h) { base.width = lights.width = w; base.height = lights.height = h; },
      update(cam) {
        const s = (def.scale ?? 1) * Math.pow(cam.zoomRatio, def.depth * 0.6);
        base.tileScale.set(s); lights.tileScale.set(s);
        const x = -cam.x * cam.zoom * def.depth + cam.width / 2, y = -cam.y * cam.zoom * def.depth + cam.height / 2;
        base.tilePosition.set(x, y); lights.tilePosition.set(x, y);
        base.alpha = def.alpha ?? 0.5;
        const n = night(ctx.progress);
        lights.alpha = (def.alpha ?? 0.5) * 1.5 * Math.min(1, n) * (0.88 + 0.12 * Math.sin(cam.time * 1.3 + def.depth * 9));
        void tier;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

// ---------------------------------------------------------------- skyline
const SKY_W = 1024, SKY_H = 512;
interface Bld { x: number; w: number; h: number; step: boolean; ant: boolean }
const buildings: Bld[] = (() => {
  const r = new Rng(606);
  const out: Bld[] = [];
  let x = 0;
  while (x < SKY_W) {
    const w = Math.min(SKY_W - x, Math.round(r.range(46, 120)));
    const h = Math.round(r.range(110, 430) * (r.chance(0.2) ? 1.0 : 0.82));
    out.push({ x, w, h, step: r.chance(0.4), ant: r.chance(0.3) });
    x += w;
  }
  return out;
})();
const skylineTex = (mode: 'sil' | 0 | 1 | 2) =>
  bakeTexture(`bg:t06:sky:${mode}`, SKY_W, (c) => {
    buildings.forEach((b, bi) => {
      const y = SKY_H - b.h;
      if (mode === 'sil') {
        const g = c.createLinearGradient(0, y, 0, SKY_H);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#aab');
        c.fillStyle = g;
        c.fillRect(b.x, y, b.w - 2, b.h);
        if (b.step) c.fillRect(b.x + b.w * 0.2, y - b.h * 0.12, b.w * 0.55, b.h * 0.12);
        if (b.ant) c.fillRect(b.x + b.w * 0.45, y - b.h * 0.3, 3, b.h * 0.3);
      } else {
        const r = new Rng(900 + bi);
        const cw = 7, ch = 10, gx = 6, gy = 6;
        for (let wy = y + 14; wy < SKY_H - 10; wy += ch + gy) {
          for (let wx = b.x + 7; wx < b.x + b.w - 12; wx += cw + gx) {
            const set = Math.floor(r.next() * 3);
            const lit = r.chance(0.55);
            const warm = r.chance(0.85);
            if (set === mode && lit) {
              c.fillStyle = warm ? 'rgba(255,214,120,0.95)' : 'rgba(160,220,255,0.95)';
              c.fillRect(wx, wy, cw, ch);
            }
          }
        }
      }
    });
  });

const skyline: BackgroundLayerType = {
  id: 't06_skyline',
  create(def, tier, ctx) {
    const view = new Container();
    const mk = (tex: any, add: boolean) => {
      const t = new TilingSprite({ texture: tex, width: 100, height: SKY_H });
      if (add) t.blendMode = 'add';
      view.addChild(t);
      return t;
    };
    const sil = mk(skylineTex('sil'), false);
    sil.tint = def.color ?? 0x0c1230;
    const sets = [0, 1, 2].map((i) => mk(skylineTex(i as 0 | 1 | 2), true));
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; sil.width = w; for (const s of sets) s.width = w; },
      update(cam) {
        const sc = Math.max(0.5, (H * 0.55) / SKY_H) * (def.scale ?? 1);
        const hh = SKY_H * sc;
        const ox = -cam.x * cam.zoom * def.depth;
        for (const t of [sil, ...sets]) {
          t.tileScale.set(sc);
          t.y = H - hh + ((def.params?.lift as number) ?? 0);
          t.height = hh;
          t.tilePosition.set(ox, 0);
        }
        const n = night(ctx.progress);
        sil.alpha = def.alpha ?? 0.8;
        sets.forEach((s, i) => {
          const k = clamp(n * 3 - i, 0, 1);
          s.alpha = (def.alpha ?? 0.8) * k * (0.82 + 0.18 * Math.sin(cam.time * (1.1 + i * 0.4) + i * 2));
        });
        void tier; void W;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [grid, skyline];
void Sprite;
