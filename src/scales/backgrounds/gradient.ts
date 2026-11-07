/** 'gradient': full-screen vertical gradient (palette bgTop → bgBottom) + breathing centre glow. */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { colorToCss } from '../../core/math';
import type { BackgroundLayerType } from '../backgroundRegistry';

const layer: BackgroundLayerType = {
  id: 'gradient',
  create(def, tier) {
    const view = new Container();
    const top = def.colors?.[0] ?? tier.palette.bgTop;
    const bottom = def.colors?.[1] ?? tier.palette.bgBottom;
    const tex = bakeTexture(`bg:grad:${top}:${bottom}`, 256, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, colorToCss(top));
      g.addColorStop(1, colorToCss(bottom));
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    const bg = new Sprite(tex);
    view.addChild(bg);
    const centerColor = def.color ?? tier.palette.bgCenter;
    const glow = new Sprite(Tex.glow());
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.tint = centerColor ?? 0x000000;
    glow.visible = centerColor !== undefined;
    view.addChild(glow);
    let w = 1, h = 1;
    return {
      view,
      resize(W, H) {
        w = W; h = H;
        bg.width = W; bg.height = H;
        glow.position.set(W / 2, H / 2);
      },
      update(cam) {
        const d = Math.hypot(w, h) * (1.1 + Math.sin(cam.time * 0.3) * 0.05);
        glow.width = glow.height = d;
        glow.alpha = (def.alpha ?? 0.5) * (0.85 + Math.sin(cam.time * 0.5) * 0.15);
      },
      destroy() {
        view.destroy({ children: true });
      },
    };
  },
};
export default layer;
