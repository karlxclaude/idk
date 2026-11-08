/**
 * Tier 10 (Cosmic Web) renderers: galaxies, groups, clusters, quasars, superclusters and voids.
 * All art is baked once into shared canvas textures; update() only touches sprite transforms.
 */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import { Rng, TAU } from '../../core/math';
import { defineRenderers } from '../define';
import { sprite } from './core';
import type { Entity } from '../Entity';

const gauss = (r: Rng) => (r.next() + r.next() + r.next() + r.next() - 2) * 1.2;

function spiralTex(seed: number) {
  return bakeTexture(`t10:spiral:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 77 + 3);
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(m, m, 0, m, m, m * 0.95);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    const arms = 2 + (seed % 2);
    const wind = 3.4 + r.range(0, 1.6);
    for (let a = 0; a < arms; a++) {
      for (let i = 0; i < 520; i++) {
        const t = Math.pow(r.next(), 0.75);
        const ang = (a / arms) * TAU + t * wind + gauss(r) * (0.1 + 0.2 * t);
        const rad = (0.1 + t * 0.85) * m;
        const x = m + Math.cos(ang) * rad, y = m + Math.sin(ang) * rad;
        const sz = 0.7 + r.next() * 1.9;
        c.fillStyle = `rgba(255,255,255,${(0.25 + 0.6 * (1 - t) * r.next()).toFixed(3)})`;
        c.beginPath(); c.arc(x, y, sz, 0, TAU); c.fill();
      }
      // diffuse arm glow
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const ang = (a / arms) * TAU + t * wind;
        const rad = (0.1 + t * 0.85) * m;
        const x = m + Math.cos(ang) * rad, y = m + Math.sin(ang) * rad;
        g = c.createRadialGradient(x, y, 0, x, y, 14 + 10 * t);
        g.addColorStop(0, `rgba(255,255,255,${0.14 * (1 - t * 0.6)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x - 30, y - 30, 60, 60);
      }
    }
  });
}

const ellipticalTex = () =>
  bakeTexture('t10:ell', 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.4)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** A swarm of tiny galaxies in a gaussian cloud over a hot-gas haze. */
function swarmTex(key: string, seed: number, n: number, spread: number, gas: number, big: number) {
  return bakeTexture(key, 256, (c, s) => {
    const r = new Rng(seed);
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, `rgba(255,255,255,${gas})`);
    g.addColorStop(0.5, `rgba(255,255,255,${gas * 0.4})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) {
      let x = m + gauss(r) * m * spread, y = m + gauss(r) * m * spread;
      const d = Math.hypot(x - m, y - m);
      if (d > m * 0.9) { x = m + (x - m) * 0.5; y = m + (y - m) * 0.5; }
      const rad = (i === 0 ? big * 1.8 : big) * r.range(0.5, 1.2);
      const rot = r.angle();
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.scale(1, r.range(0.35, 1));
      g = c.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(-rad, -rad, rad * 2, rad * 2);
      c.restore();
    }
  });
}

/** A lumpy supercluster: heavy nodes tied by bright filaments with galaxy dust along them. */
const superTex = (seed: number) =>
  bakeTexture(`t10:super:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 31 + 9);
    const m = s / 2;
    c.globalCompositeOperation = 'lighter';
    const nodes: [number, number, number][] = [[m, m, 1]];
    const k = 6 + (seed % 3);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + r.range(-0.3, 0.3), d = m * r.range(0.35, 0.72);
      nodes.push([m + Math.cos(a) * d, m + Math.sin(a) * d, r.range(0.4, 0.8)]);
    }
    const halo = c.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, 'rgba(255,255,255,0.3)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, s, s);
    c.lineCap = 'round';
    const link = (a: number[], b: number[]) => {
      const mx = (a[0] + b[0]) / 2 + r.range(-12, 12), my = (a[1] + b[1]) / 2 + r.range(-12, 12);
      for (const [w, al] of [[7, 0.1], [2.4, 0.5]] as const) {
        c.strokeStyle = `rgba(255,255,255,${al})`;
        c.lineWidth = w;
        c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mx, my, b[0], b[1]); c.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const t = r.next();
        const x = (1 - t) * (1 - t) * a[0] + 2 * t * (1 - t) * mx + t * t * b[0] + gauss(r) * 3;
        const y = (1 - t) * (1 - t) * a[1] + 2 * t * (1 - t) * my + t * t * b[1] + gauss(r) * 3;
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.beginPath(); c.arc(x, y, r.range(0.6, 1.5), 0, TAU); c.fill();
      }
    };
    for (let i = 1; i < nodes.length; i++) {
      link(nodes[0], nodes[i]);
      if (i > 1 && r.chance(0.7)) link(nodes[i - 1], nodes[i]);
    }
    for (const [x, y, w] of nodes) {
      const rad = 22 * w + 6;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });

const jetTex = () =>
  bakeTexture('t10:jet', 128, (c, s) => {
    // vertical beam: bright at the centre, fading to both ends and sides
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.globalCompositeOperation = 'destination-in';
    const h = c.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,0)');
    h.addColorStop(0.5, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h;
    c.fillRect(0, 0, s, s);
  });

const voidTex = () =>
  bakeTexture('t10:void', 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.97)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

const dashRingTex = () =>
  bakeTexture('t10:dashRing', 256, (c, s) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.lineCap = 'round';
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 6, a, a + (TAU / n) * 0.55);
      c.stroke();
    }
  });

function add(tex: Texture, d: number, alpha: number): Sprite {
  return sprite(tex, d, { add: true, alpha });
}

export default defineRenderers([
  {
    /** Spiral or elliptical galaxy. params.kind: 'spiral' | 'elliptical'. */
    id: 'galaxy',
    defaults: { kind: 'spiral', glow: 2.4, glowAlpha: 0.4 },
    create(arch, p) {
      const v = new Container();
      v.addChild(add(Tex.glow(), 2 * p.glow, p.glowAlpha));
      v.addChild(add(p.kind === 'spiral' ? spiralTex(1) : ellipticalTex(), 2.3, 1));
      v.addChild(add(Tex.glow(), 1.0, 0.85));
      return v;
    },
    reset(v, e, p) {
      const body = v.children[1] as Sprite;
      if (p.kind === 'spiral') {
        body.texture = spiralTex((e.uid % 3) + 1);
        body.scale.y = body.scale.x * (0.45 + ((e.uid * 7) % 10) / 10 * 0.55);
      } else {
        body.scale.y = body.scale.x * (0.6 + ((e.uid * 7) % 10) / 10 * 0.4);
      }
      (v.children[0] as Sprite).tint = e.color;
      body.tint = e.color;
      (v.children[2] as Sprite).tint = e.color2;
    },
  },
  {
    /** Swarm of galaxies: groups (few, bigger) and clusters (many, hot gas halo). */
    id: 'galaxySwarm',
    defaults: { n: 8, spread: 0.45, gas: 0.25, big: 16, glow: 2.3, glowAlpha: 0.4, seed: 1 },
    create(arch, p) {
      const v = new Container();
      v.addChild(add(Tex.glow(), 2 * p.glow, p.glowAlpha));
      v.addChild(add(swarmTex(`t10:swarm:${p.seed}:${p.n}`, p.seed * 101, p.n, p.spread, p.gas, p.big), 2.3, 1));
      v.addChild(add(Tex.glow(), 0.9, 0.5));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color2;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[2] as Sprite).tint = 0xffffff;
    },
  },
  {
    /** Quasar: blazing core, accretion ring and two long jets. Jets spin with the entity. */
    id: 'quasar',
    defaults: { glow: 3.2, glowAlpha: 0.6 },
    create(arch, p) {
      const v = new Container();
      v.addChild(add(Tex.glow(), 2 * p.glow, p.glowAlpha));
      const jets = new Container();
      const j1 = sprite(jetTex(), 1, { add: true, alpha: 0.8 });
      j1.width = 0.5; j1.height = 6.4;
      const j2 = sprite(jetTex(), 1, { add: true, alpha: 0.35 });
      j2.width = 1.2; j2.height = 6.4;
      jets.addChild(j2, j1);
      v.addChild(jets);
      const disc = add(Tex.ring(), 2.3, 0.9);
      disc.scale.y *= 0.35;
      v.addChild(disc);
      v.addChild(add(Tex.glow(), 1.7, 1));
      v.addChild(add(Tex.glow(), 0.8, 1));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      const jets = v.children[1] as Container;
      (jets.children[0] as Sprite).tint = e.color;
      (jets.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color2;
      (v.children[3] as Sprite).tint = e.color2;
      (v.children[4] as Sprite).tint = 0xffffff;
    },
    update(v, e, p, ctx, dt) {
      const t = ctx.tierTime;
      (v.children[4] as Sprite).alpha = 0.8 + 0.2 * Math.sin(t * 7 + e.uid);
    },
  },
  {
    /** Supercluster predator: a bright knotted lattice ringed by slowly turning dashes. */
    id: 'supercluster',
    defaults: { glow: 2.8, glowAlpha: 0.5 },
    create(arch, p) {
      const v = new Container();
      v.addChild(add(Tex.glow(), 2 * p.glow, p.glowAlpha));
      v.addChild(add(superTex(1), 2.3, 1));
      v.addChild(add(dashRingTex(), 2.35, 0.8));
      v.addChild(add(Tex.glow(), 1.3, 0.55));
      return v;
    },
    reset(v, e) {
      (v.children[1] as Sprite).texture = superTex((e.uid % 3) + 1);
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color2;
      (v.children[2] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color;
    },
    update(v, e, p, ctx, dt) {
      (v.children[2] as Sprite).rotation -= dt * 0.9;
      (v.children[1] as Sprite).rotation += dt * 0.08;
    },
  },
  {
    /** Cosmic void: a dark bubble with a faint luminous skin that swallows the web behind it. */
    id: 'void',
    defaults: { rim: 0.5 },
    create() {
      const v = new Container();
      v.addChild(add(Tex.ring(), 2.1, 0.55));
      v.addChild(add(Tex.ring(), 2.5, 0.2));
      const dark = sprite(voidTex(), 2.2);
      dark.tint = 0x000004;
      v.addChild(dark);
      v.addChild(add(Tex.glow(), 3.4, 0.25));
      return v;
    },
    reset(v, e) {
      (v.children[0] as Sprite).tint = e.color;
      (v.children[1] as Sprite).tint = e.color;
      (v.children[3] as Sprite).tint = e.color2;
    },
    update(v, e, p, ctx) {
      const t = ctx.tierTime + e.uid;
      (v.children[1] as Sprite).scale.set(1 + Math.sin(t * 0.9) * 0.04);
    },
  },
]);
