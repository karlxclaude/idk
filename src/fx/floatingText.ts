/** Pooled screen-space floating text ("+0.12", "FUSION x2"). Uses BitmapText for cheap updates. */
import { BitmapFont, BitmapText, Container } from 'pixi.js';
import { Pool } from '../core/pool';

interface FT {
  t: BitmapText;
  wx: number; wy: number; oy: number; life: number; maxLife: number; scale: number;
  age: number; bump: number; vel: number; drift: number;
  /** Combo accounting (only for mergeable '+N' texts). */
  combo: boolean; value: number; count: number; decimals: number; base: number; color: number; baseSize: number;
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
      return { t, wx: 0, wy: 0, oy: 0, life: 0, maxLife: 1, scale: 1, age: 0, bump: 0, vel: 0, drift: 0, combo: false, value: 0, count: 0, decimals: 0, base: 0, color: 0xffffff, baseSize: 22 };
    });
  }

  private lastCombo: FT | null = null;
  /** Seconds a combo stays open for merging. */
  comboWindow = 0.7;

  private static mix(a: number, b: number, k: number) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return ((ar + (br - ar) * k) << 16) | ((ag + (bg - ag) * k) << 8) | (ab + (bb - ab) * k) | 0;
  }

  private static fmt(v: number, decimals: number) {
    if (decimals > 0) return v.toFixed(Math.min(2, decimals));
    return String(Math.round(v));
  }

  private applyCombo(f: FT) {
    const txt = '+' + FloatingText.fmt(f.value, f.decimals) + (f.count > 1 ? ` ×${f.count}` : '');
    f.t.text = txt;
    const k = Math.min(1, (f.count - 1) / 9);
    // Colour by value: base colour, warming toward gold then white-hot as the combo builds.
    f.t.tint = FloatingText.mix(FloatingText.mix(f.color, 0xffd24a, Math.min(1, k * 1.6)), 0xffffff, Math.max(0, k - 0.6) * 1.2);
    f.scale = (f.baseSize * (1 + Math.min(0.9, Math.log10(1 + f.value) * 0.18 + k * 0.5))) / 36;
  }

  /** Spawn at a WORLD position; it is projected through the camera each frame. */
  spawn(wx: number, wy: number, text: string, o: FloatTextOptions = {}) {
    const m = /^\+(\d+(?:\.(\d+))?)$/.exec(text);
    if (m) {
      const v = parseFloat(m[1]);
      const c = this.lastCombo;
      if (c && c.combo && this.live.includes(c) && c.age - c.base < this.comboWindow) {
        c.value += v;
        c.count++;
        c.decimals = Math.max(c.decimals, m[2] ? m[2].length : 0);
        c.wx += (wx - c.wx) * 0.5; c.wy += (wy - c.wy) * 0.5;
        c.life = c.maxLife * 0.72;
        c.base = c.age;
        c.bump = 1;
        this.applyCombo(c);
        return;
      }
    }
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
    f.age = 0; f.bump = 0; f.vel = 70 + Math.random() * 20; f.drift = (Math.random() - 0.5) * 24;
    f.combo = false; f.count = 1; f.base = 0;
    if (m) {
      f.combo = true;
      f.value = parseFloat(m[1]);
      f.decimals = m[2] ? m[2].length : 0;
      f.color = o.color ?? 0xffffff;
      f.baseSize = o.size ?? 22;
      this.lastCombo = f;
    }
    this.container.addChild(f.t);
    this.live.push(f);
  }

  update(dt: number, toScreen: (x: number, y: number) => [number, number]) {
    let w = 0;
    for (let i = 0; i < this.live.length; i++) {
      const f = this.live[i];
      f.life -= dt;
      f.age += dt;
      if (f.life <= 0) {
        this.container.removeChild(f.t);
        this.pool.release(f);
        if (this.lastCombo === f) this.lastCombo = null;
        continue;
      }
      const t = 1 - f.life / f.maxLife;
      // Float: fast launch that eases out (exponential), plus lateral drift.
      f.vel *= Math.exp(-2.2 * dt);
      f.oy -= f.vel * dt;
      f.bump = Math.max(0, f.bump - dt * 6);
      const [sx, sy] = toScreen(f.wx, f.wy);
      f.t.position.set(sx + f.drift * (1 - Math.exp(-f.age * 3)), sy + f.oy - 10);
      // Pop-in: overshoot-and-settle (easeOutBack-like) over the first 0.16s.
      const u = Math.min(1, f.age / 0.16);
      const back = 1 + 2.2 * Math.pow(u - 1, 3) + 1.2 * Math.pow(u - 1, 2);
      const pop = (0.35 + 0.65 * back) * (1 + f.bump * 0.28);
      f.t.scale.set(f.scale * pop * (t > 0.7 ? 1 - (t - 0.7) * 0.4 : 1));
      f.t.alpha = t > 0.6 ? 1 - Math.pow((t - 0.6) / 0.4, 1.5) : 1;
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
    this.lastCombo = null;
  }
}
