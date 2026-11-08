/**
 * Tier 6 mechanic "cityGrid": the streets. Roads (asphalt strips with lane markings, drawn under the
 * entities) are laid out around the player; cars and trucks stream along their two lanes in both
 * directions, keep a following distance, and respawn at the entry edge when they pass the view.
 * Roads scale with the player: when you outgrow a street it vanishes and wider ones appear.
 * Buildings that spawn on a road are shoved to the kerb. Traffic is edible when smaller than you,
 * otherwise it just honks and bumps.
 */
import { TilingSprite } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';
import type { Entity } from '../../entities/Entity';
import type { MechanicDef } from '../mechanicRegistry';

const roadTex = (vertical: boolean) =>
  bakeTexture(`t06:road:${vertical ? 'v' : 'h'}`, 128, (c, s) => {
    const r = new Rng(9);
    c.save();
    if (vertical) { c.translate(s, 0); c.rotate(Math.PI / 2); }
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, '#3a3d4a'); g.addColorStop(0.5, '#2a2c38'); g.addColorStop(1, '#3a3d4a');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    for (let i = 0; i < 180; i++) { c.fillStyle = `rgba(255,255,255,${r.range(0.02, 0.07)})`; c.fillRect(r.range(0, s), r.range(0, s), 1.5, 1.5); }
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(0, 4, s, 3); c.fillRect(0, s - 7, s, 3);                 // kerb lines
    c.fillStyle = 'rgba(255,205,60,0.9)'; c.fillRect(0, s / 2 - 4, s, 2.5); c.fillRect(0, s / 2 + 1.5, s, 2.5);  // double yellow
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.fillRect(8, s * 0.25 - 1.5, 46, 3); c.fillRect(8, s * 0.75 - 1.5, 46, 3);                                // lane dashes
    c.restore();
  });

interface Road { id: number; axis: 0 | 1; pos: number; w: number; sprite: TilingSprite; cool: number }

const def: MechanicDef = {
  id: 't06_cityGrid',
  defaults: { roads: 3, perRoad: 7, speed: [1.2, 2.3] as [number, number], truckFrac: 0.2, roadWidth: 1.25, obsolete: 0.5 },
  create(p, ctx) {
    const roads: Road[] = [];
    let nextId = 1;
    let acc = 0;
    let axisToggle = 0;
    const veh: Entity[] = [];

    const makeRoad = (): Road | null => {
      const pl = ctx.player, vr = ctx.camera.viewRadius;
      const axis = (axisToggle++ % 2) as 0 | 1;
      const w = pl.radius * p.roadWidth;
      let best = 0, bestScore = Infinity;
      const buildings = ctx.world.entities.filter((e) => !e.dead && e.hasTag('building'));
      for (let k = 0; k < 8; k++) {
        const off = ctx.rng.range(-0.85, 0.85) * vr;
        const pos = (axis === 0 ? pl.y : pl.x) + off;
        let score = 0;
        for (const r of roads) if (r.axis === axis && Math.abs(r.pos - pos) < w * 2.6 + r.w) score += 100;
        for (const b of buildings) score += Math.abs((axis === 0 ? b.y : b.x) - pos) < w / 2 + b.radius ? 1 : 0;
        if (score < bestScore) { bestScore = score; best = pos; }
      }
      if (bestScore >= 100) return null;
      const sprite = new TilingSprite({ texture: roadTex(axis === 1), width: 100, height: 100 });
      ctx.layers.worldUnder.addChild(sprite);
      const road = { id: nextId++, axis, pos: best, w, sprite, cool: 0 };
      roads.push(road);
      return road;
    };

    const removeRoad = (r: Road) => {
      for (const e of ctx.world.entities) if (!e.dead && e.data.road === r.id) ctx.world.despawn(e, 'culled');
      r.sprite.destroy();
      roads.splice(roads.indexOf(r), 1);
    };

    const spawnVehicle = (r: Road) => {
      const pl = ctx.player, cam = ctx.camera;
      const lane = ctx.rng.chance(0.5) ? 0 : 1;
      const dir = lane === 0 ? 1 : -1;
      const truck = ctx.rng.chance(p.truckFrac);
      const rad = pl.radius * ctx.rng.range(0.2, 0.34) * (truck ? 1.2 : 1);
      const half = (r.axis === 0 ? cam.width : cam.height) / 2 / cam.zoom;
      const entry = -dir * (half * ctx.rng.range(1.05, 1.4) + rad * 2);
      const lanePerp = r.pos + (r.axis === 0 ? 1 : -1) * dir * r.w * 0.25;
      const x = r.axis === 0 ? cam.x + entry : lanePerp;
      const y = r.axis === 0 ? lanePerp : cam.y + entry;
      const spd = pl.radius * ctx.rng.range(p.speed[0], p.speed[1]) * (truck ? 0.8 : 1);
      const e = ctx.world.spawn(truck ? 't06_truck' : 't06_car', x, y, {
        radius: rad,
        popIn: false,
        data: { road: r.id, lane, dir, spd },
      });
      if (e) {
        e.rotation = e.prevRotation = r.axis === 0 ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        e.vx = e.vy = 0;
        if (r.axis === 0) e.vx = dir * spd; else e.vy = dir * spd;
      }
    };

    return {
      update(dt) {
        const pl = ctx.player, cam = ctx.camera, vr = cam.viewRadius;
        acc += dt;
        // ---- road upkeep (4 Hz)
        if (acc >= 0.25) {
          const step = acc;
          acc = 0;
          for (let i = roads.length - 1; i >= 0; i--) {
            const r = roads[i];
            const pc = r.axis === 0 ? pl.y : pl.x;
            if (Math.abs(r.pos - pc) > vr * 1.5 || r.w < pl.radius * p.obsolete) removeRoad(r);
          }
          if (roads.length < p.roads) makeRoad();
          // vehicles per road
          for (const r of roads) {
            r.cool -= step;
            let n = 0;
            for (const e of ctx.world.entities) if (!e.dead && e.data.road === r.id) n++;
            if (n < p.perRoad && r.cool <= 0) { spawnVehicle(r); r.cool = 0.35; }
          }
          // kerb-nudge buildings
          for (const e of ctx.world.entities) {
            if (e.dead || !e.hasTag('building')) continue;
            for (const r of roads) {
              const perp = r.axis === 0 ? e.y : e.x;
              const half = r.w / 2 + e.radius * 1.05;
              if (Math.abs(perp - r.pos) < half) {
                const side = Math.sign(perp - r.pos) || 1;
                const np = r.pos + side * half;
                if (r.axis === 0) e.y = e.prevY = np; else e.x = e.prevX = np;
              }
            }
          }
        }
        // ---- drive
        veh.length = 0;
        for (const e of ctx.world.entities) if (!e.dead && e.data.road !== undefined) veh.push(e);
        for (const e of veh) {
          const r = roads.find((q) => q.id === e.data.road);
          if (!r) { ctx.world.despawn(e, 'culled'); continue; }
          const dir = e.data.dir as number;
          const horiz = r.axis === 0;
          const along = horiz ? e.x - cam.x : e.y - cam.y;
          const half = (horiz ? cam.width : cam.height) / 2 / cam.zoom;
          if (along * dir > half * 1.5 + e.radius * 3) { ctx.world.despawn(e, 'culled'); continue; }
          let spd = e.data.spd as number;
          // follow distance
          for (const o of veh) {
            if (o === e || o.data.road !== e.data.road || o.data.lane !== e.data.lane) continue;
            const gap = ((horiz ? o.x - e.x : o.y - e.y) * dir) - (o.radius + e.radius) * 1.7;
            if (gap > -e.radius && gap < e.radius * 2.2) spd = Math.min(spd, Math.max(0, (o.data.spd as number) * 0.8));
          }
          const lanePerp = r.pos + (horiz ? 1 : -1) * dir * r.w * 0.25;
          const k = Math.min(1, dt * 3);
          if (horiz) {
            e.vx += (dir * spd - e.vx) * k;
            e.vy += ((lanePerp - e.y) * 4 - e.vy) * Math.min(1, dt * 6);
            e.rotation = dir > 0 ? 0 : Math.PI;
          } else {
            e.vy += (dir * spd - e.vy) * k;
            e.vx += ((lanePerp - e.x) * 4 - e.vx) * Math.min(1, dt * 6);
            e.rotation = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
      },
      render() {
        const cam = ctx.camera, vr = cam.viewRadius;
        const L = vr * 2.8;
        for (const r of roads) {
          const sc = r.w / 128;
          r.sprite.tileScale.set(sc, sc);
          if (r.axis === 0) {
            r.sprite.width = L; r.sprite.height = r.w;
            r.sprite.position.set(cam.rx - L / 2, r.pos - r.w / 2);
            r.sprite.tilePosition.set(-r.sprite.x, 0);
          } else {
            r.sprite.width = r.w; r.sprite.height = L;
            r.sprite.position.set(r.pos - r.w / 2, cam.ry - L / 2);
            r.sprite.tilePosition.set(0, -r.sprite.y);
          }
        }
      },
      rebase(dx, dy) {
        for (const r of roads) r.pos -= r.axis === 0 ? dy : dx;
      },
      destroy() {
        for (const r of roads) r.sprite.destroy();
        roads.length = 0;
      },
    };
  },
};
export default def;
