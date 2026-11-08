/**
 * Tier 8 (Stellar) renderers: stars with corona rays, solar systems, pulsars, black holes and flares.
 * All textures are baked once; update() only touches transforms/alphas.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';
import { box } from './t07_common';

const sp = (v: Container, i: number) => v.children[i] as Sprite;

/** Granulated stellar surface with limb darkening (white; tinted by entity colour). */
const starBodyTex = () =>
  bakeTexture('t08:starBody', 256, (c, s) => {
    const m = s / 2;
    const r = new Rng(808);
    c.save();
    c.beginPath(); c.arc(m, m, m - 1.5, 0, 6.3); c.clip();
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f0f0f0'); g.addColorStop(1, '#a8a8a8');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 420; i++) { // convection granules
      const x = r.range(0, s), y = r.range(0, s), rad = r.range(2, 7);
      c.fillStyle = r.chance(0.5) ? `rgba(255,255,255,${r.range(0.1, 0.35)})` : `rgba(120,120,120,${r.range(0.08, 0.25)})`;
      c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fill();
    }
    for (let i = 0; i < 4; i++) { // sunspots
      const x = m + r.range(-0.5, 0.5) * m, y = m + r.range(-0.5, 0.5) * m, rad = r.range(4, 11);
      c.fillStyle = 'rgba(70,40,20,0.5)';
      c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fill();
    }
    c.restore();
  });

/** Radial corona spikes. */
const raysTex = (n: number) =>
  bakeTexture(`t08:rays:${n}`, 256, (c, s) => {
    const m = s / 2;
    const r = new Rng(n * 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + r.range(-0.1, 0.1);
      const len = m * r.range(0.6, 1);
      const w = r.range(0.04, 0.09);
      const g = c.createRadialGradient(m, m, m * 0.2, m, m, len);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(m + Math.cos(a - w) * m * 0.2, m + Math.sin(a - w) * m * 0.2);
      c.lineTo(m + Math.cos(a) * len, m + Math.sin(a) * len);
      c.lineTo(m + Math.cos(a + w) * m * 0.2, m + Math.sin(a + w) * m * 0.2);
      c.fill();
    }
  });

/** Accretion disk with angular streaks (inner radius ~0.34 of texture half-size). */
const diskTex = () =>
  bakeTexture('t08:disk', 512, (c, s) => {
    const m = s / 2;
    const r = new Rng(404);
    const g = c.createRadialGradient(m, m, m * 0.33, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.04, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(m, m, m, 0, 6.3); c.fill();
    c.globalCompositeOperation = 'destination-out'; // streaks of gap and brightness
    for (let i = 0; i < 90; i++) {
      const rad = r.range(0.38, 0.98) * m;
      const a0 = r.range(0, 6.3), da = r.range(0.2, 1.2);
      c.strokeStyle = `rgba(0,0,0,${r.range(0.15, 0.55)})`;
      c.lineWidth = r.range(1, 5);
      c.beginPath(); c.arc(m, m, rad, a0, a0 + da); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 70; i++) {
      const rad = r.range(0.36, 0.9) * m;
      const a0 = r.range(0, 6.3), da = r.range(0.15, 0.9);
      c.strokeStyle = `rgba(255,255,255,${r.range(0.2, 0.7)})`;
      c.lineWidth = r.range(1, 3);
      c.beginPath(); c.arc(m, m, rad, a0, a0 + da); c.stroke();
    }
  });

/** Thin bright photon ring. */
const photonTex = () =>
  bakeTexture('t08:photon', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, m * 0.78, m, m, m * 0.99);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

const beamTex = () =>
  bakeTexture('t08:beam', 256, (c, s) => {
    const m = s / 2;
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, m - 18); c.lineTo(s, m - 3); c.lineTo(s, m + 3); c.lineTo(0, m + 18);
    c.closePath(); c.fill();
    const h = c.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,1)');
    h.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h;
    c.fillRect(0, m - 1.5, s, 3);
  });

const tongueTex = () =>
  bakeTexture('t08:tongue', 256, (c, s) => {
    const m = s / 2;
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, m);
    c.bezierCurveTo(s * 0.3, m - 14, s * 0.7, m - 54, s * 0.98, m - 30);
    c.lineTo(s, m);
    c.lineTo(s * 0.98, m + 30);
    c.bezierCurveTo(s * 0.7, m + 54, s * 0.3, m + 14, 0, m);
    c.fill();
  });

export default defineRenderers([
  {
    /** Star: corona rays + granulated body + hot core. data.charge (0..1) brightens it before a flare. */
    id: 't08_star',
    defaults: { glow: 3.0, glowAlpha: 0.6, rays: 14, rayScale: 3.4 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: p.glowAlpha })); // 0
      v.addChild(box(raysTex(p.rays), p.rayScale, p.rayScale, { add: true, alpha: 0.55 })); // 1
      v.addChild(box(raysTex(p.rays + 5), p.rayScale * 0.8, p.rayScale * 0.8, { add: true, alpha: 0.4 })); // 2
      v.addChild(box(starBodyTex(), 2)); // 3
      v.addChild(sprite(Tex.glow(), 1.5, { add: true, alpha: 0.65 })); // 4
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = e.color;
      sp(v, 4).tint = e.color2;
    },
    update(v, e) {
      v.children[1].rotation = e.age * 0.12;
      v.children[2].rotation = -e.age * 0.08;
      const ch = (e.data.charge as number) ?? 0;
      const pulse = 1 + Math.sin(e.age * 2 + e.uid) * 0.03 + ch * 0.18 * (0.6 + 0.4 * Math.sin(e.age * 22));
      v.children[0].alpha = Math.min(1, 0.6 + ch * 0.4) * pulse;
      v.children[4].alpha = 0.65 + ch * 0.35;
    },
  },
  {
    /** Solar system: star, faint orbit rings and three planets circling in view space. */
    id: 't08_system',
    defaults: { glow: 1.8 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.4 })); // 0
      for (const d of [0.9, 1.42, 1.9]) v.addChild(sprite(Tex.ring(), d, { alpha: 0.25 })); // 1-3
      v.addChild(box(starBodyTex(), 0.5)); // 4
      v.addChild(sprite(Tex.glow(), 0.9, { add: true, alpha: 0.9 })); // 5
      const cols = [0xff9a5a, 0x6bb8ff, 0xe8d0a0];
      for (let i = 0; i < 3; i++) { // 6-8
        const pl = sprite(Tex.orb(), [0.13, 0.17, 0.2][i], { tint: cols[i] });
        v.addChild(pl);
      }
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      for (let i = 1; i <= 3; i++) sp(v, i).tint = e.color2;
      sp(v, 4).tint = e.color;
      sp(v, 5).tint = e.color2;
    },
    update(v, e) {
      const rad = [0.45, 0.71, 0.95], w = [1.7, 1.0, 0.6];
      for (let i = 0; i < 3; i++) {
        const a = e.age * w[i] + e.uid * 1.3 + i * 2.1;
        v.children[6 + i].position.set(Math.cos(a) * rad[i], Math.sin(a) * rad[i]);
      }
    },
  },
  {
    /** Pulsar: tiny neutron star with two sweeping beams (entity rotation = beam angle) and expanding pulses. */
    id: 't08_pulsar',
    defaults: { beam: 4.5 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 5.5, { add: true, alpha: 0.5 })); // 0
      for (const sgn of [1, -1]) { // 1,2
        const b = box(beamTex(), p.beam, p.beam * 0.5, { add: true, alpha: 0.85 });
        b.anchor.set(0, 0.5);
        b.scale.x = Math.abs(b.scale.x) * sgn;
        v.addChild(b);
      }
      v.addChild(sprite(Tex.ring(), 1, { add: true, alpha: 0.5 })); // 3
      v.addChild(sprite(Tex.ring(), 1, { add: true, alpha: 0.5 })); // 4
      v.addChild(sprite(Tex.orb(), 1.1)); // 5
      v.addChild(sprite(Tex.glow(), 2.2, { add: true, alpha: 0.95 })); // 6
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color2;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = e.color;
      sp(v, 4).tint = e.color;
      sp(v, 5).tint = 0xffffff;
      sp(v, 6).tint = e.color2;
    },
    update(v, e) {
      for (let i = 0; i < 2; i++) {
        const t = (e.age * 0.7 + i * 0.5) % 1;
        const s = 1.4 + t * 5;
        v.children[3 + i].width = v.children[3 + i].height = s;
        v.children[3 + i].alpha = (1 - t) * 0.55;
      }
      v.children[6].alpha = 0.7 + 0.3 * Math.sin(e.age * 18);
    },
  },
  {
    /** Black hole: black core, photon ring, lens halo and a rotating tilted accretion disk. */
    id: 't08_blackhole',
    defaults: { glow: 3.4, tilt: 0.32 },
    create(_a, p) {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 2 * p.glow, { add: true, alpha: 0.4 })); // 0 lens halo
      const wrap = new Container(); // 1 squashed disk plane
      wrap.scale.y = p.tilt;
      const d1 = box(diskTex(), 4.4, 4.4, { add: true, alpha: 0.95 });
      const d2 = box(diskTex(), 3.2, 3.2, { add: true, alpha: 0.9 });
      wrap.addChild(d1, d2);
      v.addChild(wrap);
      v.addChild(sprite(Tex.disc(), 1.34, { tint: 0x000000 })); // 2 shadow
      v.addChild(box(photonTex(), 2.0, 2.0, { add: true, alpha: 0.9 })); // 3 photon ring
      // lensed copy of the far side of the disk arching over/under the shadow
      const lens = new Container(); // 4
      lens.scale.x = 0.62;
      lens.addChild(box(photonTex(), 3.0, 3.0, { add: true, alpha: 0.4 }));
      v.addChild(lens);
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      const wrap = v.children[1] as Container;
      (wrap.children[0] as Sprite).tint = e.color;
      (wrap.children[1] as Sprite).tint = e.color2;
      sp(v, 3).tint = e.color2;
      ((v.children[4] as Container).children[0] as Sprite).tint = e.color;
    },
    update(v, e, _p, _c, dt) {
      const wrap = v.children[1] as Container;
      wrap.children[0].rotation += dt * 0.35;
      wrap.children[1].rotation -= dt * 0.8;
      // keep the disk plane fixed on screen regardless of entity rotation
      v.children[1].rotation = -v.rotation + 0.35;
      v.children[4].rotation = -v.rotation + 0.35 + Math.PI / 2;
      v.children[0].alpha = 0.35 + 0.08 * Math.sin(e.age * 1.3);
    },
  },
  {
    /** Solar flare: a writhing plasma tongue that flies head-first (+x). */
    id: 't08_flare',
    defaults: {},
    create() {
      const v = new Container();
      v.addChild(sprite(Tex.glow(), 3.4, { add: true, alpha: 0.6 })); // 0
      const t1 = box(tongueTex(), 5, 2.4, { add: true, alpha: 0.9 }); // 1
      t1.anchor.set(1, 0.5);
      t1.position.set(0.6, 0);
      const t2 = box(tongueTex(), 3.6, 1.4, { add: true, alpha: 0.95 }); // 2
      t2.anchor.set(1, 0.5);
      t2.position.set(0.5, 0);
      v.addChild(t1, t2);
      v.addChild(sprite(Tex.glow(), 1.5, { add: true, alpha: 1 })); // 3
      return v;
    },
    reset(v, e) {
      sp(v, 0).tint = e.color;
      sp(v, 1).tint = e.color;
      sp(v, 2).tint = e.color2;
      sp(v, 3).tint = 0xffffff;
    },
    update(v, e) {
      v.children[1].skew.y = Math.sin(e.age * 11 + e.uid) * 0.28;
      v.children[2].skew.y = -Math.sin(e.age * 13 + e.uid) * 0.35;
    },
  },
]);
