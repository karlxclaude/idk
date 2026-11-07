/**
 * Tier 3 (Primordial Pond) renderers: bacteria, diatoms, amoebas, viruses and paramecia.
 * Everything is baked once into shared textures; update() only touches sprite transforms.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';

function box(tex: Texture, w: number, h: number, o: { add?: boolean; alpha?: number } = {}): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = w;
  s.height = h;
  if (o.add) s.blendMode = 'add';
  if (o.alpha !== undefined) s.alpha = o.alpha;
  return s;
}


/** Scale relative to the sprite's baked size (setting width/height already changed scale). */
function mul(s: any, kx: number, ky = kx) {
  if (s.bx === undefined) { s.bx = s.scale.x; s.by = s.scale.y; }
  s.scale.set(s.bx * kx, s.by * ky);
}

const capsuleTex = () =>
  bakeTexture('t03:capsule', 128, (c, s) => {
    const h = s / 2;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#8c8c8c');
    g.addColorStop(0.35, '#fff');
    g.addColorStop(1, '#8c8c8c');
    c.fillStyle = g;
    c.beginPath();
    c.roundRect(2, s / 4 + 2, s - 4, h - 4, (h - 4) / 2);
    c.fill();
  });
const nucleoidTex = () =>
  bakeTexture('t03:nucleoid', 128, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    for (let x = 22; x <= s - 22; x += 2) {
      const y = s / 2 + Math.sin(x * 0.2) * 8 + Math.sin(x * 0.53) * 4;
      if (x === 22) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  });
const tailTex = () =>
  bakeTexture('t03:tail', 128, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    for (let x = 0; x <= s; x += 2) {
      const y = s / 2 + Math.sin((x / s) * Math.PI * 3) * 14 * (x / s);
      if (x === 0) c.moveTo(s - x, y); else c.lineTo(s - x, y);
    }
    c.stroke();
  });

function diatomTex(shape: 'centric' | 'pennate') {
  return bakeTexture(`t03:diatom:${shape}`, 256, (c, s) => {
    const m = s / 2;
    c.strokeStyle = '#fff';
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 8;
    if (shape === 'centric') {
      c.beginPath(); c.arc(m, m, m - 8, 0, Math.PI * 2); c.fill(); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.arc(m, m, m * 0.55, 0, Math.PI * 2); c.stroke();
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        c.beginPath();
        c.moveTo(m + Math.cos(a) * m * 0.55, m + Math.sin(a) * m * 0.55);
        c.lineTo(m + Math.cos(a) * (m - 10), m + Math.sin(a) * (m - 10));
        c.stroke();
      }
      c.fillStyle = '#fff';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath(); c.arc(m + Math.cos(a) * m * 0.25, m + Math.sin(a) * m * 0.25, 4, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.beginPath(); c.ellipse(m, m, m - 6, m * 0.42, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(14, m); c.lineTo(s - 14, m); c.stroke();
      for (let x = 34; x < s - 30; x += 12) {
        const hh = m * 0.42 * Math.sqrt(Math.max(0, 1 - ((x - m) / (m - 6)) ** 2)) - 6;
        c.beginPath(); c.moveTo(x, m - hh); c.lineTo(x, m - 5); c.moveTo(x, m + 5); c.lineTo(x, m + hh); c.stroke();
      }
    }
  });
}

/** Irregular amoeba outline with pseudopod lobes. */
const blobTex = (seed: number, rim: boolean) =>
  bakeTexture(`t03:blob:${seed}:${rim}`, 256, (c, s) => {
    const r = new Rng(seed);
    const ph = [r.range(0, 6.28), r.range(0, 6.28), r.range(0, 6.28)];
    c.beginPath();
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const rad = 0.72 + 0.09 * Math.sin(a * 2 + ph[0]) + 0.11 * Math.sin(a * 3 + ph[1]) + 0.07 * Math.sin(a * 5 + ph[2]);
      const x = s / 2 + Math.cos(a) * rad * (s / 2 - 6) * 1.04;
      const y = s / 2 + Math.sin(a) * rad * (s / 2 - 6) * 1.04;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
    if (rim) {
      c.lineWidth = 7;
      c.strokeStyle = '#fff';
      c.stroke();
    } else {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, '#fff');
      c.fillStyle = g;
      c.fill();
    }
  });

const virusSpikesTex = () =>
  bakeTexture('t03:virus:spikes', 256, (c, s) => {
    const m = s / 2;
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    c.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.beginPath();
      c.moveTo(m + Math.cos(a) * m * 0.55, m + Math.sin(a) * m * 0.55);
      c.lineTo(m + Math.cos(a) * m * 0.84, m + Math.sin(a) * m * 0.84);
      c.stroke();
      c.beginPath();
      c.arc(m + Math.cos(a) * m * 0.9, m + Math.sin(a) * m * 0.9, 11, 0, Math.PI * 2);
      c.fill();
    }
  });
const capsidTex = () =>
  bakeTexture('t03:virus:capsid', 256, (c, s) => {
    const m = s / 2, R = m * 0.62;
    const hex = (rad: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        c.lineTo(m + Math.cos(a) * rad, m + Math.sin(a) * rad);
      }
      c.closePath();
    };
    const g = c.createRadialGradient(m * 0.85, m * 0.8, 0, m, m, R);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#8a8a8a');
    c.fillStyle = g;
    hex(R); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)';
    c.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      c.beginPath(); c.moveTo(m, m); c.lineTo(m + Math.cos(a) * R, m + Math.sin(a) * R); c.stroke();
    }
  });

const slipperTex = () =>
  bakeTexture('t03:slipper', 256, (c, s) => {
    const g = c.createLinearGradient(0, s * 0.25, 0, s * 0.75);
    g.addColorStop(0, '#8c8c8c'); g.addColorStop(0.4, '#fff'); g.addColorStop(1, '#8c8c8c');
    c.fillStyle = g;
    c.beginPath();
    // slipper: blunt front (+x), tapered back
    c.moveTo(s * 0.04, s / 2);
    c.bezierCurveTo(s * 0.2, s * 0.3, s * 0.55, s * 0.24, s * 0.82, s * 0.32);
    c.bezierCurveTo(s * 0.99, s * 0.4, s * 0.99, s * 0.6, s * 0.82, s * 0.68);
    c.bezierCurveTo(s * 0.55, s * 0.76, s * 0.2, s * 0.7, s * 0.04, s / 2);
    c.fill();
  });
const ciliaTex = () =>
  bakeTexture('t03:cilia', 256, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    // cilia fringe sampled along the slipper outline
    const pts: [number, number, number][] = [];
    const bez = (p0: number[], p1: number[], p2: number[], p3: number[], n: number) => {
      for (let i = 0; i < n; i++) {
        const t = i / n, u = 1 - t;
        const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
        const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
        pts.push([x * s, y * s, Math.atan2(y - 0.5, x - 0.5)]);
      }
    };
    bez([0.04, 0.5], [0.2, 0.3], [0.55, 0.24], [0.82, 0.32], 16);
    bez([0.82, 0.32], [0.99, 0.4], [0.99, 0.6], [0.82, 0.68], 8);
    bez([0.82, 0.68], [0.55, 0.76], [0.2, 0.7], [0.04, 0.5], 16);
    for (const [x, y, a] of pts) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
      c.stroke();
    }
  });
const grooveTex = () =>
  bakeTexture('t03:groove', 128, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(s * 0.3, s * 0.42);
    c.quadraticCurveTo(s * 0.6, s * 0.5, s * 0.8, s * 0.5);
    c.stroke();
  });

export default defineRenderers([
  {
    /** Rod bacterium with a wagging flagellum. Faces +x. */
    id: 'bacterium',
    defaults: { glow: 2.0, glowAlpha: 0.3 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const tail = box(tailTex(), 1.8, 1.8, { alpha: 0.8 });
      tail.anchor.set(1, 0.5);
      tail.position.set(-0.95, 0);
      v.addChild(tail);
      v.addChild(box(capsuleTex(), 2.3, 1.15));
      v.addChild(box(nucleoidTex(), 1.6, 1.6, { alpha: 0.75 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e) {
      v.children[1].skew.y = Math.sin(e.age * 9 + e.uid) * 0.35;
    },
  },
  {
    /** Diatom: a glassy silica shell. params.shape = 'centric' | 'pennate'. */
    id: 'diatom',
    defaults: { shape: 'centric', glow: 2.1, glowAlpha: 0.3 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const w = p.shape === 'pennate' ? 2.4 : 2.1;
      v.addChild(box(diatomTex(p.shape), w, w));
      v.addChild(sprite(Tex.glow(), 0.8, { add: true, alpha: 0.35 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
    },
  },
  {
    /** Amoeba: wobbling translucent blob, nucleus, food vacuoles and a bright rim. */
    id: 'amoeba',
    defaults: { variant: 1, glow: 2.6, glowAlpha: 0.4 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const body = new Container();
      body.addChild(sprite(blobTex(p.variant * 31, false), 2.5, { alpha: 0.78 }));
      body.addChild(sprite(blobTex(p.variant * 31, true), 2.5, { alpha: 0.9 }));
      v.addChild(body);
      const nuc = sprite(Tex.orb(), 0.62);
      nuc.position.set(-0.12, 0.05);
      v.addChild(nuc);
      for (let i = 0; i < 4; i++) v.addChild(sprite(Tex.disc(), 0.2 + (i % 2) * 0.1, { alpha: 0.6 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      const body = v.children[1] as Container;
      (body.children[0] as Sprite).tint = e.color;
      (body.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color2;
      for (let i = 3; i < 7; i++) (v.children[i] as Sprite).tint = 0xffffff;
    },
    update(v, e) {
      const t = e.age + e.uid * 0.37;
      const body = v.children[1] as Container;
      body.scale.set(1 + Math.sin(t * 2.1) * 0.05, 1 + Math.cos(t * 2.7) * 0.05);
      body.rotation = Math.sin(t * 0.6) * 0.25;
      for (let i = 0; i < 4; i++) {
        const a = t * (0.4 + i * 0.13) + i * 1.7;
        v.children[3 + i].position.set(Math.cos(a) * 0.5 * (0.6 + 0.2 * i), Math.sin(a * 1.2) * 0.45 * (0.6 + 0.2 * i));
      }
    },
  },
  {
    /** Virus: hexagonal capsid with a crown of spike proteins. */
    id: 'virus',
    defaults: { glow: 2.6, glowAlpha: 0.5 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(virusSpikesTex(), 2.4));
      v.addChild(sprite(capsidTex(), 2.4));
      v.addChild(sprite(Tex.glow(), 0.9, { add: true, alpha: 0.6 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e) {
      mul(v.children[1], 1 + Math.sin(e.age * 6 + e.uid) * 0.06);
      v.children[2].rotation = -e.age * 0.5;
    },
  },
  {
    /** Paramecium: slipper-shaped ciliate with a shimmering cilia fringe. Faces +x. */
    id: 'paramecium',
    defaults: { glow: 2.2, glowAlpha: 0.3 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(box(ciliaTex(), 2.6, 2.6, { alpha: 0.65 }));
      v.addChild(box(slipperTex(), 2.6, 2.6, { alpha: 0.9 }));
      v.addChild(box(grooveTex(), 2.6, 2.6, { alpha: 0.7 }));
      const v1 = sprite(Tex.glow(), 0.5, { add: true, alpha: 0.8 });
      v1.position.set(-0.6, 0);
      const v2 = sprite(Tex.glow(), 0.5, { add: true, alpha: 0.8 });
      v2.position.set(0.7, -0.05);
      v.addChild(v1, v2);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
      (v.children[4] as Sprite).tint = e.color2;
      (v.children[5] as Sprite).tint = e.color2;
    },
    update(v, e) {
      const t = e.age * 22 + e.uid;
      mul(v.children[1], 1 + Math.sin(t) * 0.025, 1 + Math.cos(t * 1.3) * 0.025);
      v.children[2].skew.x = Math.sin(e.age * 3 + e.uid) * 0.05;
      v.children[4].alpha = 0.4 + 0.4 * Math.max(0, Math.sin(e.age * 1.5));
    },
  },
]);
