/**
 * Shared helpers for the tier 4-6 renderers (helper module: no default export, so the renderer
 * registry skips it). Everything bakes once into cached textures drawn in VIEW UNITS (body radius 1).
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import type { Entity } from '../Entity';
import type { RendererDef } from '../types';

export const TAU = Math.PI * 2;

/** Bake a texture whose canvas covers [-ext, ext] on both axes in view units. */
export function bakeU(key: string, ext: number, draw: (c: CanvasRenderingContext2D) => void, px = 256): Texture {
  return bakeTexture(key, px, (c, s) => {
    c.setTransform(s / (2 * ext), 0, 0, s / (2 * ext), s / 2, s / 2);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    draw(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
  });
}

export interface USpriteOpts {
  add?: boolean;
  alpha?: number;
  tint?: number;
  x?: number;
  y?: number;
}
/** Sprite for a texture baked with bakeU(…, ext, …): spans 2*ext view units, centred. */
export function us(tex: Texture, ext: number, o: USpriteOpts = {}): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = s.height = ext * 2;
  if (o.add) s.blendMode = 'add';
  if (o.alpha !== undefined) s.alpha = o.alpha;
  if (o.tint !== undefined) s.tint = o.tint;
  if (o.x !== undefined || o.y !== undefined) s.position.set(o.x ?? 0, o.y ?? 0);
  return s;
}

export const glowSprite = (d: number, alpha = 0.5, x = 0, y = 0): Sprite => {
  const s = new Sprite(Tex.glow());
  s.anchor.set(0.5);
  s.width = s.height = d;
  s.blendMode = 'add';
  s.alpha = alpha;
  s.position.set(x, y);
  return s;
};

/** Smooth blink 0..1 used by bioluminescent prey (renderer + darkness mechanic agree on it). */
export function blinkLevel(e: { age: number; uid: number }, rate = 1): number {
  const s = Math.sin((e.age * 1.7 + e.uid * 1.913) * rate);
  return Math.pow(Math.max(0, s), 3);
}

export function tintAll(children: Sprite[], tints: number[]) {
  for (let i = 0; i < children.length; i++) children[i].tint = tints[i];
}

/** Body outline from top/bottom half-height profiles over u in [0,1] (u=0 nose at +L, u=1 tail at -L). */
export function profilePath(c: CanvasRenderingContext2D, L: number, top: (u: number) => number, bot: (u: number) => number, n = 56) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    c.lineTo(L - 2 * L * u, -top(u));
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    c.lineTo(L - 2 * L * u, bot(u));
  }
  c.closePath();
}

/** Vertical shading for tinted-white bodies: darker back, bright belly. */
export function shadeGradient(c: CanvasRenderingContext2D, y0: number, y1: number, back = 0.5) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  const b = Math.round(back * 255);
  g.addColorStop(0, `rgb(${b},${b},${b})`);
  g.addColorStop(0.5, `rgb(${Math.round(b + (255 - b) * 0.7)},${Math.round(b + (255 - b) * 0.7)},${Math.round(b + (255 - b) * 0.7)})`);
  g.addColorStop(1, '#fff');
  return g;
}

/** Specification of a side-profile swimmer (faces +x, dorsal side up). */
export interface SwimSpec {
  ext: number;
  L: number;
  top: (u: number) => number;
  bot: (u: number) => number;
  /** Extra body parts drawn with the body fill (beaks, flippers fused to the body). */
  bodyExtra?: (c: CanvasRenderingContext2D) => void;
  /** Hinge x of the tail. */
  hinge: number;
  /** Tail drawn around the hinge (0,0) extending towards -x. */
  tail: (c: CanvasRenderingContext2D) => void;
  tailExt: number;
  tailAmp: number;
  tailSpeed: number;
  /** Fins behind the body (tinted like the body). */
  fins?: (c: CanvasRenderingContext2D) => void;
  /** Belly line y (positive = lower) over u; the lower part is painted with colour2. */
  bellyLine?: (u: number) => number;
  /** Untinted details: eyes, gills, mouth, patches. */
  detail?: (c: CanvasRenderingContext2D) => void;
  /** Photophore spots [x, y, size] that blink in colour2. */
  lights?: [number, number, number][];
  glow?: number;
  glowAlpha?: number;
  /** Body-bend skew amount. */
  bend?: number;
}

class SwimView extends Container {
  flip = new Container();
  tail!: Sprite;
  lights: Sprite[] = [];
  parts: Sprite[] = [];
  phase = 0;
}

export function swimmerRenderer(id: string, spec: SwimSpec): RendererDef {
  const key = `swim:${id}`;
  const bodyTex = () =>
    bakeU(`${key}:body`, spec.ext, (c) => {
      profilePath(c, spec.L, spec.top, spec.bot);
      c.fillStyle = shadeGradient(c, -spec.top(0.45) * 1.05, spec.bot(0.45) * 1.05, 0.55);
      c.fill();
      if (spec.bodyExtra) {
        c.fillStyle = shadeGradient(c, -0.35, 0.35, 0.55);
        spec.bodyExtra(c);
      }
    }, 512);
  const bellyTex = () =>
    bakeU(`${key}:belly`, spec.ext, (c) => {
      if (!spec.bellyLine) return;
      c.save();
      profilePath(c, spec.L, spec.top, spec.bot);
      c.clip();
      const y0 = spec.bellyLine(0.5);
      const g = c.createLinearGradient(0, y0 - 0.08, 0, y0 + 0.14);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      c.fillStyle = g;
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        c.lineTo(spec.L - 2 * spec.L * u, spec.bellyLine(u) - 0.08);
      }
      c.lineTo(-spec.L - 1, 3);
      c.lineTo(spec.L + 1, 3);
      c.closePath();
      c.fill();
      c.restore();
    }, 512);
  const finsTex = () => bakeU(`${key}:fins`, spec.ext, (c) => { c.fillStyle = shadeGradient(c, -1, 1, 0.45); spec.fins?.(c); });
  const tailTex = () => bakeU(`${key}:tail`, spec.tailExt, (c) => { c.fillStyle = shadeGradient(c, -spec.tailExt, spec.tailExt, 0.6); spec.tail(c); });
  const detailTex = () => bakeU(`${key}:detail`, spec.ext, (c) => spec.detail?.(c), 512);

  return {
    id,
    create() {
      const v = new SwimView();
      v.addChild(v.flip);
      const f = v.flip;
      if (spec.glow) f.addChild(glowSprite(spec.glow * 2, spec.glowAlpha ?? 0.25));
      const tail = us(tailTex(), spec.tailExt);
      tail.position.set(spec.hinge, 0);
      v.tail = tail;
      f.addChild(tail);
      if (spec.fins) { const s = us(finsTex(), spec.ext); v.parts.push(s); f.addChild(s); } else v.parts.push(new Sprite());
      const body = us(bodyTex(), spec.ext);
      v.parts.push(body);
      f.addChild(body);
      const belly = us(bellyTex(), spec.ext);
      v.parts.push(belly);
      f.addChild(belly);
      if (spec.detail) f.addChild(us(detailTex(), spec.ext));
      for (const [x, y, s] of spec.lights ?? []) {
        const g = glowSprite(s, 0.9, x, y);
        v.lights.push(g);
        f.addChild(g);
      }
      return v;
    },
    reset(view, e) {
      const v = view as SwimView;
      v.tail.tint = e.color;
      v.parts[0].tint = e.color;
      v.parts[1].tint = e.color;
      v.parts[2].tint = e.color2;
      for (const l of v.lights) l.tint = e.color2;
      v.flip.scale.y = Math.cos(e.rotation) < 0 ? -1 : 1;
      v.phase = e.uid;
    },
    update(view, e, _p, _ctx, dt) {
      const v = view as SwimView;
      const sp = Math.hypot(e.vx, e.vy) / Math.max(e.radius, 1e-3);
      v.phase += dt * spec.tailSpeed * (0.55 + Math.min(sp, 5) * 0.28);
      v.tail.rotation = Math.sin(v.phase) * spec.tailAmp;
      if (spec.bend) v.flip.skew.y = Math.sin(v.phase - 0.6) * spec.bend;
      const target = Math.cos(e.rotation) < 0 ? -1 : 1;
      v.flip.scale.y += (target - v.flip.scale.y) * Math.min(1, dt * 9);
      for (let i = 0; i < v.lights.length; i++) v.lights[i].alpha = 0.25 + 0.75 * blinkLevel({ age: e.age + i * 0.6, uid: e.uid }, 1.1);
    },
  } as RendererDef;
}

/** Wavy hanging strand baked into a texture (jellyfish tentacles, whiskers). */
export function strand(c: CanvasRenderingContext2D, x0: number, y0: number, len: number, wob: number, phase: number, steps = 18) {
  c.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + Math.sin(t * 7 + phase) * wob * (0.3 + t);
    const y = y0 + len * t;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
}

export type { Entity };
