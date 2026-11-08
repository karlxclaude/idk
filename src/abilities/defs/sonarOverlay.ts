/**
 * Sonar overlay (helper module for the Abyss ability 'bioluminescentLure': no default export, so the
 * ability registry skips it). While active it draws, in screen space:
 *  - an expanding sonar sweep ring around the player,
 *  - pulsing rings on prey (cyan) and threats (red) that are on screen,
 *  - edge-of-screen arrows pointing at off-screen prey/threats.
 * It also stamps every entity with data.pingUntil so darkness mechanics reveal them.
 * Sprites are pooled; nothing is redrawn per frame.
 */
import { Container, Sprite, type Ticker } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import type { GameContext } from '../../core/context';

const arrowTex = () =>
  bakeTexture('sonar:arrow', 64, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(s * 0.82, s / 2);
    c.lineTo(s * 0.3, s * 0.26);
    c.lineTo(s * 0.42, s / 2);
    c.lineTo(s * 0.3, s * 0.74);
    c.closePath();
    c.fill();
  });

const PREY = 0x3ff5ff;
const THREAT = 0xff4a5a;
const MAX_RINGS = 26;
const MAX_ARROW_PREY = 12;
const MAX_ARROW_THREAT = 5;

interface Cand { sx: number; sy: number; d2: number; r: number; uid: number }

let root: Container | null = null;
let sweep: Sprite | null = null;
let ticker: ((t: Ticker) => void) | null = null;
let timeLeft = 0;
let total = 1;
let owner: GameContext | null = null;
const arrows: Sprite[] = [];
const rings: Sprite[] = [];
const prey: Cand[] = [];
const threats: Cand[] = [];

function grab(pool: Sprite[], i: number, make: () => Sprite): Sprite {
  while (pool.length <= i) {
    const s = make();
    root!.addChild(s);
    pool.push(s);
  }
  return pool[i];
}
const makeArrow = () => { const s = new Sprite(arrowTex()); s.anchor.set(0.5); s.blendMode = 'add'; return s; };
const makeRing = () => { const s = new Sprite(Tex.ring()); s.anchor.set(0.5); s.blendMode = 'add'; return s; };

function stop() {
  if (owner && ticker) owner.app.ticker.remove(ticker);
  ticker = null;
  if (root) { root.destroy({ children: true }); root = null; }
  sweep = null;
  arrows.length = rings.length = 0;
  owner = null;
  timeLeft = 0;
}

function frame(ctx: GameContext, realDt: number) {
  if (!root) return;
  if (ctx.tier.index !== 4) { stop(); return; }
  if (!ctx.loop.paused) timeLeft -= realDt;
  if (timeLeft <= 0) { stop(); return; }
  const cam = ctx.camera, pl = ctx.player;
  const W = cam.width, H = cam.height, cx = W / 2, cy = H / 2, m = 38;
  const life = timeLeft / total;
  const fade = Math.min(1, timeLeft / 0.8) * Math.min(1, (total - timeLeft) / 0.15 + 0.2);
  const now = performance.now() / 1000;
  const eatRatio = ctx.tier.eatRatio ?? ctx.stats.eatRatio;

  // Expanding sweep ring from the player.
  const ph = (now * 0.9) % 1;
  const sx0 = cam.worldToScreenX(pl.x), sy0 = cam.worldToScreenY(pl.y);
  sweep!.position.set(sx0, sy0);
  sweep!.width = sweep!.height = Math.max(W, H) * 2.2 * ph + 20;
  sweep!.alpha = (1 - ph) * 0.55 * fade;

  prey.length = threats.length = 0;
  const stamp = ctx.tierTime + timeLeft;
  for (const e of ctx.world.entities) {
    if (e.dead || e.intangible) continue;
    if (!(typeof e.data.pingUntil === 'number' && e.data.pingUntil > stamp - 0.01)) e.data.pingUntil = stamp;
    const isPrey = e.arch.edible !== 'never' && e.radius < pl.radius * eatRatio;
    const sx = cam.worldToScreenX(e.x), sy = cam.worldToScreenY(e.y);
    const dx = e.x - pl.x, dy = e.y - pl.y;
    const c: Cand = { sx, sy, d2: dx * dx + dy * dy, r: e.radius * cam.rzoom, uid: e.uid };
    (isPrey ? prey : threats).push(c);
  }
  prey.sort((a, b) => a.d2 - b.d2);
  threats.sort((a, b) => a.d2 - b.d2);

  let ai = 0, ri = 0;
  const place = (list: Cand[], maxArrows: number, color: number) => {
    let n = 0, nr = 0;
    for (const c of list) {
      if (n >= maxArrows && nr >= MAX_RINGS) break;
      const on = c.sx > m && c.sx < W - m && c.sy > m && c.sy < H - m;
      if (on) {
        if (nr >= MAX_RINGS) continue;
        nr++;
        const r = grab(rings, ri++, makeRing);
        const t = (now * 1.1 + c.uid * 0.37) % 1;
        r.visible = true;
        r.tint = color;
        r.position.set(c.sx, c.sy);
        r.width = r.height = Math.max(40, c.r * 2.8) * (0.7 + t * 0.9);
        r.alpha = (1 - t) * 0.95 * fade;
      } else {
        if (n >= maxArrows) continue;
        const dx = c.sx - cx, dy = c.sy - cy;
        const k = Math.min((cx - m) / (Math.abs(dx) || 1), (cy - m) / (Math.abs(dy) || 1));
        const a = grab(arrows, ai++, makeArrow);
        a.visible = true;
        a.tint = color;
        a.position.set(cx + dx * k, cy + dy * k);
        a.rotation = Math.atan2(dy, dx);
        const near = Math.min(1, 1.6 - Math.sqrt(c.d2) / (cam.gameplayViewRadius(pl.radius) * 3));
        const s = (color === THREAT ? 26 : 22) + 14 * Math.max(0, near) + Math.min(14, c.r * 0.3);
        const pulse = 0.85 + 0.15 * Math.sin(now * 8 + c.uid);
        a.width = a.height = s * pulse;
        a.alpha = (0.45 + 0.55 * Math.max(0, near)) * fade * (0.6 + 0.4 * life + 0.4);
        n++;
      }
    }
  };
  place(prey, MAX_ARROW_PREY, PREY);
  place(threats, MAX_ARROW_THREAT, THREAT);
  for (let i = ai; i < arrows.length; i++) arrows[i].visible = false;
  for (let i = ri; i < rings.length; i++) rings[i].visible = false;
}

/** Start (or extend) the sonar for `seconds`. */
export function startSonar(ctx: GameContext, seconds: number) {
  if (root && owner === ctx) { total = seconds; timeLeft = seconds; return; }
  stop();
  total = seconds;
  timeLeft = seconds;
  owner = ctx;
  root = new Container();
  sweep = new Sprite(Tex.ring());
  sweep.anchor.set(0.5);
  sweep.blendMode = 'add';
  sweep.tint = PREY;
  root.addChild(sweep);
  ctx.layers.screenFx.addChild(root);
  ticker = (t: Ticker) => frame(ctx, t.deltaMS / 1000);
  ctx.app.ticker.add(ticker);
}
