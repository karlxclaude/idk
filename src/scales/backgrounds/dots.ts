/** 'dots': cheap tiling star/dust field (TilingSprite) with parallax and twinkle. */
import { Container, TilingSprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const layer: BackgroundLayerType = {
  id: 'dots',
  create(def, tier) {
    const view = new Container();
    const density = def.density ?? 1;
    const size = 512;
    const seed = Math.floor((def.scale ?? 1) * 1000 + density * 77 + def.depth * 1313);
    const tex = bakeTexture(`bg:dots:${seed}:${density}`, size, (c, s) => {
      const r = new Rng(seed);
      const n = Math.floor(density * 140);
      for (let i = 0; i < n; i++) {
        const x = r.range(0, s), y = r.range(0, s);
        const rad = r.range(0.6, 2.2) * (r.chance(0.08) ? 2 : 1);
        const a = r.range(0.25, 1);
        for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
          const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad * 2);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = g;
          c.fillRect(x + ox - rad * 2, y + oy - rad * 2, rad * 4, rad * 4);
        }
      }
    });
    const ts = new TilingSprite({ texture: tex, width: 100, height: 100 });
    ts.tint = def.color ?? tier.palette.accent;
    ts.alpha = def.alpha ?? 0.6;
    if (def.blend === 'add' || def.blend === 'screen') ts.blendMode = def.blend;
    view.addChild(ts);
    const twinkle = (def.params?.twinkle as number) ?? 0.15;
    return {
      view,
      resize(w, h) {
        ts.width = w;
        ts.height = h;
      },
      update(cam) {
        const s = (def.scale ?? 1) * Math.pow(cam.zoomRatio, def.depth * 0.6);
        ts.tileScale.set(s);
        ts.tilePosition.set(-cam.x * cam.zoom * def.depth + cam.width / 2, -cam.y * cam.zoom * def.depth + cam.height / 2);
        ts.alpha = (def.alpha ?? 0.6) * (1 - twinkle + twinkle * Math.sin(cam.time * 1.7 + def.depth * 10));
      },
      destroy() {
        view.destroy({ children: true });
      },
    };
  },
};
export default layer;
