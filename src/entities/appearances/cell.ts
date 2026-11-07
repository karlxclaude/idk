/** Tiers 2-3: a living cell. Translucent membrane, cytoplasm, nucleus, organelles and wiggling cilia. */
import { Container } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, bakeUnits, blotchTex, rimTex, rng, softDisc, sprite } from './_kit';

function ciliaTex(key: string, seed: number, n: number) {
  return bakeUnits(key, 512, 3.2, (c) => {
    const r = rng(seed);
    c.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = ((i + r() * 0.5) / n) * TAU, len = 0.2 + r() * 0.16, bend = (r() - 0.5) * 0.5;
      const x0 = Math.cos(a) * 0.97, y0 = Math.sin(a) * 0.97;
      const mx = Math.cos(a + bend * 0.5) * (0.97 + len * 0.5), my = Math.sin(a + bend * 0.5) * (0.97 + len * 0.5);
      const x1 = Math.cos(a + bend * 0.3) * (0.97 + len), y1 = Math.sin(a + bend * 0.3) * (0.97 + len);
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = g;
      c.lineWidth = 0.035;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(mx + Math.cos(a + 1.57) * bend * 0.2, my + Math.sin(a + 1.57) * bend * 0.2, x1, y1);
      c.stroke();
    }
  });
}

const cell: PlayerAppearanceDef = {
  id: 'cell',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 5.4, { add: true, alpha: 0.45, tint: pal.playerGlow });
    const cil1 = sprite(ciliaTex('app:cilia1', 5, 30), 3.2, { add: true, alpha: 0.85, tint: pal.playerGlow });
    const cil2 = sprite(ciliaTex('app:cilia2', 9, 24), 3.2, { add: true, alpha: 0.6, tint: pal.accent });
    const body = R.tinted(sprite(softDisc(), 2.05, { alpha: 0.62 }), pal.player);
    const cyto = sprite(blotchTex('app:cell:cyto', 21, 28, 0.08, 0.22, 0.6), 1.85, { add: true, alpha: 0.5, tint: pal.playerGlow });
    const vac = [0, 1, 2, 3].map((i) => sprite(Tex.orb(), 0.2 + (i % 2) * 0.1, { alpha: 0.5, tint: pal.accent }));
    const nucGlow = sprite(Tex.glow(), 1.5, { add: true, alpha: 0.7, tint: pal.accent });
    const nuc = R.tinted(sprite(Tex.orb(), 0.7), pal.accent);
    const nucleolus = sprite(Tex.glow(), 0.35, { add: true, alpha: 0.95 });
    const rim = sprite(rimTex(), 2.2, { add: true, alpha: 0.95, tint: pal.playerGlow });
    const mem = sprite(Tex.ring(), 2.08, { add: true, alpha: 0.5, tint: 0xffffff });
    view.addChild(halo, cil1, cil2, body, cyto, ...vac, nucGlow, nuc, nucleolus, rim, mem);
    R.attach(view, pal.playerGlow, 2.3);
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash, sp = R.speed;
        halo.width = halo.height = (5.4 + Math.sin(t * 2) * 0.25) * (1 + f * 0.4);
        halo.alpha = 0.4 + f * 0.4;
        // cilia: rippling rotation + scale, faster when moving
        const w = 3 + sp * 7;
        cil1.rotation = Math.sin(t * w) * 0.045 + t * 0.05;
        cil2.rotation = Math.sin(t * w * 1.3 + 1.7) * 0.06 - t * 0.04;
        cil1.scale.set(1 + Math.sin(t * w * 1.1) * 0.025);
        cil2.scale.set(1 + Math.cos(t * w * 0.9) * 0.03);
        // wobbling membrane
        mem.width = 2.08 + Math.sin(t * 5.1) * 0.06 + f * 0.1;
        mem.height = 2.08 + Math.cos(t * 4.3) * 0.06 + f * 0.1;
        rim.alpha = 0.8 + f * 0.2;
        cyto.rotation = t * 0.25;
        // nucleus drifts toward heading slightly and pulses
        nuc.position.set(0.12 + Math.sin(t * 0.9) * 0.05 + sp * 0.08, Math.cos(t * 1.3) * 0.06);
        nucGlow.position.copyFrom(nuc.position);
        nucleolus.position.set(nuc.x - 0.06, nuc.y - 0.06);
        nuc.width = nuc.height = 0.7 + Math.sin(t * 3) * 0.025 + R.eat * 0.15;
        nucGlow.alpha = 0.55 + f * 0.45 + Math.sin(t * 2.4) * 0.1;
        vac.forEach((v, i) => {
          const a = t * (0.35 + i * 0.12) + (i * TAU) / 4, d = 0.55 + (i % 2) * 0.12;
          v.position.set(Math.cos(a) * d, Math.sin(a) * d * 0.85);
        });
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default cell;
