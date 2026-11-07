/**
 * Typed event bus. Every cross-cutting system (audio, UI, FX polish, save, achievements)
 * SUBSCRIBES to these events instead of being called directly by the engine.
 *
 *   import { events } from '../core/events';
 *   const off = events.on('eat', (e) => playBlip(e.sizeRatio));
 *   off(); // unsubscribe
 *
 * Adding a new event: add a key to `GameEvents` below (owned by the engine/architect; ask before
 * changing payloads of existing events, they are a public contract).
 */
import type { Entity } from '../entities/Entity';
import type { TierConfig } from '../scales/types';
import type { Settings } from './state';
import type { Action } from './input';

export interface GameEvents {
  /** Player ate an entity. sizeRatio = entity.radius / player.radius (0..~1.1). */
  eat: {
    entity: Entity;
    archetypeId: string;
    massGained: number;
    essenceGained: number;
    x: number;
    y: number;
    sizeRatio: number;
    /** Player mass after the eat. */
    playerMass: number;
  };
  /** Player bumped into a close-in-size entity (no eat, no damage). */
  bump: { entity: Entity; x: number; y: number; sizeRatio: number };
  /** Player took damage. */
  hurt: { source: Entity | null; massLost: number; x: number; y: number; sizeRatio: number };
  /** Player died (mass fell below the death threshold). Respawn follows automatically. */
  death: { tierIndex: number; x: number; y: number };
  /** Player respawned at the start of the current tier. */
  respawn: { tierIndex: number; mass: number };
  /** Size-meter progress changed (0..1). Fired at most once per sim step. */
  tierProgress: { tierIndex: number; progress: number; mass: number; target: number };
  /** A tier became active (game start, after scale-shift mid point, debug jump). */
  tierEnter: { tier: TierConfig; viaShift: boolean; ngPlus: number };
  /** Meter full: transition begins. Sim freezes; audio should play the "whoomp". */
  scaleShiftStart: { from: TierConfig; to: TierConfig };
  /** Transition midpoint: old world is now a speck, new tier is loaded. */
  scaleShiftMid: { from: TierConfig; to: TierConfig };
  /** Transition finished; player has control again. */
  scaleShiftEnd: { from: TierConfig; to: TierConfig };
  /** Essence (currency) changed. */
  essenceChanged: { essence: number; delta: number };
  /** Any ability fired (dash included, id 'dash'). */
  abilityUsed: { id: string; action: Action | null; x: number; y: number };
  /** Pause toggled. */
  pause: { paused: boolean };
  /** Floating origin rebased: every local coordinate was shifted by (-dx, -dy). */
  originRebased: { dx: number; dy: number };
  /** Tier 15 completed: the cycle restarts at tier 1. */
  ngPlus: { count: number };
  /** Settings object changed (UI writes settings, then emits this). */
  settingsChanged: { settings: Settings };
  /** Generic tier-mechanic event, e.g. { mechanic: 'gluonStrings', kind: 'snap' }. */
  mechanic: { mechanic: string; kind: string; x: number; y: number; value?: number };
  /** Raw action pressed (keyboard or UI button), before gameplay handles it. */
  action: { action: Action };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => this.off(type, fn);
  }

  once<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof E>(type: K, fn: Handler<E[K]>): void {
    this.handlers.get(type)?.delete(fn);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] handler for '${String(type)}' threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

/** The global game event bus. */
export const events = new EventBus<GameEvents>();
