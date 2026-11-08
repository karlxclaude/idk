/** One signature ability per tier (ids match each tier file's abilityId). */
import type { AbilityDef } from '../registry';
import type { GameContext } from '../../core/context';
import type { Entity } from '../../entities/Entity';

const tmp: Entity[] = [];

const eatRatioOf = (ctx: GameContext) => ctx.tier.eatRatio ?? ctx.stats.eatRatio;
const isEdible = (ctx: GameContext, e: Entity) =>
  !e.dead && !e.intangible && e.arch.edible !== 'never' && e.radius < ctx.player.radius * eatRatioOf(ctx);
const isThreat = (ctx: GameContext, e: Entity) => !e.dead && !e.intangible && !isEdible(ctx, e);

/** Eat through Game.eat (the context is the Game instance); falls back to a plain despawn. */
function eatIt(ctx: GameContext, e: Entity) {
  const g = ctx as unknown as { eat?: (e: Entity, ratio: number) => void };
  if (g.eat) g.eat(e, e.radius / ctx.player.radius);
  else { ctx.world.despawn(e, 'eaten'); ctx.player.grow(0.02); }
}

function near(ctx: GameContext, R: number): Entity[] {
  const p = ctx.player;
  return ctx.world.within(p.x, p.y, R, []);
}

function dirOf(ctx: GameContext): [number, number] {
  const p = ctx.player;
  let dx = ctx.input.steerX, dy = ctx.input.steerY;
  let l = Math.hypot(dx, dy);
  if (l < 0.1) { dx = Math.cos(p.heading); dy = Math.sin(p.heading); l = 1; }
  return [dx / l, dy / l];
}

/** Expanding ring of particles (radius in world units). */
function ring(ctx: GameContext, r: number, color: number | number[], count = 40) {
  const p = ctx.player;
  ctx.fx.burst(p.x, p.y, { count, color, speed: r * 2.6, size: Math.max(p.radius * 0.25, r * 0.04), life: 0.55, drag: 3, grow: 0.3 });
}

function pullTo(e: Entity, tx: number, ty: number, speed: number, k: number) {
  const dx = tx - e.x, dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx += ((dx / d) * speed - e.vx) * k;
  e.vy += ((dy / d) * speed - e.vy) * k;
}

function pushFrom(e: Entity, ox: number, oy: number, impulse: number) {
  const dx = e.x - ox, dy = e.y - oy;
  const d = Math.hypot(dx, dy) || 1;
  e.vx += (dx / d) * impulse;
  e.vy += (dy / d) * impulse;
}

/** Lingering effects: remaining seconds per ability id. */
const linger = new Map<string, number>();
const startLinger = (id: string, t: number) => linger.set(id, t);
function tick(id: string, dt: number): number {
  const t = linger.get(id) ?? 0;
  if (t <= 0) return 0;
  linger.set(id, t - dt);
  return t;
}

const frozen = new Map<number, number>(); // entity uid -> seconds left

const abilities: AbilityDef[] = [
  {
    id: 'bondSnap',
    name: 'Bond Snap',
    description: 'Snap molecular bonds: prey within reach is yanked into your mouth and the closest is swallowed.',
    cooldown: 7,
    icon: '⚭',
    activate(ctx) {
      const p = ctx.player;
      let n = 0;
      for (const e of near(ctx, p.radius * 7)) {
        if (!isEdible(ctx, e)) continue;
        pullTo(e, p.x, p.y, p.radius * 16, 0.9);
        if (n < 8 && Math.hypot(e.x - p.x, e.y - p.y) < p.radius * 2.6) { eatIt(ctx, e); n++; }
      }
      ring(ctx, p.radius * 5, [ctx.tier.palette.accent, 0xffffff]);
      ctx.fx.shake(0.15);
      return true;
    },
  },
  {
    id: 'flagellumBurst',
    name: 'Flagellum Burst',
    description: 'Lash your tail: a huge burst of speed with brief invulnerability.',
    cooldown: 5,
    icon: '≋',
    activate(ctx) {
      const p = ctx.player;
      const [dx, dy] = dirOf(ctx);
      const v = p.maxSpeed(ctx) * 3.4;
      p.vx = dx * v; p.vy = dy * v;
      p.dashTime = 0.55;
      p.invuln = Math.max(p.invuln, 0.6);
      startLinger('flagellumBurst', 0.55);
      ctx.fx.burst(p.x, p.y, { count: 28, color: ctx.tier.palette.playerGlow, speed: p.radius * 5, size: p.radius * 0.3, life: 0.6, spread: 0.45, angle: Math.atan2(-dy, -dx) });
      return true;
    },
    update(ctx, dt) {
      if (tick('flagellumBurst', dt) > 0) {
        const p = ctx.player;
        ctx.fx.burst(p.x, p.y, { count: 2, color: ctx.tier.palette.playerGlow, speed: p.radius, size: p.radius * 0.35, life: 0.4 });
      }
    },
  },
  {
    id: 'bioluminescentLure',
    name: 'Sonar',
    description: 'Ping the deep: prey and threats are revealed with arrows pointing past the screen edge for several seconds.',
    cooldown: 12,
    icon: '◎',
    activate(ctx) {
      // Overlay lives in sonarOverlay.ts (helper module); loaded through a glob so this entry stays self-contained.
      const mods = import.meta.glob('./sonarOverlay.ts', { eager: true }) as Record<string, { startSonar: (c: GameContext, s: number) => void }>;
      for (const m of Object.values(mods)) m.startSonar(ctx, 6);
      startLinger('bioluminescentLure', 6);
      ring(ctx, ctx.player.radius * 14, [ctx.tier.palette.accent, 0xffffff], 70);
      ctx.fx.flash(0.16, ctx.tier.palette.accent, 3);
      return true;
    },
    update(ctx, dt) {
      if (tick('bioluminescentLure', dt) <= 0) return;
      const p = ctx.player;
      if (Math.random() < dt * 1.4) ring(ctx, p.radius * 10, ctx.tier.palette.accent, 22);
    },
  },
  {
    id: 'tidalSurge',
    name: 'Tidal Surge',
    description: 'Ride a wave: surge forward carrying small prey along and shoving threats aside.',
    cooldown: 8,
    icon: '≈',
    activate(ctx) {
      const p = ctx.player;
      const [dx, dy] = dirOf(ctx);
      const v = p.maxSpeed(ctx) * 2.6;
      p.vx += dx * v; p.vy += dy * v;
      p.dashTime = 0.45;
      p.invuln = Math.max(p.invuln, 0.4);
      for (const e of near(ctx, p.radius * 12)) {
        const rx = e.x - p.x, ry = e.y - p.y;
        const along = rx * dx + ry * dy;
        if (along < 0 || Math.hypot(rx, ry) < 1e-3 || along / Math.hypot(rx, ry) < 0.5) continue;
        if (isEdible(ctx, e)) { e.vx = dx * v * 0.9; e.vy = dy * v * 0.9; }
        else if (isThreat(ctx, e)) { const side = Math.sign(rx * dy - ry * dx) || 1; e.vx += -dy * side * p.radius * 14; e.vy += dx * side * p.radius * 14; }
      }
      ctx.fx.burst(p.x, p.y, { count: 50, color: [ctx.tier.palette.glow, 0xffffff], speed: p.radius * 12, size: p.radius * 0.4, life: 0.7, spread: 0.5, angle: Math.atan2(dy, dx) });
      ctx.fx.shake(0.3);
      return true;
    },
  },
  {
    id: 'gridlock',
    name: 'Blackout',
    description: 'Cut the power: everything bigger than you nearby grinds almost to a halt for 4 seconds.',
    cooldown: 14,
    icon: '⏻',
    activate(ctx) {
      const p = ctx.player;
      let n = 0;
      for (const e of near(ctx, p.radius * 14)) if (isThreat(ctx, e)) { frozen.set(e.uid, 4); n++; }
      ring(ctx, p.radius * 10, [0x222233, ctx.tier.palette.accent]);
      ctx.fx.flash(0.35, 0x000000, 2);
      return n >= 0 || true;
    },
    update(ctx, dt) {
      if (!frozen.size) return;
      for (const e of ctx.world.entities) {
        const t = frozen.get(e.uid);
        if (t === undefined) continue;
        if (e.dead) { frozen.delete(e.uid); continue; }
        e.vx *= 0.12; e.vy *= 0.12;
        e.alpha = Math.min(e.alpha, 0.6);
        if (t - dt <= 0) frozen.delete(e.uid); else frozen.set(e.uid, t - dt);
      }
      if (frozen.size > 400) frozen.clear();
    },
  },
  {
    id: 'tectonicQuake',
    name: 'Impact Quake',
    description: 'Slam the ground: a heavy shockwave devours small things and hurls bigger ones away.',
    cooldown: 10,
    icon: '⛰',
    activate(ctx) {
      const p = ctx.player;
      let n = 0;
      for (const e of near(ctx, p.radius * 9)) {
        if (isEdible(ctx, e)) {
          if (e.radius < p.radius * 0.45 && n < 20) { eatIt(ctx, e); n++; } else pushFrom(e, p.x, p.y, p.radius * 6);
        } else if (isThreat(ctx, e)) pushFrom(e, p.x, p.y, p.radius * 14);
      }
      ring(ctx, p.radius * 9, [0xffb36b, ctx.tier.palette.accent, 0xffffff], 60);
      ctx.fx.shake(0.8);
      ctx.fx.hitStop(80);
      return true;
    },
  },
  {
    id: 'solarFlare',
    name: 'Supernova',
    description: 'A huge radial blast that consumes everything smaller and blasts the rest away.',
    cooldown: 16,
    icon: '☀',
    activate(ctx) {
      const p = ctx.player;
      let n = 0;
      for (const e of near(ctx, p.radius * 11)) {
        if (isEdible(ctx, e)) { if (n < 30) { eatIt(ctx, e); n++; } }
        else if (isThreat(ctx, e)) pushFrom(e, p.x, p.y, p.radius * 18);
      }
      p.invuln = Math.max(p.invuln, 0.8);
      ring(ctx, p.radius * 11, [0xffe08a, 0xff7a3a, 0xffffff], 90);
      ctx.fx.flash(0.6, 0xffe9a8, 3);
      ctx.fx.shake(0.9);
      ctx.fx.hitStop(100);
      return true;
    },
  },
  {
    id: 'spiralArm',
    name: 'Spiral Arms',
    description: 'For 5 seconds everything nearby swirls in a galactic spiral toward your core.',
    cooldown: 15,
    icon: '🌀',
    activate(ctx) {
      startLinger('spiralArm', 5);
      ring(ctx, ctx.player.radius * 12, [ctx.tier.palette.accent, ctx.tier.palette.glow], 60);
      return true;
    },
    update(ctx, dt) {
      if (tick('spiralArm', dt) <= 0) return;
      const p = ctx.player;
      for (const e of near(ctx, p.radius * 15)) {
        if (!isEdible(ctx, e)) continue;
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const s = p.radius * 5;
        e.vx += ((dx / d) * s * 0.7 + (-dy / d) * s - e.vx) * 0.08;
        e.vy += ((dy / d) * s * 0.7 + (dx / d) * s - e.vy) * 0.08;
      }
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2, r = p.radius * (3 + Math.random() * 9);
        ctx.fx.burst(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, { count: 2, color: ctx.tier.palette.accent, speed: p.radius, size: p.radius * 0.3, life: 0.6 });
      }
    },
  },
  {
    id: 'darkMatterTug',
    name: 'Filament Ride',
    description: 'Tug the cosmic web: all smaller matter in a vast radius streams in along filaments for 3 seconds.',
    cooldown: 14,
    icon: '⌇',
    activate(ctx) {
      startLinger('darkMatterTug', 3);
      ring(ctx, ctx.player.radius * 25, [ctx.tier.palette.accent, 0xffffff], 80);
      ctx.fx.shake(0.3);
      return true;
    },
    update(ctx, dt) {
      if (tick('darkMatterTug', dt) <= 0) return;
      const p = ctx.player;
      for (const e of near(ctx, p.radius * 28)) if (isEdible(ctx, e)) pullTo(e, p.x, p.y, p.radius * 10, 0.1);
    },
  },
  {
    id: 'inflationPulse',
    name: 'Big Crunch',
    description: 'Collapse space around you: a huge implosion drags in all smaller things and eats the nearest.',
    cooldown: 18,
    icon: '⊛',
    activate(ctx) {
      const p = ctx.player;
      let n = 0;
      for (const e of near(ctx, p.radius * 18)) {
        if (isEdible(ctx, e)) {
          pullTo(e, p.x, p.y, p.radius * 20, 0.95);
          if (n < 25 && Math.hypot(e.x - p.x, e.y - p.y) < p.radius * 4) { eatIt(ctx, e); n++; }
        } else if (isThreat(ctx, e)) pushFrom(e, p.x, p.y, p.radius * 8);
      }
      ring(ctx, p.radius * 16, [0x000000, ctx.tier.palette.accent, 0xffffff], 80);
      ctx.fx.flash(0.4, 0xffffff, 3);
      ctx.fx.shake(0.8);
      return true;
    },
  },
  {
    id: 'bubbleNucleation',
    name: 'Inflate',
    description: 'Nucleate a vacuum bubble: for 4 seconds you are invulnerable and a vast pull gathers everything smaller.',
    cooldown: 20,
    icon: '◯',
    activate(ctx) {
      startLinger('bubbleNucleation', 4);
      ctx.player.invuln = Math.max(ctx.player.invuln, 4);
      ring(ctx, ctx.player.radius * 20, [ctx.tier.palette.glow, 0xffffff], 80);
      ctx.fx.flash(0.3, ctx.tier.palette.glow, 3);
      return true;
    },
    update(ctx, dt) {
      if (tick('bubbleNucleation', dt) <= 0) return;
      const p = ctx.player;
      for (const e of near(ctx, p.radius * 24)) {
        if (isEdible(ctx, e)) pullTo(e, p.x, p.y, p.radius * 8, 0.08);
        else if (isThreat(ctx, e) && Math.hypot(e.x - p.x, e.y - p.y) < p.radius * 8) pushFrom(e, p.x, p.y, p.radius * 1.2);
      }
    },
  },
];
export default abilities;
