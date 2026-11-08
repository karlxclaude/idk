/**
 * Tier 9 (Galactic) renderers: star clusters, drifting nebulae, spiral / elliptical / dwarf galaxies and quasars.
 * Black holes reuse the 't08_blackhole' renderer. Everything is baked once.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';
import { box, puffTex } from './t07_common';

const sp = (v: Container, i: number) => v.children[i] as Sprite;

const dot = (c: CanvasRenderingContext2D, x: number, y: number, rad: number, a: number) => {
  const g = c.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `rgba(255,255,255,${a})`);
  g.addColorStop(0.4, `rgba(255,255,255,${a * 0.35})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
};

/** A swarm of stars, dense in the middle (globular-ish). */
const clusterTex = (seed: number) =>
  bakeTexture(`t09:cluster:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 71 + 1);
    const m = s / 2;
    for (let i = 0; i < 260; i++) {
      const a = r.range(0, 6.283), d = Math.pow(r.next(), 1.7) * m * 0.92;
      dot(c, m + Math.cos(a) * d, m + Math.sin(a) * d, r.range(2, 6) * (r.chance(0.06) ? 2.2 : 1), r.range(0.5, 1));
    }
    dot(c, m, m, m * 0.35, 0.5);
  });

/** Spiral arms: stars strewn along logarithmic spirals (white, tinted later). */
const armsTex = (seed: number, arms: number, bar: boolean) =>
  bakeTexture(`t09:arms:${seed}:${arms}:${bar}`, 512, (c, s) => {
    const r = new Rng(seed * 53 + 7);
    const m = s / 2;
    const n = 2800;
    for (let i = 0; i < 380; i++) { // soft haze following the arms
      const arm = i % arms, t = Math.pow(r.next(), 0.8), rad = (0.1 + t * 0.88) * m;
      const a = (arm / arms) * 6.283 + t * 3.6 + r.range(-0.3, 0.3);
      dot(c, m + Math.cos(a) * rad, m + Math.sin(a) * rad, r.range(16, 34), 0.1);
    }
    for (let i = 0; i < n; i++) {
      const arm = i % arms;
      const t = Math.pow(r.next(), 0.8); // 0 centre .. 1 rim
      const rad = (0.1 + t * 0.88) * m;
      const wind = 3.6;
      const a = (arm / arms) * 6.283 + t * wind + r.range(-1, 1) * (0.28 - 0.12 * t) * (1 + (1 - t) * 0.5);
      const x = m + Math.cos(a) * rad, y = m + Math.sin(a) * rad;
      dot(c, x, y, r.range(2.2, 6.5) * (1 - t * 0.3), r.range(0.2, 0.9) * (1 - t * 0.4) + 0.12);
      if (r.chance(0.06)) dot(c, x, y, r.range(5, 12), 0.28); // HII clumps
    }
    if (bar) for (let i = 0; i < 160; i++) {
      const u = r.range(-1, 1), a = 0.5;
      dot(c, m + Math.cos(a) * u * m * 0.34 + r.range(-4, 4), m + Math.sin(a) * u * m * 0.34 + r.range(-4, 4), r.range(2, 6), 0.6);
    }
  });

/** Dark dust lanes along the arms (drawn as transparent-black strokes, normal blend). */
const dustTex = (seed: number) =>
  bakeTexture(`t09:dust:${seed}`, 512, (c, s) => {
    const r = new Rng(seed * 19 + 4);
    const m = s / 2;
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.lineCap = 'round';
    for (let arm = 0; arm < 2; arm++) {
      c.lineWidth = 7;
      c.beginPath();
      for (let k = 0; k <= 80; k++) {
        const t = k / 80;
        const rad = (0.14 + t * 0.78) * m;
        const a = arm * Math.PI + t * 3.6 + 0.35;
        const x = m + Math.cos(a) * rad + Math.sin(k * 1.7) * 3, y = m + Math.sin(a) * rad + Math.cos(k * 1.3) * 3;
        if (k === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    void r;
  });

const ellipticalTex = () =>
  bakeTexture('t09:ell', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    const r = new Rng(91);
    for (let i = 0; i < 130; i++) {
      const a = r.range(0, 6.283), d = Math.pow(r.next(), 1.4) * m * 0.8;
      dot(c, m + Math.cos(a) * d, m + Math.sin(a) * d, r.range(1.5, 3.5), r.range(0.2, 0.6));
    }
  });

const dwarfTex = (seed: number) =>
  bakeTexture(`t09:dwarf:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 33 + 2);
    const m = s / 2;
    for (let b = 0; b < 5; b++) { // irregular clumps
      const bx = m + r.range(-0.35, 0.35) * m, by = m + r.range(-0.35, 0.35) * m;
      for (let i = 0; i < 60; i++) {
        const a = r.range(0, 6.283), d = Math.pow(r.next(), 1.3) * m * 0.38;
        dot(c, bx + Math.cos(a) * d, by + Math.sin(a) * d, r.range(1.5, 4.5), r.range(0.3, 0.9));
      }
      dot(c, bx, by, m * 0.3, 0.18);
    }
  });

const jetTex = () =>
  bakeTexture('t09:jet', 256, (c, s) => {
    const m = s / 2;
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, m - 10); c.lineTo(s, m - 34); c.lineTo(s, m + 34); c.lineTo(0, m + 10);
    c.closePath(); c.fill();
    for (let i = 0; i < 6; i++) { // knots
      const x = s * (0.15 + i * 0.14);
      dot(c, x, m, 20 - i * 2, 0.7);
    }
  });

const quasarDiskTex = () =>
  bakeTexture('t09:qdisk', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, m * 0.2, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

export default defineRenderers([
  {
    /** Star cluster: a counter-rotating pair of star swarms in a hazy halo. */
    id: 't09_cluster',
    defaults: { glow: 2.2, glowAlpha: 0.4 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha })); // 0
      v.addChild(box(clusterTex(1), 2.1, 2.1, { add: true })); // 1
      v.addChild(box(clusterTex(2), 1.7, 1.7, { add: true, alpha: 0.8 })); // 2
      v.addChild(sprite(Tex.glow(), 0.9, { add: true, alpha: 0.7 })); // 3
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = e.color2;
    },
    update(v, e) {
      v.children[1].rotation = e.age * 0.15;
      v.children[2].rotation = -e.age * 0.22;
      v.children[3].alpha = 0.55 + 0.2 * Math.sin(e.age * 1.7 + e.uid);
    },
  },
  {
    /** Nebula: layered gas puffs drifting against each other, with embedded young stars. */
    id: 't09_nebula',
    defaults: { glow: 2.0 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.28 })); // 0
      v.addChild(box(puffTex(1), 2.6, 2.6, { alpha: 0.75 })); // 1
      v.addChild(box(puffTex(2), 2.2, 2.2, { add: true, alpha: 0.7 })); // 2
      v.addChild(box(puffTex(3), 1.7, 1.7, { add: true, alpha: 0.8 })); // 3
      for (let i = 0; i < 3; i++) v.addChild(sprite(Tex.glow(), 0.28, { add: true, alpha: 0.9 })); // 4-6
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = e.color;
      for (let i = 4; i < 7; i++) sp(v, i).tint = 0xffffff;
    },
    update(v, e) {
      const t = e.age * 0.25 + e.uid;
      v.children[1].rotation = t * 0.3;
      v.children[2].rotation = -t * 0.45;
      v.children[3].rotation = t * 0.7;
      for (let i = 0; i < 3; i++) {
        const a = t * (0.6 + i * 0.3) + i * 2.1;
        v.children[4 + i].position.set(Math.cos(a) * 0.4, Math.sin(a * 1.3) * 0.35);
        v.children[4 + i].alpha = 0.5 + 0.5 * Math.sin(e.age * 2.5 + i * 2 + e.uid);
      }
    },
  },
  {
    /**
     * Galaxy. params.kind: spiral | barred | elliptical | dwarf. Tilt is randomised per entity.
     * Layout: halo glow, tilted plane container [haze, arms/body, dust], bright core.
     */
    id: 't09_galaxy',
    defaults: { kind: 'spiral', glow: 2.0, arms: 2 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.35 })); // 0 halo
      const plane = new Container(); // 1
      if (p.kind === 'elliptical') {
        plane.addChild(box(ellipticalTex(), 2.3, 2.3, { add: true, alpha: 0.95 }));
        plane.addChild(box(ellipticalTex(), 1.4, 1.4, { add: true, alpha: 0.7 }));
        plane.addChild(new Sprite());
      } else if (p.kind === 'dwarf') {
        plane.addChild(box(dwarfTex(1), 2.2, 2.2, { add: true, alpha: 0.9 }));
        plane.addChild(box(dwarfTex(2), 1.6, 1.6, { add: true, alpha: 0.8 }));
        plane.addChild(new Sprite());
      } else {
        const bar = p.kind === 'barred';
        plane.addChild(sprite(Tex.glow(), 2.3, { add: true, alpha: 0.6 }));
        plane.addChild(box(armsTex(1, p.arms, bar), 2.25, 2.25, { add: true, alpha: 0.95 }));
        plane.addChild(box(dustTex(1), 2.25, 2.25, { alpha: 0.9 }));
        plane.addChild(box(ellipticalTex(), 1.2, 1.2, { add: true, alpha: 0.85 })); // bulge
      }
      v.addChild(plane);
      v.addChild(sprite(Tex.glow(), p.kind === 'dwarf' ? 0.5 : 0.95, { add: true, alpha: 0.95 })); // 2 core
      v.addChild(sprite(Tex.glow(), 0.4, { add: true, alpha: 0.9, tint: 0xffffff })); // 3 nucleus
      return v;
    },
    reset(v, e, p) {
      const plane = v.children[1] as Container;
      plane.scale.y = p.kind === 'dwarf' ? 0.85 : 0.5 + (e.uid % 5) * 0.1;
      plane.rotation = e.uid * 0.9;
      sp(v, 0).tint = e.color;
      (plane.children[0] as Sprite).tint = e.color;
      (plane.children[1] as Sprite).tint = p.kind === 'elliptical' ? e.color2 : e.color2;
      (plane.children[2] as Sprite).tint = 0x1a0830;
      if (plane.children[3]) (plane.children[3] as Sprite).tint = e.color2;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = 0xfff6e0;
    },
    update(v, e, p) {
      const plane = v.children[1] as Container;
      if (p.kind === 'spiral' || p.kind === 'barred') {
        plane.children[1].rotation = e.age * 0.12;
        plane.children[2].rotation = e.age * 0.12;
      } else if (p.kind === 'dwarf') {
        plane.children[1].rotation = -e.age * 0.2;
      }
      v.children[0].alpha = 0.3 + 0.05 * Math.sin(e.age * 0.8 + e.uid);
    },
  },
  {
    /** Quasar: blazing core, tilted hot disk and two relativistic jets along entity rotation. */
    id: 't09_quasar',
    defaults: { jet: 4.2 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 6, { add: true, alpha: 0.55 })); // 0
      for (const sgn of [1, -1]) { // 1,2 jets
        const j = box(jetTex(), p.jet, p.jet * 0.5, { add: true, alpha: 0.8 });
        j.anchor.set(0, 0.5);
        j.scale.x = Math.abs(j.scale.x) * sgn;
        v.addChild(j);
      }
      const disk = new Container(); // 3
      disk.rotation = Math.PI / 2;
      disk.scale.x = 0.35;
      disk.addChild(box(quasarDiskTex(), 3, 3, { add: true, alpha: 0.9 }));
      v.addChild(disk);
      v.addChild(sprite(Tex.glow(), 1.8, { add: true, alpha: 1 })); // 4
      v.addChild(sprite(Tex.disc(), 0.45, { tint: 0xffffff })); // 5
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color;
      ((v.children[3] as Container).children[0] as Sprite).tint = e.color2;
      sp(v, 4).tint = e.color2;
    },
    update(v, e) {
      const f = 0.65 + 0.2 * Math.sin(e.age * 7 + e.uid) + 0.1 * Math.sin(e.age * 17);
      v.children[1].alpha = f;
      v.children[2].alpha = 0.85 - 0.15 * Math.sin(e.age * 6);
      v.children[4].alpha = 0.8 + 0.2 * Math.sin(e.age * 11);
    },
  },
]);
