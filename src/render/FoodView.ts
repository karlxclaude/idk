/** Food sprites (pooled) from baked textures, plus the vacuole rings around food being digested. */
import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { Camera } from '../core/camera';
import { bakeTexture } from '../core/textures';
import type { Food, FoodKind } from '../sim/Food';
import type { World } from '../sim/World';

const NOMINAL = 48; // texture diameter in px that maps to radius*2

function bacteriaTex(v: number): Texture {
  return bakeTexture(`food:bact${v}`, 64, (c, s) => {
    c.translate(s / 2, s / 2);
    c.lineCap = 'round';
    const grad = c.createLinearGradient(0, -8, 0, 8);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(190,190,205,0.9)');
    c.strokeStyle = grad;
    c.lineWidth = 15;
    c.beginPath();
    if (v === 0) { c.moveTo(-18, 0); c.lineTo(18, 0); }
    else if (v === 1) { c.moveTo(-18, 5); c.quadraticCurveTo(0, -12, 18, 5); }
    else { c.lineWidth = 12; c.moveTo(-20, 0); c.lineTo(-20.1, 0); c.moveTo(-6, 0); c.lineTo(-6.1, 0); c.moveTo(8, 0); c.lineTo(8.1, 0); c.moveTo(21, 0); c.lineTo(21.1, 0); }
    c.stroke();
    // membrane edge
    c.strokeStyle = 'rgba(120,120,140,0.5)';
    c.lineWidth = 1.5;
    c.stroke();
  });
}
function algaeTex(v: number): Texture {
  return bakeTexture(`food:alga${v}`, 64, (c, s) => {
    c.translate(s / 2, s / 2);
    const ball = (x: number, y: number, r: number) => {
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.7, 'rgba(200,210,190,0.9)');
      g.addColorStop(1, 'rgba(120,130,110,0.85)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(60,80,50,0.45)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + Math.cos(i * 1.7) * r * 0.45, y + Math.sin(i * 1.7) * r * 0.45, r * 0.14, 0, Math.PI * 2); c.fill(); }
    };
    if (v === 0) { ball(-8, -6, 11); ball(9, -4, 10); ball(0, 9, 11); ball(10, 10, 7); }
    else if (v === 1) { ball(0, 0, 22); c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 22, 0, Math.PI * 2); c.stroke(); }
    else {
      // diatom: striped elongated shell
      c.fillStyle = 'rgba(230,240,225,0.9)';
      c.beginPath(); c.ellipse(0, 0, 26, 11, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(90,110,80,0.6)'; c.lineWidth = 1.5;
      for (let x = -20; x <= 20; x += 5) { c.beginPath(); c.moveTo(x, -9 * Math.sqrt(1 - (x / 26) ** 2)); c.lineTo(x, 9 * Math.sqrt(1 - (x / 26) ** 2)); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(0, 0, 26, 11, 0, 0, Math.PI * 2); c.stroke();
    }
  });
}
function debrisTex(v: number): Texture {
  return bakeTexture(`food:debris${v}`, 64, (c, s) => {
    c.translate(s / 2, s / 2);
    const pts = 7 + v * 2;
    c.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = 14 + ((i * 7 + v * 3) % 5) * 3 - (i % 2) * 4;
      const x = Math.cos(a) * r * (v === 1 ? 1.5 : 1), y = Math.sin(a) * r * (v === 2 ? 0.7 : 1);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
    c.fillStyle = 'rgba(235,225,210,0.9)';
    c.fill();
    c.strokeStyle = 'rgba(120,100,80,0.7)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(90,70,50,0.4)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(Math.cos(i * 2.3) * 8, Math.sin(i * 2.3) * 7, 2 + (i % 3), 0, Math.PI * 2); c.fill(); }
  });
}

export class FoodView {
  readonly container = new Container();
  private vacuoles = new Graphics();
  private sprites: Sprite[] = [];
  private owners: (Food | null)[] = [];
  private free: number[] = [];
  private frame = 0;
  private lastSeen: number[] = [];
  private tex: Record<FoodKind, Texture[]> = {
    bacteria: [bacteriaTex(0), bacteriaTex(1), bacteriaTex(2)],
    algae: [algaeTex(0), algaeTex(1), algaeTex(2)],
    debris: [debrisTex(0), debrisTex(1), debrisTex(2)],
  };

  constructor() {
    this.container.addChild(this.vacuoles);
  }

  private acquire(f: Food): number {
    let i = this.free.pop();
    if (i === undefined) {
      i = this.sprites.length;
      const sp = new Sprite();
      sp.anchor.set(0.5);
      this.sprites.push(sp);
      this.owners.push(null);
      this.lastSeen.push(0);
      this.container.addChild(sp);
    }
    const sp = this.sprites[i];
    sp.texture = this.tex[f.kind][f.variant % 3];
    sp.tint = f.tint;
    sp.visible = true;
    this.owners[i] = f;
    f.viewId = i;
    return i;
  }

  update(world: World, cam: Camera, time: number) {
    this.frame++;
    const zoom = cam.rzoom;
    const cullR = cam.viewRadius * 1.2;
    const vg = this.vacuoles;
    vg.clear();
    for (const f of world.food) {
      if (f.state === 'dead') continue;
      const d2 = (f.x - cam.rx) ** 2 + (f.y - cam.ry) ** 2;
      if (d2 > cullR * cullR) continue;
      let i = f.viewId;
      if (i < 0 || this.owners[i] !== f) i = this.acquire(f);
      this.lastSeen[i] = this.frame;
      const sp = this.sprites[i];
      const s = (f.radius * 2 * f.scale) / NOMINAL;
      sp.position.set(f.x, f.y);
      sp.alpha = f.alpha * (f.kind === 'debris' ? 0.85 : 0.95);
      if (f.kind === 'bacteria') {
        sp.rotation = f.angle + Math.sin(time * 9 + f.phase) * 0.12;
        sp.scale.set(s * (1 + 0.05 * Math.sin(time * 7 + f.phase)), s * (1 - 0.05 * Math.sin(time * 7 + f.phase)));
      } else {
        sp.rotation = f.angle;
        sp.scale.set(s);
      }
      if (f.state !== 'free' && f.captor) {
        // Vacuole forming around the food inside the cell.
        const grow = f.state === 'captured' ? f.progress : 1;
        const r = f.radius * (1.25 + 0.35 * grow) * (f.state === 'digesting' ? 1 - 0.4 * f.progress : 1);
        vg.circle(f.x, f.y, r);
        const a = f.state === 'captured' ? grow : 1 - f.progress * f.progress;
        vg.fill({ color: 0xffffff, alpha: 0.12 * a });
        vg.stroke({ width: Math.max(0.8 / zoom, f.radius * 0.1), color: f.captor.cfg.membrane, alpha: 0.4 * a });
      }
    }
    for (let i = 0; i < this.sprites.length; i++) {
      if (this.owners[i] && this.lastSeen[i] !== this.frame) {
        this.sprites[i].visible = false;
        if (this.owners[i]!.viewId === i) this.owners[i]!.viewId = -1;
        this.owners[i] = null;
        this.free.push(i);
      }
    }
  }
}
