/**
 * Procedural audio: SFX + adaptive music, driven purely by the event bus.
 * Public surface: constructor(settings), init(), unlock(), setVolumes(), setMuted(), uiClick(), dispose().
 */
import { events } from '../core/events';
import type { Settings } from '../core/state';
import type { TierConfig } from '../scales/types';
import { Music } from './music';
import { Sfx } from './sfx';
import { type Bus, MODES, clamp, createBus } from './synth';

const SHIFT_RISER = 1.8;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private bus: Bus | null = null;
  private sfx: Sfx | null = null;
  private music: Music | null = null;
  private muted = false;
  private paused = false;
  private shifting = false;
  private tier: TierConfig | null = null;
  private progress = 0;
  private offs: Array<() => void> = [];
  private inited = false;

  constructor(private settings: Settings) {
    this.muted = !!(settings as unknown as { muted?: boolean }).muted;
  }

  /** Create/resume the AudioContext. Safe to call repeatedly; must run from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.bus = createBus(this.ctx);
      this.sfx = new Sfx(this.bus);
      this.music = new Music(this.bus);
      this.applyVolumes(true);
      void this.ctx.resume().catch(() => {});
      if (this.tier) this.enterTier(this.tier, 0.5);
      this.music.setProgress(this.progress);
      this.applyDuck();
    } catch (err) {
      console.warn('[audio] unavailable', err);
      this.ctx = null;
      this.bus = null;
    }
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number; muted?: boolean }) {
    if (v.master !== undefined) this.settings.masterVolume = v.master;
    if (v.music !== undefined) this.settings.musicVolume = v.music;
    if (v.sfx !== undefined) this.settings.sfxVolume = v.sfx;
    if (v.muted !== undefined) this.muted = v.muted;
    this.applyVolumes();
  }

  setMuted(m: boolean) {
    this.setVolumes({ muted: m });
  }

  /** Play the UI click (also fired automatically for button clicks). */
  uiClick() {
    this.sfx?.click();
  }

  private applyVolumes(immediate = false) {
    const b = this.bus;
    if (!b) return;
    const s = this.settings;
    const t = b.ctx.currentTime;
    const set = (g: GainNode, v: number) => (immediate ? (g.gain.value = v) : g.gain.setTargetAtTime(v, t, 0.04));
    set(b.master, this.muted ? 0 : clamp(s.masterVolume, 0, 1) * 0.9);
    // squared curves feel more natural than linear sliders
    set(b.music, Math.pow(clamp(s.musicVolume, 0, 1), 2) * 0.9);
    set(b.sfx, Math.pow(clamp(s.sfxVolume, 0, 1), 2));
  }

  private applyDuck() {
    const b = this.bus;
    if (!b) return;
    const target = this.paused ? 0.22 : this.shifting ? 0.45 : 1;
    b.musicDuck.gain.setTargetAtTime(target, b.ctx.currentTime, this.paused ? 0.12 : 0.35);
  }

  private enterTier(tier: TierConfig, fade = 3) {
    if (!this.music || !this.sfx || !tier.music) return;
    this.music.setTier(tier.index, tier.music, fade);
    const scale = MODES[tier.music.mode] ?? MODES.aeolian;
    const k = this.music.key;
    if (k) this.sfx.setKey(k.rootPc, scale);
  }

  init() {
    if (this.inited) return;
    this.inited = true;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'click'] as const) {
      window.addEventListener(ev, unlock, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend().catch(() => {});
      else void this.ctx.resume().catch(() => {});
    });
    // Generic UI click for buttons / links.
    window.addEventListener(
      'click',
      (e) => {
        const el = e.target as Element | null;
        if (el?.closest?.('button, a, [role="button"], .btn, [data-sfx="click"]')) this.sfx?.click();
      },
      { capture: true },
    );

    const on = events.on.bind(events);
    this.offs.push(
      on('settingsChanged', ({ settings }) => {
        this.settings = settings;
        const m = (settings as unknown as { muted?: boolean }).muted;
        if (m !== undefined) this.muted = m;
        this.applyVolumes();
      }),
      on('eat', (e) => this.sfx?.eat(e.sizeRatio)),
      on('bump', (e) => this.sfx?.bump(e.sizeRatio)),
      on('hurt', (e) => this.sfx?.hurt(e.massLost)),
      on('death', () => this.sfx?.death()),
      on('respawn', () => this.sfx?.respawn()),
      on('abilityUsed', (e) => this.sfx?.ability(e.id)),
      on('essenceChanged', (e) => this.sfx?.essence(e.delta)),
      on('mechanic', (e) => this.sfx?.mechanic(e.mechanic, e.kind, e.value)),
      on('ngPlus', () => this.sfx?.ngPlus()),
      on('tierProgress', (e) => {
        this.progress = e.progress;
        this.music?.setProgress(e.progress);
      }),
      on('tierEnter', ({ tier, viaShift }) => {
        this.tier = tier;
        this.progress = 0;
        this.music?.setProgress(0);
        this.enterTier(tier, viaShift ? 3.5 : 2);
        if (!viaShift) this.sfx?.shimmer();
      }),
      on('scaleShiftStart', () => {
        this.shifting = true;
        this.applyDuck();
        this.sfx?.riser(SHIFT_RISER);
      }),
      on('scaleShiftMid', () => {
        this.sfx?.whoomp();
      }),
      on('scaleShiftEnd', () => {
        this.shifting = false;
        this.applyDuck();
        this.sfx?.shimmer();
      }),
      on('pause', ({ paused }) => {
        this.paused = paused;
        this.applyDuck();
        this.sfx?.pauseToggle(paused);
      }),
    );
  }

  dispose() {
    for (const o of this.offs) o();
    this.offs = [];
    this.music?.stop();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.bus = null;
    this.inited = false;
  }
}
