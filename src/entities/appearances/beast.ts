/** Land beast (suggested for tiers 5-6): furry mane, stomping paws, horns, glowing eyes, snapping jaw. */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import { spikyTexture } from '../renderers/core';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, bakeUnits, rimTex, sprite } from './_kit';

const hornTex = () =>
  bakeUnits('app:beast:horn', 128, 1.6, (c) => {
    const g = c.createLinearGradient(0, 0, 0.7, -0.6);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-0.1, 0.08);
    c.quadraticCurveTo(0.35, 0.05, 0.7, -0.62);
    c.quadraticCurveTo(0.3, -0.25, -0.1, -0.1);
    c.closePath();
    c.fill();
  });
const tailTex = () =>
  bakeUnits('app:beast:tail', 128, 1.8, (c) => {
    const g = c.createLinearGradient(0, 0, -0.85, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0.2)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -0.14);
    c.quadraticCurveTo(-0.5, -0.1, -0.88, 0.0);
    c.quadraticCurveTo(-0.5, 0.1, 0, 0.14);
    c.fill();
  });
const jawTex = () =>
  bakeUnits('app:beast:jaw', 128, 1.6, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0.2, 0);
    c.quadraticCurveTo(0.5, -0.3, 0.78, -0.22);
    c.lineTo(0.78, 0.22);
    c.quadraticCurveTo(0.5, 0.3, 0.2, 0);
    c.fill();
    c.fillStyle = '#ddd';
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(0.78, i * 0.085 - 0.04);
      c.lineTo(0.62, i * 0.085);
      c.lineTo(0.78, i * 0.085 + 0.04);
      c.fill();
    }
  });

const beast: PlayerAppearanceDef = {
  id: 'beast',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(Tex.glow(), 5, { add: true, alpha: 0.4, tint: pal.playerGlow });
    const mane = R.tinted(sprite(spikyTexture(16, 0.22), 2.7, { alpha: 0.9 }), pal.accent);
    const tail = new Sprite(tailTex());
    tail.anchor.set(0.5);
    tail.width = tail.height = 1.8;
    tail.position.set(-1.0, 0);
    R.tinted(tail, pal.player);
    const paws: Sprite[] = [];
    for (const [x, y] of [[0.5, -0.78], [0.5, 0.78], [-0.45, -0.8], [-0.45, 0.8]]) {
      const pw = R.tinted(sprite(Tex.orb(), 0.5), pal.accent);
      pw.position.set(x, y);
      paws.push(pw);
    }
    const body = R.tinted(sprite(Tex.orb(), 2.0), pal.player);
    body.scale.x *= 1.1;
    const fur = sprite(Tex.glow(), 1.9, { add: true, alpha: 0.35, tint: pal.playerGlow });
    const rim = sprite(rimTex(), 2.3, { add: true, alpha: 0.9, tint: pal.playerGlow });
    const jaw = sprite(jawTex(), 1.6, { alpha: 0 });
    jaw.position.set(0.55, 0);
    jaw.tint = 0x14040a;
    const head = R.tinted(sprite(Tex.orb(), 1.05), pal.player);
    head.position.set(0.72, 0);
    const horns = [-1, 1].map((s) => {
      const h = sprite(hornTex(), 1.0, { tint: 0xfff0d0 });
      h.position.set(0.55, s * 0.32);
      if (s > 0) h.scale.y *= -1;
      return h;
    });
    const eyes = [-1, 1].map((s) => {
      const e = sprite(Tex.glow(), 0.32, { add: true, alpha: 1, tint: pal.accent });
      e.position.set(0.98, s * 0.2);
      return e;
    });
    const eyeCore = eyes.map((e) => {
      const d = sprite(Tex.dot(), 0.1, { add: true });
      d.position.copyFrom(e.position);
      return d;
    });
    const snout = sprite(Tex.glow(), 0.7, { add: true, alpha: 0.4, tint: pal.playerGlow });
    snout.position.set(1.1, 0);
    view.addChild(halo, mane, tail, ...paws, body, fur, rim, jaw, head, ...horns, ...eyes, ...eyeCore, snout);
    R.attach(view, pal.playerGlow, 2.6);
    let open = 0;
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash, sp = R.speed;
        halo.alpha = 0.35 + f * 0.5;
        mane.rotation = Math.sin(t * 1.5) * 0.04 + t * 0.05;
        const gait = t * (3 + sp * 9);
        paws.forEach((pw, i) => {
          const ph = Math.sin(gait + (i === 1 || i === 2 ? Math.PI : 0));
          pw.x = [0.5, 0.5, -0.45, -0.45][i] + ph * (0.12 + sp * 0.22);
        });
        tail.rotation = Math.sin(t * (2.5 + sp * 5)) * 0.3;
        tail.position.set(-1.0, 0);
        const target = Math.max(R.eat, 0.02);
        open += (target - open) * Math.min(1, dt * 16);
        jaw.alpha = Math.min(1, open * 3);
        jaw.height = Math.max(0.001, 1.6 * open);
        head.position.x = 0.72 + R.eat * 0.1;
        eyes.forEach((e, i) => {
          e.alpha = 0.8 + Math.sin(t * 3 + i) * 0.1 + f * 0.2;
          e.width = e.height = 0.32 + f * 0.2;
        });
        body.scale.y = body.scale.x / 1.1 * (1 + Math.sin(t * 2) * 0.02);
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default beast;
