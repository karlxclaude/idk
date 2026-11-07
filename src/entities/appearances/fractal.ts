/** Tier 12: multiverse-eater. A void heart wrapped in recursively nested, counter-rotating bubble rings and fractal tendrils. */
import { Container } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, bakeUnits, rimTex, rng, sprite } from './_kit';

function branch(c: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, w: number, depth: number, r: () => number) {
  if (depth === 0 || len < 0.04) return;
  const bend = (r() - 0.5) * 0.9;
  const x1 = x + Math.cos(a + bend * 0.5) * len, y1 = y + Math.sin(a + bend * 0.5) * len;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6, x1, y1);
  c.stroke();
  const na = a + bend;
  branch(c, x1, y1, na - 0.55, len * 0.62, w * 0.65, depth - 1, r);
  branch(c, x1, y1, na + 0.55, len * 0.62, w * 0.65, depth - 1, r);
  if (depth > 2) branch(c, x1, y1, na, len * 0.7, w * 0.7, depth - 1, r);
}
const tendrilTex = (key: string, seed: number, n: number) =>
  bakeUnits(key, 512, 4.4, (c) => {
    const r = rng(seed);
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineCap = 'round';
    c.shadowColor = 'white';
    c.shadowBlur = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      branch(c, Math.cos(a) * 0.95, Math.sin(a) * 0.95, a, 0.55, 0.045, 5, r);
    }
  });

interface Bubble {
  node: Container;
  speed: number;
}

/** Nested bubble: ring + faint fill, with `kids` satellites orbiting at radius d each a smaller bubble. */
function bubble(level: number, color: number, accent: number, spin: Bubble[]): Container {
  const c = new Container();
  c.addChild(sprite(Tex.disc(), 2, { alpha: 0.07 + 0.03 * level, tint: color }));
  c.addChild(sprite(Tex.ring(), 2, { add: true, alpha: 0.9 - level * 0.12, tint: level % 2 ? accent : color }));
  if (level < 2) {
    const kids = level === 0 ? 5 : 4;
    const orbit = new Container();
    c.addChild(orbit);
    for (let i = 0; i < kids; i++) {
      const k = bubble(level + 1, color, accent, spin);
      const a = (i / kids) * TAU, d = level === 0 ? 0.72 : 0.7;
      k.position.set(Math.cos(a) * d, Math.sin(a) * d);
      k.scale.set(level === 0 ? 0.3 : 0.32);
      orbit.addChild(k);
    }
    spin.push({ node: orbit, speed: (level === 0 ? 0.5 : -1.1) * (level + 1) });
  }
  return c;
}

const fractal: PlayerAppearanceDef = {
  id: 'fractal',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 7, { add: true, alpha: 0.55, tint: pal.playerGlow });
    const ten1 = sprite(tendrilTex('app:fr:t1', 8, 7), 4.4, { add: true, alpha: 0.65, tint: pal.playerGlow });
    const ten2 = sprite(tendrilTex('app:fr:t2', 23, 5), 3.8, { add: true, alpha: 0.5, tint: pal.accent });
    const spin: Bubble[] = [];
    const root = bubble(0, pal.player, pal.accent, spin);
    root.scale.set(1.15);
    const voidDisc = sprite(Tex.disc(), 0.9, { tint: 0x02000a, alpha: 0.9 });
    const voidRim = sprite(rimTex(), 1.25, { add: true, alpha: 0.9, tint: pal.accent });
    const heart = sprite(Tex.glow(), 1.9, { add: true, alpha: 0.5, tint: pal.playerGlow });
    const rim = sprite(rimTex(), 2.6, { add: true, alpha: 0.7, tint: pal.playerGlow });
    view.addChild(halo, ten1, ten2, root, heart, voidDisc, voidRim, rim);
    R.attach(view, pal.playerGlow, 2.9);
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash;
        const boost = 1 + f * 3 + R.dash;
        ten1.rotation += dt * 0.12 * boost;
        ten2.rotation -= dt * 0.2 * boost;
        const wob = 1 + Math.sin(t * 2.4) * 0.03 + R.eat * 0.08;
        ten1.width = ten1.height = 4.4 * wob;
        for (const s of spin) s.node.rotation += dt * s.speed * boost;
        root.rotation -= dt * 0.15 * boost;
        halo.alpha = 0.5 + f * 0.4;
        halo.width = halo.height = 7 * (1 + f * 0.2);
        heart.alpha = 0.4 + Math.sin(t * 3) * 0.1 + f * 0.5;
        voidDisc.width = voidDisc.height = 0.9 + Math.sin(t * 1.8) * 0.04 + R.eat * 0.35;
        voidRim.width = voidRim.height = 1.25 + R.eat * 0.4;
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default fractal;
