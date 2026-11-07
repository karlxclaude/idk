/**
 * Input: pointer/touch steering + abstract actions.
 *
 * Steering
 *  - Mouse: the player follows the cursor while it is over the canvas (speed scales with distance).
 *  - Touch 'follow' (default): player moves toward the finger while it is down; release = coast.
 *  - Touch 'joystick': drag relative to the touch-down point (virtual stick, no on-screen art).
 *  - Keyboard: WASD / arrows override pointer steering.
 *
 * Actions (UI agent API)
 *  - input.press('dash')            fire an action once (on-screen buttons call this)
 *  - input.setHeld('ability1', b)   for hold-type buttons
 *  - input.onAction('pause', cb)    observe actions (also emitted as the 'action' event)
 *  - input.bindKey('KeyQ', 'ability1')
 *  Gameplay code polls `consume(action)` once per sim step.
 */
import { events } from './events';

export type Action =
  | 'dash'
  | 'split'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'pause'
  | 'debugFill'
  | 'debugMass'
  | 'debugNextTier';

export const ALL_ACTIONS: readonly Action[] = [
  'dash', 'split', 'ability1', 'ability2', 'ability3', 'ability4', 'pause', 'debugFill', 'debugMass', 'debugNextTier',
];

const DEFAULT_BINDINGS: Record<string, Action> = {
  Space: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyF: 'split',
  KeyQ: 'ability1',
  Digit1: 'ability1',
  KeyE: 'ability2',
  Digit2: 'ability2',
  KeyR: 'ability3',
  Digit3: 'ability3',
  Digit4: 'ability4',
  Escape: 'pause',
  KeyP: 'pause',
  BracketRight: 'debugFill',
  BracketLeft: 'debugMass',
  Backslash: 'debugNextTier',
};

export class Input {
  /** Steering vector, magnitude 0..1, in screen space (y down). */
  steerX = 0;
  steerY = 0;
  /** True while there is an active steering source. */
  steering = false;

  touchMode: 'follow' | 'joystick' = 'follow';
  /** Disable pointer/keyboard gameplay input (e.g. while a menu is open). */
  enabled = true;

  readonly pointer = { x: 0, y: 0, down: false, inside: false, type: 'mouse' as string };
  private anchor = { x: 0, y: 0 };
  private touchId: number | null = null;
  private keys = new Set<string>();
  private bindings: Record<string, Action> = { ...DEFAULT_BINDINGS };
  private pressed = new Set<Action>();
  private held = new Set<Action>();
  private listeners = new Map<Action, Set<() => void>>();
  private el: HTMLElement | null = null;
  private cleanup: (() => void)[] = [];

  attach(el: HTMLElement) {
    this.el = el;
    const on = <K extends keyof HTMLElementEventMap>(t: K, fn: (e: HTMLElementEventMap[K]) => void, target: any = el) => {
      target.addEventListener(t, fn, { passive: false });
      this.cleanup.push(() => target.removeEventListener(t, fn));
    };
    on('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      this.pointer.type = e.pointerType;
      this.setPointer(e);
      if (e.pointerType === 'mouse') {
        if (e.button === 2) this.press('dash');
        this.pointer.down = true;
        return;
      }
      if (this.touchId === null) {
        this.touchId = e.pointerId;
        this.pointer.down = true;
        this.anchor.x = this.pointer.x;
        this.anchor.y = this.pointer.y;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else {
        // A second finger tap = dash (handy on phones without buttons).
        this.press('dash');
      }
    });
    on('pointermove', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.pointer.type = 'mouse';
        this.pointer.inside = true;
        this.setPointer(e);
      } else if (e.pointerId === this.touchId) {
        this.setPointer(e);
      }
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') {
        this.pointer.down = false;
        return;
      }
      if (e.pointerId === this.touchId) {
        this.touchId = null;
        this.pointer.down = false;
      }
    };
    on('pointerup', up);
    on('pointercancel', up);
    on('pointerleave', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.pointer.inside = false;
    });
    on('contextmenu', (e: Event) => e.preventDefault());
    on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = this.bindings[e.code];
      if (a) {
        e.preventDefault();
        this.press(a);
        this.held.add(a);
      }
    }, window);
    on('keyup', (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      const a = this.bindings[e.code];
      if (a) this.held.delete(a);
    }, window);
    on('blur', () => {
      this.keys.clear();
      this.held.clear();
    }, window);
  }

  detach() {
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    this.el = null;
  }

  private setPointer(e: PointerEvent) {
    const r = this.el!.getBoundingClientRect();
    this.pointer.x = e.clientX - r.left;
    this.pointer.y = e.clientY - r.top;
  }

  // ---------- Action API ----------
  /** Fire an action once (keyboard, UI buttons, debug). */
  press(a: Action) {
    this.pressed.add(a);
    events.emit('action', { action: a });
    this.listeners.get(a)?.forEach((fn) => fn());
  }
  setHeld(a: Action, held: boolean) {
    if (held) {
      if (!this.held.has(a)) this.press(a);
      this.held.add(a);
    } else this.held.delete(a);
  }
  isHeld(a: Action) {
    return this.held.has(a);
  }
  /** Returns true once per press (gameplay polls this each sim step). */
  consume(a: Action): boolean {
    if (!this.pressed.has(a)) return false;
    this.pressed.delete(a);
    return true;
  }
  clearPressed() {
    this.pressed.clear();
  }
  onAction(a: Action, fn: () => void): () => void {
    let s = this.listeners.get(a);
    if (!s) this.listeners.set(a, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }
  bindKey(code: string, a: Action) {
    this.bindings[code] = a;
  }
  unbindKey(code: string) {
    delete this.bindings[code];
  }

  /**
   * Compute steering relative to the player's on-screen position.
   * @param px,py player screen position (px)
   * @param refPx reference distance (px) at which steering reaches full strength
   * @param deadPx radius around the player with no steering
   */
  updateSteer(px: number, py: number, refPx: number, deadPx: number) {
    let x = 0, y = 0, active = false;
    if (this.enabled) {
      // Keyboard
      const kx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      const ky = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
      if (kx || ky) {
        const l = Math.hypot(kx, ky);
        x = kx / l;
        y = ky / l;
        active = true;
      } else if (this.pointer.type !== 'mouse' ? this.pointer.down : this.pointer.inside) {
        let dx: number, dy: number, ref = refPx, dead = deadPx;
        if (this.pointer.type !== 'mouse' && this.touchMode === 'joystick') {
          dx = this.pointer.x - this.anchor.x;
          dy = this.pointer.y - this.anchor.y;
          ref = refPx * 0.45;
          dead = 6;
        } else {
          dx = this.pointer.x - px;
          dy = this.pointer.y - py;
        }
        const d = Math.hypot(dx, dy);
        if (d > dead) {
          const m = Math.min(1, (d - dead) / Math.max(1, ref - dead));
          x = (dx / d) * m;
          y = (dy / d) * m;
        }
        active = true;
      }
    }
    this.steerX = x;
    this.steerY = y;
    this.steering = active;
  }
}

export const input = new Input();
