/**
 * Atom: glowing nucleus (color) wrapped in 1-3 tilted orbital rings with electrons (color2)
 * racing around them. params.shells = number of orbitals.
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { defineRenderers } from '../define';
import { sprite } from './core';

export default defineRenderers([
  {
    id: 'atom',
    defaults: { shells: 2, glow: 2.4, glowAlpha: 0.45, nucleus: 0.55 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.glow(), 2 * 1.05, { add: true, alpha: 0.18 })); // electron cloud haze
      for (let s = 0; s < p.shells; s++) {
        const orbit = new Container();
        orbit.rotation = (s / p.shells) * Math.PI;
        const ring = sprite(Tex.ring(), 2, { add: true, alpha: 0.4 });
        ring.height = 0.75;
        orbit.addChild(ring);
        const el = sprite(Tex.glow(), 0.36, { add: true });
        orbit.addChild(el);
        v.addChild(orbit);
      }
      v.addChild(sprite(Tex.orb(), 2 * p.nucleus));
      v.addChild(sprite(Tex.glow(), 2 * p.nucleus * 0.9, { add: true, alpha: 0.7 }));
      return v;
    },
    reset(v, e, p) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      for (let s = 0; s < p.shells; s++) {
        const orbit = v.children[2 + s] as Container;
        (orbit.children[0] as Sprite).tint = e.color2;
        (orbit.children[1] as Sprite).tint = 0xffffff;
      }
      (v.children[2 + p.shells] as Sprite).tint = e.color;
      e.data.orbitPhase = Math.random() * Math.PI * 2;
    },
    update(v, e, p, _ctx, dt) {
      e.data.orbitPhase = (e.data.orbitPhase ?? 0) + dt * 3.2;
      for (let s = 0; s < p.shells; s++) {
        const orbit = v.children[2 + s] as Container;
        const a = e.data.orbitPhase * (1 + s * 0.35) + s * 2.1;
        // electron on an ellipse (ring is squashed to 0.375 radius vertically)
        orbit.children[1].position.set(Math.cos(a), Math.sin(a) * 0.375);
      }
    },
  },
]);
