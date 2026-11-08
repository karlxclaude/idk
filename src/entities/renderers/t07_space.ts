/**
 * Tier 7 (Planetary) renderers, also reused by tiers 8-9 (planets, comets).
 * Everything is baked once; update() only touches sprite transforms.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';
import { box, planetBodyTex, planetDetailTex, planetShadeTex, rimTex, ringTex, type PlanetKind } from './t07_common';

const satTex = () =>
  bakeTexture('t07:sat', 256, (c, s) => {
    const m = s / 2;
    // solar panels
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? 8 : s - 8 - 84;
      const g = c.createLinearGradient(x0, 0, x0 + 84, 0);
      g.addColorStop(0, '#1a3a8a'); g.addColorStop(1, '#4a8aff');
      c.fillStyle = g;
      c.fillRect(x0, m - 30, 84, 60);
      c.strokeStyle = 'rgba(200,230,255,0.7)';
      c.lineWidth = 2;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x0 + i * 21, m - 30); c.lineTo(x0 + i * 21, m + 30); c.stroke(); }
      c.beginPath(); c.moveTo(x0, m); c.lineTo(x0 + 84, m); c.stroke();
      c.strokeRect(x0, m - 30, 84, 60);
    }
    c.fillStyle = '#9a9aa6'; // truss
    c.fillRect(m - 44, m - 4, 88, 8);
    const b = c.createLinearGradient(m - 26, m - 26, m + 26, m + 26);
    b.addColorStop(0, '#fff3b0'); b.addColorStop(0.5, '#d8b050'); b.addColorStop(1, '#7a5a20');
    c.fillStyle = b;
    c.beginPath(); c.roundRect(m - 26, m - 26, 52, 52, 6); c.fill();
    c.strokeStyle = '#4a3a10'; c.lineWidth = 2;
    c.strokeRect(m - 20, m - 20, 40, 40);
    c.fillStyle = '#e8e8f0'; // dish
    c.beginPath(); c.ellipse(m, m - 40, 20, 10, 0, 0, 6.3); c.fill();
    c.strokeStyle = '#e8e8f0'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(m, m - 26); c.lineTo(m, m - 40); c.stroke();
  });

const shardTex = (i: number) =>
  bakeTexture(`t07:shard:${i}`, 128, (c, s) => {
    const r = new Rng(i * 41 + 7);
    const m = s / 2;
    c.fillStyle = '#fff';
    c.beginPath();
    const n = 5 + (i % 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.283 + r.range(-0.3, 0.3);
      const rr = m * r.range(0.35, 0.95);
      c.lineTo(m + Math.cos(a) * rr * (i % 2 ? 1 : 1.2), m + Math.sin(a) * rr * (i % 2 ? 1 : 0.55));
    }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.moveTo(m, m); c.lineTo(m + r.range(-30, 30), m + 40); c.lineTo(m - 30, m + r.range(0, 30)); c.fill();
  });

const rockTex = (i: number) =>
  bakeTexture(`t07:rock:${i}`, 256, (c, s) => {
    const r = new Rng(i * 59 + 11);
    const m = s / 2;
    const ph = [r.range(0, 6.3), r.range(0, 6.3), r.range(0, 6.3), r.range(0, 6.3)];
    const outline = (k: number) => {
      const a = (k / 64) * 6.2832;
      const rad = 0.82 + 0.08 * Math.sin(a * 2 + ph[0]) + 0.06 * Math.sin(a * 3 + ph[1]) + 0.04 * Math.sin(a * 5 + ph[2]) + 0.03 * Math.sin(a * 9 + ph[3]);
      return [m + Math.cos(a) * rad * (m - 4) * (1 + 0.12 * (i % 2)), m + Math.sin(a) * rad * (m - 4) * (1 - 0.1 * (i % 2))];
    };
    c.save();
    c.beginPath();
    for (let k = 0; k <= 64; k++) { const [x, y] = outline(k); if (k === 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.closePath();
    c.clip();
    const g = c.createRadialGradient(s * 0.36, s * 0.34, 4, m, m, m);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#b4b4b4'); g.addColorStop(1, '#4a4a4a');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    for (let k = 0; k < 16; k++) {
      const x = r.range(30, s - 30), y = r.range(30, s - 30), rad = r.range(5, 24);
      c.fillStyle = `rgba(40,40,40,${r.range(0.2, 0.45)})`;
      c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 2;
      c.beginPath(); c.arc(x - 1.5, y - 1.5, rad, Math.PI * 0.95, Math.PI * 1.85); c.stroke();
    }
    c.restore();
  });

const tailTex = (dust: boolean) =>
  bakeTexture(`t07:tail:${dust}`, 256, (c, s) => {
    const m = s / 2;
    const g = c.createLinearGradient(s, 0, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    if (dust) { // fat curved dust tail
      c.moveTo(s, m);
      c.bezierCurveTo(s * 0.6, m - 10, s * 0.3, m + 20, 0, m + 70);
      c.lineTo(0, m + 10);
      c.bezierCurveTo(s * 0.3, m - 30, s * 0.6, m + 6, s, m);
    } else { // thin straight ion tail
      c.moveTo(s, m - 5); c.lineTo(0, m - 1.5); c.lineTo(0, m + 1.5); c.lineTo(s, m + 5);
    }
    c.closePath(); c.fill();
  });

/** Sprite of a swappable texture, indexable for per-entity variation. */
const sp = (v: Container, i: number) => v.children[i] as Sprite;

export default defineRenderers([
  {
    /** Satellite with solar panels and a blinking beacon. */
    id: 't07_satellite',
    defaults: { glow: 1.8 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.28 }));
      v.addChild(box(satTex(), 2.3));
      const blink = sprite(Tex.glow(), 0.6, { add: true });
      blink.position.set(0, -0.2);
      v.addChild(blink);
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 2).tint = e.color2;
    },
    update(v, e) {
      sp(v, 2).alpha = Math.max(0, Math.sin(e.age * 3 + e.uid)) ** 3;
    },
  },
  {
    /** Space junk: tumbling metal shards. */
    id: 't07_debris',
    defaults: { glow: 1.6 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.18 }));
      v.addChild(box(shardTex(0), 2.1));
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color2;
      const s = sp(v, 1);
      s.texture = shardTex(e.uid % 4);
      s.tint = e.color;
    },
  },
  {
    /** Lumpy cratered rock. */
    id: 't07_asteroid',
    defaults: { glow: 1.5, glowAlpha: 0.12 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha }));
      v.addChild(box(rockTex(0), 2.2));
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color2;
      const s = sp(v, 1);
      s.texture = rockTex(e.uid % 5);
      s.tint = e.color;
    },
  },
  {
    /** Comet: bright nucleus, ion + dust tails trailing behind (-x). Pair with faceVelocity. */
    id: 't07_comet',
    defaults: { glow: 2.6, tail: 4.2 },
    create(_a, p) {
      const v = new Container();
      const dust = box(tailTex(true), p.tail, p.tail, { add: true, alpha: 0.55 });
      dust.anchor.set(1, 0.5);
      dust.position.set(0.2, 0);
      const ion = box(tailTex(false), p.tail * 1.3, p.tail * 1.3, { add: true, alpha: 0.8 });
      ion.anchor.set(1, 0.5);
      ion.position.set(0.2, 0);
      v.addChild(dust, ion);
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.6 }));
      v.addChild(sprite(Tex.orb(), 1.3));
      v.addChild(sprite(Tex.glow(), 1.1, { add: true, alpha: 0.9 }));
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color2;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color;
      sp(v, 3).tint = 0xdfe8f0;
      sp(v, 4).tint = e.color;
    },
    update(v, e) {
      v.children[1].alpha = 0.7 + 0.2 * Math.sin(e.age * 9 + e.uid);
      v.children[0].alpha = 0.5 + 0.12 * Math.sin(e.age * 4 + e.uid * 2);
    },
  },
  {
    /**
     * Planet / moon. params.kind: rocky|gas|ice|lava|moon, params.ring: draw a ring system.
     * Terminator shading is counter-rotated so the light always comes from the upper-left.
     */
    id: 't07_planet',
    defaults: { kind: 'rocky' as PlanetKind, ring: false, glow: 1.7, glowAlpha: 0.35 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow * (p.ring ? 1.4 : 1), { add: true, alpha: p.glowAlpha })); // 0
      const rb = box(ringTex(false), 4.6, 4.6, { alpha: 0.85 }); // 1
      rb.visible = !!p.ring;
      v.addChild(rb);
      v.addChild(box(planetBodyTex(p.kind, 0), 2)); // 2
      v.addChild(box(planetDetailTex(p.kind, 0), 2, 2, { alpha: p.kind === 'moon' ? 0 : 0.6 })); // 3
      v.addChild(box(planetShadeTex(), 2)); // 4
      if (p.kind !== 'moon') v.addChild(box(rimTex(), 2.35, 2.35, { add: true, alpha: 0.8 })); // 5
      else v.addChild(new Sprite());
      const rf = box(ringTex(true), 4.6, 4.6, { alpha: 0.9 }); // 6
      rf.visible = !!p.ring;
      v.addChild(rf);
      return v;
    },
    reset(v, e, p) {
      const seed = e.uid % 3;
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color2;
      sp(v, 2).texture = planetBodyTex(p.kind, seed);
      sp(v, 2).tint = e.color;
      sp(v, 3).texture = planetDetailTex(p.kind, seed);
      sp(v, 3).tint = e.color2;
      sp(v, 5).tint = e.color2;
      sp(v, 6).tint = e.color2;
    },
    update(v) {
      // keep the sun direction fixed on screen regardless of entity rotation
      v.children[4].rotation = -v.rotation;
    },
  },
]);
