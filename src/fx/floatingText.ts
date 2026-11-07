/** Pooled screen-space floating text ("+0.12", "FUSION x2"). Uses BitmapText for cheap updates. */
import { BitmapFont, BitmapText, Container } from 'pixi.js';
import { Pool } from '../core/pool';

interface FT {
  t: BitmapText;
  wx: number; wy: number; oy: number; life: number; maxLife: number; scale: number;
}

let installed = false;
function installFont() {
  if (installed) return;
  installed = true;
  BitmapFont.install({
    name: 'EHFloat',
    style: { fontFamily: 'Arial, sans-serif', fontSize: 36, fontWeight: 'bold', fill: '#ffffff', stroke: { color: '#000000', width: 5 } },
    chars: [['a', 'z'], ['A', 'Z'], ['0', '9'], ' +-.,!x×%:/\'?'],
    resolution: 1,
  });
}

export interface FloatTextOptions {
  color?: number;
  /** Font size in px. */
  size?: number;
  life?: number;
}

export class FloatingText {
  readonly container = new Container();
  private live: FT[] = [];
  private pool: Pool<FT>;
  max = 40;

  constructor() {
    installFont();
    this.pool = new Pool<FT>(() => {
      const t = new BitmapText({ text: '', style: { fontFamily: 'EHFloat', fontSize: 36 } });
      t.anchor.set(0.5);
      return { t, wx: 0, wy: 0, oy: 0, life: 0, maxLife: 1, scale: 1 };
    });
  }

  /** Spawn at a WORLD position; it is projected through the camera each frame. */
  spawn(wx: number, wy: number, text: string, o: FloatTextOptions = {}) {
    if (this.live.length >= this.max) {
      const old = this.live.shift()!;
      this.container.removeChild(old.t);
      this.pool.release(old);
    }
    const f = this.pool.acquire();
    f.t.text = text;
    f.t.tint = o.color ?? 0xffffff;
    f.wx = wx; f.wy = wy; f.oy = 0;
    f.maxLife = f.life = o.life ?? 0.9;
    f.scale = (o.size ?? 22) / 36;
    this.container.addChild(f.t);
    this.live.push(f);
  }

  update(dt: number, toScreen: (x: number, y: number) => [number, number]) {
    let w = 0;
    for (let i = 0; i < this.live.length; i++) {
      const f = this.live[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.container.removeChild(f.t);
        this.pool.release(f);
        continue;
      }
      const t = 1 - f.life / f.maxLife;
      f.oy -= dt * 60 * (1 - t);
      const [sx, sy] = toScreen(f.wx, f.wy);
      f.t.position.set(sx, sy + f.oy - 10);
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5);
      f.t.scale.set(f.scale * pop);
      f.t.alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      this.live[w++] = f;
    }
    this.live.length = w;
  }

  rebase(dx: number, dy: number) {
    for (const f of this.live) { f.wx -= dx; f.wy -= dy; }
  }

  clear() {
    for (const f of this.live) {
      this.container.removeChild(f.t);
      this.pool.release(f);
    }
    this.live.length = 0;
  }
}
