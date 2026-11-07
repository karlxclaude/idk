/** Pooled entity instance. Plain fields; behaviors write to it directly. */
import type { Container } from 'pixi.js';
import type { Circle } from '../core/spatialHash';
import type { EntityArchetype } from './types';

let nextUid = 1;

export class Entity implements Circle {
  /** Unique per spawn (pooled objects get a new uid each spawn). Store uid to detect reuse. */
  uid = 0;
  active = false;
  arch!: EntityArchetype;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  radius = 10;
  /** Radius at spawn (behaviors like 'pulse' oscillate around it). */
  baseRadius = 10;
  rotation = 0;
  prevRotation = 0;
  spin = 0;
  age = 0;
  lifetime = Infinity;
  color = 0xffffff;
  color2 = 0xffffff;
  /** Visual alpha (behaviors like 'flicker' drive it). */
  alpha = 1;
  /** Visual squash/stretch multipliers. */
  scaleX = 1;
  scaleY = 1;
  /** Spawn pop-in scale 0..1. */
  popScale = 1;
  /** When true the entity cannot be eaten / cannot hurt (e.g. flickered out). */
  intangible = false;
  nutritionMul = 1;
  essenceBonus = 0;
  spawnTag = -1;
  /** Far from the camera: renderer skipped, behaviors may run at reduced cost. */
  offscreen = false;
  /** Pending removal at end of step. */
  dead = false;
  /** Free per-entity state for behaviors/mechanics. Cleared on spawn. */
  data: Record<string, any> = {};
  view: Container | null = null;
  _qstamp = 0;

  /** Called by World.spawn. */
  activate(arch: EntityArchetype, x: number, y: number, radius: number) {
    this.uid = nextUid++;
    this.active = true;
    this.dead = false;
    this.arch = arch;
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = this.vy = 0;
    this.radius = this.baseRadius = radius;
    this.rotation = this.prevRotation = Math.random() * Math.PI * 2;
    this.spin = 0;
    this.age = 0;
    this.lifetime = Infinity;
    this.alpha = 1;
    this.scaleX = this.scaleY = 1;
    this.popScale = 1;
    this.intangible = false;
    this.nutritionMul = 1;
    this.essenceBonus = 0;
    this.spawnTag = -1;
    this.offscreen = false;
    this.data = {};
  }

  hasTag(tag: string): boolean {
    return !!this.arch.tags && this.arch.tags.includes(tag);
  }
}
