/**
 * Tier 2 mechanic: quarks are bound by glowing gluon strings (springs). Stretch a string too
 * far and it SNAPS - releasing edible gluon sparks and a fresh quark/antiquark pair at the
 * break point (colour confinement, gamified).
 */
import { Graphics } from 'pixi.js';
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

interface Link {
  a: Entity; au: number; b: Entity; bu: number; rest: number;
}

const def: MechanicDef = {
  id: 'gluonStrings',
  defaults: {
    tag: 'quark', linkRange: 9, maxLinksPerQuark: 2, snapStretch: 2.6, stiffness: 2.2,
    color: 0xffd27a, spark: 't02_gluonSpark', pair: ['t02_upQuark', 't02_downQuark'], maxLinks: 40,
  },
  create(p, ctx) {
    const links: Link[] = [];
    const g = new Graphics();
    g.blendMode = 'add';
    ctx.layers.worldUnder.addChild(g);
    const degree = new Map<Entity, number>();
    let linkTimer = 0;
    const alive = (e: Entity, uid: number) => e.active && !e.dead && e.uid === uid;
    const tmp: Entity[] = [];

    const addLink = (a: Entity, b: Entity) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      links.push({ a, au: a.uid, b, bu: b.uid, rest: Math.max(d * 0.8, (a.radius + b.radius) * 1.6) });
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    };

    const snap = (l: Link, mx: number, my: number) => {
      const r = Math.min(l.a.radius, l.b.radius);
      ctx.fx.burst(mx, my, { count: 16, color: [p.color, 0xffffff], speed: r * 9, size: r * 0.7, life: 0.5 });
      ctx.fx.shake(0.12);
      const n = ctx.rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const a = ctx.rng.angle();
        ctx.world.spawn(p.spark, mx, my, { radius: r * ctx.rng.range(0.35, 0.6), vx: Math.cos(a) * r * 6, vy: Math.sin(a) * r * 6 });
      }
      // New quark-antiquark pair from the string energy.
      const q1 = ctx.world.spawn(ctx.rng.pick(p.pair), mx + r, my, { radius: r * 0.75, vx: r * 3 });
      const q2 = ctx.world.spawn(ctx.rng.pick(p.pair), mx - r, my, { radius: r * 0.75, vx: -r * 3 });
      if (q1 && q2) addLink(q1, q2);
      ctx.events.emit('mechanic', { mechanic: 'gluonStrings', kind: 'snap', x: mx, y: my });
    };

    return {
      update(dt) {
        for (const k of [...degree.keys()]) if (!k.active || k.dead) degree.delete(k);
        // Form new links between nearby free quarks.
        linkTimer -= dt;
        if (linkTimer <= 0 && links.length < p.maxLinks) {
          linkTimer = 0.4;
          for (const e of ctx.world.entities) {
            if (e.dead || !e.hasTag(p.tag) || (degree.get(e) ?? 0) >= p.maxLinksPerQuark || e.offscreen) continue;
            ctx.world.within(e.x, e.y, e.radius * p.linkRange, tmp);
            let best: Entity | null = null, bestD = Infinity;
            for (const o of tmp) {
              if (o === e || o.dead || !o.hasTag(p.tag) || (degree.get(o) ?? 0) >= p.maxLinksPerQuark) continue;
              if (links.some((l) => (l.a === e && l.b === o) || (l.a === o && l.b === e))) continue;
              const d = Math.hypot(o.x - e.x, o.y - e.y);
              if (d < bestD) { bestD = d; best = o; }
            }
            if (best) addLink(e, best);
            if (links.length >= p.maxLinks) break;
          }
        }
        // Springs + snapping.
        for (let i = links.length - 1; i >= 0; i--) {
          const l = links[i];
          if (!alive(l.a, l.au) || !alive(l.b, l.bu)) {
            const s = alive(l.a, l.au) ? l.a : alive(l.b, l.bu) ? l.b : null;
            if (s) ctx.fx.burst(s.x, s.y, { count: 6, color: p.color, speed: s.radius * 5, size: s.radius * 0.5, life: 0.3 });
            links.splice(i, 1);
            continue;
          }
          const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > l.rest * p.snapStretch) {
            links.splice(i, 1);
            degree.set(l.a, (degree.get(l.a) ?? 1) - 1);
            degree.set(l.b, (degree.get(l.b) ?? 1) - 1);
            snap(l, (l.a.x + l.b.x) / 2, (l.a.y + l.b.y) / 2);
            continue;
          }
          if (d > l.rest) {
            // Strong force grows with distance (confinement).
            const f = (d - l.rest) * p.stiffness * dt;
            const ma = l.a.radius * l.a.radius, mb = l.b.radius * l.b.radius, tot = ma + mb;
            l.a.vx += (dx / d) * f * (mb / tot) * 2; l.a.vy += (dy / d) * f * (mb / tot) * 2;
            l.b.vx -= (dx / d) * f * (ma / tot) * 2; l.b.vy -= (dy / d) * f * (ma / tot) * 2;
          }
        }
      },
      render(alpha) {
        g.clear();
        const t = ctx.loop.realTime;
        for (const l of links) {
          if (l.a.offscreen && l.b.offscreen) continue;
          const ax = l.a.prevX + (l.a.x - l.a.prevX) * alpha, ay = l.a.prevY + (l.a.y - l.a.prevY) * alpha;
          const bx = l.b.prevX + (l.b.x - l.b.prevX) * alpha, by = l.b.prevY + (l.b.y - l.b.prevY) * alpha;
          const d = Math.hypot(bx - ax, by - ay);
          const stretch = Math.min(1, Math.max(0, (d / l.rest - 1) / (p.snapStretch - 1)));
          const w = Math.min(l.a.radius, l.b.radius) * (0.7 - stretch * 0.5);
          // Wobbly string: midpoint offset perpendicular.
          const nx = -(by - ay) / (d || 1), ny = (bx - ax) / (d || 1);
          const wob = Math.sin(t * 9 + l.au) * d * 0.06 * (1 - stretch);
          const mx = (ax + bx) / 2 + nx * wob, my = (ay + by) / 2 + ny * wob;
          g.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ width: w * 2.6, color: p.color, alpha: 0.18 + stretch * 0.2 });
          g.moveTo(ax, ay).quadraticCurveTo(mx, my, bx, by).stroke({ width: Math.max(0.5, w), color: stretch > 0.7 ? 0xffffff : p.color, alpha: 0.85 });
        }
      },
      destroy() {
        links.length = 0;
        degree.clear();
        g.destroy();
      },
    };
  },
};
export default def;
