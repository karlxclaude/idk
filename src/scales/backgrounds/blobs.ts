/** 'blobs': a few huge soft additive glows drifting with parallax (cheap nebula fallback). */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { BackgroundLayerType } from '../backgroundRegistry';

const layer: BackgroundLayerType = {
  id: 'blobs',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(1, Math.round(def.density ?? 5));
    const colors = def.colors ?? [tier.palette.accent, tier.palette.glow];
    const blobs = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(Tex.glow());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = colors[i % colors.length];
      view.addChild(s);
      return { s, bx: Math.random(), by: Math.random(), size: 0.5 + Math.random() * 0.9, ph: Math.random() * 10 };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) {
        W = w; H = h;
      },
      update(cam) {
        const pw = W * 1.8, ph = H * 1.8;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const b of blobs) {
          let x = (b.bx * pw + ox + Math.sin(cam.time * 0.05 * (def.speed ?? 1) + b.ph) * 60) % pw; if (x < 0) x += pw;
          let y = (b.by * ph + oy + Math.cos(cam.time * 0.04 * (def.speed ?? 1) + b.ph) * 60) % ph; if (y < 0) y += ph;
          b.s.position.set(x - W * 0.4, y - H * 0.4);
          b.s.width = b.s.height = Math.max(W, H) * b.size * (def.scale ?? 1);
          b.s.alpha = (def.alpha ?? 0.25) * (0.8 + 0.2 * Math.sin(cam.time * 0.3 + b.ph));
        }
      },
      destroy() {
        view.destroy({ children: true });
      },
    };
  },
};
export default layer;
