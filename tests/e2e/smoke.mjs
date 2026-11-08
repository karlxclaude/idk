// E2E smoke test: serves the production build, drives the game with Playwright chromium.
// Usage: node tests/e2e/smoke.mjs [--shots DIR]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const shotDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });
const failures = [];
const step = (m) => console.log(`[e2e] ${m}`);
const fail = (m) => { failures.push(m); console.error(`[e2e] FAIL: ${m}`); };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
const kill = () => { try { process.kill(-server.pid, 'SIGKILL'); } catch { /* gone */ } };
process.on('exit', kill);

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not yet */ }
    await sleep(500);
  }
  throw new Error('preview server did not start:\n' + log);
}
const IGNORABLE = [/GPU stall/i, /swiftshader/i, /WebGL.*(performance|deprecated)/i, /AudioContext/i, /autoplay/i, /favicon/i];
const attach = (page, bucket) => {
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORABLE.some((r) => r.test(m.text()))) bucket.push(`console.error: ${m.text()}`); });
  page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`));
};
const shot = async (page, name) => { if (shotDir) await page.screenshot({ path: `${shotDir}/${name}.png` }); };

async function run(viewport, label, mobile = false) {
  const ctx = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  attach(page, errs);
  await page.goto(BASE);
  step(`${label}: waiting for title`);
  await page.waitForSelector('.screen.title.on', { timeout: 30000 });
  await page.waitForFunction(() => window.__game && window.__game.world.player, null, { timeout: 30000 });
  await sleep(1500);
  await shot(page, `${label}-title`);
  await page.click('.screen.title [data-a="play"]');
  await page.waitForFunction(() => window.__game.phase === 'playing', null, { timeout: 5000 });
  step(`${label}: playing`);
  // Steer toward food for a while using the pointer / touch.
  const cx = viewport.width / 2, cy = viewport.height / 2;
  // Touch steering follows a held finger, so drive a real touch sequence through CDP instead of tap().
  const cdp = mobile ? await ctx.newCDPSession(page) : null;
  let touching = false;
  const touch = async (x, y) => {
    await cdp.send('Input.dispatchTouchEvent', { type: touching ? 'touchMove' : 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    touching = true;
  };
  for (let i = 0; i < 24; i++) {
    const target = await page.evaluate(() => {
      const g = window.__game, p = g.world.player, cam = g.camera;
      let best = null, bd = Infinity;
      for (const f of g.world.food) {
        if (f.state !== 'free') continue;
        const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
        if (d < bd) { bd = d; best = f; }
      }
      if (!best) return null;
      return { x: cam.worldToScreenX(best.x), y: cam.worldToScreenY(best.y) };
    });
    const tx = target ? Math.min(viewport.width - 5, Math.max(5, target.x)) : cx + 200;
    const ty = target ? Math.min(viewport.height - 5, Math.max(5, target.y)) : cy;
    if (mobile) await touch(tx, ty); else await page.mouse.move(tx, ty);
    await sleep(250);
    if (i === 6) await shot(page, `${label}-play`);
  }
  if (cdp && touching) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const stats = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    return { eaten: w.foodEaten, radius: w.player.radius, phase: g.phase, orgs: w.organisms.length, food: w.food.length, fps: g.loop.fps };
  });
  step(`${label}: ${JSON.stringify(stats)}`);
  if (stats.eaten < 1) fail(`${label}: player ate nothing while steering at food`);
  if (stats.radius <= 24) fail(`${label}: player did not grow`);
  // Force a division and watch it complete.
  await page.evaluate(() => { const w = window.__game.world; w.player.addMass(w.divideRadius ** 2 - w.player.mass + 50); });
  await page.waitForFunction(() => window.__game.world.player.state === 'dividing', null, { timeout: 8000 }).catch(() => fail(`${label}: division never started`));
  await sleep(1400);
  await shot(page, `${label}-mitosis`);
  await page.waitForFunction(() => window.__game.world.generation >= 1, null, { timeout: 8000 }).catch(() => fail(`${label}: division never finished`));
  await sleep(600);
  await shot(page, `${label}-divided`);
  // Pause / resume.
  await page.keyboard.press('Escape');
  await sleep(300);
  if (!(await page.evaluate(() => window.__game.paused))) fail(`${label}: pause did not engage`);
  await page.click('.screen.pause [data-a="resume"]');
  await sleep(300);
  if (await page.evaluate(() => window.__game.paused)) fail(`${label}: resume failed`);
  // Death: drop a huge predator on the player.
  await page.evaluate(() => { const w = window.__game.world, p = w.player; w.graceTimer = 0; const pr = w.spawnOrganism('predator', p.x + p.radius * 0.5, p.y, p.radius * 2.5); pr.vx = 0; });
  await page.waitForFunction(() => window.__game.phase === 'dying', null, { timeout: 6000 }).catch(() => fail(`${label}: player was never engulfed`));
  await sleep(900);
  await shot(page, `${label}-dying`);
  await page.waitForSelector('.screen.death.on', { timeout: 8000 }).catch(() => fail(`${label}: death screen did not appear`));
  await sleep(1200);
  await shot(page, `${label}-death`);
  await page.click('.screen.death [data-a="restart"]');
  await page.waitForFunction(() => window.__game.phase === 'playing' && window.__game.world.generation === 0, null, { timeout: 6000 }).catch(() => fail(`${label}: restart failed`));
  await sleep(1500);
  await shot(page, `${label}-restarted`);
  const fps = await page.evaluate(() => window.__game.loop.fps);
  step(`${label}: fps ${fps.toFixed(1)} (software GL)`);
  for (const e of errs) fail(`${label}: ${e}`);
  await ctx.close();
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await run({ width: 1100, height: 700 }, 'desktop');
  await run({ width: 390, height: 780 }, 'phone', true);
} catch (e) {
  fail(String(e?.stack || e));
} finally {
  await browser?.close();
  kill();
}
if (failures.length) { console.error(`\n[e2e] ${failures.length} failure(s)`); process.exit(1); }
console.log('\n[e2e] all good');
