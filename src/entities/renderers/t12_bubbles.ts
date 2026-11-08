/**
 * Tier 12 (Eternal Inflation) renderers: iridescent bubble universes of every kind. Baked once;
 * update() only turns sprites. The soap rainbow is shared (t12_soap) and never tinted; entity
 * colours drive the halo and the faint milky fill.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { TAU } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite, spikyTexture } from './core';
import { cmbSphereTex } from './t11_cmbTex';
import { soapTex } from './t12_soap';

const starsTex = () =>
  bakeTexture('t12:stars', 128, (c, s) => {
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * m * 0.88;
      const x = m + Math.cos(a) * d, y = m + Math.sin(a) * d;
      const r = 0.8 + rnd() * 2.4;
      const g = c.createRadialGradient(x, y, 0, x, y, r * 2);
      g.addColorStop(0, `rgba(255,255,255,${0.5 + rnd() * 0.5})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    }
  });

const darkDisc = () =>
  bakeTexture('t12:dark', 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** halo, milky fill, soap skin. */
function base(v: Container, glow: number, glowAlpha: number, fillAlpha: number) {
  v.addChild(sprite(Tex.glow(), 2 * glow, { add: true, alpha: glowAlpha }));
  v.addChild(sprite(Tex.disc(), 2, { alpha: fillAlpha }));
  v.addChild(sprite(soapTex(0), 2.06, { alpha: 1 }));
}
function baseReset(v: Container, e: { uid: number; color: number; color2: number }) {
  (v.children[0] as Sprite).tint = e.color;
  (v.children[1] as Sprite).tint = e.color2;
  (v.children[2] as Sprite).texture = soapTex(e.uid % 5);
  (v.children[2] as Sprite).width = (v.children[2] as Sprite).height = 2.06;
}
const shimmer = (v: Container, dt: number, k = 0.15) => { (v.children[2] as Sprite).rotation += dt * k; };

export default defineRenderers([
  {
    /** A plain soap-film bubble universe. */
    id: 'soapBubble',
    defaults: { glow: 1.8, glowAlpha: 0.3, fill: 0.14 },
    create(arch, p) {
      const v = new Container();
      base(v, p.glow, p.glowAlpha, p.fill);
      return v;
    },
    reset(v, e) { baseReset(v, e); },
    update(v, e, p, ctx, dt) { shimmer(v, dt); },
  },
  {
    /** A bubble holding a tiny universe: CMB-mottled core and a scatter of stars. */
    id: 'pocketUniverse',
    defaults: { glow: 1.9, glowAlpha: 0.35 },
    create(arch, p) {
      const v = new Container();
      base(v, p.glow, p.glowAlpha, 0.1);
      v.addChild(sprite(cmbSphereTex(1, 0.5), 1.3, { alpha: 0.92 }));
      v.addChild(sprite(starsTex(), 1.8, { add: true, alpha: 0.9 }));
      return v;
    },
    reset(v, e) {
      baseReset(v, e);
      (v.children[3] as Sprite).texture = cmbSphereTex(e.uid % 4, [0.25, 0.5, 0.75, 0.5][e.uid % 4]);
      (v.children[3] as Sprite).width = (v.children[3] as Sprite).height = 1.3;
    },
    update(v, e, p, ctx, dt) {
      shimmer(v, dt);
      (v.children[3] as Sprite).rotation += dt * 0.25;
      (v.children[4] as Sprite).rotation -= dt * 0.1;
    },
  },
  {
    /** Two fused bubbles sharing a wall (a collision in progress). */
    id: 'twinBubble',
    defaults: { glow: 2.2, glowAlpha: 0.3 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const a = new Container();
      const b = new Container();
      a.addChild(sprite(Tex.disc(), 1.5, { alpha: 0.12 }), sprite(soapTex(1), 1.55));
      b.addChild(sprite(Tex.disc(), 1.2, { alpha: 0.12 }), sprite(soapTex(3), 1.25));
      a.position.set(-0.28, 0.04);
      b.position.set(0.52, -0.08);
      v.addChild(a, b);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      for (let i = 1; i <= 2; i++) ((v.children[i] as Container).children[0] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      ((v.children[1] as Container).children[1] as Sprite).rotation += dt * 0.12;
      ((v.children[2] as Container).children[1] as Sprite).rotation -= dt * 0.18;
    },
  },
  {
    /** A bubble with a ring of smaller bubbles circulating inside: a nested multiverse. */
    id: 'nestedBubble',
    defaults: { glow: 2.2, glowAlpha: 0.4, n: 6 },
    create(arch, p) {
      const v = new Container();
      base(v, p.glow, p.glowAlpha, 0.1);
      const inner = new Container();
      for (let i = 0; i < p.n; i++) {
        const a = (i / p.n) * TAU, d = i === 0 ? 0 : 0.5;
        const sz = i === 0 ? 0.62 : 0.32 + (i % 3) * 0.04;
        const s = sprite(soapTex(i % 5), sz * 2);
        s.position.set(Math.cos(a) * d, Math.sin(a) * d);
        inner.addChild(s);
      }
      v.addChild(inner);
      v.addChild(sprite(Tex.glow(), 0.7, { add: true, alpha: 0.5 }));
      return v;
    },
    reset(v, e) {
      baseReset(v, e);
      (v.children[4] as Sprite).tint = e.color;
    },
    update(v, e, p, ctx, dt) {
      shimmer(v, dt, 0.1);
      const inner = v.children[3] as Container;
      inner.rotation += dt * 0.5;
      for (const c of inner.children) c.rotation -= dt * 0.5;
    },
  },
  {
    /** Inflaton storm: a huge roiling bubble with a jagged ring; an apex predator of the foam. */
    id: 'bubbleStorm',
    defaults: { glow: 2.6, glowAlpha: 0.6 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(spikyTexture(16, 0.1), 2.4, { add: true, alpha: 0.5 }));
      v.addChild(sprite(cmbSphereTex(2, 0.8), 1.9));
      v.addChild(sprite(soapTex(2), 2.1));
      v.addChild(sprite(Tex.glow(), 1.0, { add: true, alpha: 0.5 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color2;
      (v.children[4] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      (v.children[1] as Sprite).rotation += dt * 0.7;
      (v.children[2] as Sprite).rotation -= dt * 0.35;
      (v.children[3] as Sprite).rotation += dt * 0.1;
      (v.children[4] as Sprite).alpha = 0.4 + 0.25 * Math.sin(ctx.tierTime * 4 + e.uid);
    },
  },
  {
    /** True-vacuum decay bubble: a hard black sphere with a white-hot, spiky wall. */
    id: 'vacuumDecay',
    defaults: {},
    create() {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 5.2, { add: true, alpha: 0.45 }));
      v.addChild(sprite(spikyTexture(18, 0.14), 2.4, { add: true, alpha: 0.9 }));
      const d = sprite(darkDisc(), 2.0);
      d.tint = 0x020006;
      v.addChild(d);
      v.addChild(sprite(Tex.ring(), 2.0, { add: true, alpha: 1 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      (v.children[1] as Sprite).rotation -= dt * 1.2;
      (v.children[0] as Sprite).alpha = 0.35 + 0.2 * Math.sin(ctx.tierTime * 5 + e.uid);
    },
  },
]);
