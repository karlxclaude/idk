/**
 * Adaptive procedural music. One TierVoice per tier is built from TierConfig.music:
 *  - drone: continuous detuned oscillators (+ a slow pad chord per bar). Always audible.
 *  - other layers fade in with tierProgress, in the order listed by the tier's `layers`.
 * Notes are scheduled with a lookahead timer (no per-frame work).
 */
import type { MusicParams } from '../scales/types';
import { type Bus, MODES, clamp, degreeMidi, midiToFreq, mulberry32, noise, rootPitchClass, tone } from './synth';

type LayerKind = 'drone' | 'bass' | 'pulse' | 'arp' | 'lead' | 'shimmer';
const ALIAS: Record<string, LayerKind> = {
  drone: 'drone', pad: 'drone', bass: 'bass', sub: 'bass', pulse: 'pulse', perc: 'pulse', drums: 'pulse',
  rhythm: 'pulse', arp: 'arp', arpeggio: 'arp', lead: 'lead', melody: 'lead', shimmer: 'shimmer',
  texture: 'shimmer', choir: 'shimmer', bells: 'shimmer',
};
const OSC_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
const osc = (name: string | undefined, fallback: OscillatorType): OscillatorType =>
  name && OSC_TYPES.includes(name) ? (name as OscillatorType) : fallback;

const PROGRESSIONS = [
  [0, 5, 3, 4],
  [0, 3, 4, 3],
  [0, 2, 5, 4],
  [0, 4, 5, 3],
  [0, 0, 3, 1],
  [0, 5, 2, 4],
];
const BASS_PATTERNS = [
  [0, 8],
  [0, 6, 8, 12],
  [0, 3, 6, 8, 11, 14],
  [0, 4, 8, 12],
];

const LOOKAHEAD = 0.22; // seconds scheduled ahead
const TICK_MS = 45;

interface TierVoice {
  index: number;
  out: GainNode;
  layers: Map<LayerKind, { gain: GainNode; threshold: number }>;
  stopNodes: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  p: MusicParams;
  scale: number[];
  rootMidi: number;
  stepDur: number;
  prog: number[];
  bassPat: number[];
  rng: () => number;
  leadDeg: number;
  arpPos: number;
  chordDeg: number;
  /** progress 0..1 at which each layer is fully in. */
  levels: Map<LayerKind, number>;
}

export class Music {
  private cur: TierVoice | null = null;
  private timer: number | null = null;
  private nextStepTime = 0;
  private step = 0;
  private target = 0;
  private smooth = 0;
  private lastLayerUpdate = 0;
  private pendingTier: { index: number; p: MusicParams } | null = null;

  constructor(private bus: Bus) {}

  get key() {
    return this.cur ? { rootPc: rootPitchClass(this.cur.p.root), scale: this.cur.scale } : null;
  }

  setProgress(p: number) {
    this.target = clamp(p, 0, 1);
  }

  /** Switch to a tier's music, crossfading from the previous one. */
  setTier(index: number, p: MusicParams, fadeIn = 3) {
    if (this.cur && this.cur.index === index && this.cur.p === p) return;
    const ctx = this.bus.ctx;
    const old = this.cur;
    this.cur = this.build(index, p);
    const t = ctx.currentTime;
    const o = this.cur.out;
    o.gain.setValueAtTime(0.0001, t);
    o.gain.linearRampToValueAtTime(1, t + fadeIn);
    if (old) this.retire(old, Math.min(fadeIn, 2.5));
    // reverb amount follows the tier
    this.bus.musicReverb.gain.setTargetAtTime(0.1 + 0.5 * clamp(p.reverb ?? 0.4, 0, 1), t, 0.8);
    this.step = 0;
    this.nextStepTime = Math.max(this.nextStepTime, t + 0.1);
    this.smooth = this.target;
    this.applyLayers(true);
    this.start();
  }

  setTierDeferred(index: number, p: MusicParams) {
    this.pendingTier = { index, p };
  }

  flushPending() {
    if (this.pendingTier) {
      const { index, p } = this.pendingTier;
      this.pendingTier = null;
      this.setTier(index, p);
    }
  }

  private retire(v: TierVoice, fade: number) {
    const t = this.bus.ctx.currentTime;
    v.out.gain.cancelScheduledValues(t);
    v.out.gain.setValueAtTime(v.out.gain.value, t);
    v.out.gain.linearRampToValueAtTime(0, t + fade);
    window.setTimeout(() => {
      for (const n of v.stopNodes) {
        try {
          n.stop();
        } catch { /* already stopped */ }
      }
      for (const n of v.nodes) n.disconnect();
      v.out.disconnect();
    }, (fade + 0.6) * 1000);
  }

  private build(index: number, p: MusicParams): TierVoice {
    const ctx = this.bus.ctx;
    const scale = MODES[p.mode] ?? MODES.aeolian;
    const rootMidi = 12 * ((p.octave ?? 2) + 1) + rootPitchClass(p.root);
    const rng = mulberry32(index * 7919 + 13);
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.bus.music);

    const names = (p.layers?.length ? p.layers : ['drone', 'bass', 'pulse', 'arp']).map((n) => ALIAS[n] ?? 'shimmer');
    const kinds: LayerKind[] = ['drone'];
    for (const k of names) if (!kinds.includes(k)) kinds.push(k);
    const layers = new Map<LayerKind, { gain: GainNode; threshold: number }>();
    const nonDrone: LayerKind[] = kinds.filter((k) => k !== 'drone');
    kinds.forEach((k) => {
      const g = ctx.createGain();
      g.gain.value = k === 'drone' ? 1 : 0;
      g.connect(out);
      const i = nonDrone.indexOf(k);
      layers.set(k, { gain: g, threshold: k === 'drone' ? 0 : 0.04 + 0.7 * (i / Math.max(1, nonDrone.length)) });
    });

    const v: TierVoice = {
      index, out, layers, stopNodes: [], nodes: [out, ...[...layers.values()].map((l) => l.gain)], p, scale, rootMidi,
      stepDur: 60 / clamp(p.tempo || 80, 40, 180) / 4,
      prog: PROGRESSIONS[index % PROGRESSIONS.length],
      bassPat: BASS_PATTERNS[index % BASS_PATTERNS.length],
      rng, leadDeg: 4, arpPos: 0, chordDeg: 0, levels: new Map(),
    };

    // Continuous drone: root + fifth-ish degree through a slowly breathing lowpass.
    const dg = layers.get('drone')!.gain;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 500 + 250 * clamp(p.reverb ?? 0.4, 0, 1);
    filt.Q.value = 0.7;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    filt.connect(droneGain).connect(dg);
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.05 + (index % 5) * 0.015;
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(filt.frequency);
    lfo.start();
    v.stopNodes.push(lfo);
    v.nodes.push(filt, droneGain, lfo, lfoG);
    const dType = osc(p.timbre?.pad, 'sine');
    const droneType: OscillatorType = dType === 'sine' ? 'triangle' : dType;
    const notes: [number, number, number][] = [
      [rootMidi, 0, 1],
      [rootMidi, 7, 0.6],
      [degreeMidi(rootMidi, scale, 4), -5, 0.5],
      [rootMidi - 12, 0, 0.7],
    ];
    for (const [m, det, amp] of notes) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = m === rootMidi - 12 ? 'sine' : droneType;
      o.frequency.value = midiToFreq(m);
      o.detune.value = det;
      g.gain.value = amp;
      o.connect(g).connect(filt);
      o.start();
      v.stopNodes.push(o);
      v.nodes.push(o, g);
    }
    return v;
  }

  private start() {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private applyLayers(immediate = false) {
    const v = this.cur;
    if (!v) return;
    const t = this.bus.ctx.currentTime;
    for (const [k, l] of v.layers) {
      if (k === 'drone') continue;
      const x = clamp((this.smooth - l.threshold) / 0.14, 0, 1);
      const lvl = x * x * (3 - 2 * x);
      v.levels.set(k, lvl);
      if (immediate) l.gain.gain.setValueAtTime(lvl, t);
      else l.gain.gain.setTargetAtTime(lvl, t, 0.6);
    }
  }

  private tick() {
    const ctx = this.bus.ctx;
    const v = this.cur;
    if (!v || ctx.state !== 'running') {
      if (v && ctx.state !== 'running') this.nextStepTime = ctx.currentTime + 0.1;
      return;
    }
    const now = ctx.currentTime;
    this.smooth += (this.target - this.smooth) * 0.08;
    if (now - this.lastLayerUpdate > 0.25) {
      this.lastLayerUpdate = now;
      this.applyLayers();
    }
    // Throttled background tab: drop missed steps instead of bursting.
    if (this.nextStepTime < now - 0.4) this.nextStepTime = now + 0.05;
    while (this.nextStepTime < now + LOOKAHEAD) {
      this.scheduleStep(v, this.step, this.nextStepTime);
      this.nextStepTime += v.stepDur;
      this.step++;
    }
  }

  private on(v: TierVoice, k: LayerKind) {
    return (v.levels.get(k) ?? 0) > 0.03;
  }

  private scheduleStep(v: TierVoice, step: number, t: number) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const dest = v.out;
    const { scale, rootMidi, rng } = v;
    const T = v.p.timbre ?? {};
    const sd = v.stepDur;

    if (s === 0) {
      v.chordDeg = v.prog[bar % v.prog.length];
      // pad chord: part of the drone layer, always on
      const gDrone = v.layers.get('drone')!.gain;
      const len = sd * 16;
      for (const off of [0, 2, 4]) {
        const m = degreeMidi(rootMidi + 12, scale, v.chordDeg + off);
        tone(this.bus, gDrone, {
          type: osc(T.pad, 'sine'), f: midiToFreq(m), t, dur: len * 1.15, gain: 0.05, attack: len * 0.4,
          detune: (rng() - 0.5) * 12, lp: 1800,
        });
      }
    }

    if (this.on(v, 'bass') && v.bassPat.includes(s)) {
      const g = v.layers.get('bass')!.gain;
      const m = degreeMidi(rootMidi, scale, v.chordDeg) ;
      const type = osc(T.bass, 'sine');
      tone(this.bus, g, {
        type: type === 'sine' ? 'triangle' : type, f: midiToFreq(m), t, dur: sd * (s % 8 === 0 ? 3.2 : 1.8),
        gain: 0.22, attack: 0.01, lp: 420, lp2: 160,
      });
      if (type === 'sine' || type === 'triangle') tone(this.bus, g, { type: 'sine', f: midiToFreq(m - 12), t, dur: sd * 3, gain: 0.18, attack: 0.01 });
    }

    if (this.on(v, 'pulse')) {
      const g = v.layers.get('pulse')!.gain;
      const click = T.perc === 'click';
      if (s % 8 === 0) {
        tone(this.bus, g, { type: 'sine', f: click ? 190 : 150, f2: 45, t, dur: 0.16, gain: 0.3 });
      }
      if (s % 4 === 2) {
        noise(this.bus, g, { t, dur: click ? 0.025 : 0.06, gain: click ? 0.09 : 0.07, filter: 'highpass', f: click ? 6000 : 4500 });
      }
      if (s === 12 && !click) noise(this.bus, g, { t, dur: 0.09, gain: 0.09, filter: 'bandpass', f: 1800, q: 0.8 });
      if (click && (s === 7 || s === 15) && rng() < 0.6) {
        tone(this.bus, g, { type: 'triangle', f: 1800 + rng() * 800, t, dur: 0.03, gain: 0.05 });
      }
    }

    if (this.on(v, 'arp') && s % 2 === 0) {
      const g = v.layers.get('arp')!.gain;
      const seq = [0, 2, 4, 7, 4, 2, 9, 7];
      const deg = v.chordDeg + seq[v.arpPos++ % seq.length];
      tone(this.bus, g, {
        type: osc(T.lead, 'triangle'), f: midiToFreq(degreeMidi(rootMidi + 24, scale, deg)), t,
        dur: sd * 2.2, gain: 0.07, attack: 0.004, lp: 3500,
      });
    }

    if (this.on(v, 'lead') && (s === 0 || s === 6 || s === 8 || s === 12) && rng() < 0.7) {
      const g = v.layers.get('lead')!.gain;
      v.leadDeg = clamp(v.leadDeg + Math.floor(rng() * 5) - 2, 0, 9);
      const m = degreeMidi(rootMidi + 24, scale, v.leadDeg);
      tone(this.bus, g, {
        type: osc(T.lead, 'triangle'), f: midiToFreq(m), t, dur: sd * (3 + Math.floor(rng() * 4)),
        gain: 0.09, attack: 0.05, vib: 3, lp: 3000,
      });
    }

    if (this.on(v, 'shimmer') && s === 0 && bar % 2 === 0 && rng() < 0.85) {
      const g = v.layers.get('shimmer')!.gain;
      for (let i = 0; i < 2; i++) {
        const m = degreeMidi(rootMidi + 36, scale, v.chordDeg + [0, 2, 4, 6][Math.floor(rng() * 4)]);
        tone(this.bus, g, { type: 'sine', f: midiToFreq(m), t: t + i * sd * 3, dur: sd * 12, gain: 0.045, attack: sd * 4 });
      }
      if (T.texture === 'noise') {
        noise(this.bus, g, { t, dur: sd * 14, gain: 0.03, filter: 'bandpass', f: 3000, f2: 6000, q: 0.6, attack: sd * 6 });
      }
    }
  }
}
