/**
 * Fixed-timestep game loop with render interpolation, pause, hit-stop and global timeScale.
 *
 *  - update(dt) runs at a fixed 60 Hz in *sim time* (affected by timeScale, pause, hit-stop).
 *  - realUpdate(realDt) runs once per frame in real time (camera shake, UI-ish FX, transitions).
 *  - render(alpha) runs once per frame; alpha in [0,1) interpolates between previous and current sim state.
 */
export interface LoopHooks {
  update(dt: number): void;
  realUpdate(realDt: number): void;
  render(alpha: number, realDt: number): void;
}

export class GameLoop {
  readonly fixedDt = 1 / 60;
  /** Global sim speed multiplier (slow-mo < 1). */
  timeScale = 1;
  /** Extra freeze (e.g. during scale shift) independent of pause. */
  frozen = false;
  private _paused = false;
  private hitStopRemaining = 0;
  private acc = 0;
  /** Total sim seconds elapsed. */
  simTime = 0;
  /** Total real seconds elapsed. */
  realTime = 0;
  /** Smoothed FPS for debug displays. */
  fps = 60;
  private maxStepsPerFrame = 5;

  constructor(private hooks: LoopHooks) {}

  get paused() {
    return this._paused;
  }
  setPaused(p: boolean) {
    this._paused = p;
  }

  /** Freeze simulation for `ms` real milliseconds (impact punch). Stacks as max, not sum. */
  hitStop(ms: number) {
    this.hitStopRemaining = Math.max(this.hitStopRemaining, ms / 1000);
  }
  get inHitStop() {
    return this.hitStopRemaining > 0;
  }

  tick(deltaMs: number) {
    const realDt = Math.min(deltaMs / 1000, 0.1);
    this.realTime += realDt;
    if (realDt > 0) this.fps += (1 / realDt - this.fps) * 0.05;

    let simDt = realDt * this.timeScale;
    if (this._paused || this.frozen) simDt = 0;
    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining -= realDt;
      simDt = 0;
    }

    this.acc += simDt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < this.maxStepsPerFrame) {
      this.hooks.update(this.fixedDt);
      this.simTime += this.fixedDt;
      this.acc -= this.fixedDt;
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.acc = 0; // avoid spiral of death

    this.hooks.realUpdate(realDt);
    this.hooks.render(this.acc / this.fixedDt, realDt);
  }
}
