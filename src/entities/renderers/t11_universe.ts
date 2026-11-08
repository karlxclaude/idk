/**
 * Tier 11 (Observable Universe) renderers: CMB-mottled universes, web blobs and fragments, and
 * dark-energy rifts. Baked once into shared textures; update() only moves sprite transforms.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng, TAU } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';
import { cmbSphereTex } from './t11_cmbTex';

const gauss = (r: Rng) => (r.next() + r.next() + r.next() + r.next() - 2) * 1.2;

/** Cosmic-web bits as a baked texture. elong = 0: round lumpy cluster; 1: long winding filament. */
const webTex = (seed: number, elong: number) =>
  bakeTexture(`t11:web:${seed}:${elong}`, 256, (c, s) => {
    const r = new Rng(seed * 59 + 5);
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    const nodes: [number, number, number][] = [];
    if (elong > 0.5) {
      const n = 6;
      const ph = r.range(0, 6), amp = r.range(0.12, 0.3) * m;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1) - 0.5;
        nodes.push([m + t * s * 0.82, m + Math.sin(t * 5 + ph) * amp + gauss(r) * 5, r.range(0.35, 1)]);
      }
    } else {
      nodes.push([m, m, 1]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + r.range(-0.3, 0.3), d = m * r.range(0.3, 0.7);
        nodes.push([m + Math.cos(a) * d, m + Math.sin(a) * d, r.range(0.35, 0.85)]);
      }
    }
    const haze = c.createRadialGradient(m, m, 0, m, m, m);
    haze.addColorStop(0, 'rgba(255,255,255,0.22)');
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = haze;
    c.fillRect(0, 0, s, s);
    c.lineCap = 'round';
    const link = (a: number[], b: number[]) => {
      const mx = (a[0] + b[0]) / 2 + r.range(-10, 10), my = (a[1] + b[1]) / 2 + r.range(-10, 10);
      for (const [w, al] of [[8, 0.1], [2.6, 0.55]] as const) {
        c.strokeStyle = `rgba(255,255,255,${al})`;
        c.lineWidth = w;
        c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mx, my, b[0], b[1]); c.stroke();
      }
      for (let i = 0; i < 22; i++) {
        const t = r.next();
        const x = (1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * mx + t * t * b[0] + gauss(r) * 3;
        const y = (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * my + t * t * b[1] + gauss(r) * 3;
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath(); c.arc(x, y, r.range(0.6, 1.4), 0, TAU); c.fill();
      }
    };
    if (elong > 0.5) for (let i = 1; i < nodes.length; i++) link(nodes[i - 1], nodes[i]);
    else for (let i = 1; i < nodes.length; i++) { link(nodes[0], nodes[i]); if (i > 1 && r.chance(0.6)) link(nodes[i - 1], nodes[i]); }
    for (const [x, y, w] of nodes) {
      const rad = 20 * w + 5;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });

/** Jagged fissure arms radiating from the centre. */
const riftTex = (seed: number) =>
  bakeTexture(`t11:rift:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 13 + 1);
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const arms = 5 + (seed % 2);
    const paths: [number, number][][] = [];
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * TAU + r.range(-0.25, 0.25);
      const pts: [number, number][] = [[m, m]];
      let x = m, y = m, dir = ang;
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        dir += r.range(-0.55, 0.55);
        const l = (m * 0.92) / steps * r.range(0.8, 1.2);
        x += Math.cos(dir) * l; y += Math.sin(dir) * l;
        pts.push([x, y]);
      }
      paths.push(pts);
    }
    for (const [w, al] of [[16, 0.12], [8, 0.3], [3.2, 0.9], [1.2, 1]] as const) {
      c.strokeStyle = `rgba(255,255,255,${al})`;
      c.lineWidth = w;
      for (const pts of paths) {
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
    }
  });

const darkTex = () =>
  bakeTexture('t11:dark', 128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

const horizonTex = () =>
  bakeTexture('t11:horizon', 256, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    for (const [rr, w, al, dash] of [[s / 2 - 5, 2.5, 0.9, 0], [s / 2 - 14, 1.5, 0.45, 1]] as const) {
      c.lineWidth = w;
      c.globalAlpha = al;
      if (dash) {
        const n = 40;
        for (let i = 0; i < n; i++) { c.beginPath(); c.arc(s / 2, s / 2, rr, (i / n) * TAU, (i / n) * TAU + (TAU / n) * 0.4); c.stroke(); }
      } else { c.beginPath(); c.arc(s / 2, s / 2, rr, 0, TAU); c.stroke(); }
    }
  });

export default defineRenderers([
  {
    /** A whole universe: halo, CMB-mottled sphere, glowing rim, specular glint. params.horizon adds a turning horizon ring. */
    id: 'cmbUniverse',
    defaults: { glow: 2.2, glowAlpha: 0.5, horizon: false },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(cmbSphereTex(0, 0.5), 2));
      v.addChild(sprite(Tex.ring(), 2.04, { add: true, alpha: 0.9 }));
      v.addChild(sprite(Tex.glow(), 0.9, { add: true, alpha: 0.35 }));
      const h = sprite(horizonTex(), 2.5, { add: true, alpha: p.horizon ? 0.7 : 0 });
      h.visible = !!p.horizon;
      v.addChild(h);
      v.children[3].position.set(-0.4, -0.42);
      return v;
    },
    reset(v, e) {
      const body = v.children[1] as Sprite;
      body.texture = cmbSphereTex(e.uid % 4, [0.25, 0.5, 0.75, 0.5][e.uid % 4]);
      body.width = body.height = 2;
      (v.children[0] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      (v.children[1] as Sprite).rotation += dt * 0.12;
      if (p.horizon) (v.children[4] as Sprite).rotation -= dt * 0.35;
    },
  },
  {
    /** Cosmic-web bits: params.elong 0 = supercluster blob, 1 = winding filament fragment. */
    id: 'webBlob',
    defaults: { elong: 0, glow: 2.3, glowAlpha: 0.4 },
    create(arch, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(webTex(1, p.elong), 2.3, { add: true }));
      v.addChild(sprite(Tex.glow(), 0.8, { add: true, alpha: 0.5 }));
      return v;
    },
    reset(v, e, p) {
      (v.children[1] as Sprite).texture = webTex((e.uid % 3) + 1, p.elong);
      (v.children[0] as Sprite).tint = e.color2;
      (v.children[1] as Sprite).tint = e.color;
    },
  },
  {
    /** Dark-energy rift: a black wound in space with hot magenta fissures. */
    id: 'rift',
    defaults: {},
    create() {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 5, { add: true, alpha: 0.4 }));
      v.addChild(sprite(darkTex(), 2.1));
      v.addChild(sprite(riftTex(1), 2.4, { add: true }));
      v.addChild(sprite(Tex.glow(), 1.2, { add: true, alpha: 0.7 }));
      (v.children[1] as Sprite).tint = 0x04000a;
      return v;
    },
    reset(v, e) {
      (v.children[2] as Sprite).texture = riftTex((e.uid % 2) + 1);
      (v.children[0] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx, dt) {
      (v.children[2] as Sprite).rotation += dt * 0.5;
      const k = 0.55 + 0.45 * Math.sin(ctx.tierTime * 3 + e.uid);
      (v.children[2] as Sprite).alpha = 0.6 + 0.4 * k;
      (v.children[3] as Sprite).alpha = 0.4 + 0.5 * k;
    },
  },
]);
