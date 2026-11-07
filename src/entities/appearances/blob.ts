/** Tier 1: glowing quantum droplet. Breathing halo, shimmering membrane, orbiting probability motes. */
import { Container } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, TAU, blotchTex, rimTex, sprite } from './_kit';

const blob: PlayerAppearanceDef = {
  id: 'blob',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 6, { add: true, alpha: 0.55, tint: pal.playerGlow });
    const body = R.tinted(sprite(Tex.orb(), 2), pal.player);
    const swirl = sprite(blotchTex('app:blob:swirl', 11, 22, 0.08, 0.2, 0.6), 1.85, { add: true, alpha: 0.5, tint: pal.playerGlow });
    const rim = sprite(rimTex(), 2.3, { add: true, alpha: 0.9, tint: pal.playerGlow });
    const membrane = sprite(Tex.ring(), 2.15, { add: true, alpha: 0.6, tint: pal.playerGlow });
    const core = sprite(Tex.glow(), 1.2, { add: true, alpha: 0.8, tint: pal.playerGlow });
    const motes = [0, 1, 2].map(() => sprite(Tex.dot(), 0.28, { add: true, alpha: 0.9, tint: pal.accent }));
    view.addChild(halo, body, swirl, rim, membrane, core, ...motes);
    R.attach(view, pal.playerGlow, 2.2);
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash;
        const br = 1 + Math.sin(t * 2.2) * 0.06;
        halo.width = halo.height = 6 * br * (1 + f * 0.5 + R.speed * 0.1);
        halo.alpha = 0.5 + f * 0.4;
        membrane.width = 2.15 + Math.sin(t * 5.3) * 0.06;
        membrane.height = 2.15 + Math.cos(t * 4.1) * 0.06;
        swirl.rotation = t * 0.6;
        core.alpha = 0.75 + Math.sin(t * 3.1) * 0.15 + f * 0.3;
        motes.forEach((m, i) => {
          const a = t * (1.6 + i * 0.5) + (i * TAU) / 3, d = 0.95 + Math.sin(t * 3 + i) * 0.08;
          m.position.set(Math.cos(a) * d, Math.sin(a * 1.1) * d);
          m.alpha = 0.5 + 0.5 * Math.sin(t * 7 + i * 2);
        });
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default blob;
