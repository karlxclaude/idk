/**
 * Tier 4 background layer types:
 *  - 't04_caustics': rippling caustic light + surface glow from above; fades with depth.
 *  - 't04_leviathans': huge dim silhouettes (whales, rays, shoals) cruising in the dark.
 *  - 't04_depth': darkness veil that thickens the deeper (further down) the player swims.
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng, clamp } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const TAU = Math.PI * 2;
/** 0 (surface) .. 1 (abyss) from absolute camera y. */
const depth01 = (y: number, span: number) => 1 / (1 + Math.exp(-y / span));

const causticTex = () =>
  bakeTexture('bg:t04:caustic', 256, (c, s) => {
    const img = c.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = (x / s) * TAU, v = (y / s) * TAU;
        const n =
          Math.sin(u * 2 + Math.sin(v * 3) * 1.3) +
          Math.sin(v * 2 + Math.sin(u * 3 + 1) * 1.3) +
          Math.sin((u + v) * 2 + Math.sin((u - v) * 2) * 1.1);
        const t = Math.max(0, 1 - Math.abs(n) * 1.15);
        const a = Math.round(255 * t * t * t);
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = a;
      }
    }
    c.putImageData(img, 0, 0);
  });

const surfaceTex = () =>
  bakeTexture('bg:t04:surface', 128, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

const caustics: BackgroundLayerType = {
  id: 't04_caustics',
  create(def, tier) {
    const view = new Container();
    const color = def.color ?? 0x7ad8ff;
    const surface = new Sprite(surfaceTex());
    surface.blendMode = 'add';
    surface.tint = tier.palette.glow;
    view.addChild(surface);
    const mk = (a: number) => {
      const ts = new TilingSprite({ texture: causticTex(), width: 100, height: 100 });
      ts.blendMode = 'add';
      ts.tint = color;
      ts.alpha = a;
      view.addChild(ts);
      return ts;
    };
    const a = mk(1), b = mk(0.7);
    const span = (def.params?.span as number) ?? 4000;
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) {
        W = w; H = h;
        a.width = b.width = w; a.height = b.height = h;
        surface.width = w; surface.height = h * 0.8;
      },
      update(cam) {
        const light = Math.pow(1 - depth01(cam.y, span), 1.4);
        const s1 = 2.4 * (def.scale ?? 1), s2 = 1.6 * (def.scale ?? 1);
        a.tileScale.set(s1);
        b.tileScale.set(s2);
        const dx = -cam.x * cam.zoom * def.depth, dy = -cam.y * cam.zoom * def.depth;
        a.tilePosition.set(dx + cam.time * 14, dy + cam.time * 9);
        b.tilePosition.set(dx * 1.6 - cam.time * 11, dy * 1.6 + cam.time * 7 + 60);
        const al = (def.alpha ?? 0.3) * (0.4 + 0.6 * light);
        a.alpha = al * (0.8 + 0.2 * Math.sin(cam.time * 0.9));
        b.alpha = al * 0.7 * (0.8 + 0.2 * Math.sin(cam.time * 1.3 + 2));
        surface.alpha = 0.55 * light * (0.88 + 0.12 * Math.sin(cam.time * 0.6));
        void W; void H;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const levTex = (i: number) =>
  bakeTexture(`bg:t04:lev:${i}`, 512, (c, s) => {
    const m = s / 2;
    c.shadowColor = '#fff';
    c.shadowBlur = 14;
    c.fillStyle = '#fff';
    c.translate(m, m);
    if (i === 0) { // whale
      c.beginPath();
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, x = 200 - 400 * u;
        c.lineTo(x, -62 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8) - 6 * u * u * u);
      }
      for (let k = 60; k >= 0; k--) {
        const u = k / 60, x = 200 - 400 * u;
        c.lineTo(x, 55 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.8) + 6 * u * u * u);
      }
      c.fill();
      c.beginPath(); c.moveTo(-190, -4); c.quadraticCurveTo(-225, -30, -250, -60); c.quadraticCurveTo(-232, -8, -240, 0);
      c.quadraticCurveTo(-232, 8, -250, 60); c.quadraticCurveTo(-225, 30, -190, 4); c.fill();
      c.beginPath(); c.moveTo(60, 40); c.quadraticCurveTo(20, 90, -40, 100); c.quadraticCurveTo(0, 60, 10, 40); c.fill();
    } else if (i === 1) { // manta ray
      c.beginPath();
      c.moveTo(220, 0);
      c.quadraticCurveTo(80, -150, -60, -190);
      c.quadraticCurveTo(-30, -60, -110, -10);
      c.lineTo(-250, 0);
      c.lineTo(-110, 10);
      c.quadraticCurveTo(-30, 60, -60, 190);
      c.quadraticCurveTo(80, 150, 220, 0);
      c.fill();
    } else { // shoal
      const r = new Rng(9);
      for (let k = 0; k < 46; k++) {
        const x = r.range(-200, 200), y = r.range(-70, 70) * (1 - Math.abs(x) / 280);
        c.beginPath(); c.ellipse(x, y, 13, 5, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x - 19, y - 5); c.lineTo(x - 19, y + 5); c.fill();
      }
    }
  });

const leviathans: BackgroundLayerType = {
  id: 't04_leviathans',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 4));
    const rng = new Rng(404 + n);
    const colors = def.colors ?? [tier.palette.glow];
    const items = Array.from({ length: n }, (_, i) => {
      const kind = i % 3;
      const s = new Sprite(levTex(kind));
      s.anchor.set(0.5);
      s.tint = colors[i % colors.length];
      view.addChild(s);
      return { s, kind, bx: rng.next(), by: rng.range(0.1, 0.9), size: rng.range(0.55, 0.95), sp: rng.range(8, 20) * (rng.chance(0.5) ? 1 : -1), ph: rng.range(0, 9) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 2.2;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth * 0.6;
        for (const it of items) {
          let x = (it.bx * pw + ox + cam.time * it.sp) % pw; if (x < 0) x += pw;
          const ph = H * 1.6;
          let y = (it.by * ph + oy + Math.sin(cam.time * 0.15 + it.ph) * 22) % ph; if (y < 0) y += ph;
          it.s.position.set(x - pw * 0.25, y - H * 0.3);
          const sz = Math.max(W, H) * it.size * (def.scale ?? 1) * (it.kind === 2 ? 0.5 : 1);
          it.s.width = sz; it.s.height = sz;
          it.s.scale.x = Math.abs(it.s.scale.x) * (it.sp < 0 ? -1 : 1);
          it.s.alpha = def.alpha ?? 0.3;
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

const depthVeil: BackgroundLayerType = {
  id: 't04_depth',
  create(def, tier) {
    const view = new Container();
    const tex = bakeTexture('bg:t04:veil', 128, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    const veil = new Sprite(tex);
    veil.tint = def.color ?? 0x00030c;
    view.addChild(veil);
    const span = (def.params?.span as number) ?? 4000;
    return {
      view,
      resize(w, h) { veil.width = w; veil.height = h; },
      update(cam) {
        veil.alpha = clamp((def.alpha ?? 0.7) * (0.15 + 0.85 * depth01(cam.y, span)), 0, 0.95);
        void tier;
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [caustics, leviathans, depthVeil];
