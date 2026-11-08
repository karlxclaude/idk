/**
 * Tier 7 mechanic "orbitals":
 *  - Planets (tag 'host') grow moons that orbit them on rails; a released moon (host eaten/gone) flies off.
 *  - Asteroid belts (tag 'belt') share one slowly turning flow so they stream like a real belt.
 *  - Gravity slingshot: skim past a gas giant (tag 'gas') at speed and it flings you onward.
 *  - Meteor showers: a telegraphed volley of burning rocks sweeps across the screen.
 */
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const def: MechanicDef = {
  id: 't07_orbitals',
  defaults: { maxMoons: 14, showerEvery: [26, 42] as [number, number], showerCount: [12, 18] as [number, number], slingBoost: 1.45, beltSpeed: 0.3, gravity: 3 },
  create(p, ctx) {
    const moons: Entity[] = [];
    let scan = 0;
    let flowA = ctx.rng.angle();
    let sling = 0;
    let showerIn = ctx.rng.range(14, 22);
    let showerLeft = 0;
    let showerGap = 0;
    let sDir = 0;
    let sAnchorX = 0, sAnchorY = 0, sR = 0;

    const spawnMoons = (h: Entity) => {
      const gas = h.hasTag('gas');
      const n = gas ? ctx.rng.int(2, 4) : ctx.rng.chance(0.55) ? 1 : 0;
      for (let i = 0; i < n && moons.length < p.maxMoons; i++) {
        const a = ctx.rng.angle();
        const R = h.radius * (gas ? ctx.rng.range(2.6, 4.2) : ctx.rng.range(1.9, 2.8));
        const m = ctx.world.spawn('t07_moon', h.x + Math.cos(a) * R, h.y + Math.sin(a) * R, {
          radius: h.radius * ctx.rng.range(0.14, 0.26), popIn: false,
        });
        if (!m) continue;
        m.data.host = h;
        m.data.hostUid = h.uid;
        m.data.a = a;
        m.data.R = R;
        m.data.w = ctx.rng.sign() * ctx.rng.range(0.5, 0.95) * Math.pow(h.radius / R, 0.5) * 2.4;
        moons.push(m);
      }
    };

    const shower = () => {
      const pl = ctx.player;
      const R = ctx.camera.viewRadius;
      sDir = ctx.rng.angle();
      sAnchorX = pl.x;
      sAnchorY = pl.y;
      sR = R;
      showerLeft = Math.round(ctx.rng.range(p.showerCount[0], p.showerCount[1]));
      showerGap = 0;
      ctx.fx.floatText(pl.x, pl.y - pl.radius * 2.4, 'METEOR SHOWER!', { color: 0xffa860, size: 20 });
      ctx.fx.flash(0.12, 0xff8a40, 3);
      ctx.fx.shake(0.12);
      ctx.events.emit('mechanic', { mechanic: 't07_orbitals', kind: 'shower', x: pl.x, y: pl.y });
    };

    return {
      update(dt) {
        const pl = ctx.player;
        // moons on rails
        for (let i = moons.length - 1; i >= 0; i--) {
          const m = moons[i];
          const h = m.data.host as Entity | undefined;
          if (m.dead || !m.active || !h || h.dead || !h.active || h.uid !== m.data.hostUid) {
            if (h) m.data.host = undefined;
            moons.splice(i, 1);
            continue;
          }
          m.data.a += m.data.w * dt;
          const tx = h.x + Math.cos(m.data.a) * m.data.R, ty = h.y + Math.sin(m.data.a) * m.data.R;
          m.vx = (tx - m.x) / dt;
          m.vy = (ty - m.y) / dt;
        }
        sling -= dt;
        flowA += dt * 0.03;

        // shower volley
        showerIn -= dt;
        if (showerIn <= 0 && showerLeft === 0 && pl.alive) {
          shower();
          showerIn = ctx.rng.range(p.showerEvery[0], p.showerEvery[1]);
        }
        if (showerLeft > 0) {
          showerGap -= dt;
          if (showerGap <= 0) {
            showerGap = ctx.rng.range(0.12, 0.4);
            showerLeft--;
            const dx = Math.cos(sDir), dy = Math.sin(sDir);
            const o = ctx.rng.range(-1, 1) * sR * 0.95;
            const sx = sAnchorX - dx * sR * 1.2 - dy * o;
            const sy = sAnchorY - dy * sR * 1.2 + dx * o;
            const speed = pl.radius * ctx.rng.range(4.5, 7.5);
            const m = ctx.world.spawn('t07_meteor', sx, sy, {
              radius: pl.radius * ctx.rng.range(0.1, 0.26), vx: dx * speed, vy: dy * speed, popIn: false,
              lifetime: (sR * 2.8) / speed + 0.5,
            });
            if (m) { m.data.driftX = dx * speed; m.data.driftY = dy * speed; }
          }
        }

        // slow scan: moons for new planets, belt flow, slingshot
        scan += dt;
        if (scan < 0.1) return;
        const step = scan;
        scan = 0;
        const fx = Math.cos(flowA), fy = Math.sin(flowA);
        const bs = pl.radius * p.beltSpeed;
        const maxV = pl.maxSpeed(ctx);
        for (const e of ctx.world.entities) {
          if (e.dead || !e.active) continue;
          if (e.hasTag('host')) {
            if (!e.data.t07m && e.age > 0.05) { e.data.t07m = true; spawnMoons(e); }
            if (e.hasTag('gas') && pl.alive && !e.offscreen) { // gravity assist: a gentle pull on the player only
              const gx = e.x - pl.x, gy = e.y - pl.y;
              const gd = Math.hypot(gx, gy) || 1;
              if (gd < e.radius * 4 && gd > e.radius * 1.1) {
                const f = (1 - gd / (e.radius * 4)) ** 2 * p.gravity * pl.maxSpeed(ctx) * step;
                pl.vx += (gx / gd) * f;
                pl.vy += (gy / gd) * f;
              }
            }
            if (e.hasTag('gas') && sling <= 0 && pl.alive && !e.offscreen) {
              const dx = e.x - pl.x, dy = e.y - pl.y;
              const d = Math.hypot(dx, dy) || 1;
              const sp = Math.hypot(pl.vx, pl.vy);
              if (d < e.radius * 3.0 && d > e.radius * 1.35 && sp > maxV * 0.45) {
                const head = (pl.vx * dx + pl.vy * dy) / (sp * d); // 1 = straight at it
                if (head < 0.7 && head > -0.2) {
                  const k = Math.min(p.slingBoost, (maxV * 1.9) / sp);
                  pl.vx *= k;
                  pl.vy *= k;
                  sling = 3;
                  ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.8, 'SLINGSHOT!', { color: 0xffe08a, size: 18 });
                  ctx.fx.burst(pl.x, pl.y, { count: 14, color: [0xffe08a, 0xffffff], speed: pl.radius * 6, size: pl.radius * 0.2, life: 0.5, spread: 0.4, angle: Math.atan2(-pl.vy, -pl.vx) });
                  ctx.fx.flash(0.08, 0xffe08a, 5);
                  ctx.events.emit('mechanic', { mechanic: 't07_orbitals', kind: 'slingshot', x: pl.x, y: pl.y });
                }
              }
            }
          } else if (e.hasTag('belt')) {
            const k = Math.min(1, step * 1.4);
            e.vx += (fx * bs - e.vx) * k;
            e.vy += (fy * bs - e.vy) * k;
          }
        }
      },
      rebase() {},
      destroy() { moons.length = 0; },
    };
  },
};
export default def;
