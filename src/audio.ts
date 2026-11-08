/** Tiny procedural soundscape: underwater ambience plus squelchy eat, gulp, divide and death cues. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private started = false;

  init() {
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else void this.ctx.resume().catch(() => {});
    });
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {}); return; }
    try {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 10;
      this.master.connect(comp).connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < len; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.08; d[i] = lp * 3; }
      void ctx.resume().catch(() => {});
      this.startAmbient();
    } catch { this.ctx = null; }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private startAmbient() {
    const ctx = this.ctx!;
    if (this.started) return;
    this.started = true;
    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0;
    this.ambient.gain.setTargetAtTime(0.22, ctx.currentTime, 3);
    this.ambient.connect(this.master!);
    const src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG).connect(lp.frequency);
    src.connect(lp).connect(this.ambient);
    src.start(); lfo.start();
    for (const [f, g] of [[48, 0.12], [72.3, 0.06], [96.5, 0.03]] as const) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      const vib = ctx.createOscillator(); vib.frequency.value = 0.11 + f * 0.001;
      const vg = ctx.createGain(); vg.gain.value = 1.5;
      vib.connect(vg).connect(o.frequency);
      o.connect(og).connect(this.ambient);
      o.start(); vib.start();
    }
  }

  private tone(f: number, f2: number, dur: number, gain: number, type: OscillatorType = 'sine', lpHz = 0) {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let tail: AudioNode = o;
    if (lpHz) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = lpHz; tail.connect(lp); tail = lp; }
    tail.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  private squelch(f: number, f2: number, dur: number, gain: number) {
    const ctx = this.ctx; if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    s.onended = () => { s.disconnect(); g.disconnect(); };
  }

  /** Food captured. `size` = food radius relative to the cell. */
  eat(size: number) {
    const p = 1 - Math.min(1, size * 2);
    this.squelch(1400 * (0.6 + p * 0.6), 300, 0.16, 0.18);
    this.tone(520 + p * 300, 260, 0.14, 0.06, 'triangle', 1800);
  }
  /** A whole cell engulfed. */
  gulp() {
    this.squelch(700, 160, 0.42, 0.3);
    this.tone(220, 90, 0.5, 0.12, 'sine', 900);
  }
  divide() {
    for (let i = 0; i < 4; i++) setTimeout(() => this.tone([392, 523, 659, 784][i], [392, 523, 659, 784][i] * 1.01, 0.9, 0.05, 'sine', 2400), i * 110);
    this.squelch(500, 1400, 0.8, 0.08);
  }
  death() {
    this.tone(160, 38, 1.8, 0.16, 'sine', 600);
    this.squelch(900, 120, 1.2, 0.22);
    if (this.ambient && this.ctx) {
      this.ambient.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.4);
      this.ambient.gain.setTargetAtTime(0.22, this.ctx.currentTime + 3, 2);
    }
  }
  click() { this.tone(900, 600, 0.05, 0.03, 'triangle'); }
}
