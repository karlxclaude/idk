/**
 * Tier 2 mechanic "bonding": molecules carry a donor ('bondA') or acceptor ('bondB') tag
 * (nucleotide bases carry data.bond). Eating complementary partners in alternating order
 * builds a bond chain; each link raises the mass bonus (x1.25 per link, capped). Eating the
 * same kind twice, or waiting too long, snaps the chain.
 * Eating a DNA strand (tag 'dna') unzips it into a burst of edible bases that alternate A/B,
 * ready-made fuel for a chain.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const kind = (e: Entity): 'A' | 'B' | null =>
  (e.data.bond as 'A' | 'B' | undefined) ?? (e.hasTag('bondA') ? 'A' : e.hasTag('bondB') ? 'B' : null);

const def: MechanicDef = {
  id: 't02_bonding',
  defaults: { window: 4.5, bonus: 0.25, maxChain: 8, unzip: [4, 6] as [number, number] },
  create(p, ctx) {
    let last: 'A' | 'B' | null = null;
    let chain = 0;
    let timer = 0;
    return {
      update(dt) {
        if (chain > 0) {
          timer -= dt;
          if (timer <= 0) { chain = 0; last = null; }
        }
      },
      onEat(e) {
        const pl = ctx.player;
        if (e.hasTag('dna')) {
          const n = Math.round(ctx.rng.range(p.unzip[0], p.unzip[1]));
          for (let i = 0; i < n; i++) {
            const a = ctx.rng.angle();
            const sp = e.radius * ctx.rng.range(1.5, 3);
            ctx.world.spawn('t02_base', e.x + Math.cos(a) * e.radius * 0.4, e.y + Math.sin(a) * e.radius * 0.4, {
              radius: pl.radius * ctx.rng.range(0.14, 0.24),
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              data: { bond: i % 2 === 0 ? 'A' : 'B' },
            });
          }
          ctx.fx.burst(e.x, e.y, { count: 14, color: [e.color, e.color2], speed: e.radius * 4, size: e.radius * 0.2, life: 0.5 });
          ctx.fx.floatText(e.x, e.y - e.radius * 1.2, 'UNZIPPED!', { color: e.color2, size: 15 });
        }
        const k = kind(e);
        if (!k) return;
        if (last && k !== last) chain = Math.min(p.maxChain, chain + 1);
        else chain = 0;
        last = k;
        timer = p.window;
        if (chain < 1) return;
        ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.5, `BOND x${chain + 1}`, { color: 0x7affd0, size: 13 + Math.min(chain, 6) });
        ctx.fx.burst(pl.x, pl.y, { count: 4 + chain * 2, color: [0x7affd0, 0xff7ad9], speed: pl.radius * 3, size: pl.radius * 0.12, life: 0.4 });
        ctx.events.emit('mechanic', { mechanic: 't02_bonding', kind: 'chain', x: pl.x, y: pl.y });
        return 1 + chain * p.bonus;
      },
      destroy() {},
    };
  },
};
export default def;
