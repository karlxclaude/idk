/** Static sediment grains: drawn once per grain (irregular mineral lumps), pooled Graphics. */
import { Container, Graphics } from 'pixi.js';
import { Rng, TAU } from '../core/math';
import type { Grain, World } from '../sim/World';

export class GrainView {
  readonly container = new Container();
  private views = new Map<Grain, { g: Graphics; seed: number }>();
  private free: Graphics[] = [];

  update(world: World) {
    for (const grain of world.grains) {
      const v = this.views.get(grain);
      if (v && v.seed === grain.seed) continue;
      const g = v?.g ?? this.free.pop() ?? new Graphics();
      g.visible = true;
      if (!v) this.container.addChild(g);
      this.views.set(grain, { g, seed: grain.seed });
      this.draw(g, grain);
    }
    for (const [grain, v] of this.views) {
      if (world.grains.includes(grain) && grain.alive) continue;
      this.views.delete(grain);
      v.g.clear(); v.g.visible = false;
      this.container.removeChild(v.g);
      this.free.push(v.g);
    }
  }

  private draw(g: Graphics, grain: Grain) {
    g.clear();
    const r = new Rng(Math.floor(grain.seed * 1000));
    const R = grain.radius;
    const n = 11 + grain.variant * 3;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const rr = R * (0.8 + r.next() * 0.3);
      pts.push(grain.x + Math.cos(a) * rr, grain.y + Math.sin(a) * rr);
    }
    g.poly(pts, true);
    g.fill({ color: grain.variant === 0 ? 0x6e6657 : grain.variant === 1 ? 0x5c6a5e : 0x7a6a52, alpha: 0.8 });
    g.stroke({ width: R * 0.05, color: 0x2e2a24, alpha: 0.55 });
    // Mineral speckles and a highlight.
    for (let i = 0; i < 9; i++) {
      const a = r.angle(), d = Math.sqrt(r.next()) * R * 0.7;
      g.circle(grain.x + Math.cos(a) * d, grain.y + Math.sin(a) * d, R * (0.03 + r.next() * 0.05));
    }
    g.fill({ color: 0x1e1b17, alpha: 0.45 });
    g.circle(grain.x - R * 0.3, grain.y - R * 0.3, R * 0.25);
    g.fill({ color: 0xffffff, alpha: 0.06 });
  }
}
