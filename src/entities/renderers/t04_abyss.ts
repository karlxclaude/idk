/**
 * Tier 4 (The Abyss) renderers: schooling minnows, sharks, dolphins (shared swimmer kit), krill,
 * shrimp, jellyfish and anglerfish. Baked once; update() only moves a handful of sprites.
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { defineRenderers } from '../define';
import { TAU, bakeU, blinkLevel, glowSprite, strand, swimmerRenderer, us, profilePath, shadeGradient } from './t04_kit';

/** Fusiform half-height profile. */
export const fusi = (h: number, a = 0.72, b = 0.85, t = 0.05) => (u: number) =>
  h * Math.pow(Math.sin(Math.PI * Math.pow(u, a)), b) + t * u * u * u;

const eye = (c: CanvasRenderingContext2D, x: number, y: number, r: number, iris = '#fff', pupil = '#000') => {
  c.fillStyle = iris;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = pupil;
  c.beginPath(); c.arc(x + r * 0.15, y, r * 0.58, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.beginPath(); c.arc(x - r * 0.1, y - r * 0.3, r * 0.2, 0, TAU); c.fill();
};

const minnow = swimmerRenderer('t04_minnow', {
  ext: 1.5, L: 1.0,
  top: fusi(0.36, 0.72, 0.8, 0.05), bot: fusi(0.33, 0.72, 0.8, 0.05),
  hinge: -0.92, tailExt: 0.95, tailAmp: 0.5, tailSpeed: 11, bend: 0.12,
  tail(c) {
    c.beginPath();
    c.moveTo(0.12, -0.07); c.quadraticCurveTo(-0.35, -0.12, -0.88, -0.58);
    c.quadraticCurveTo(-0.6, 0, -0.88, 0.58); c.quadraticCurveTo(-0.35, 0.12, 0.12, 0.07);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.25, -0.3); c.lineTo(-0.3, -0.66); c.lineTo(-0.5, -0.26); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.1, 0.3); c.lineTo(-0.5, 0.52); c.lineTo(-0.6, 0.24); c.closePath(); c.fill();
  },
  bellyLine: () => 0.06,
  detail(c) {
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.045;
    c.beginPath(); c.moveTo(0.55, 0.02); c.quadraticCurveTo(-0.1, -0.04, -0.82, 0.01); c.stroke();
    eye(c, 0.62, -0.08, 0.1);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.03;
    c.beginPath(); c.arc(0.38, 0, 0.4, -0.7, 0.7); c.stroke();
  },
  glow: 1.5, glowAlpha: 0.18,
});

const shark = swimmerRenderer('t04_shark', {
  ext: 2.5, L: 1.5,
  top: fusi(0.4, 0.85, 0.9, 0.045), bot: fusi(0.33, 0.85, 0.9, 0.045),
  hinge: -1.4, tailExt: 1.25, tailAmp: 0.34, tailSpeed: 6, bend: 0.07,
  tail(c) {
    c.beginPath();
    c.moveTo(0.18, -0.06);
    c.quadraticCurveTo(-0.3, -0.12, -0.9, -1.05);
    c.quadraticCurveTo(-0.58, -0.28, -0.52, -0.02);
    c.quadraticCurveTo(-0.72, 0.3, -0.72, 0.58);
    c.quadraticCurveTo(-0.28, 0.2, 0.18, 0.07);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.42, -0.36); c.quadraticCurveTo(0.2, -0.85, -0.12, -1.02); c.quadraticCurveTo(-0.14, -0.6, -0.4, -0.34); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.5, 0.2); c.quadraticCurveTo(0.35, 0.65, -0.2, 0.98); c.quadraticCurveTo(-0.08, 0.5, -0.12, 0.22); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.55, 0.2); c.lineTo(-0.9, 0.5); c.lineTo(-0.85, 0.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.6, -0.2); c.lineTo(-0.8, -0.45); c.lineTo(-0.9, -0.18); c.closePath(); c.fill();
  },
  bellyLine: () => 0.04,
  detail(c) {
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.035;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0.58 - i * 0.07, -0.18); c.quadraticCurveTo(0.52 - i * 0.07, 0.02, 0.58 - i * 0.07, 0.2); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(1.3, 0.1); c.quadraticCurveTo(1.05, 0.2, 0.82, 0.12); c.stroke();
    c.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { const x = 1.22 - i * 0.075; c.beginPath(); c.moveTo(x, 0.125 + (i * 0.002)); c.lineTo(x - 0.03, 0.2); c.lineTo(x - 0.06, 0.13); c.fill(); }
    eye(c, 1.02, -0.1, 0.065, '#e8ecf0', '#000');
    c.fillStyle = 'rgba(255,40,40,0.8)'; c.beginPath(); c.arc(1.03, -0.1, 0.018, 0, TAU); c.fill();
  },
  glow: 2.4, glowAlpha: 0.06,
});

const dolphin = swimmerRenderer('t04_dolphin', {
  ext: 2.2, L: 1.25,
  top: fusi(0.34, 0.65, 0.85, 0.05), bot: fusi(0.3, 0.7, 0.85, 0.05),
  bodyExtra(c) { c.beginPath(); c.ellipse(1.42, 0.03, 0.4, 0.09, 0, 0, TAU); c.fill(); },
  hinge: -1.15, tailExt: 0.95, tailAmp: 0.42, tailSpeed: 7, bend: 0.1,
  tail(c) {
    c.beginPath();
    c.moveTo(0.18, -0.05); c.quadraticCurveTo(-0.2, -0.12, -0.78, -0.72); c.quadraticCurveTo(-0.5, -0.15, -0.42, 0);
    c.quadraticCurveTo(-0.5, 0.15, -0.78, 0.72); c.quadraticCurveTo(-0.2, 0.12, 0.18, 0.05);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.35, -0.34); c.quadraticCurveTo(0.15, -0.88, -0.32, -0.92); c.quadraticCurveTo(-0.06, -0.55, -0.15, -0.33); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.58, 0.18); c.quadraticCurveTo(0.42, 0.62, -0.02, 0.8); c.quadraticCurveTo(0.26, 0.4, 0.2, 0.2); c.closePath(); c.fill();
  },
  bellyLine: () => 0.03,
  detail(c) {
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(1.75, 0.04); c.quadraticCurveTo(1.35, 0.1, 0.98, 0.06); c.stroke();
    eye(c, 0.78, -0.04, 0.062, '#e8ecf0', '#10161c');
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(0.45, -0.28, 0.025, 0, TAU); c.fill();
  },
  glow: 2, glowAlpha: 0.08,
});

// ---------------------------------------------------------------- krill / plankton
const krillTex = () =>
  bakeU('t04:krill', 1.3, (c) => {
    for (let i = 0; i < 6; i++) {
      const x = 0.75 - i * 0.27, y = 0.1 * Math.sin(i * 0.7), r = i === 0 ? 0.3 : 0.24 - i * 0.022;
      c.fillStyle = `rgba(255,255,255,${i === 0 ? 0.9 : 0.75})`;
      c.beginPath(); c.ellipse(x, y, r * 1.05, r * 0.8, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.025;
      c.beginPath(); c.arc(x, y, r * 0.8, 1.9, 4.4); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.03;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0.5 - i * 0.22, 0.16); c.lineTo(0.42 - i * 0.22, 0.38); c.stroke(); }
    c.beginPath(); c.moveTo(0.95, -0.05); c.quadraticCurveTo(1.15, -0.25, 1.28, -0.3); c.stroke();
    c.fillStyle = '#000'; c.beginPath(); c.arc(0.86, -0.07, 0.07, 0, TAU); c.fill();
    // tail fan
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.moveTo(-0.85, 0.04); c.lineTo(-1.2, -0.12); c.lineTo(-1.15, 0.05); c.lineTo(-1.2, 0.2); c.closePath(); c.fill();
  });
const photoTex = () =>
  bakeU('t04:krill:dots', 1.3, (c) => {
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(0.55 - i * 0.3, 0.17, 0.045, 0, TAU); c.fill(); }
  });

const krill = {
  id: 't04_krill',
  create() {
    const v = new Container();
    v.addChild(glowSprite(3.6, 0.0));
    v.addChild(us(krillTex(), 1.3, { alpha: 0.75 }));
    v.addChild(us(photoTex(), 1.3, { add: true }));
    for (let i = 0; i < 4; i++) v.addChild(glowSprite(0.7, 0.9, 0.55 * 1 - i * 0.3, 0.17));
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[0] as Sprite).tint = e.color2;
    (v.children[1] as Sprite).tint = e.color;
    for (let i = 2; i < v.children.length; i++) (v.children[i] as Sprite).tint = e.color2;
  },
  update(v: Container, e: any) {
    const b = blinkLevel(e, 1);
    (v.children[0] as Sprite).alpha = 0.08 + 0.55 * b;
    for (let i = 3; i < v.children.length; i++) (v.children[i] as Sprite).alpha = 0.2 + 0.8 * b;
    (v.children[2] as Sprite).alpha = 0.3 + 0.7 * b;
    v.children[1].rotation = Math.sin(e.age * 9 + e.uid) * 0.08;
  },
};

// ---------------------------------------------------------------- shrimp
const shrimpBody = () =>
  bakeU('t04:shrimp:body', 1.8, (c) => {
    // C-shaped body from head (+x) curling to tail fan (-x, down).
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = 0.85 - 1.5 * t - 0.12 * Math.sin(t * Math.PI);
      const y = -0.25 + 0.65 * Math.sin(t * 2.0) * 0.55 + 0.55 * t * t;
      pts.push([x, y, 0.3 * (1 - t * 0.55) + 0.03]);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y, r] = pts[i];
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r * 1.1);
      g.addColorStop(0, '#fff'); g.addColorStop(1, '#8a8a8a');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 0.03;
    for (let i = 2; i < pts.length - 1; i += 1) {
      const [x, y, r] = pts[i];
      c.beginPath(); c.arc(x, y, r * 0.9, 0.5, 2.6); c.stroke();
    }
    // tail fan
    const [tx, ty] = pts[pts.length - 1];
    c.fillStyle = '#c8c8c8';
    for (let k = -1; k <= 1; k++) {
      c.beginPath(); c.ellipse(tx - 0.2, ty + 0.12 + k * 0.1, 0.3, 0.09, 0.6 + k * 0.5, 0, TAU); c.fill();
    }
    // head shield
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0.78, -0.3); c.lineTo(1.28, -0.34); c.lineTo(0.9, -0.12); c.closePath(); c.fill();
  }, 512);
const shrimpDetail = () =>
  bakeU('t04:shrimp:detail', 1.8, (c) => {
    c.fillStyle = '#000'; c.beginPath(); c.arc(1.05, -0.28, 0.08, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(1.03, -0.31, 0.025, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.035;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0.55 - i * 0.2, -0.1 + i * 0.07); c.lineTo(0.42 - i * 0.2, 0.2 + i * 0.1); c.stroke(); }
  }, 512);
const antTex = () =>
  bakeU('t04:shrimp:ant', 1.8, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 0.028;
    c.beginPath(); c.moveTo(1.15, -0.32); c.bezierCurveTo(1.5, -0.7, 1.7, -0.4, 1.75, -0.95); c.stroke();
    c.beginPath(); c.moveTo(1.1, -0.28); c.bezierCurveTo(1.6, -0.3, 1.65, 0.1, 1.78, 0.35); c.stroke();
  }, 512);

const shrimp = {
  id: 't04_shrimp',
  create() {
    const v = new Container();
    const f = new Container();
    v.addChild(f);
    f.addChild(glowSprite(3.4, 0.14));
    f.addChild(us(antTex(), 1.8, { alpha: 0.85 }));
    f.addChild(us(shrimpBody(), 1.8));
    f.addChild(us(shrimpDetail(), 1.8));
    return v;
  },
  reset(v: Container, e: any) {
    const f = v.children[0] as Container;
    (f.children[0] as Sprite).tint = e.color2;
    (f.children[1] as Sprite).tint = e.color2;
    (f.children[2] as Sprite).tint = e.color;
    f.scale.y = Math.cos(e.rotation) < 0 ? -1 : 1;
  },
  update(v: Container, e: any, _p: any, _c: any, dt: number) {
    const f = v.children[0] as Container;
    const t = e.age * 7 + e.uid;
    const sp = Math.hypot(e.vx, e.vy) / e.radius;
    f.children[2].skew.y = Math.sin(t) * 0.1 * Math.min(1.5, sp);
    f.children[1].rotation = Math.sin(e.age * 3 + e.uid) * 0.08;
    const target = Math.cos(e.rotation) < 0 ? -1 : 1;
    f.scale.y += (target - f.scale.y) * Math.min(1, dt * 9);
  },
};

// ---------------------------------------------------------------- jellyfish
const bellTex = () =>
  bakeU('t04:jelly:bell', 1.5, (c) => {
    c.beginPath();
    c.moveTo(-1, 0.12);
    c.bezierCurveTo(-1.02, -0.65, -0.55, -1.02, 0, -1.02);
    c.bezierCurveTo(0.55, -1.02, 1.02, -0.65, 1, 0.12);
    // scalloped lower lip
    for (let i = 0; i < 6; i++) {
      const x0 = 1 - i * (2 / 6), x1 = x0 - 2 / 6;
      c.quadraticCurveTo((x0 + x1) / 2, 0.34, x1, 0.12);
    }
    c.closePath();
    const g = c.createRadialGradient(0, -0.15, 0.1, 0, 0, 1.1);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0.85)');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 0.05; c.stroke();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 0.03;
    for (let i = -4; i <= 4; i++) { c.beginPath(); c.moveTo(0, -1.0); c.quadraticCurveTo(i * 0.22, -0.4, i * 0.27, 0.3); c.stroke(); }
    c.restore();
  }, 512);
const gonadTex = () =>
  bakeU('t04:jelly:gonad', 1.5, (c) => {
    c.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      c.beginPath(); c.ellipse(Math.cos(a) * 0.22, -0.32 + Math.sin(a) * 0.1, 0.17, 0.09, a * 0.5, 0, TAU); c.fill();
    }
  });
const armsTex = () =>
  bakeU('t04:jelly:arms', 2.0, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 0.13;
    for (let i = -2; i <= 2; i++) strand(c, i * 0.18, 0.12, 1.15 - Math.abs(i) * 0.12, 0.09, i * 1.3);
    c.lineWidth = 0.05;
    for (let i = -2; i <= 2; i++) strand(c, i * 0.18 + 0.05, 0.14, 1.35 - Math.abs(i) * 0.12, 0.12, i * 1.3 + 1);
  }, 384);
const tentTex = () =>
  bakeU('t04:jelly:tent', 3.0, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 0.028;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const x = -0.95 + (i / (n - 1)) * 1.9;
      const len = 2.2 + 0.5 * Math.sin(i * 2.1);
      strand(c, x, 0.14, len, 0.12, i * 1.7, 26);
    }
    c.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const x = -0.95 + (i / (n - 1)) * 1.9;
      const len = 2.2 + 0.5 * Math.sin(i * 2.1);
      for (let k = 1; k <= 5; k++) {
        const t = k / 6;
        c.beginPath(); c.arc(x + Math.sin(t * 7 + i * 1.7) * 0.12 * (0.3 + t), 0.14 + len * t, 0.025, 0, TAU); c.fill();
      }
    }
  }, 512);

const jelly = {
  id: 't04_jelly',
  defaults: { glow: 2.6, glowAlpha: 0.45, tent: 1, sting: false },
  create(_a: any, p: any) {
    const v = new Container();
    v.addChild(glowSprite(p.glow * 2, p.glowAlpha));             // 0 halo
    const tent = us(tentTex(), 3.0, { alpha: p.sting ? 0.85 : 0.6, y: 0 });
    tent.scale.y *= p.tent; tent.position.y = 3.0 * (p.tent - 1) - 0.0;
    v.addChild(tent);                                              // 1
    const arms = us(armsTex(), 2.0, { alpha: 0.7 });
    arms.position.y = 0.6;
    v.addChild(arms);                                              // 2
    v.addChild(us(bellTex(), 1.5, { alpha: 0.9 }));                // 3
    v.addChild(us(gonadTex(), 1.5, { add: true, alpha: 0.85 }));   // 4
    v.addChild(glowSprite(1.9, 0.5, 0, -0.35));                    // 5 core
    if (p.sting) for (let i = 0; i < 6; i++) v.addChild(glowSprite(0.35, 0.8, -0.8 + i * 0.32, 2.0 * p.tent + (i % 2) * 0.5));
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[0] as Sprite).tint = e.color2;
    (v.children[1] as Sprite).tint = e.color2;
    (v.children[2] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = e.color;
    (v.children[4] as Sprite).tint = e.color2;
    (v.children[5] as Sprite).tint = e.color2;
    for (let i = 6; i < v.children.length; i++) (v.children[i] as Sprite).tint = e.color2;
  },
  update(v: Container, e: any) {
    const t = e.age * 2.1 + e.uid;
    const s = Math.sin(t);
    v.rotation = Math.sin(e.age * 0.5 + e.uid) * 0.1;
    const bell = v.children[3];
    if ((bell as any).bx === undefined) { (bell as any).bx = bell.scale.x; (bell as any).by = bell.scale.y; }
    bell.scale.set((bell as any).bx * (1 - 0.07 * s), (bell as any).by * (1 + 0.12 * s));
    v.children[4].scale.copyFrom(bell.scale);
    const tent = v.children[1];
    if ((tent as any).by === undefined) { (tent as any).bx = tent.scale.x; (tent as any).by = tent.scale.y; }
    tent.scale.y = (tent as any).by * (1 - 0.1 * s);
    tent.skew.x = Math.sin(t * 0.55 + 1) * 0.14;
    v.children[2].skew.x = Math.sin(t * 0.8) * 0.18;
    (v.children[5] as Sprite).alpha = 0.35 + 0.3 * (0.5 + 0.5 * s);
    (v.children[0] as Sprite).alpha = (0.28 + 0.22 * (0.5 + 0.5 * s)) * (e.alpha);
    for (let i = 6; i < v.children.length; i++) (v.children[i] as Sprite).alpha = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + i));
  },
};

// ---------------------------------------------------------------- anglerfish
const anglerBody = () =>
  bakeU('t04:angler:body', 2.3, (c) => {
    c.beginPath();
    c.moveTo(1.02, 0.08);
    c.bezierCurveTo(1.0, -0.55, 0.5, -0.95, -0.15, -0.78);
    c.bezierCurveTo(-0.6, -0.65, -0.85, -0.3, -1.05, -0.1);
    c.lineTo(-1.05, 0.1);
    c.bezierCurveTo(-0.85, 0.3, -0.6, 0.72, -0.1, 0.78);
    c.bezierCurveTo(0.45, 0.82, 0.95, 0.62, 1.12, 0.3);
    c.lineTo(0.98, 0.24);
    c.closePath();
    c.fillStyle = shadeGradient(c, -0.85, 0.85, 0.45);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 0.03;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0.3 - i * 0.22, -0.7 + Math.abs(i - 2.5) * 0.06); c.quadraticCurveTo(0.2 - i * 0.22, 0, 0.3 - i * 0.22, 0.7 - Math.abs(i - 2.5) * 0.06); c.stroke(); }
  }, 512);
const anglerFins = () =>
  bakeU('t04:angler:fins', 2.3, (c) => {
    c.fillStyle = '#bbb';
    c.beginPath(); c.moveTo(-0.9, -0.12); c.quadraticCurveTo(-1.5, -0.6, -1.85, -0.5); c.quadraticCurveTo(-1.6, 0, -1.85, 0.5); c.quadraticCurveTo(-1.5, 0.6, -0.9, 0.12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.0, 0.5); c.quadraticCurveTo(-0.3, 1.0, -0.7, 1.0); c.quadraticCurveTo(-0.5, 0.7, -0.5, 0.55); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.5, -0.65); c.quadraticCurveTo(-0.8, -1.1, -1.2, -0.95); c.quadraticCurveTo(-1.0, -0.6, -0.95, -0.4); c.closePath(); c.fill();
  }, 512);
const anglerDetail = () =>
  bakeU('t04:angler:detail', 2.3, (c) => {
    // glowing maw interior
    c.fillStyle = 'rgba(10,0,0,0.85)';
    c.beginPath(); c.moveTo(1.08, 0.16); c.quadraticCurveTo(0.7, 0.4, 0.15, 0.2); c.quadraticCurveTo(0.7, 0.14, 1.08, 0.16); c.fill();
    // needle teeth
    c.fillStyle = 'rgba(240,250,255,0.95)';
    for (let i = 0; i < 9; i++) {
      const x = 1.04 - i * 0.1, y = 0.16 + (1 - i / 9) * 0.0 + 0.02 * i * 0.3 + 0.0;
      c.beginPath(); c.moveTo(x, y - 0.02); c.lineTo(x - 0.02, y + 0.15 - i * 0.008); c.lineTo(x - 0.07, y - 0.01); c.fill();
    }
    for (let i = 0; i < 7; i++) {
      const x = 1.0 - i * 0.11, y = 0.26 + 0.015 * i;
      c.beginPath(); c.moveTo(x, y + 0.02); c.lineTo(x - 0.02, y - 0.17); c.lineTo(x - 0.07, y + 0.02); c.fill();
    }
    // eye
    c.fillStyle = '#d7e86a'; c.beginPath(); c.arc(0.55, -0.18, 0.15, 0, TAU); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(0.58, -0.18, 0.08, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(0.53, -0.23, 0.03, 0, TAU); c.fill();
  }, 512);
const stalkTex = () =>
  bakeU('t04:angler:stalk', 2.3, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(0.45, -0.72); c.bezierCurveTo(0.55, -1.5, 1.2, -1.8, 1.65, -1.5); c.stroke();
    c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(1.65, -1.5); c.lineTo(1.72, -1.28); c.stroke();
  }, 512);

const angler = {
  id: 't04_angler',
  create() {
    const v = new Container();
    const f = new Container();
    v.addChild(f);
    f.addChild(glowSprite(5.6, 0.0, 1.7, -1.35));              // 0 lure halo
    f.addChild(us(anglerFins(), 2.3, { alpha: 0.9 }));         // 1
    f.addChild(us(stalkTex(), 2.3, { alpha: 0.9 }));           // 2
    f.addChild(us(anglerBody(), 2.3));                         // 3
    f.addChild(us(anglerDetail(), 2.3));                       // 4
    f.addChild(glowSprite(3.0, 0.0, 0.2, -0.1));               // 5 body-lit rim
    f.addChild(glowSprite(1.6, 0.95, 1.72, -1.28));            // 6 lure
    f.addChild(glowSprite(0.55, 1, 1.72, -1.28));              // 7 hot core
    return v;
  },
  reset(v: Container, e: any) {
    const f = v.children[0] as Container;
    (f.children[0] as Sprite).tint = e.color2;
    (f.children[1] as Sprite).tint = e.color;
    (f.children[2] as Sprite).tint = e.color;
    (f.children[3] as Sprite).tint = e.color;
    (f.children[5] as Sprite).tint = e.color2;
    (f.children[6] as Sprite).tint = e.color2;
    (f.children[7] as Sprite).tint = 0xffffff;
    f.scale.y = Math.cos(e.rotation) < 0 ? -1 : 1;
  },
  update(v: Container, e: any, _p: any, _c: any, dt: number) {
    const f = v.children[0] as Container;
    const t = e.age * 2.4 + e.uid;
    const pulse = 0.55 + 0.45 * Math.sin(t);
    (f.children[6] as Sprite).alpha = 0.6 + 0.4 * pulse;
    (f.children[7] as Sprite).alpha = 0.7 + 0.3 * pulse;
    (f.children[0] as Sprite).alpha = 0.18 + 0.2 * pulse;
    (f.children[5] as Sprite).alpha = 0.14 + 0.1 * pulse;
    const sway = Math.sin(e.age * 1.7 + e.uid) * 0.05;
    f.children[2].rotation = sway; f.children[1].rotation = Math.sin(e.age * 4 + e.uid) * 0.05;
    const dx = Math.sin(e.age * 1.7 + e.uid) * 0.05;
    f.children[6].position.set(1.72 + dx * 2, -1.28 + dx);
    f.children[7].position.set(1.72 + dx * 2, -1.28 + dx);
    f.skew.y = Math.sin(e.age * 3 + e.uid) * 0.03;
    const target = Math.cos(e.rotation) < 0 ? -1 : 1;
    f.scale.y += (target - f.scale.y) * Math.min(1, dt * 9);
  },
};

// profilePath re-exported usage placeholder to keep kit tree-shaking friendly
void profilePath;
void Tex;

export default defineRenderers([minnow, shark, dolphin, krill, shrimp, jelly, angler] as any);
