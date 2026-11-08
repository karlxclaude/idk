/**
 * Steering input. Mouse: the cell swims toward the cursor (speed scales with distance).
 * Touch: the cell swims toward the finger while it is down, then coasts.
 * Keyboard: WASD / arrows override the pointer. Escape / P toggles pause.
 */
export class Input {
  /** Steering vector, magnitude 0..1, screen space (y down). */
  steerX = 0;
  steerY = 0;
  steering = false;
  enabled = true;
  readonly pointer = { x: 0, y: 0, down: false, inside: false, type: 'mouse' };
  private touchId: number | null = null;
  private keys = new Set<string>();
  private pauseListeners: Array<() => void> = [];
  private el: HTMLElement | null = null;
  private cleanup: Array<() => void> = [];

  attach(el: HTMLElement) {
    this.el = el;
    const on = <K extends keyof HTMLElementEventMap>(t: K, fn: (e: HTMLElementEventMap[K]) => void, target: EventTarget = el) => {
      target.addEventListener(t, fn as EventListener, { passive: false });
      this.cleanup.push(() => target.removeEventListener(t, fn as EventListener));
    };
    on('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.pointer.type = e.pointerType;
      this.setPointer(e);
      if (e.pointerType === 'mouse') {
        this.pointer.down = true;
        this.pointer.inside = true;
        return;
      }
      if (this.touchId === null) {
        this.touchId = e.pointerId;
        this.pointer.down = true;
        try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    });
    on('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.pointer.type = 'mouse';
        this.pointer.inside = true;
        this.setPointer(e);
      } else if (e.pointerId === this.touchId) this.setPointer(e);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') { this.pointer.down = false; return; }
      if (e.pointerId === this.touchId) { this.touchId = null; this.pointer.down = false; }
    };
    on('pointerup', up);
    on('pointercancel', up);
    on('pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse') this.pointer.inside = false; });
    on('contextmenu', (e: Event) => e.preventDefault());
    on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); this.pauseListeners.forEach((f) => f()); }
    }, window);
    on('keyup', (e: KeyboardEvent) => this.keys.delete(e.code), window);
    on('blur', () => this.keys.clear(), window);
  }

  detach() { this.cleanup.forEach((f) => f()); this.cleanup = []; this.el = null; }

  onPause(fn: () => void) { this.pauseListeners.push(fn); }

  private setPointer(e: PointerEvent) {
    const r = this.el!.getBoundingClientRect();
    this.pointer.x = e.clientX - r.left;
    this.pointer.y = e.clientY - r.top;
  }

  /** Compute steering relative to the player's on-screen position. */
  updateSteer(px: number, py: number, refPx: number, deadPx: number) {
    let x = 0, y = 0, active = false;
    if (this.enabled) {
      const k = this.keys;
      const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        x = kx / l; y = ky / l; active = true;
      } else if (this.pointer.type !== 'mouse' ? this.pointer.down : this.pointer.inside) {
        const dx = this.pointer.x - px, dy = this.pointer.y - py;
        const d = Math.hypot(dx, dy);
        if (d > deadPx) {
          const m = Math.min(1, (d - deadPx) / Math.max(1, refPx - deadPx));
          x = (dx / d) * m; y = (dy / d) * m;
        }
        active = true;
      }
    }
    this.steerX = x; this.steerY = y; this.steering = active;
  }
}

export const input = new Input();
