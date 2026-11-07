/** Default player appearance: glowing blob with a breathing halo and a wobbling membrane ring. */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { sprite } from '../renderers/core';
import type { PlayerAppearanceDef } from '../appearance';

const blob: PlayerAppearanceDef = {
  id: 'blob',
  create(tier) {
    const view = new Container();
    const halo = sprite(Tex.glow(), 6, { add: true, alpha: 0.55, tint: tier.palette.playerGlow });
    const body = sprite(Tex.orb(), 2, { tint: tier.palette.player });
    const membrane = sprite(Tex.ring(), 2.15, { add: true, alpha: 0.7, tint: tier.palette.playerGlow });
    const core = sprite(Tex.glow(), 1.6, { add: true, alpha: 0.9 });
    view.addChild(halo, body, membrane, core);
    let t = Math.random() * 10;
    let flash = 0;
    return {
      view,
      update(player, ctx, dt) {
        t += dt;
        flash = Math.max(0, flash - dt * 4);
        const breathe = 1 + Math.sin(t * 2.2) * 0.06;
        halo.width = halo.height = 6 * breathe * (1 + flash * 0.5);
        halo.alpha = 0.5 + flash * 0.4;
        membrane.width = 2.15 + Math.sin(t * 5.3) * 0.05;
        membrane.height = 2.15 + Math.cos(t * 4.1) * 0.05;
        core.alpha = 0.75 + Math.sin(t * 3.1) * 0.15 + flash * 0.3;
        body.tint = player.hurtFlash > 0 ? 0xff5566 : tier.palette.player;
      },
      onEat(r) {
        flash = Math.min(1, flash + 0.3 + r);
      },
      onHurt() {
        flash = 0;
      },
      destroy() {
        view.destroy({ children: true });
      },
    };
  },
};

export default blob;
