/**
 * Tier 5 background layer types:
 *  - 't05_sun': a low sunset sun with a glittering reflection path.
 *  - 't05_waves': tiling rows of wave crests that scroll and parallax.
 *  - 't05_cliffs': top-down sea stacks and cliff headlands ringed with surf, at layered depths.
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const TAU = Math.PI * 2;

const glitterTex = () =>
  bakeTexture('bg:t05:glitter', 256, (c, s) => {
    const r = new Rng(21);
    for (let i = 0; i < 90; i++) {
      const y = Math.pow(r.next(), 0.8) * s;
      const w = (6 + r.next() * 34) * (1 - y / s * 0.55);
      const x = s / 2 + (r.next() - 0.5) * (s * 0.55) * (0.25 + y / s);
      c.fillStyle = `rgba(255,255,255,${(0.9 - y / s * 0.6) * r.range(0.4, 1)})`;
      c.beginPath(); c.roundRect(x - w / 2, y, w, 2 + r.next() * 2.5, 2); c.fill();
    }
  });

const sun: BackgroundLayerType = {
  id: 't05_sun',
  create(def, tier) {
    const view = new Container();
    const halo = new Sprite(Tex.glow());
    halo.anchor.set(0.5); halo.blendMode = 'add'; halo.tint = def.colors?.[0] ?? 0xff7a5a;
    const halo2 = new Sprite(Tex.glow());
    halo2.anchor.set(0.5); halo2.blendMode = 'add'; halo2.tint = def.colors?.[1] ?? 0xffc080;
    const disc = new Sprite(Tex.disc());
    disc.anchor.set(0.5); disc.tint = def.colors?.[2] ?? 0xfff0d0;
    const glit = [0, 1, 2].map((i) => {
      const g = new Sprite(glitterTex());
      g.anchor.set(0.5, 0); g.blendMode = 'add'; g.tint = def.colors?.[1] ?? 0xffd0a0;
      (g as any).ph = i * 2.1;
      return g;
    });
    view.addChild(halo, halo2, ...glit, disc);
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const px = -cam.x * cam.zoom * def.depth, py = -cam.y * cam.zoom * def.depth * 0.6;
        const cx = W * 0.5 + px, cy = H * 0.2 + py;
        const R = Math.min(W, H) * 0.09 * (def.scale ?? 1);
        halo.position.set(cx, cy); halo.width = halo.height = R * 14; halo.alpha = (def.alpha ?? 0.5) * 0.75;
        halo2.position.set(cx, cy); halo2.width = halo2.height = R * 6; halo2.alpha = (def.alpha ?? 0.5) * 0.9;
        disc.position.set(cx, cy); disc.width = disc.height = R * 2;
        for (const g of glit) {
          const ph = (g as any).ph;
          g.position.set(cx + Math.sin(cam.time * 0.6 + ph) * 8, cy + R * 0.8);
          g.width = R * 5 * (0.9 + 0.1 * Math.sin(cam.time * 1.3 + ph));
          g.height = H * 0.95;
          g.alpha = (def.alpha ?? 0.5) * 0.45 * (0.55 + 0.45 * Math.sin(cam.time * 2.2 + ph * 3));
        }
        void tier;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const waveTex = () =>
  bakeTexture('bg:t05:waves', 256, (c, s) => {
    const r = new Rng(88);
    c.lineCap = 'round';
    for (let row = 0; row < 7; row++) {
      const y0 = (row + 0.5) * (s / 7) + r.range(-6, 6);
      const k = 1 + (row % 3);
      const amp = r.range(3, 7);
      const ph = r.range(0, TAU);
      c.lineWidth = r.range(1.6, 3.4);
      c.strokeStyle = `rgba(255,255,255,${r.range(0.4, 0.9)})`;
      const start = r.range(0, s), len = r.range(s * 0.25, s * 0.6);
      for (const off of [-s, 0]) {
        c.beginPath();
        let started = false;
        for (let x = 0; x <= len; x += 3) {
          const X = start + x + off;
          const y = y0 + Math.sin((X / s) * TAU * k + ph) * amp;
          if (!started) { c.moveTo(X, y); started = true; } else c.lineTo(X, y);
        }
        c.stroke();
      }
    }
  });

const waves: BackgroundLayerType = {
  id: 't05_waves',
  create(def, tier) {
    const view = new Container();
    const ts = new TilingSprite({ texture: waveTex(), width: 100, height: 100 });
    ts.tint = def.color ?? tier.palette.glow;
    ts.alpha = def.alpha ?? 0.3;
    if (def.blend === 'add') ts.blendMode = 'add';
    view.addChild(ts);
    return {
      view,
      resize(w, h) { ts.width = w; ts.height = h; },
      update(cam) {
        const s = (def.scale ?? 1) * Math.pow(cam.zoomRatio, def.depth * 0.5);
        ts.tileScale.set(s, s * 0.8);
        const sp = (def.speed ?? 1) * 18;
        ts.tilePosition.set(-cam.x * cam.zoom * def.depth + cam.width / 2 + cam.time * sp, -cam.y * cam.zoom * def.depth + cam.height / 2 + Math.sin(cam.time * 0.4) * 10);
        ts.alpha = (def.alpha ?? 0.3) * (0.85 + 0.15 * Math.sin(cam.time * 0.8 + def.depth * 7));
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const rockTex = (i: number) =>
  bakeTexture(`bg:t05:rock:${i}`, 256, (c, s) => {
    const r = new Rng(300 + i * 17);
    const m = s / 2;
    const ph = [r.range(0, TAU), r.range(0, TAU), r.range(0, TAU), r.range(0, TAU)];
    const pts: [number, number][] = [];
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * TAU;
      const rad = 0.62 + 0.12 * Math.sin(a * 2 + ph[0]) + 0.1 * Math.sin(a * 3 + ph[1]) + 0.06 * Math.sin(a * 5 + ph[2]) + 0.03 * Math.sin(a * 9 + ph[3]);
      pts.push([m + Math.cos(a) * rad * m * 0.9, m + Math.sin(a) * rad * m * 0.9 * (i === 2 ? 0.7 : 1)]);
    }
    const path = () => { c.beginPath(); pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
    const g = c.createRadialGradient(m * 0.7, m * 0.65, 4, m, m, m);
    g.addColorStop(0, '#fff'); g.addColorStop(0.7, '#9a9a9a'); g.addColorStop(1, '#5a5a5a');
    path(); c.fillStyle = g; c.fill();
    c.save(); path(); c.clip();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
    for (let k = 0; k < 9; k++) {
      c.beginPath(); c.moveTo(m + r.range(-50, 50), m + r.range(-50, 50));
      c.lineTo(m + r.range(-110, 110), m + r.range(-110, 110)); c.stroke();
    }
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(m * 1.25, m * 1.3, m * 0.7, m * 0.55, 0.6, 0, TAU); c.fill();
    c.restore();
  });
const surfTex = () =>
  bakeTexture('bg:t05:surf', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, m * 0.35, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  });

const cliffs: BackgroundLayerType = {
  id: 't05_cliffs',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 5));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 7);
    const colors = def.colors ?? [tier.palette.bgBottom];
    const items = Array.from({ length: n }, (_, i) => {
      const foam = new Sprite(surfTex());
      foam.anchor.set(0.5); foam.blendMode = 'add'; foam.tint = 0xcff2ff;
      const rock = new Sprite(rockTex(i % 3));
      rock.anchor.set(0.5); rock.tint = colors[i % colors.length];
      view.addChild(foam, rock);
      return { foam, rock, bx: rng.next(), by: rng.next(), size: rng.range(0.14, 0.34), rot: rng.range(0, TAU), ph: rng.range(0, 9) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.5, ph = H * 1.5;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy) % ph; if (y < 0) y += ph;
          const px = x - W * 0.25, py = y - H * 0.25;
          const sz = Math.max(W, H) * it.size * (def.scale ?? 1);
          it.rock.position.set(px, py); it.rock.width = it.rock.height = sz; it.rock.rotation = it.rot;
          it.foam.position.set(px, py); it.foam.width = it.foam.height = sz * (1.9 + 0.08 * Math.sin(cam.time * 0.9 + it.ph));
          it.rock.alpha = def.alpha ?? 0.5;
          it.foam.alpha = (def.alpha ?? 0.5) * (0.55 + 0.25 * Math.sin(cam.time * 0.9 + it.ph));
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [sun, waves, cliffs];
