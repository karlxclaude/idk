/**
 * Tier 5 (Living Shore) renderers: seabirds, crabs, turtles and boats (top-down), plus the
 * side-profile sardines, seals, orcas and whales built on the tier-5 copy of the swimmer kit.
 * Every texture is baked once; per-frame work is only sprite transforms and alphas.
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { defineRenderers } from '../define';
import { TAU, bakeU, fusi, glowSprite, swimmerRenderer, us } from './t05_kit';

const eye = (c: CanvasRenderingContext2D, x: number, y: number, r: number, iris = '#fff', pupil = '#000') => {
  c.fillStyle = iris;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = pupil;
  c.beginPath(); c.arc(x + r * 0.12, y, r * 0.62, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.beginPath(); c.arc(x - r * 0.1, y - r * 0.32, r * 0.2, 0, TAU); c.fill();
};

const shadow = (d: number, ox: number, oy: number, a = 0.28): Sprite => {
  const s = new Sprite(Tex.glow());
  s.anchor.set(0.5);
  s.width = s.height = d;
  s.tint = 0x000000;
  s.alpha = a;
  s.position.set(ox, oy);
  return s;
};

// ---------------------------------------------------------------- swimmers
const sardine = swimmerRenderer('t05_sardine', {
  ext: 1.5, L: 1.05,
  top: fusi(0.3, 0.7, 0.8, 0.04), bot: fusi(0.27, 0.7, 0.8, 0.04),
  hinge: -0.98, tailExt: 0.9, tailAmp: 0.5, tailSpeed: 12, bend: 0.12,
  tail(c) {
    c.beginPath();
    c.moveTo(0.12, -0.06); c.quadraticCurveTo(-0.3, -0.12, -0.82, -0.6);
    c.quadraticCurveTo(-0.5, 0, -0.82, 0.6); c.quadraticCurveTo(-0.3, 0.12, 0.12, 0.06);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.15, -0.26); c.lineTo(-0.25, -0.55); c.lineTo(-0.4, -0.22); c.closePath(); c.fill();
  },
  bellyLine: () => 0.04,
  detail(c) {
    // blue-green back stripe, silver flank shine, row of dark spots, eye
    c.fillStyle = 'rgba(20,70,110,0.55)';
    c.beginPath(); c.ellipse(-0.05, -0.17, 0.85, 0.08, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.ellipse(0.0, -0.02, 0.75, 0.045, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(10,30,50,0.6)';
    for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0.45 - i * 0.18, -0.08, 0.03, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.025;
    c.beginPath(); c.arc(0.62, 0.0, 0.2, -1.1, 1.1); c.stroke();
    eye(c, 0.82, -0.04, 0.075, '#f4f0e0', '#000');
  },
  glow: 1.3, glowAlpha: 0.06,
});

const seal = swimmerRenderer('t05_seal', {
  ext: 2.0, L: 1.25,
  top: fusi(0.46, 0.55, 0.9, 0.1), bot: fusi(0.42, 0.55, 0.9, 0.1),
  hinge: -1.05, tailExt: 0.9, tailAmp: 0.45, tailSpeed: 6, bend: 0.1,
  tail(c) {
    c.beginPath();
    c.moveTo(0.14, -0.05); c.quadraticCurveTo(-0.35, -0.2, -0.78, -0.55); c.quadraticCurveTo(-0.52, -0.08, -0.5, 0);
    c.quadraticCurveTo(-0.52, 0.08, -0.78, 0.55); c.quadraticCurveTo(-0.35, 0.2, 0.14, 0.05);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.45, 0.28); c.quadraticCurveTo(0.35, 0.78, -0.08, 0.92); c.quadraticCurveTo(0.0, 0.5, 0.05, 0.3); c.closePath(); c.fill();
  },
  bellyLine: () => 0.16,
  detail(c) {
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 18; i++) { c.beginPath(); c.ellipse(0.6 - i * 0.1, -0.2 + Math.sin(i * 2.3) * 0.12, 0.04, 0.03, 0, 0, TAU); c.fill(); }
    eye(c, 0.84, -0.12, 0.09, '#2a2420', '#000');
    c.fillStyle = '#16120e'; c.beginPath(); c.ellipse(1.22, 0.0, 0.07, 0.055, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.02;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(1.12, 0.06 + i * 0.03); c.quadraticCurveTo(1.35, 0.12 + i * 0.1, 1.5, 0.1 + i * 0.16); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.025;
    c.beginPath(); c.moveTo(1.18, 0.1); c.quadraticCurveTo(1.0, 0.18, 0.88, 0.1); c.stroke();
  },
  glow: 1.8, glowAlpha: 0.05,
});

const orca = swimmerRenderer('t05_orca', {
  ext: 2.6, L: 1.55,
  top: fusi(0.44, 0.8, 0.9, 0.05), bot: fusi(0.38, 0.8, 0.9, 0.05),
  hinge: -1.45, tailExt: 1.2, tailAmp: 0.32, tailSpeed: 5, bend: 0.06,
  tail(c) {
    c.beginPath();
    c.moveTo(0.18, -0.06); c.quadraticCurveTo(-0.25, -0.14, -0.78, -0.82); c.quadraticCurveTo(-0.52, -0.2, -0.42, 0);
    c.quadraticCurveTo(-0.52, 0.2, -0.78, 0.82); c.quadraticCurveTo(-0.25, 0.14, 0.18, 0.06);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.35, -0.4); c.quadraticCurveTo(0.12, -1.0, -0.1, -1.4); c.quadraticCurveTo(-0.22, -0.9, -0.5, -0.36); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.55, 0.22); c.quadraticCurveTo(0.7, 0.9, 0.1, 1.0); c.quadraticCurveTo(-0.05, 0.6, 0.02, 0.24); c.closePath(); c.fill();
  },
  bellyLine: () => 0.1,
  detail(c) {
    c.fillStyle = 'rgba(210,220,230,0.55)';
    c.beginPath(); c.ellipse(-0.2, -0.3, 0.32, 0.12, 0.25, 0, TAU); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(0.88, -0.14, 0.26, 0.1, -0.45, 0, TAU); c.fill();
    eye(c, 0.98, -0.1, 0.045, '#ffffff', '#000');
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(1.5, 0.14); c.quadraticCurveTo(1.2, 0.2, 0.95, 0.14); c.stroke();
  },
  glow: 2.4, glowAlpha: 0.05,
});

const whale = swimmerRenderer('t05_whale', {
  ext: 3.0, L: 1.8,
  top: fusi(0.52, 0.6, 0.85, 0.05), bot: fusi(0.5, 0.6, 0.85, 0.05),
  hinge: -1.7, tailExt: 1.5, tailAmp: 0.22, tailSpeed: 3, bend: 0.04,
  tail(c) {
    c.beginPath();
    c.moveTo(0.22, -0.07); c.quadraticCurveTo(-0.3, -0.16, -0.9, -0.98); c.quadraticCurveTo(-0.6, -0.26, -0.5, 0);
    c.quadraticCurveTo(-0.6, 0.26, -0.9, 0.98); c.quadraticCurveTo(-0.3, 0.16, 0.22, 0.07);
    c.closePath(); c.fill();
  },
  fins(c) {
    c.beginPath(); c.moveTo(0.4, 0.3); c.quadraticCurveTo(0.5, 1.0, -0.4, 1.35); c.quadraticCurveTo(-0.1, 0.7, -0.1, 0.34); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.7, -0.46); c.quadraticCurveTo(-0.9, -0.76, -1.05, -0.72); c.quadraticCurveTo(-1.0, -0.55, -1.1, -0.42); c.closePath(); c.fill();
  },
  bellyLine: () => 0.14,
  detail(c) {
    c.strokeStyle = 'rgba(0,0,40,0.22)'; c.lineWidth = 0.025;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(1.35 - i * 0.04, 0.2 + i * 0.045); c.quadraticCurveTo(0.2, 0.28 + i * 0.045, -0.7, 0.25 + i * 0.03); c.stroke(); }
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(1.8, 0.1); c.quadraticCurveTo(1.2, 0.34, 0.65, 0.2); c.stroke();
    eye(c, 0.78, 0.1, 0.06, '#d8dce0', '#000');
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(1.6 - i * 0.05, -0.18 - Math.sin(i * 1.7) * 0.08, 0.02 + (i % 3) * 0.008, 0, TAU); c.fill(); }
  },
  glow: 3, glowAlpha: 0.05,
});

// ---------------------------------------------------------------- gull (top-down)
const gullWing = () =>
  bakeU('t05:gull:wing', 2.0, (c) => {
    // shoulder at origin, wing extends towards -y, swept back (-x)
    const g = c.createLinearGradient(0, 0, 0, -1.8);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#cfcfcf');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0.3, 0);
    c.quadraticCurveTo(0.35, -0.7, -0.15, -1.55);
    c.lineTo(-0.5, -1.75);
    c.lineTo(-0.58, -1.45);
    c.lineTo(-0.72, -1.55);
    c.lineTo(-0.72, -1.2);
    c.lineTo(-0.9, -1.2);
    c.quadraticCurveTo(-0.85, -0.5, -0.55, 0.05);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.72)';
    c.beginPath(); c.moveTo(-0.15, -1.55); c.lineTo(-0.5, -1.75); c.lineTo(-0.58, -1.45); c.lineTo(-0.72, -1.55); c.lineTo(-0.72, -1.2); c.lineTo(-0.9, -1.2); c.lineTo(-0.85, -1.05); c.quadraticCurveTo(-0.5, -1.25, -0.15, -1.1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.025;
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0.1 - i * 0.1, -0.35 - i * 0.05); c.lineTo(-0.6 - i * 0.04, -0.9 - i * 0.15); c.stroke(); }
  }, 384);
const gullBody = () =>
  bakeU('t05:gull:body', 1.4, (c) => {
    const g = c.createLinearGradient(0, -0.35, 0, 0.35);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#bdbdbd');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(-0.05, 0, 0.78, 0.27, 0, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-0.7, -0.14); c.lineTo(-1.25, -0.2); c.lineTo(-1.3, 0); c.lineTo(-1.25, 0.2); c.lineTo(-0.7, 0.14); c.closePath(); c.fill();
    c.beginPath(); c.arc(0.78, 0, 0.2, 0, TAU); c.fill();
  }, 256);
const gullDetail = () =>
  bakeU('t05:gull:detail', 1.4, (c) => {
    c.fillStyle = '#ffb21a';
    c.beginPath(); c.moveTo(0.94, -0.06); c.lineTo(1.3, 0.0); c.lineTo(0.94, 0.07); c.closePath(); c.fill();
    c.fillStyle = '#e03a2a'; c.beginPath(); c.arc(1.17, 0.025, 0.025, 0, TAU); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(0.84, -0.09, 0.035, 0, TAU); c.fill();
    c.beginPath(); c.arc(0.84, 0.09, 0.035, 0, TAU); c.fill();
  }, 256);

const gull = {
  id: 't05_gull',
  create() {
    const v = new Container();
    v.addChild(shadow(2.4, 0.45, 0.65, 0.22));                       // 0
    const wu = us(gullWing(), 2.0); wu.position.set(0.1, -0.12);      // 1
    const wl = us(gullWing(), 2.0); wl.position.set(0.1, 0.12); wl.scale.y *= -1; // 2
    v.addChild(wu, wl);
    v.addChild(us(gullBody(), 1.4));                                  // 3
    v.addChild(us(gullDetail(), 1.4));                                // 4
    (wu as any).by = Math.abs(wu.scale.y);
    (wl as any).by = Math.abs(wl.scale.y);
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color;
    (v.children[2] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = e.color;
  },
  update(v: Container, e: any) {
    const sp = Math.hypot(e.vx, e.vy) / e.radius;
    const f = 0.45 + 0.55 * Math.abs(Math.cos(e.age * (3.2 + Math.min(sp, 3) * 1.2) + e.uid));
    const wu = v.children[1], wl = v.children[2];
    wu.scale.y = (wu as any).by * f;
    wl.scale.y = -(wl as any).by * f;
    v.children[0].alpha = 0.22 - (1 - f) * 0.05;
  },
};

// ---------------------------------------------------------------- crab (top-down)
const crabBody = () =>
  bakeU('t05:crab:body', 1.5, (c) => {
    c.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const r = 1 + 0.035 * Math.sin(a * 14);
      c.lineTo(Math.cos(a) * 0.82 * r, Math.sin(a) * 0.98 * r);
    }
    c.closePath();
    const g = c.createRadialGradient(0.15, -0.25, 0.05, 0, 0, 1);
    g.addColorStop(0, '#fff'); g.addColorStop(0.75, '#c8c8c8'); g.addColorStop(1, '#808080');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.03;
    c.beginPath(); c.arc(-0.2, 0, 0.5, -1.0, 1.0); c.stroke();
    c.beginPath(); c.moveTo(0.4, -0.6); c.quadraticCurveTo(0.2, 0, 0.4, 0.6); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.14)';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(-0.3 + (i % 3) * 0.3, -0.35 + Math.floor(i / 3) * 0.35, 0.05, 0, TAU); c.fill(); }
  }, 256);
const crabLegs = () =>
  bakeU('t05:crab:legs', 2.0, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 0.1;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x0 = 0.35 - i * 0.38, y0 = side * 0.6;
        c.beginPath();
        c.moveTo(x0, y0);
        c.lineTo(x0 - 0.15 + i * 0.05, side * 1.1);
        c.lineTo(x0 - 0.5 + i * 0.1, side * 1.55);
        c.stroke();
      }
    }
  }, 384);
const crabClaws = () =>
  bakeU('t05:crab:claws', 2.0, (c) => {
    c.fillStyle = '#fff'; c.strokeStyle = '#fff';
    for (const side of [-1, 1]) {
      c.lineWidth = 0.12;
      c.beginPath(); c.moveTo(0.55, side * 0.5); c.lineTo(0.95, side * 0.8); c.lineTo(1.2, side * 0.55); c.stroke();
      c.beginPath();
      c.moveTo(1.2, side * 0.55);
      c.quadraticCurveTo(1.7, side * 0.9, 1.75, side * 0.35);
      c.quadraticCurveTo(1.55, side * 0.45, 1.35, side * 0.3);
      c.quadraticCurveTo(1.3, side * 0.35, 1.2, side * 0.55);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(1.2, side * 0.55);
      c.quadraticCurveTo(1.35, side * 0.2, 1.75, side * 0.12);
      c.quadraticCurveTo(1.55, side * 0.28, 1.4, side * 0.32);
      c.closePath(); c.fill();
    }
  }, 384);
const crabEyes = () =>
  bakeU('t05:crab:eyes', 1.5, (c) => {
    for (const side of [-1, 1]) {
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(0.7, side * 0.18); c.lineTo(0.9, side * 0.3); c.stroke();
      c.fillStyle = '#111'; c.beginPath(); c.arc(0.93, side * 0.31, 0.085, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(0.91, side * 0.28, 0.025, 0, TAU); c.fill();
    }
  }, 256);

const crab = {
  id: 't05_crab',
  create() {
    const v = new Container();
    v.addChild(shadow(2.6, 0.1, 0.15, 0.22));
    v.addChild(us(crabLegs(), 2.0));
    v.addChild(us(crabClaws(), 2.0));
    v.addChild(us(crabBody(), 1.5));
    v.addChild(us(crabEyes(), 1.5));
    return v;
  },
  reset(v: Container, e: any) {
    (v.children[1] as Sprite).tint = e.color2;
    (v.children[2] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = e.color;
  },
  update(v: Container, e: any) {
    const sp = Math.min(3, Math.hypot(e.vx, e.vy) / e.radius);
    const t = e.age * (6 + sp * 5) + e.uid;
    v.children[1].skew.x = Math.sin(t) * 0.12 * (0.4 + sp * 0.5);
    v.children[2].rotation = Math.sin(e.age * 2.2 + e.uid) * 0.06;
  },
};

// ---------------------------------------------------------------- turtle (top-down)
const turtleShell = () =>
  bakeU('t05:turtle:shell', 1.5, (c) => {
    c.beginPath(); c.ellipse(0, 0, 0.95, 0.8, 0, 0, TAU);
    const g = c.createRadialGradient(0.2, -0.2, 0.1, 0, 0, 0.95);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#707070');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.045;
    c.stroke();
    c.save(); c.clip();
    c.lineWidth = 0.04;
    const hex = (x: number, y: number, r: number) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.stroke(); };
    hex(0, 0, 0.3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      hex(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.3);
      c.beginPath(); c.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3); c.lineTo(Math.cos(a) * 0.9, Math.sin(a) * 0.9); c.stroke();
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 0.03;
    c.beginPath(); c.ellipse(0, 0, 0.88, 0.73, 0, 3.6, 5.2); c.stroke();
  }, 384);
const turtleHead = () =>
  bakeU('t05:turtle:head', 1.9, (c) => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0.8, -0.1); c.lineTo(1.2, -0.12); c.quadraticCurveTo(1.55, -0.1, 1.55, 0.03); c.quadraticCurveTo(1.45, 0.22, 1.15, 0.2); c.lineTo(0.8, 0.12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-0.85, -0.12); c.lineTo(-1.25, 0); c.lineTo(-0.85, 0.12); c.closePath(); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(1.28, -0.1, 0.045, 0, TAU); c.arc(1.28, 0.1, 0.045, 0, TAU); c.fill();
  }, 256);
const flipperTex = (key: string, len: number, w: number) =>
  bakeU(key, 1.4, (c) => {
    const g = c.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#bdbdbd');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0.14, 0); c.quadraticCurveTo(w, -len * 0.5, 0.06, -len); c.quadraticCurveTo(-w * 0.4, -len * 0.55, -0.16, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.03;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, -len * 0.2); c.lineTo(0.12 - i * 0.12, -len * (0.7 + i * 0.1)); c.stroke(); }
  }, 256);

const turtle = {
  id: 't05_turtle',
  create() {
    const v = new Container();
    v.addChild(shadow(3.2, 0.1, 0.15, 0.2));                                  // 0
    const mk = (tex: any, x: number, y: number, rot: number) => {
      const s = us(tex, 1.4); s.position.set(x, y); s.rotation = rot; (s as any).r0 = rot; return s;
    };
    const ff = flipperTex('t05:turtle:ff', 1.25, 0.5), rf = flipperTex('t05:turtle:rf', 0.75, 0.3);
    v.addChild(mk(ff, 0.45, -0.6, -0.5));                  // 1 front upper
    v.addChild(mk(ff, 0.45, 0.6, Math.PI + 0.5));          // 2 front lower
    v.addChild(mk(rf, -0.6, -0.55, -0.95));                // 3 rear upper
    v.addChild(mk(rf, -0.6, 0.55, Math.PI + 0.95));        // 4 rear lower
    v.addChild(us(turtleHead(), 1.9));                     // 5
    v.addChild(us(turtleShell(), 1.5));                    // 6
    return v;
  },
  reset(v: Container, e: any) {
    for (let i = 1; i <= 5; i++) (v.children[i] as Sprite).tint = e.color2;
    (v.children[6] as Sprite).tint = e.color;
  },
  update(v: Container, e: any) {
    const sp = Math.min(2, Math.hypot(e.vx, e.vy) / e.radius);
    const t = e.age * (2.2 + sp * 1.6) + e.uid;
    const s = Math.sin(t);
    for (let i = 1; i <= 4; i++) {
      const sgn = (i % 2 === 1 ? 1 : -1) * (i <= 2 ? 1 : -1);
      v.children[i].rotation = (v.children[i] as any).r0 + sgn * s * (i <= 2 ? 0.45 : 0.25);
    }
    v.children[5].rotation = Math.sin(t * 0.5) * 0.08;
  },
};

// ---------------------------------------------------------------- boat (top-down)
const hullTex = () =>
  bakeU('t05:boat:hull', 2.0, (c) => {
    c.beginPath();
    c.moveTo(1.7, 0);
    c.bezierCurveTo(1.2, -0.45, 0.5, -0.78, -0.7, -0.78);
    c.lineTo(-1.35, -0.64);
    c.lineTo(-1.35, 0.64);
    c.lineTo(-0.7, 0.78);
    c.bezierCurveTo(0.5, 0.78, 1.2, 0.45, 1.7, 0);
    c.closePath();
    const g = c.createLinearGradient(0, -0.8, 0, 0.8);
    g.addColorStop(0, '#9a9a9a'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, '#8a8a8a');
    c.fillStyle = g; c.fill();
  }, 384);
const deckTex = () =>
  bakeU('t05:boat:deck', 2.0, (c) => {
    c.beginPath();
    c.moveTo(1.45, 0);
    c.bezierCurveTo(1.05, -0.36, 0.45, -0.62, -0.7, -0.62);
    c.lineTo(-1.2, -0.5); c.lineTo(-1.2, 0.5); c.lineTo(-0.7, 0.62);
    c.bezierCurveTo(0.45, 0.62, 1.05, 0.36, 1.45, 0);
    c.closePath();
    c.fillStyle = '#fff'; c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.025;
    for (let x = -1.1; x < 1.3; x += 0.2) { const k = Math.max(0, x - 0.1) * 0.5; c.beginPath(); c.moveTo(x, -0.6 + k); c.lineTo(x, 0.6 - k); c.stroke(); }
  }, 384);
const cabinTex = () =>
  bakeU('t05:boat:cabin', 2.0, (c) => {
    c.fillStyle = '#f2f2f2';
    c.beginPath(); c.roundRect(-0.85, -0.38, 1.0, 0.76, 0.1); c.fill();
    c.fillStyle = '#9ec8e8';
    c.beginPath(); c.roundRect(-0.05, -0.3, 0.18, 0.6, 0.05); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.roundRect(-0.85, -0.38, 1.0, 0.1, 0.05); c.fill();
    c.fillStyle = '#d8d8d8'; c.beginPath(); c.arc(-0.5, 0, 0.14, 0, TAU); c.fill();
    c.fillStyle = '#e03a2a'; c.beginPath(); c.arc(-0.5, 0, 0.06, 0, TAU); c.fill();
  }, 384);
const sailTex = () =>
  bakeU('t05:boat:sail', 2.0, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.96)';
    c.beginPath(); c.moveTo(0.9, 0); c.quadraticCurveTo(0.1, -0.85, -1.05, -0.9); c.lineTo(-1.05, -0.05); c.quadraticCurveTo(-0.1, 0.05, 0.9, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.025; c.stroke();
  }, 384);
const wakeTex = () =>
  bakeU('t05:boat:wake', 2.6, (c) => {
    for (const s of [-1, 1]) {
      const g = c.createLinearGradient(-1.2, 0, -2.5, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.strokeStyle = g; c.lineWidth = 0.14;
      c.beginPath(); c.moveTo(-1.1, s * 0.5); c.quadraticCurveTo(-1.8, s * 0.7, -2.45, s * 1.3); c.stroke();
      c.lineWidth = 0.06;
      c.beginPath(); c.moveTo(-1.2, s * 0.2); c.quadraticCurveTo(-1.9, s * 0.3, -2.5, s * 0.6); c.stroke();
    }
    const g2 = c.createLinearGradient(-1.3, 0, -2.5, 0);
    g2.addColorStop(0, 'rgba(255,255,255,0.7)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g2; c.beginPath(); c.ellipse(-1.9, 0, 0.7, 0.28, 0, 0, TAU); c.fill();
  }, 384);

/** Fishing boat or sailboat: `sail` = chance (0..1) that a given boat is a sailboat (picked per entity). */
const boat = {
  id: 't05_boat',
  defaults: { sail: 0.4 },
  create() {
    const v = new Container();
    v.addChild(us(wakeTex(), 2.6, { add: true, alpha: 0.5 }));                 // 0 wake
    v.addChild(shadow(4.2, 0.15, 0.2, 0.28));                                  // 1
    v.addChild(us(hullTex(), 2.0));                                            // 2
    v.addChild(us(deckTex(), 2.0));                                            // 3
    v.addChild(us(cabinTex(), 2.0));                                           // 4 cabin
    v.addChild(glowSprite(0.6, 0.9, -0.5, 0));                                 // 5 lamp
    v.addChild(us(sailTex(), 2.0));                                            // 6 sail
    (v.children[0] as any).bx = v.children[0].scale.x;
    return v;
  },
  reset(v: Container, e: any, p: any) {
    const sail = ((e.uid * 0.6180339) % 1) < (p.sail ?? 0.4);
    (v.children[2] as Sprite).tint = e.color;
    (v.children[3] as Sprite).tint = e.color2;
    v.children[4].visible = !sail;
    v.children[5].visible = !sail;
    v.children[6].visible = sail;
    (v.children[5] as Sprite).tint = 0xffe8a0;
  },
  update(v: Container, e: any) {
    const sp = Math.min(1.5, Math.hypot(e.vx, e.vy) / Math.max(e.radius, 1e-3));
    const w = v.children[0];
    w.alpha = 0.15 + 0.5 * Math.min(1, sp);
    w.scale.x = (w as any).bx * (0.7 + 0.5 * Math.min(1, sp));
    v.children[2].skew.y = Math.sin(e.age * 1.3 + e.uid) * 0.015;
    (v.children[5] as Sprite).alpha = 0.5 + 0.4 * Math.sin(e.age * 3 + e.uid);
  },
};

export default defineRenderers([sardine, seal, orca, whale, gull, crab, turtle, boat] as any);
