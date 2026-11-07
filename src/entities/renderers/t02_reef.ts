/**
 * Tier 2 (Molecular Reef) renderers: water molecule, ball-and-stick molecules, folded proteins,
 * kelp-like DNA strands, jaw-like enzymes and spiky free radicals. All textures are baked once
 * and shared; per-frame work is limited to cheap sprite transforms.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite, spikyTexture } from './core';

/** Non-square centred sprite (w x h in view units). */
function box(tex: Texture, w: number, h: number, o: { add?: boolean; alpha?: number } = {}): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = w;
  s.height = h;
  if (o.add) s.blendMode = 'add';
  if (o.alpha !== undefined) s.alpha = o.alpha;
  return s;
}

const barTex = () =>
  bakeTexture('t02:bar', 32, (c, s) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.roundRect(1, s * 0.2, s - 2, s * 0.6, s * 0.3);
    c.fill();
  });

function bond(x1: number, y1: number, x2: number, y2: number, w: number): Sprite {
  const s = box(barTex(), Math.hypot(x2 - x1, y2 - y1), w, { alpha: 0.9 });
  s.position.set((x1 + x2) / 2, (y1 + y2) / 2);
  s.rotation = Math.atan2(y2 - y1, x2 - x1);
  return s;
}

function atomAt(x: number, y: number, d: number): Sprite {
  const s = sprite(Tex.orb(), d);
  s.position.set(x, y);
  return s;
}

/** Folded protein: thick tube strokes looping through a disc with a thin bright core stroke. */
const proteinTex = (seed: number) =>
  bakeTexture(`t02:protein:${seed}`, 256, (c, s) => {
    const r = new Rng(seed);
    const pts: [number, number][] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + r.range(-0.3, 0.3);
      const d = r.range(0.2, 0.78) * (s / 2 - 22);
      pts.push([s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d]);
    }
    const path = () => {
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      c.quadraticCurveTo(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
    };
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 46;
    path(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 30;
    path(); c.stroke();
    c.strokeStyle = '#fff';
    c.lineWidth = 9;
    c.setLineDash([2, 12]);
    path(); c.stroke();
  });

/** Double helix, vertical. Strands and rungs are separate textures so they tint differently. */
const helixStrandTex = () =>
  bakeTexture('t02:helix:strand', 128, (c, s) => {
    c.lineCap = 'round';
    c.lineWidth = 9;
    for (const ph of [0, Math.PI]) {
      c.strokeStyle = ph ? 'rgba(255,255,255,0.75)' : '#fff';
      c.beginPath();
      for (let y = 4; y <= s - 4; y += 2) {
        const x = s / 2 + Math.sin((y / s) * Math.PI * 4 + ph) * (s * 0.34);
        if (y === 4) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  });
const helixRungTex = () =>
  bakeTexture('t02:helix:rung', 128, (c, s) => {
    c.lineCap = 'round';
    c.lineWidth = 5;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    for (let y = 8; y < s - 4; y += 8) {
      const dx = Math.sin((y / s) * Math.PI * 4) * (s * 0.34);
      c.beginPath();
      c.moveTo(s / 2 - dx, y);
      c.lineTo(s / 2 + dx, y);
      c.stroke();
    }
  });

const jawTex = () =>
  bakeTexture('t02:jaw', 128, (c, s) => {
    // upper half-disc with a gradient and a few teeth along the flat edge
    c.save();
    c.beginPath();
    c.rect(0, 0, s, s / 2);
    c.clip();
    const g = c.createRadialGradient(s * 0.4, s * 0.3, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.6, '#cfcfcf');
    g.addColorStop(1, '#8a8a8a');
    c.fillStyle = g;
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const x = s * (0.62 + i * 0.09);
      c.beginPath();
      c.moveTo(x - 4, s / 2);
      c.lineTo(x, s / 2 + 12);
      c.lineTo(x + 4, s / 2);
      c.fill();
    }
  });

export default defineRenderers([
  {
    /** H2O: bent V of one big oxygen (color) and two hydrogens (color2). */
    id: 'waterMol',
    defaults: { glow: 2.3, glowAlpha: 0.4 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(bond(0, 0.3, -0.78, -0.5, 0.2), bond(0, 0.3, 0.78, -0.5, 0.2));
      v.addChild(atomAt(0, 0.3, 1.25));
      v.addChild(atomAt(-0.78, -0.5, 0.78), atomAt(0.78, -0.5, 0.78));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color2;
      (v.children[3] as Sprite).tint = e.color;
      (v.children[4] as Sprite).tint = e.color2;
      (v.children[5] as Sprite).tint = e.color2;
    },
  },
  {
    /** Ball-and-stick molecule: central atom + N satellites (or a ring of N with params.ring). */
    id: 'ballStick',
    defaults: { atoms: 4, ring: false, glow: 2.3, glowAlpha: 0.45 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      const n = p.atoms as number;
      const pos: [number, number][] = [];
      if (p.ring) for (let i = 0; i < n; i++) pos.push([Math.cos((i / n) * Math.PI * 2) * 0.62, Math.sin((i / n) * Math.PI * 2) * 0.62]);
      else {
        pos.push([0, 0]);
        for (let i = 1; i < n; i++) {
          const a = ((i - 1) / (n - 1)) * Math.PI * 2 + 0.4;
          pos.push([Math.cos(a) * 0.68, Math.sin(a) * 0.68]);
        }
      }
      const bonds = new Container();
      if (p.ring) for (let i = 0; i < n; i++) bonds.addChild(bond(pos[i][0], pos[i][1], pos[(i + 1) % n][0], pos[(i + 1) % n][1], 0.16));
      else for (let i = 1; i < n; i++) bonds.addChild(bond(pos[0][0], pos[0][1], pos[i][0], pos[i][1], 0.16));
      v.addChild(bonds);
      const atoms = new Container();
      pos.forEach((q, i) => atoms.addChild(atomAt(q[0], q[1], (p.ring ? 0.7 : i === 0 ? 0.95 : 0.62))));
      v.addChild(atoms);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      for (const b of (v.children[1] as Container).children) (b as Sprite).tint = e.color2;
      (v.children[2] as Container).children.forEach((a, i) => ((a as Sprite).tint = i % 2 === 0 ? e.color : e.color2));
    },
    update(v, e) {
      v.children[2].rotation = v.children[1].rotation = Math.sin(e.age * 0.8 + e.uid) * 0.12;
    },
  },
  {
    /** Folded protein: translucent glossy ribbon around a glowing core. */
    id: 'protein',
    defaults: { variant: 1, glow: 2.4, glowAlpha: 0.4 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(Tex.disc(), 1.7, { alpha: 0.22 }));
      v.addChild(sprite(proteinTex(7 + p.variant * 13), 2.15));
      v.addChild(sprite(Tex.glow(), 0.8, { add: true, alpha: 0.6 }));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e) {
      v.children[2].rotation = Math.sin(e.age * 0.7 + e.uid) * 0.25;
      v.children[2].scale.set(1 + Math.sin(e.age * 1.7) * 0.03);
    },
  },
  {
    /** DNA strand swaying like kelp: twisting helix + glowing rungs. Long axis = ±length. */
    id: 'dna',
    defaults: { length: 1.5, glow: 1.5, glowAlpha: 0.35 },
    create(_a, p) {
      const v = new Container();
      const inner = new Container();
      inner.addChild(box(Tex.glow(), 1.7 * p.glow, 2 * p.length * p.glow * 0.9, { add: true, alpha: p.glowAlpha }));
      inner.addChild(box(helixRungTex(), 1.1, 2 * p.length));
      inner.addChild(box(helixStrandTex(), 1.1, 2 * p.length));
      v.addChild(inner);
      return v;
    },
    reset(v, e) {
      const inner = v.children[0] as Container;
      (inner.children[0] as Sprite).tint = e.color;
      (inner.children[1] as Sprite).tint = e.color2;
      (inner.children[2] as Sprite).tint = e.color;
    },
    update(v, e) {
      const inner = v.children[0] as Container;
      const t = e.age + (e.uid % 17);
      inner.rotation = Math.sin(t * 0.9) * 0.14;
      // twist illusion: strands narrow and widen out of phase with the rungs
      inner.children[2].scale.x = 0.8 + 0.2 * Math.abs(Math.sin(t * 1.6));
      inner.children[1].scale.x = 0.8 + 0.2 * Math.abs(Math.cos(t * 1.6));
    },
  },
  {
    /** Enzyme predator: two snapping jaws (color) around a hot active site (color2). Faces +x. */
    id: 'enzyme',
    defaults: { glow: 2.8, glowAlpha: 0.55 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(jawTex(), 2.1)); // top (drawn upper half)
      const bottom = sprite(jawTex(), 2.1);
      bottom.scale.y *= -1;
      v.addChild(bottom);
      const site = sprite(Tex.glow(), 1.3, { add: true, alpha: 0.9 });
      site.position.set(0.45, 0);
      v.addChild(site);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e) {
      const open = 0.12 + 0.34 * (0.5 + 0.5 * Math.sin(e.age * 4.5 + e.uid));
      v.children[1].rotation = -open;
      v.children[2].rotation = open;
      v.children[3].alpha = 0.6 + 0.4 * Math.sin(e.age * 9);
    },
  },
  {
    /** Free radical: spiky body with a lone, hot unpaired electron orbiting it. */
    id: 'radical',
    defaults: { spikes: 10, depth: 0.28, glow: 3, glowAlpha: 0.65 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(sprite(spikyTexture(p.spikes, p.depth), 2.2));
      v.addChild(sprite(Tex.orb(), 1.0));
      const el = sprite(Tex.glow(), 0.7, { add: true });
      v.addChild(el);
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = e.color2;
      (v.children[3] as Sprite).tint = 0xffffff;
    },
    update(v, e) {
      const a = e.age * 5;
      v.children[3].position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35);
    },
  },
]);
