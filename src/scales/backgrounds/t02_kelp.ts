/**
 * 'reefKelp' (tier 2): out-of-focus kelp / ribbon-protein silhouettes swaying from the bottom of
 * the screen, drifting horizontally with parallax. params.height = fraction of screen height.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const frondTex = (variant: number) =>
  bakeTexture(`bg:t02:frond:${variant}`, 256, (c, s) => {
    const r = new Rng(900 + variant);
    const w = 128, h = s;
    const sway = r.range(10, 22), freq = r.range(1.2, 2.4), ph = r.range(0, 6);
    const half = (y: number) => 3 + (1 - y / h) * 9 + Math.sin(y * 0.05 + variant) * 1.5;
    const mid = (y: number) => w / 2 + Math.sin((y / h) * freq * Math.PI + ph) * sway * (1 - y / h * 0.3);
    // blade
    c.beginPath();
    for (let y = 0; y <= h; y += 4) c.lineTo(mid(y) - half(y), y);
    for (let y = h; y >= 0; y -= 4) c.lineTo(mid(y) + half(y), y);
    c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fill();
    // little leaflets
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    for (let y = 40; y < h; y += 14) {
      const d = (y % 28 === 0 ? 1 : -1) * (half(y) + 6 + r.range(0, 6));
      c.beginPath(); c.moveTo(mid(y), y); c.lineTo(mid(y) + d, y - 6); c.stroke();
    }
  });

const layer: BackgroundLayerType = {
  id: 'reefKelp',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 8));
    const colors = def.colors ?? [tier.palette.accent];
    const rng = new Rng(Math.floor(def.depth * 997 + n * 31));
    const hFrac = (def.params?.height as number) ?? 0.6;
    const fronds = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(frondTex(i % 4));
      s.anchor.set(0.5, 1);
      s.tint = colors[i % colors.length];
      if (def.blend === 'add') s.blendMode = 'add';
      view.addChild(s);
      return { s, bx: rng.next(), size: rng.range(0.55, 1.1), ph: rng.range(0, 10), sp: rng.range(0.4, 0.9) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.4;
        const ox = -cam.x * cam.zoom * def.depth;
        const oy = Math.max(-40, Math.min(40, -cam.y * cam.zoom * def.depth * 0.3));
        const t = cam.time * (def.speed ?? 1);
        for (const f of fronds) {
          let x = (f.bx * pw + ox) % pw; if (x < 0) x += pw;
          f.s.position.set(x - W * 0.2, H + 10 + oy);
          const hh = H * hFrac * f.size * (def.scale ?? 1);
          f.s.height = hh;
          f.s.width = hh * 0.5;
          f.s.rotation = Math.sin(t * f.sp + f.ph) * 0.09;
          f.s.alpha = def.alpha ?? 0.3;
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default layer;
