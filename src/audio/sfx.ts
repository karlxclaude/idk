/** All one-shot sound effects, synthesized. Rate-limited and voice-capped. */
import { type Bus, clamp, hashStr, midiToFreq, noise, tone, voices } from './synth';

const VOICE_SOFT_CAP = 28; // low-priority sfx are dropped above this
const VOICE_HARD_CAP = 56; // everything but critical is dropped above this

export class Sfx {
  private last = new Map<string, number>();
  /** Midi notes of the current tier's key, spanning several octaves (for snapping/chimes). */
  private notes: number[] = [];
  private combo = 0;
  private lastEat = 0;

  constructor(private bus: Bus) {}

  setKey(rootPc: number, scale: number[]) {
    const out: number[] = [];
    for (let oct = 2; oct <= 8; oct++) for (const s of scale) out.push(12 * (oct + 1) + rootPc + s);
    this.notes = out.sort((a, b) => a - b);
  }

  private get out() {
    return this.bus.sfx;
  }
  private get now() {
    return this.bus.ctx.currentTime;
  }

  /** Returns false when this sound should be dropped. prio: 0 low, 1 normal, 2 critical. */
  private gate(key: string, minMs: number, prio = 1): boolean {
    if (voices.count > VOICE_HARD_CAP && prio < 2) return false;
    if (voices.count > VOICE_SOFT_CAP && prio < 1) return false;
    const t = performance.now();
    const l = this.last.get(key) ?? -1e9;
    if (t - l < minMs) return false;
    this.last.set(key, t);
    return true;
  }

  private snap(freq: number): number {
    if (!this.notes.length) return freq;
    const m = 69 + 12 * Math.log2(freq / 440);
    let best = this.notes[0];
    for (const n of this.notes) if (Math.abs(n - m) < Math.abs(best - m)) best = n;
    return midiToFreq(best);
  }

  /** Scale-degree note by index from the middle of the table. */
  private chimeNote(i: number, octUp = 0): number {
    if (!this.notes.length) return 660 * Math.pow(2, i / 7);
    const base = Math.floor(this.notes.length * 0.45);
    return midiToFreq(this.notes[clamp(base + i, 0, this.notes.length - 1)]) * Math.pow(2, octUp);
  }

  // ── gameplay ──
  eat(sizeRatio: number) {
    if (!this.gate('eat', 22, 0)) return;
    const r = clamp(sizeRatio, 0.02, 1.2);
    const nowMs = performance.now();
    this.combo = nowMs - this.lastEat < 450 ? Math.min(this.combo + 1, 6) : 0;
    this.lastEat = nowMs;
    // bigger prey = deeper; fast chains climb in pitch
    const f = this.snap((1500 - 1050 * Math.min(1, r)) * (1 + 0.07 * this.combo));
    const t = this.now;
    const o = this.out;
    tone(this.bus, o, { type: 'sine', f: f * 1.6, f2: f, dur: 0.08 + 0.12 * r, gain: 0.2, counted: true });
    tone(this.bus, o, { type: 'triangle', f: f * 2, f2: f * 1.5, dur: 0.05, gain: 0.07, counted: true });
    noise(this.bus, o, { dur: 0.02, gain: 0.08, filter: 'highpass', f: 3500, counted: true });
    if (r > 0.5) this.crunch(r, t);
  }

  private crunch(r: number, t = this.now) {
    const o = this.out;
    const g = 0.14 + 0.2 * r;
    for (let i = 0; i < 3; i++) {
      noise(this.bus, o, {
        t: t + i * 0.034 + Math.random() * 0.01,
        dur: 0.07 + 0.03 * r,
        gain: g * (1 - i * 0.2),
        filter: 'bandpass',
        f: 2200 - i * 500,
        f2: 600,
        q: 1.4,
        counted: true,
      });
    }
    tone(this.bus, o, { type: 'sine', f: 140, f2: 48, dur: 0.2, gain: 0.3 * r, counted: true });
  }

  bump(sizeRatio: number) {
    if (!this.gate('bump', 90, 0)) return;
    const f = 120 + 90 * (1 - clamp(sizeRatio, 0, 1));
    tone(this.bus, this.out, { type: 'sine', f, f2: f * 0.6, dur: 0.1, gain: 0.18, counted: true });
    noise(this.bus, this.out, { dur: 0.04, gain: 0.07, filter: 'lowpass', f: 800, counted: true });
  }

  hurt(massLost = 0) {
    if (!this.gate('hurt', 120, 2)) return;
    const g = clamp(0.25 + massLost * 0.002, 0.25, 0.45);
    tone(this.bus, this.out, { type: 'sawtooth', f: 260, f2: 55, dur: 0.32, gain: g, lp: 1800, lp2: 150, counted: true });
    tone(this.bus, this.out, { type: 'square', f: 90, f2: 40, dur: 0.22, gain: 0.15, lp: 400, counted: true });
    noise(this.bus, this.out, { dur: 0.18, gain: 0.22, filter: 'bandpass', f: 1400, f2: 300, q: 0.8, counted: true });
  }

  death() {
    if (!this.gate('death', 400, 2)) return;
    const t = this.now;
    const o = this.out;
    tone(this.bus, o, { type: 'sawtooth', f: 440, f2: 35, dur: 1.3, gain: 0.3, lp: 3000, lp2: 90 });
    tone(this.bus, o, { type: 'sine', f: 110, f2: 24, t, dur: 1.5, gain: 0.5 });
    noise(this.bus, o, { dur: 0.9, gain: 0.3, filter: 'lowpass', f: 3000, f2: 120, q: 0.7 });
    for (let i = 0; i < 4; i++) {
      tone(this.bus, o, { type: 'triangle', f: 600 - i * 120, f2: 200, t: t + 0.1 + i * 0.1, dur: 0.25, gain: 0.08 });
    }
  }

  respawn() {
    if (!this.gate('respawn', 400, 2)) return;
    const t = this.now;
    for (let i = 0; i < 5; i++) {
      const f = this.chimeNote(i * 2 - 2);
      tone(this.bus, this.out, { type: 'triangle', f, t: t + i * 0.07, dur: 0.5, gain: 0.13, attack: 0.01 });
      tone(this.bus, this.out, { type: 'sine', f: f * 2, t: t + i * 0.07, dur: 0.35, gain: 0.05 });
    }
    noise(this.bus, this.out, { t, dur: 0.4, gain: 0.08, filter: 'bandpass', f: 400, f2: 5000, q: 2, attack: 0.1 });
  }

  dash() {
    if (!this.gate('dash', 120, 1)) return;
    noise(this.bus, this.out, { dur: 0.3, gain: 0.28, filter: 'bandpass', f: 500, f2: 4200, q: 2.5, attack: 0.07, counted: true });
    tone(this.bus, this.out, { type: 'sine', f: 180, f2: 520, dur: 0.22, gain: 0.1, counted: true });
  }

  ability(id: string) {
    if (id === 'dash') return this.dash();
    if (!this.gate('ability:' + id, 120, 1)) return;
    const h = hashStr(id);
    const f = this.chimeNote((h % 6) - 2);
    const t = this.now;
    tone(this.bus, this.out, { type: 'sawtooth', f: f * 0.5, f2: f * 2, dur: 0.35, gain: 0.12, lp: 2500, lp2: 700, counted: true });
    tone(this.bus, this.out, { type: 'triangle', f, f2: f * 1.5, t: t + 0.05, dur: 0.4, gain: 0.12, counted: true });
    noise(this.bus, this.out, { dur: 0.25, gain: 0.1, filter: 'highpass', f: 2000, f2: 6000, attack: 0.05, counted: true });
  }

  essence(delta: number) {
    if (delta <= 0 || !this.gate('essence', 60, 0)) return;
    const big = clamp(Math.log10(delta + 1) / 2, 0, 1);
    const i = Math.floor(Math.random() * 3) + Math.round(big * 3);
    const f = this.chimeNote(i, 1);
    const t = this.now;
    tone(this.bus, this.out, { type: 'sine', f, dur: 0.6, gain: 0.1 + 0.06 * big, attack: 0.005, counted: true });
    tone(this.bus, this.out, { type: 'sine', f: f * 1.5, t: t + 0.06, dur: 0.7, gain: 0.07, counted: true });
    tone(this.bus, this.out, { type: 'sine', f: f * 3.01, t: t + 0.02, dur: 0.25, gain: 0.025, counted: true });
  }

  mechanic(mech: string, kind: string, value?: number) {
    if (!this.gate('mech:' + mech + kind, 50, 0)) return;
    const h = hashStr(mech + ':' + kind);
    const f = this.chimeNote((h % 8) - 3);
    const v = clamp(value === undefined ? 1 : Math.abs(value), 0.3, 1.5);
    const k = kind.toLowerCase();
    const o = this.out;
    if (/strip|break|shatter|pop|burst|explo|crack|snap|split|ionize|zap|hit/.test(k)) {
      tone(this.bus, o, { type: 'triangle', f: f * 1.5, f2: f * 0.7, dur: 0.14, gain: 0.12 * v, counted: true });
      noise(this.bus, o, { dur: 0.08, gain: 0.12 * v, filter: 'bandpass', f: 3000, f2: 900, q: 1.5, counted: true });
    } else if (/fuse|merge|absorb|gather|charge|collect|grow|bond|link|form/.test(k)) {
      tone(this.bus, o, { type: 'sine', f: f * 0.7, f2: f * 1.4, dur: 0.25, gain: 0.12 * v, counted: true });
      tone(this.bus, o, { type: 'sine', f: f * 1.4, f2: f * 2.1, dur: 0.2, gain: 0.05 * v, counted: true });
    } else {
      tone(this.bus, o, { type: 'sine', f, f2: f * 1.02, dur: 0.22, gain: 0.1 * v, counted: true });
      tone(this.bus, o, { type: 'triangle', f: f * 2, dur: 0.12, gain: 0.04 * v, counted: true });
    }
  }

  // ── scale shift ──
  /** Riser before the shift. Length ~ the shift's first half. */
  riser(dur = 1.8) {
    const t = this.now;
    const o = this.out;
    noise(this.bus, o, { t, dur, gain: 0.34, filter: 'bandpass', f: 150, f2: 7000, q: 1.8, attack: dur * 0.9 });
    tone(this.bus, o, { type: 'sawtooth', f: 55, f2: 440, t, dur, gain: 0.16, lp: 300, lp2: 4000, attack: dur * 0.9 });
    tone(this.bus, o, { type: 'sine', f: 220, f2: 1760, t, dur, gain: 0.1, attack: dur * 0.9 });
  }

  /** Bass "whoomp" at the shift's midpoint (the moment the world flips). */
  whoomp() {
    const t = this.now;
    const o = this.out;
    tone(this.bus, o, { type: 'sine', f: 140, f2: 26, t, dur: 1.6, gain: 0.7, attack: 0.01 });
    tone(this.bus, o, { type: 'sawtooth', f: 220, f2: 30, t, dur: 1.4, gain: 0.3, lp: 2000, lp2: 90, attack: 0.02 });
    noise(this.bus, o, { t, dur: 1.2, gain: 0.35, filter: 'lowpass', f: 2500, f2: 80, q: 0.8, attack: 0.005 });
    tone(this.bus, o, { type: 'sine', f: 2200, f2: 300, t, dur: 0.5, gain: 0.06 });
  }

  /** Title-card shimmer: a glassy cascade up the new key. */
  shimmer() {
    const t = this.now;
    for (let i = 0; i < 7; i++) {
      const f = this.chimeNote(i * 2 - 4, 1);
      tone(this.bus, this.out, { type: 'sine', f, t: t + i * 0.09, dur: 1.4, gain: 0.07, attack: 0.02 });
      tone(this.bus, this.out, { type: 'triangle', f: f * 2.01, t: t + i * 0.09 + 0.03, dur: 0.9, gain: 0.025, attack: 0.02 });
    }
  }

  ngPlus() {
    this.whoomp();
    this.shimmer();
  }

  // ── UI ──
  click() {
    if (!this.gate('click', 40, 1)) return;
    tone(this.bus, this.out, { type: 'triangle', f: 900, f2: 600, dur: 0.05, gain: 0.12, counted: true });
    noise(this.bus, this.out, { dur: 0.015, gain: 0.05, filter: 'highpass', f: 4000, counted: true });
  }

  pauseToggle(paused: boolean) {
    if (!this.gate('pause', 100, 1)) return;
    const a = paused ? 700 : 450;
    const b = paused ? 350 : 800;
    tone(this.bus, this.out, { type: 'sine', f: a, f2: b, dur: 0.16, gain: 0.12, counted: true });
  }
}
