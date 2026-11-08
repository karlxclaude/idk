/** Food particles: bacteria swim, algae drift and sink, debris tumbles in the current. Pooled. */
import type { Circle } from '../core/spatialHash';
import type { Organism } from './Organism';

export type FoodKind = 'bacteria' | 'algae' | 'debris';
export type FoodState = 'free' | 'captured' | 'digesting' | 'dead';

/** Nutrition multiplier applied to r² when digested. */
export const FOOD_YIELD: Record<FoodKind, number> = { bacteria: 3.2, algae: 2.6, debris: 1.4 };
export const CAPTURE_TIME = 0.45;
export const DIGEST_TIME = 1.8;

export class Food implements Circle {
  x = 0; y = 0; radius = 4; _qstamp = 0;
  kind: FoodKind = 'bacteria';
  variant = 0;
  tint = 0xffffff;
  vx = 0; vy = 0;
  angle = 0; spin = 0;
  phase = 0;
  state: FoodState = 'dead';
  captor: Organism | null = null;
  /** Target offset inside the captor (captor-local, rotates with nothing: cells don't spin). */
  localX = 0; localY = 0;
  /** Capture start point (world). */
  fromX = 0; fromY = 0;
  progress = 0;
  /** Mass still to transfer to the captor. */
  mass = 0;
  /** Render helpers written by the renderer. */
  viewId = -1;
  alpha = 1; scale = 1;

  init(kind: FoodKind, x: number, y: number, radius: number, variant: number, tint: number) {
    this.kind = kind; this.x = x; this.y = y; this.radius = radius; this.variant = variant; this.tint = tint;
    this.vx = this.vy = 0;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * (kind === 'debris' ? 1.2 : kind === 'bacteria' ? 0.4 : 0.25);
    this.phase = Math.random() * Math.PI * 2;
    this.state = 'free';
    this.captor = null;
    this.progress = 0;
    this.mass = radius * radius * FOOD_YIELD[kind];
    this.alpha = 1; this.scale = 1;
    this.viewId = -1;
  }
}
