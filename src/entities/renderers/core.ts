/**
 * Built-in procedural renderers. Every view is built for BODY RADIUS = 1 and reuses baked
 * textures (core/textures.ts) so per-frame cost is just sprite transforms.
 * To swap in real art later: register a renderer with the same id that builds Sprites from
 * loaded textures, or call registerTexture() with the baked key before first use.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { defineRenderers } from '../define';
import type { Entity } from '../Entity';

/** Helper: centred sprite of `diameter` view units. */
export function sprite(tex: Texture, diameter: number, opts: { add?: boolean; alpha?: number; tint?: number } = {}): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = s.height = diameter;
  if (opts.add) s.blendMode = 'add';
  if (opts.alpha !== undefined) s.alpha = opts.alpha;
  if (opts.tint !== undefined) s.tint = opts.tint;
  return s;
}

export function spikyTexture(spikes: number, depth: number): Texture {
  return bakeTexture(`core:spiky:${spikes}:${depth}`, 256, (c, s) => {
    const cx = s / 2, R = s / 2 - 2, r = R * (1 - depth);
    c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? R : r;
      c.lineTo(cx + Math.cos(a) * rr, cx + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  });
}

export function polygonTexture(sides: number): Texture {
  return bakeTexture(`core:poly:${sides}`, 256, (c, s) => {
    const cx = s / 2, R = s / 2 - 3;
    c.fillStyle = '#fff';
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(cx + Math.cos(a) * R, cx + Math.sin(a) * R);
    }
    c.closePath();
    c.fill();
  });
}

function tintChildren(view: Container, e: Entity, map: ('c' | 'c2' | 'w' | null)[]) {
  view.children.forEach((ch, i) => {
    const m = map[i];
    if (m === 'c') (ch as Sprite).tint = e.color;
    else if (m === 'c2') (ch as Sprite).tint = e.color2;
    else if (m === 'w') (ch as Sprite).tint = 0xffffff;
  });
}

export default defineRenderers([
  {
    /** Glowing sphere: additive halo + shaded body + hot core. */
    id: 'glowOrb',
    defaults: { glow: 2.6, glowAlpha: 0.55, core: 0.45, coreAlpha: 0.7 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.orb(), 2));
      v.addChild(sprite(Tex.glow(), 2 * p.core * 2, { add: true, alpha: p.coreAlpha }));
      return v;
    },
    reset(v, e) {
      tintChildren(v, e, ['c', 'c', 'w']);
    },
  },
  {
    /** Hollow bubble ring with faint fill. */
    id: 'ring',
    defaults: { glow: 2.0, glowAlpha: 0.35, fillAlpha: 0.15 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.disc(), 2, { alpha: p.fillAlpha }));
      v.addChild(sprite(Tex.ring(), 2));
      return v;
    },
    reset(v, e) {
      tintChildren(v, e, ['c', 'c', 'c2']);
    },
  },
  {
    /** Spiky danger body (reads as "do not touch"). */
    id: 'spiky',
    defaults: { spikes: 9, depth: 0.32, glow: 2.2, glowAlpha: 0.5 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(spikyTexture(p.spikes, p.depth), 2.3));
      v.addChild(sprite(Tex.orb(), 1.1));
      return v;
    },
    reset(v, e) {
      tintChildren(v, e, ['c', 'c', 'c2']);
    },
  },
  {
    /** Regular polygon body. */
    id: 'polygon',
    defaults: { sides: 6, glow: 2.0, glowAlpha: 0.4 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(polygonTexture(p.sides), 2.1));
      v.addChild(sprite(Tex.glow(), 0.9, { add: true, alpha: 0.6 }));
      return v;
    },
    reset(v, e) {
      tintChildren(v, e, ['c', 'c', 'w']);
    },
  },
  {
    /** Quark: hot orb with a colour-charge ring (color2) that spins. */
    id: 'quark',
    defaults: { glow: 2.8, glowAlpha: 0.6 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.orb(), 1.7));
      v.addChild(sprite(Tex.ring(), 2.25, { alpha: 0.9 }));
      v.addChild(sprite(Tex.glow(), 1.0, { add: true, alpha: 0.8 }));
      return v;
    },
    reset(v, e) {
      tintChildren(v, e, ['c2', 'c', 'c2', 'w']);
    },
  },
  {
    /** Nucleon: translucent shell holding three quark dots (color2). */
    id: 'nucleon',
    defaults: { glow: 2.2, glowAlpha: 0.45 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.orb(), 2, { alpha: 0.85 }));
      const inner = new Container();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const q = sprite(Tex.glow(), 0.9, { add: true });
        q.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42);
        inner.addChild(q);
      }
      v.addChild(inner);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      for (const q of (v.children[2] as Container).children) (q as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      (v.children[2] as Container).rotation += dt * 2.2;
    },
  },
  {
    /** Cluster of N orbs (nuclei, molecules...). params.count, spread. */
    id: 'cluster',
    defaults: { count: 4, spread: 0.5, glow: 2.4, glowAlpha: 0.5 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const n = p.count as number;
      const sub = 2 / Math.sqrt(n) * 0.95;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + i;
        const d = n === 1 ? 0 : p.spread * (0.6 + 0.4 * ((i * 7) % 3) / 2);
        const s = sprite(Tex.orb(), sub);
        s.position.set(Math.cos(a) * d, Math.sin(a) * d);
        v.addChild(s);
      }
      return v;
    },
    reset(v, e) {
      v.children.forEach((c, i) => ((c as Sprite).tint = i === 0 ? e.color : i % 2 ? e.color : e.color2));
    },
  },
  {
    /**
     * A conquered previous world. Uses e.data.texture (the real snapshot) or ctx.lastWorldTexture,
     * falling back to a procedural swirl.
     */
    id: 'speck',
    defaults: { glow: 1.9, glowAlpha: 0.7 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.orb(), 2));
      v.addChild(sprite(Tex.ring(), 2.08, { alpha: 0.85, add: true }));
      return v;
    },
    reset(v, e, p, ctx) {
      const tex: Texture | null = (e.data.texture as Texture) ?? ctx.lastWorldTexture;
      const body = v.children[1] as Sprite;
      body.texture = tex ?? Tex.orb();
      body.width = body.height = 2;
      body.tint = tex ? 0xffffff : e.color;
      (v.children[0] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color;
    },
    update(v, e, p, ctx, dt) {
      (v.children[1] as Sprite).rotation += dt * 0.15;
    },
  },
]);
