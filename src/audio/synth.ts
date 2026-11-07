/**
 * Low-level synthesis helpers + the master bus (compressor/limiter, reverb, volume stages).
 * No game knowledge lives here.
 */
import type { MusicMode } from '../scales/types';

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ───────────────────────── music theory ─────────────────────────
export const MODES: Record<MusicMode, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  wholeTone: [0, 2, 4, 6, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  // "chromatic" is rendered as the octatonic (whole-half) scale: dense and prismatic yet usable.
  chromatic: [0, 2, 3, 5, 6, 8, 9, 11],
};

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function rootPitchClass(root: string | undefined): number {
  if (!root) return 0;
  let pc = PC[root[0].toUpperCase()] ?? 0;
  for (const ch of root.slice(1)) {
    if (ch === '#') pc++;
    else if (ch === 'b') pc--;
  }
  return ((pc % 12) + 12) % 12;
}
export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Frequency of scale degree `deg` (may be negative / beyond one octave) above a root midi note. */
export function degreeMidi(rootMidi: number, scale: number[], deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  const idx = ((deg % n) + n) % n;
  return rootMidi + oct * 12 + scale[idx];
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ───────────────────────── bus ─────────────────────────
export interface Bus {
  ctx: AudioContext;
  /** Final gain (master volume / mute) -> compressor -> destination. */
  master: GainNode;
  music: GainNode;
  sfx: GainNode;
  /** Ducking stage for music (pause, scale-shift). */
  musicDuck: GainNode;
  /** Sends into the shared convolver reverb. */
  sfxReverb: GainNode;
  musicReverb: GainNode;
  noise: AudioBuffer;
}

function makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      // one-pole lowpass on the noise so the tail darkens naturally
      lp += (Math.random() * 2 - 1 - lp) * (0.25 + 0.75 * (1 - i / len));
      d[i] = lp * env;
    }
  }
  return buf;
}

export function createBus(ctx: AudioContext): Bus {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 14;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  // Safety limiter stage after the compressor.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.08;
  master.connect(comp).connect(limiter).connect(ctx.destination);

  const music = ctx.createGain();
  const musicDuck = ctx.createGain();
  const sfx = ctx.createGain();
  music.connect(musicDuck).connect(master);
  sfx.connect(master);

  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.4, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  conv.connect(wet).connect(master);
  const musicReverb = ctx.createGain();
  const sfxReverb = ctx.createGain();
  musicReverb.gain.value = 0.3;
  sfxReverb.gain.value = 0.14;
  musicDuck.connect(musicReverb).connect(conv);
  sfx.connect(sfxReverb).connect(conv);

  const nl = ctx.sampleRate * 2;
  const noise = ctx.createBuffer(1, nl, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;

  return { ctx, master, music, sfx, musicDuck, sfxReverb, musicReverb, noise };
}

// ───────────────────────── voices ─────────────────────────
/** Live count of SFX voices (oscillators/noise sources flagged `counted`). */
export const voices = { count: 0 };

export interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** End frequency (exponential glide over `dur`). */
  f2?: number;
  /** Start time (default: now). */
  t?: number;
  dur: number;
  gain?: number;
  attack?: number;
  detune?: number;
  /** Lowpass cutoff (Hz), optionally gliding to lp2. */
  lp?: number;
  lp2?: number;
  /** Vibrato depth in Hz at 5.5Hz. */
  vib?: number;
  /** Count toward the SFX voice cap. */
  counted?: boolean;
}

export function tone(bus: Bus, dest: AudioNode, o: ToneOpts): void {
  const ctx = bus.ctx;
  const t = o.t ?? ctx.currentTime;
  const dur = Math.max(0.02, o.dur);
  const atk = Math.min(o.attack ?? 0.004, dur * 0.8);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(1, o.f), t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const peak = Math.max(0.0002, o.gain ?? 0.2);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let tail: AudioNode = osc;
  const extra: AudioNode[] = [];
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lp2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.lp2), t + dur);
    tail.connect(f);
    tail = f;
    extra.push(f);
  }
  tail.connect(g).connect(dest);
  let lfo: OscillatorNode | null = null;
  let lfoG: GainNode | null = null;
  if (o.vib) {
    lfo = ctx.createOscillator();
    lfoG = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoG.gain.value = o.vib;
    lfo.connect(lfoG).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }
  if (o.counted) voices.count++;
  osc.start(t);
  osc.stop(t + dur + 0.05);
  osc.onended = () => {
    if (o.counted) voices.count--;
    osc.disconnect();
    g.disconnect();
    for (const n of extra) n.disconnect();
    lfo?.disconnect();
    lfoG?.disconnect();
  };
}

export interface NoiseOpts {
  t?: number;
  dur: number;
  gain?: number;
  attack?: number;
  filter?: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  counted?: boolean;
}

export function noise(bus: Bus, dest: AudioNode, o: NoiseOpts): void {
  const ctx = bus.ctx;
  const t = o.t ?? ctx.currentTime;
  const dur = Math.max(0.02, o.dur);
  const src = ctx.createBufferSource();
  src.buffer = bus.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'bandpass';
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const atk = Math.min(o.attack ?? 0.003, dur * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain ?? 0.2), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest);
  if (o.counted) voices.count++;
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
  src.onended = () => {
    if (o.counted) voices.count--;
    src.disconnect();
    f.disconnect();
    g.disconnect();
  };
}
