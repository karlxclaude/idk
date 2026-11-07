/**
 * PLACEHOLDER AUDIO. OWNED BY THE AUDIO AGENT (package a): replace with procedural SFX +
 * adaptive layered music driven by TierConfig.music. Subscribe to events only.
 */
import { events } from '../core/events';
import type { Settings } from '../core/state';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  constructor(private settings: Settings) {}

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.masterVolume * this.settings.sfxVolume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  init() {
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    events.on('settingsChanged', ({ settings }) => {
      this.settings = settings;
      if (this.master) this.master.gain.value = settings.masterVolume * settings.sfxVolume;
    });
    events.on('scaleShiftStart', () => this.whoomp());
    events.on('scaleShiftMid', () => this.boom());
    events.on('eat', (e) => this.blip(220 + (1 - e.sizeRatio) * 660, 0.05 + e.sizeRatio * 0.08));
    events.on('hurt', () => this.blip(90, 0.25, 'sawtooth'));
  }

  private blip(freq: number, dur: number, type: OscillatorType = 'sine') {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, c.currentTime + dur);
    g.gain.setValueAtTime(0.15, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(m);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  /** Bass sweep for the scale shift. */
  whoomp() {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2000, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 1.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(f).connect(g).connect(m);
    o.start(t);
    o.stop(t + 1.7);
  }

  private boom() {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(g).connect(m);
    o.start(t);
    o.stop(t + 1.05);
  }
}
