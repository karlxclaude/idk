/**
 * Murky pond water: a vignette-lit gradient, three parallax layers of suspended particles that
 * shrink as the camera zooms out, drifting light caustics, and a microscope vignette on top.
 */
import { Container, Sprite, TilingSprite } from 'pixi.js';
import type { Camera } from '../core/camera';
import { bakeTexture, radialStops } from '../core/textures';

interface Particle { ux: number; uy: number; vx: number; vy: number; phase: number; size: number; }
interface Layer { parallax: number; sprites: Sprite[]; parts: Particle[]; alpha: number; tile: number; }

const BASE_ZOOM_RADIUS = 24;

export class Background {
  readonly back = new Container();
  readonly front = new Container();
  private water: Sprite;
  private layers: Layer[] = [];
  private caustics: TilingSprite[] = [];
  private vignette: Sprite;
  private w = 800; private h = 600;

  constructor() {
    const waterTex = bakeTexture('bg:water', 512, (c, w, h) => {
      const lin = c.createLinearGradient(0, 0, 0, h);
      lin.addColorStop(0, '#12352e');
      lin.addColorStop(0.5, '#0d2a26');
      lin.addColorStop(1, '#071a19');
      c.fillStyle = lin; c.fillRect(0, 0, w, h);
      radialStops(c, w, h, [[0, 'rgba(60,120,100,0.35)'], [0.5, 'rgba(30,80,70,0.12)'], [1, 'rgba(0,0,0,0)']], 0.7);
    });
    this.water = new Sprite(waterTex);
    this.back.addChild(this.water);

    const blob = bakeTexture('bg:blob', 64, (c, w, h) => radialStops(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]));
    const speck = bakeTexture('bg:speck', 32, (c, w, h) => radialStops(c, w, h, [[0, 'rgba(255,255,255,1)'], [0.6, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]));
    const defs: Array<[number, number, number, number, number]> = [
      // parallax, count, size px, alpha, tint
      [0.12, 34, 46, 0.05, 0x9fd8c0],
      [0.35, 60, 14, 0.10, 0xb8e0cc],
      [0.7, 90, 4.5, 0.22, 0xd8f0e4],
    ];
    for (const [parallax, count, size, alpha, tint] of defs) {
      const layer: Layer = { parallax, sprites: [], parts: [], alpha, tile: 2000 };
      const cont = new Container();
      for (let i = 0; i < count; i++) {
        const sp = new Sprite(parallax < 0.5 ? blob : speck);
        sp.anchor.set(0.5);
        sp.tint = tint;
        cont.addChild(sp);
        layer.sprites.push(sp);
        layer.parts.push({ ux: Math.random(), uy: Math.random(), vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 2, phase: Math.random() * 6.28, size: size * (0.6 + Math.random() * 0.8) });
      }
      this.back.addChild(cont);
      this.layers.push(layer);
    }

    const causticTex = bakeTexture('bg:caustic', 256, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.lineCap = 'round';
      c.shadowColor = 'rgba(255,255,255,0.9)';
      c.shadowBlur = 14;
      for (let i = 0; i < 30; i++) {
        c.strokeStyle = `rgba(255,255,255,${0.18 + Math.random() * 0.3})`;
        c.lineWidth = 2.5 + Math.random() * 4;
        const x = Math.random() * w, y = Math.random() * h;
        c.beginPath();
        c.moveTo(x, y);
        const x1 = x + (Math.random() - 0.5) * 120, y1 = y + (Math.random() - 0.5) * 120;
        const x2 = x + (Math.random() - 0.5) * 120, y2 = y + (Math.random() - 0.5) * 120;
        c.bezierCurveTo(x1, y1, x2, y2, x + (Math.random() - 0.5) * 160, y + (Math.random() - 0.5) * 160);
        c.stroke();
      }
      // Make the texture tile seamlessly by mirroring edges softly.
      c.globalCompositeOperation = 'destination-in';
      const g = c.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    causticTex.source.addressMode = 'repeat';
    for (let i = 0; i < 2; i++) {
      const ts = new TilingSprite({ texture: causticTex, width: 800, height: 600 });
      ts.blendMode = 'add';
      ts.alpha = i === 0 ? 0.07 : 0.045;
      ts.tint = 0xa8e6c8;
      this.back.addChild(ts);
      this.caustics.push(ts);
    }

    const vigTex = bakeTexture('bg:vignette', 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      radialStops(c, w, h, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [0.8, 'rgba(2,8,7,0.45)'], [1, 'rgba(2,8,7,0.92)']], 0.72);
    });
    this.vignette = new Sprite(vigTex);
    this.front.addChild(this.vignette);
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.water.width = w; this.water.height = h;
    this.vignette.width = w; this.vignette.height = h;
    for (const ts of this.caustics) { ts.width = w; ts.height = h; }
    for (const l of this.layers) l.tile = Math.max(w, h) * 1.4;
  }

  update(cam: Camera, time: number, playerRadius: number) {
    const zoomRef = cam.zoomFor(BASE_ZOOM_RADIUS) / cam.zoomBias;
    const zr = cam.rzoom / zoomRef;
    const w = this.w, h = this.h;
    for (const l of this.layers) {
      const T = l.tile;
      const offX = cam.rx * l.parallax * cam.rzoom, offY = cam.ry * l.parallax * cam.rzoom;
      const sizeScale = Math.min(2.2, Math.max(0.25, Math.pow(zr, 0.35 + 0.5 * l.parallax)));
      const ox = (w - T) / 2, oy = (h - T) / 2;
      for (let i = 0; i < l.sprites.length; i++) {
        const p = l.parts[i], sp = l.sprites[i];
        let x = (p.ux * T + p.vx * time * sizeScale - offX) % T; if (x < 0) x += T;
        let y = (p.uy * T + p.vy * time * sizeScale - offY) % T; if (y < 0) y += T;
        sp.position.set(x + ox, y + oy);
        const s = (p.size * sizeScale) / sp.texture.width;
        sp.scale.set(s);
        sp.alpha = l.alpha * (0.7 + 0.3 * Math.sin(time * 0.6 + p.phase));
      }
    }
    const cs = Math.min(3, Math.max(0.6, Math.pow(zr, 0.4)));
    for (let i = 0; i < this.caustics.length; i++) {
      const ts = this.caustics[i];
      const dir = i === 0 ? 1 : -1;
      ts.tileScale.set(cs * (i === 0 ? 1.6 : 2.3) * (1 + 0.04 * Math.sin(time * 0.3 + i)));
      ts.tilePosition.set(
        -cam.rx * 0.12 * cam.rzoom + time * 9 * dir + Math.sin(time * 0.21 + i) * 30,
        -cam.ry * 0.12 * cam.rzoom + time * 5 + Math.cos(time * 0.17 + i * 2) * 30,
      );
    }
    void playerRadius;
  }
}
