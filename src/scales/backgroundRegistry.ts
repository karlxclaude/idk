/**
 * Background layer types. Drop a file in src/scales/backgrounds/ exporting default
 * BackgroundLayerType | BackgroundLayerType[] - it is auto-registered.
 */
import type { Container } from 'pixi.js';
import { Registry } from '../core/registry';
import type { GameContext } from '../core/context';
import type { BackgroundLayerDef, TierConfig } from './types';

/** Camera info passed to layers every frame. */
export interface LayerCamera {
  /** Absolute local camera position (floating-origin offset included). */
  x: number;
  y: number;
  /** Pixels per local unit. */
  zoom: number;
  /** zoom / zoom-at-tier-start (1 → ~0.25 as the player grows). */
  zoomRatio: number;
  width: number;
  height: number;
  /** Real seconds since tier start. */
  time: number;
  realDt: number;
}

export interface BackgroundLayerInstance {
  /** Screen-space view (0,0 = top-left). */
  view: Container;
  update(cam: LayerCamera): void;
  resize?(w: number, h: number): void;
  destroy(): void;
}

export interface BackgroundLayerType {
  id: string;
  create(def: BackgroundLayerDef, tier: TierConfig, ctx: GameContext): BackgroundLayerInstance;
}

export const backgroundRegistry = new Registry<BackgroundLayerType>('backgroundLayer');
backgroundRegistry.addModules(import.meta.glob('./backgrounds/**/*.ts', { eager: true }));
