/** Builds and drives a tier's parallax background + ambient layers. */
import { Container } from 'pixi.js';
import type { GameContext } from '../core/context';
import { backgroundRegistry, type BackgroundLayerInstance, type LayerCamera } from './backgroundRegistry';
import type { BackgroundLayerDef, TierConfig } from './types';

export class TierBackground {
  /** Layers behind the world. */
  readonly back = new Container();
  /** Layers in front of the world (depth > 1). */
  readonly front = new Container();
  private layers: BackgroundLayerInstance[] = [];
  private time = 0;
  baseZoom = 1;

  constructor(readonly tier: TierConfig, private ctx: GameContext) {
    const defs: BackgroundLayerDef[] = [...tier.background];
    // Ambient particle fields are rendered by the 'sparks' layer type.
    for (const a of tier.ambient) {
      defs.push({ type: 'sparks', depth: a.depth, colors: a.colors, alpha: a.alpha ?? 0.8, blend: a.blend ?? 'add', params: { count: a.count, size: a.size, drift: a.drift, flicker: a.flicker } });
    }
    const quality = ctx.state.settings.quality;
    for (const def of defs) {
      let type = backgroundRegistry.get(def.type);
      if (def.type === 'nebula' && quality === 'low') type = backgroundRegistry.get('blobs');
      if (!type) {
        console.warn(`[background] unknown layer type '${def.type}' in tier ${tier.id}`);
        continue;
      }
      const inst = type.create(def, tier, ctx);
      this.layers.push(inst);
      (def.depth > 1 ? this.front : this.back).addChild(inst.view);
    }
    this.resize(ctx.camera.width, ctx.camera.height);
  }

  resize(w: number, h: number) {
    for (const l of this.layers) l.resize?.(w, h);
  }

  update(realDt: number) {
    this.time += realDt;
    const cam = this.ctx.camera;
    const lc: LayerCamera = {
      x: cam.originX + cam.rx,
      y: cam.originY + cam.ry,
      zoom: cam.rzoom,
      zoomRatio: cam.rzoom / this.baseZoom,
      width: cam.width,
      height: cam.height,
      time: this.time,
      realDt,
    };
    for (const l of this.layers) l.update(lc);
  }

  set alpha(a: number) {
    this.back.alpha = this.front.alpha = a;
  }

  destroy() {
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.back.destroy({ children: true });
    this.front.destroy({ children: true });
  }
}
