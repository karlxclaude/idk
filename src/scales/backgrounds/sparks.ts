/**
 * 'sparks': individual ambient sprites with parallax, drift and pop-in/out flicker
 * (used for TierConfig.ambient; also usable directly). params: count, size [px,px], drift px/s, flicker 0..1.
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { BackgroundLayerType } from '../backgroundRegistry';

interface Spark {
  s: Sprite;
  bx: number; by: number; vx: number; vy: number; phase: number; rate: number; size: number;
}

const layer: BackgroundLayerType = {
  id: 'sparks',
  create(def, tier, ctx) {
    const view = new Container();
    const p = def.params ?? {};
    const qualityMul = ctx.state.settings.quality === 'low' ? 0.5 : 1;
    const count = Math.floor(((p.count as number) ?? 40) * qualityMul);
    const size = (p.size as [number, number]) ?? [2, 6];
    const drift = (p.drift as number) ?? 10;
    const flicker = (p.flicker as number) ?? 0.3;
    const colors = def.colors ?? [tier.palette.accent];
    const sparks: Spark[] = [];
    let W = 800, H = 600;
    for (let i = 0; i < count; i++) {
      const s = new Sprite(Tex.dot());
      s.anchor.set(0.5);
      s.tint = colors[i % colors.length];
      if (def.blend !== 'normal') s.blendMode = 'add';
      view.addChild(s);
      const a = Math.random() * Math.PI * 2;
      const sp = drift * (0.3 + Math.random());
      sparks.push({ s, bx: Math.random(), by: Math.random(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, phase: Math.random() * 10, rate: 0.5 + Math.random() * 2, size: size[0] + Math.random() * (size[1] - size[0]) });
    }
    return {
      view,
      resize(w, h) {
        W = w; H = h;
      },
      update(cam) {
        const pw = W * 1.2, ph = H * 1.2;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const k of sparks) {
          k.bx += (k.vx * cam.realDt) / pw;
          k.by += (k.vy * cam.realDt) / ph;
          let x = (k.bx * pw + ox) % pw; if (x < 0) x += pw;
          let y = (k.by * ph + oy) % ph; if (y < 0) y += ph;
          k.s.position.set(x - W * 0.1, y - H * 0.1);
          k.phase += cam.realDt * k.rate;
          const wave = Math.sin(k.phase);
          // flicker 1 → hard pop in/out; 0 → steady
          const vis = flicker > 0 ? Math.max(0, Math.min(1, (wave + 1 - flicker * 1.6) / (1 - flicker * 0.6 + 0.001))) : 1;
          if (vis <= 0 && flicker > 0.5 && Math.random() < 0.02) { k.bx = Math.random(); k.by = Math.random(); }
          k.s.alpha = (def.alpha ?? 0.8) * vis;
          k.s.width = k.s.height = k.size * (0.6 + 0.4 * vis) * (def.depth > 1 ? def.depth : 1);
        }
      },
      destroy() {
        view.destroy({ children: true });
      },
    };
  },
};
export default layer;
