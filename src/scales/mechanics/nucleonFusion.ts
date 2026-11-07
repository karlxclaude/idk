/**
 * Tier 3 mechanic: nucleon fusion.
 *  1. Eat protons and neutrons ALTERNATELY within the combo window → fusion combo multiplies mass gain.
 *  2. Free protons and neutrons that touch fuse into deuterons; deuterons fuse into helium nuclei
 *     (bigger, juicier targets) - the soup "cooks" as you play.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const def: MechanicDef = {
  id: 'nucleonFusion',
  defaults: { comboWindow: 2.5, maxCombo: 6, bonusPerCombo: 0.35, checkInterval: 0.3, deuteron: 't03_deuteron', helium: 't03_helium', maxFusionsPerCheck: 2 },
  create(p, ctx) {
    let combo = 0;
    let lastTag = '';
    let lastTime = -99;
    let timer = 0;
    const tmp: Entity[] = [];

    const fuse = (a: Entity, b: Entity, into: string) => {
      const x = (a.x * a.radius + b.x * b.radius) / (a.radius + b.radius);
      const y = (a.y * a.radius + b.y * b.radius) / (a.radius + b.radius);
      const r = Math.sqrt(a.radius * a.radius + b.radius * b.radius) * 0.95;
      const vx = (a.vx + b.vx) / 2, vy = (a.vy + b.vy) / 2;
      ctx.world.despawn(a, 'killed');
      ctx.world.despawn(b, 'killed');
      const e = ctx.world.spawn(into, x, y, { radius: r, vx, vy });
      ctx.fx.burst(x, y, { count: 18, color: [0xffffff, ctx.tier.palette.glow], speed: r * 6, size: r * 0.5, life: 0.5 });
      ctx.events.emit('mechanic', { mechanic: 'nucleonFusion', kind: 'fuse', x, y, value: r });
      return e;
    };

    return {
      onEat(e) {
        const tag = e.hasTag('proton') ? 'proton' : e.hasTag('neutron') ? 'neutron' : e.hasTag('nucleus') ? 'nucleus' : '';
        if (!tag) return 1;
        const now = ctx.tierTime;
        if (now - lastTime < p.comboWindow && (tag !== lastTag || tag === 'nucleus')) combo = Math.min(p.maxCombo, combo + 1);
        else combo = 1;
        lastTag = tag;
        lastTime = now;
        if (combo >= 2) {
          ctx.fx.floatText(e.x, e.y - e.radius, `FUSION x${combo}`, { color: ctx.tier.palette.accent, size: 18 + combo * 2, life: 1.1 });
          ctx.events.emit('mechanic', { mechanic: 'nucleonFusion', kind: 'combo', x: e.x, y: e.y, value: combo });
          return 1 + (combo - 1) * p.bonusPerCombo;
        }
        return 1;
      },
      update(dt) {
        timer -= dt;
        if (timer > 0) return;
        timer = p.checkInterval;
        let fusions = 0;
        for (const e of ctx.world.entities) {
          if (fusions >= p.maxFusionsPerCheck) break;
          if (e.dead || e.offscreen) continue;
          const isP = e.hasTag('proton'), isD = e.hasTag('deuteron');
          if (!isP && !isD) continue;
          ctx.world.within(e.x, e.y, e.radius * 0.6, tmp);
          for (const o of tmp) {
            if (o === e || o.dead) continue;
            if (isP && o.hasTag('neutron')) { fuse(e, o, p.deuteron); fusions++; break; }
            if (isD && o.hasTag('deuteron')) { fuse(e, o, p.helium); fusions++; break; }
          }
        }
      },
      destroy() {},
    };
  },
};
export default def;
