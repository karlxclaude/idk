/**
 * Tiers 4+: bioluminescent deep-sea creature. Faces its velocity (+x is forward), swishing tail,
 * flapping fins, jaws that open when eating, and an anglerfish lure glowing on a stalk.
 */
import { Container, Sprite } from 'pixi.js';
import { Tex } from '../../core/textures';
import type { PlayerAppearanceDef } from '../appearance';
import { Reactor, bakeUnits, sprite } from './_kit';

function bodyPath(c: CanvasRenderingContext2D, k = 1) {
  c.beginPath();
  c.moveTo(1.05, 0);
  c.bezierCurveTo(0.9, -0.62 * k, 0.3, -0.8 * k, -0.3, -0.56 * k);
  c.bezierCurveTo(-0.7, -0.4 * k, -0.95, -0.2, -1.05, -0.12);
  c.lineTo(-1.05, 0.12);
  c.bezierCurveTo(-0.95, 0.2, -0.7, 0.4 * k, -0.3, 0.56 * k);
  c.bezierCurveTo(0.3, 0.8 * k, 0.9, 0.62 * k, 1.05, 0);
  c.closePath();
}

const bodyTex = () =>
  bakeUnits('app:cr:body', 512, 2.6, (c) => {
    bodyPath(c);
    const g = c.createLinearGradient(0, -0.8, 0, 0.8);
    g.addColorStop(0, 'rgba(150,150,150,1)');
    g.addColorStop(0.55, 'rgba(235,235,235,1)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    // scale-ish ridges
    c.strokeStyle = 'rgba(0,0,0,0.12)';
    c.lineWidth = 0.02;
    for (let i = -6; i < 8; i++) {
      c.beginPath();
      c.arc(-0.2 + i * 0.16, 0, 0.5, -1.2, 1.2);
      c.stroke();
    }
    const d = c.createLinearGradient(0, -0.8, 0, 0.1);
    d.addColorStop(0, 'rgba(0,0,20,0.5)');
    d.addColorStop(1, 'rgba(0,0,20,0)');
    c.fillStyle = d;
    c.fillRect(-1.2, -0.9, 2.4, 1);
    c.restore();
  });
const rimTexBody = () =>
  bakeUnits('app:cr:rim', 512, 2.6, (c) => {
    bodyPath(c);
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 0.05;
    c.shadowColor = 'white';
    c.shadowBlur = 14;
    c.stroke();
  });
const glowBody = () =>
  bakeUnits('app:cr:glow', 256, 4, (c) => {
    c.save();
    c.scale(1.6, 1.05);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 1.2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(-2, -2, 4, 4);
    c.restore();
  });
/** Forked tail, base at origin pointing to -x. */
const tailTex = () =>
  bakeUnits('app:cr:tail', 256, 2.4, (c) => {
    const g = c.createLinearGradient(0, 0, -1.1, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0.15)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0.05, -0.12);
    c.bezierCurveTo(-0.5, -0.2, -0.8, -0.5, -1.15, -0.62);
    c.bezierCurveTo(-1.0, -0.25, -0.95, -0.1, -0.85, 0);
    c.bezierCurveTo(-0.95, 0.1, -1.0, 0.25, -1.15, 0.62);
    c.bezierCurveTo(-0.8, 0.5, -0.5, 0.2, 0.05, 0.12);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.8)';
    c.lineWidth = 0.02;
    for (let i = -3; i <= 3; i++) {
      c.beginPath();
      c.moveTo(-0.1, i * 0.03);
      c.lineTo(-1.05, i * 0.17);
      c.stroke();
    }
  });
/** Swept fin, base at origin pointing to -x and +y (mirror with scale.y = -1). */
const finTex = () =>
  bakeUnits('app:cr:fin', 256, 2, (c) => {
    const g = c.createLinearGradient(0, 0, -0.6, 0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0.1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0.25, 0);
    c.quadraticCurveTo(0.05, 0.55, -0.7, 0.9);
    c.quadraticCurveTo(-0.55, 0.4, -0.35, 0.05);
    c.closePath();
    c.fill();
  });
const stalkTex = () =>
  bakeUnits('app:cr:stalk', 256, 2.4, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 0.04;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(0.2, -0.75, 0.95, -0.7);
    c.stroke();
  });
const jawTex = () =>
  bakeUnits('app:cr:jaw', 256, 2.6, (c) => {
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0.45, 0);
    c.quadraticCurveTo(0.85, -0.3, 1.12, -0.28);
    c.quadraticCurveTo(1.1, 0, 1.12, 0.28);
    c.quadraticCurveTo(0.85, 0.3, 0.45, 0);
    c.fill();
  });

const creature: PlayerAppearanceDef = {
  id: 'creature',
  create(tier) {
    const pal = tier.palette;
    const view = new Container();
    const R = new Reactor();
    const halo = sprite(glowBody(), 4, { add: true, alpha: 0.6, tint: pal.playerGlow });
    const tail = new Sprite(tailTex());
    tail.anchor.set(0.5);
    tail.width = tail.height = 2.4;
    tail.position.set(-0.95, 0);
    tail.blendMode = 'normal';
    R.tinted(tail, pal.player);
    const tailGlow = sprite(tailTex(), 2.4, { add: true, alpha: 0.35, tint: pal.playerGlow });
    tailGlow.position.copyFrom(tail.position);
    const fins: Sprite[] = [];
    const mkFin = (x: number, y: number, flip: number) => {
      const f = sprite(finTex(), 1.1, { alpha: 0.9 });
      f.position.set(x, y);
      f.scale.y *= flip;
      R.tinted(f, pal.accent);
      fins.push(f);
      return f;
    };
    const finT = mkFin(0.05, -0.5, -1), finB = mkFin(0.05, 0.5, 1), finTop = mkFin(-0.45, -0.45, -1);
    finTop.scale.set(finTop.scale.x * 0.8, finTop.scale.y * 0.8);
    const body = R.tinted(sprite(bodyTex(), 2.6), pal.player);
    // bioluminescent spots along the belly + flank
    const spots: Sprite[] = [];
    for (let i = 0; i < 8; i++) {
      const s = sprite(Tex.glow(), 0.22, { add: true, alpha: 0.9, tint: pal.accent });
      s.position.set(0.7 - i * 0.18, 0.3 + Math.sin(i * 0.5) * 0.06 - i * 0.012);
      spots.push(s);
    }
    const rim = sprite(rimTexBody(), 2.6, { add: true, alpha: 0.9, tint: pal.playerGlow });
    const mouth = sprite(jawTex(), 2.6, { alpha: 0 });
    mouth.tint = 0x050010;
    const mouthGlow = sprite(Tex.glow(), 0.9, { add: true, alpha: 0, tint: pal.accent });
    mouthGlow.position.set(0.85, 0);
    const eyeG = sprite(Tex.glow(), 0.5, { add: true, alpha: 0.8, tint: pal.accent });
    eyeG.position.set(0.55, -0.2);
    const eye = sprite(Tex.disc(), 0.22, { tint: 0xffffff });
    eye.position.copyFrom(eyeG.position);
    const pupil = sprite(Tex.disc(), 0.11, { tint: 0x05030a });
    pupil.position.set(eye.x + 0.03, eye.y);
    // lure
    const lure = new Container();
    lure.position.set(0.5, -0.5);
    const stalk = sprite(stalkTex(), 2.4, { alpha: 0.9, tint: pal.player });
    const bulbHalo = sprite(Tex.glow(), 1.8, { add: true, alpha: 0.8, tint: pal.accent });
    const bulb = sprite(Tex.glow(), 0.5, { add: true, alpha: 1 });
    bulb.position.set(0.95, -0.7);
    bulbHalo.position.copyFrom(bulb.position);
    lure.addChild(stalk, bulbHalo, bulb);
    view.addChild(halo, tail, tailGlow, finTop, finT, finB, body, ...spots, rim, mouth, mouthGlow, eyeG, eye, pupil, lure);
    R.attach(view, pal.playerGlow, 2.5);
    let open = 0;
    return {
      view,
      update(p, ctx, dt) {
        R.step(p, ctx, dt);
        const t = R.t, f = R.flash, sp = R.speed;
        halo.alpha = 0.5 + f * 0.45 + Math.sin(t * 2) * 0.06;
        // swim: tail & fins
        const rate = 4 + sp * 8 + R.dash * 6;
        const sw = Math.sin(t * rate);
        tail.rotation = tailGlow.rotation = sw * (0.22 + sp * 0.2);
        tail.scale.y = tailGlow.scale.y = 1 + Math.sin(t * rate * 0.5) * 0.04;
        finT.rotation = Math.sin(t * rate * 0.7) * 0.25;
        finB.rotation = -Math.sin(t * rate * 0.7 + 0.5) * 0.25;
        finTop.rotation = Math.sin(t * rate * 0.9 + 1) * 0.15;
        // mouth opens on eat, idle slight breathing
        const target = Math.max(R.eat, 0.04 + 0.04 * Math.sin(t * 2.5));
        open += (target - open) * Math.min(1, dt * 18);
        mouth.alpha = Math.min(1, open * 3);
        mouth.height = Math.max(0.001, 2.6 * Math.min(1, open * 1.4));
        mouthGlow.alpha = open * 0.9;
        mouthGlow.width = mouthGlow.height = 0.9 * (0.6 + open);
        // lure sway + pulse
        lure.rotation = Math.sin(t * 1.7) * 0.12 + Math.sin(t * rate * 0.5) * 0.05 * sp;
        const pulse = 0.65 + Math.sin(t * 3.1) * 0.25 + f * 0.4;
        bulb.alpha = Math.min(1, pulse + 0.2);
        bulbHalo.alpha = pulse;
        bulbHalo.width = bulbHalo.height = 1.8 + Math.sin(t * 3.1) * 0.3 + f * 0.8;
        spots.forEach((s, i) => (s.alpha = 0.45 + 0.55 * Math.max(0, Math.sin(t * 3 - i * 0.7)) + f * 0.3));
        pupil.x = eye.x + 0.03 + sp * 0.02;
      },
      onEat: (r) => R.onEat(r),
      onHurt() { R.flash = 0; },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default creature;
