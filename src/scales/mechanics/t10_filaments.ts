/**
 * Tier 10 mechanic "filaments": draws the glowing dark-matter web in world space (pooled, baked
 * beam sprites; nothing is redrawn per frame), streams prey ('webRider') along the filaments
 * toward the heavy hubs, and gives the player a slipstream speed boost while riding one.
 * Eating galaxies while surfing a filament feeds extra mass.
 */
import { Container, Sprite } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';
import { cellEdges, hub, nearest, type Hub, type WebLevel } from './t10_webField';

const beamTex = () =>
  bakeTexture('t10:beam', 64, (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    // soften the ends
    c.globalCompositeOperation = 'destination-in';
    const h = c.createLinearGradient(0, 0, s, 0);
    h.addColorStop(0, 'rgba(255,255,255,0.35)');
    h.addColorStop(0.12, 'rgba(255,255,255,1)');
    h.addColorStop(0.88, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0.35)');
    c.fillStyle = h;
    c.fillRect(0, 0, s, s);
  });

const VIOLET = 0x8a5cff, CYAN = 0x6fe8ff, WHITE = 0xe8f4ff;
const mix = (a: number, b: number, t: number) => {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return ((r << 16) | (g << 8) | bl) | 0;
};

interface Mote { s: Sprite; ax: number; ay: number; mx: number; my: number; bx: number; by: number; ph: number; sp: number }
interface CellRec { c: Container; motes: Mote[] }

const def: MechanicDef = {
  id: 't10_filaments',
  defaults: {
    levels: [
      { cell: 320, thick: 6, seed: 11, drop: 0.1, diag: 0.4, alpha: 1, boost: 1, curved: true },
      { cell: 130, thick: 2.6, seed: 57, drop: 0.3, diag: 0.2, alpha: 0.5, boost: 0.5, curved: false },
    ] as WebLevel[],
    flow: 0.9,
  },
  create(p, ctx) {
    const levels: WebLevel[] = p.levels;
    const root = new Container();
    ctx.layers.worldUnder.addChild(root);
    const store: Map<number, CellRec>[] = levels.map(() => new Map());
    const key = (i: number, j: number) => (i + 5000) * 10007 + (j + 5000);
    const hubTmp: Hub = { x: 0, y: 0, w: 0 };

    function build(L: WebLevel, ix: number, iy: number): CellRec {
      const c = new Container();
      const motes: Mote[] = [];
      const addBeam = (x0: number, y0: number, x1: number, y1: number, th: number, a: number, tint: number) => {
        const s = new Sprite(beamTex());
        s.anchor.set(0, 0.5);
        s.blendMode = 'add';
        s.tint = tint;
        s.alpha = a;
        s.position.set(x0, y0);
        s.rotation = Math.atan2(y1 - y0, x1 - x0);
        s.width = Math.hypot(x1 - x0, y1 - y0) + th * 0.6;
        s.height = th;
        c.addChild(s);
      };
      cellEdges(L, ix, iy, (ax, ay, mx, my, bx, by, w) => {
        const tint = mix(VIOLET, CYAN, w);
        const segs: [number, number, number, number][] = L.curved ? [[ax, ay, mx, my], [mx, my, bx, by]] : [[ax, ay, bx, by]];
        for (const [x0, y0, x1, y1] of segs) {
          addBeam(x0, y0, x1, y1, L.thick * 6, 0.1 * L.alpha, tint);
          addBeam(x0, y0, x1, y1, L.thick * 1.5, 0.5 * L.alpha, mix(tint, WHITE, 0.5));
        }
        const m = new Sprite(Tex.glow());
        m.anchor.set(0.5);
        m.blendMode = 'add';
        m.tint = WHITE;
        m.width = m.height = L.thick * 5;
        m.alpha = 0.8 * L.alpha;
        c.addChild(m);
        motes.push({ s: m, ax, ay, mx, my, bx, by, ph: (ix * 0.37 + iy * 0.61 + w) % 1, sp: 0.04 + w * 0.05 });
      });
      // hub glow
      hub(L, ix, iy, hubTmp);
      const g = new Sprite(Tex.glow());
      g.anchor.set(0.5);
      g.blendMode = 'add';
      g.tint = mix(VIOLET, CYAN, hubTmp.w);
      g.position.set(hubTmp.x, hubTmp.y);
      g.width = g.height = L.cell * (0.14 + hubTmp.w * 0.34);
      g.alpha = (0.2 + hubTmp.w * 0.5) * L.alpha;
      c.addChild(g);
      const core = new Sprite(Tex.glow());
      core.anchor.set(0.5);
      core.blendMode = 'add';
      core.tint = WHITE;
      core.position.set(hubTmp.x, hubTmp.y);
      core.width = core.height = L.cell * (0.04 + hubTmp.w * 0.1);
      core.alpha = (0.35 + hubTmp.w * 0.5) * L.alpha;
      c.addChild(core);
      root.addChild(c);
      return { c, motes };
    }

    function refresh() {
      const cam = ctx.camera;
      const z = cam.rzoom || cam.zoom;
      const hw = cam.width / 2 / z, hh = cam.height / 2 / z;
      const ax = cam.rx + cam.originX, ay = cam.ry + cam.originY;
      levels.forEach((L, li) => {
        const map = store[li];
        const i0 = Math.floor((ax - hw) / L.cell) - 1, i1 = Math.floor((ax + hw) / L.cell) + 1;
        const j0 = Math.floor((ay - hh) / L.cell) - 1, j1 = Math.floor((ay + hh) / L.cell) + 1;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = key(i, j);
          if (!map.has(k)) map.set(k, build(L, i, j));
        }
        for (const [k, rec] of map) {
          const i = Math.floor(k / 10007) - 5000, j = (k % 10007) - 5000;
          if (i < i0 - 2 || i > i1 + 2 || j < j0 - 2 || j > j1 + 2) {
            rec.c.destroy({ children: true });
            map.delete(k);
          }
        }
      });
    }

    let surf = 0;
    let surfT = 0;
    let fxT = 0;
    let wasOn = false;

    return {
      update(dt) {
        const ox = ctx.camera.originX, oy = ctx.camera.originY;
        const pl = ctx.player;
        // --- prey streams along the coarse filaments toward heavy hubs
        const L0 = levels[0];
        for (const e of ctx.world.entities) {
          if (e.dead || !e.active || e.offscreen || !e.hasTag('webRider')) continue;
          const n = nearest(L0, e.x + ox, e.y + oy);
          if (n.d > L0.cell * 0.45) continue;
          const speed = Math.max(pl.radius * p.flow, e.radius * 0.8);
          const vt = e.vx * n.tx + e.vy * n.ty;
          const k = Math.min(1, dt * 2.2);
          let dv = (speed - vt) * k;
          e.vx += n.tx * dv;
          e.vy += n.ty * dv;
          const lx = n.px - ox - e.x, ly = n.py - oy - e.y;
          const ld = Math.hypot(lx, ly) || 1;
          const pull = Math.min(speed * 0.8, ld * 1.2) * k;
          e.vx += (lx / ld) * pull;
          e.vy += (ly / ld) * pull;
        }
        // --- player slipstream
        if (!pl.alive) { surf = 0; return; }
        let on = 0;
        let tx = 0, ty = 0;
        for (const L of levels) {
          const n = nearest(L, pl.x + ox, pl.y + oy);
          const reach = L.thick * 3 + pl.radius * 0.9;
          if (n.d < reach) {
            const f = L.boost * (1 - 0.5 * (n.d / reach));
            if (f > on) { on = f; tx = n.tx; ty = n.ty; }
          }
        }
        const maxV = pl.maxSpeed(ctx);
        const speed = Math.hypot(pl.vx, pl.vy);
        if (on > 0 && speed > maxV * 0.12) {
          const vt = pl.vx * tx + pl.vy * ty;
          const sgn = vt >= 0 ? 1 : -1;
          const cap = maxV * (1 + 1.1 * on);
          if (Math.abs(vt) < cap && Math.abs(vt) > maxV * 0.06) {
            pl.vx += tx * sgn * maxV * 3.2 * on * dt;
            pl.vy += ty * sgn * maxV * 3.2 * on * dt;
          }
          surf = Math.min(1, surf + dt * 3);
          fxT -= dt;
          if (fxT <= 0) {
            fxT = 0.07;
            ctx.fx.burst(pl.x, pl.y, { count: 2, color: [0x6fe8ff, 0xb07aff], speed: pl.radius * 1.5, size: pl.radius * 0.1, life: 0.5 });
          }
          if (!wasOn && surfT <= 0) {
            ctx.fx.floatText(pl.x, pl.y - pl.radius * 1.6, 'FILAMENT SURF', { color: 0x6fe8ff, size: 14 });
            surfT = 7;
          }
          wasOn = true;
        } else {
          surf = Math.max(0, surf - dt * 2);
          wasOn = false;
        }
        surfT -= dt;
      },
      render(alpha, realDt) {
        refresh();
        const t = ctx.tierTime;
        root.position.set(-ctx.camera.originX, -ctx.camera.originY);
        for (const map of store) for (const rec of map.values()) {
          for (const m of rec.motes) {
            const f = (m.ph + t * m.sp) % 1;
            let x: number, y: number;
            if (f < 0.5) { const u = f * 2; x = m.ax + (m.mx - m.ax) * u; y = m.ay + (m.my - m.ay) * u; }
            else { const u = f * 2 - 1; x = m.mx + (m.bx - m.mx) * u; y = m.my + (m.by - m.my) * u; }
            m.s.position.set(x, y);
          }
        }
      },
      onEat(e: Entity) {
        if (surf > 0.5 && e.hasTag('webRider')) return 1.25;
      },
      destroy() {
        root.destroy({ children: true });
      },
    };
  },
};
export default def;
