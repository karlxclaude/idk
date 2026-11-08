// E2E smoke test: starts vite, drives the game with Playwright chromium.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const root = process.env.PLAYWRIGHT_NODE_PATH || '/opt/node22/lib/node_modules';
  ({ chromium } = require(`${root}/playwright`));
}

const PORT = 5199;
const BASE = `http://localhost:${PORT}/`;
const TIER_COUNT = Number(process.env.TIER_COUNT || 12);
const failures = [];
const step = (m) => console.log(`[e2e] ${m}`);
const fail = (m) => { failures.push(m); console.error(`[e2e] FAIL: ${m}`); };

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let viteLog = '';
vite.stdout.on('data', (d) => (viteLog += d));
vite.stderr.on('data', (d) => (viteLog += d));
const killVite = () => { try { process.kill(-vite.pid, 'SIGKILL'); } catch { /* gone */ } };
process.on('exit', killVite);

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(BASE)).ok) return; } catch { /* not yet */ }
    await sleep(500);
  }
  throw new Error('vite did not start:\n' + viteLog);
}

// Ignore noise that is environmental, not a game bug.
const IGNORABLE = [/GPU stall/i, /swiftshader/i, /WebGL.*(performance|deprecated)/i, /AudioContext/i, /autoplay/i, /favicon/i];
const ignorable = (t) => IGNORABLE.some((r) => r.test(t));

// Other editors may touch source files while tests run; a vite HMR full-reload would reset the page.
// Neutralise the HMR socket so the page under test is stable.
async function noHmr(ctx) {
  await ctx.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = function (url, protocols) {
      if (protocols === 'vite-hmr' || (Array.isArray(protocols) && protocols.includes('vite-hmr'))) {
        return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 };
      }
      return new Native(url, protocols);
    };
    window.WebSocket.prototype = Native.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  });
}

function attach(page, bucket) {
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) bucket.push(`console.error: ${m.text()}`); });
  page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`));
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

  // --- Flow: title -> new game -> scale shift -> shop -> continue
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    await noHmr(ctx);
    const page = await ctx.newPage();
    const errs = [];
    attach(page, errs);
    await page.goto(BASE);
    step('waiting for title screen');
    await page.waitForSelector('.eh-title.on', { timeout: 30000 });
    await page.click('.eh-title [data-a="new"]');
    await page.waitForSelector('.eh-title.on', { state: 'detached', timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => window.__game && !window.__game.loop.paused, null, { timeout: 30000 });
    step('game running');
    await sleep(1500);
    await page.keyboard.press(']');
    step("pressed ']' - waiting for shop");
    await page.waitForSelector('.eh-shop.vis', { timeout: 30000 });
    step('shop open');
    await page.click('.eh-shop [data-go]');
    await page.waitForSelector('.eh-shop.vis', { state: 'detached', timeout: 10000 }).catch(() => {});
    const stillOpen = await page.evaluate(() => document.querySelector('.eh-shop')?.classList.contains('vis'));
    if (stillOpen) fail('shop did not close after Continue');
    const tier = await page.evaluate(() => window.__game.tier.index);
    if (tier !== 2) fail(`expected tier 2 after shift, got ${tier}`);
    await sleep(1000);
    errs.forEach((e) => fail(`flow: ${e}`));
    await ctx.close();
  }

  // --- Each tier loads cleanly
  for (let n = 1; n <= TIER_COUNT; n++) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
    await noHmr(ctx);
    const page = await ctx.newPage();
    const errs = [];
    attach(page, errs);
    await page.goto(`${BASE}?tier=${n}&nodebugkeys`);
    try {
      await page.waitForFunction((k) => window.__game && window.__game.tier?.index === k, n, { timeout: 30000 });
      await sleep(2000);
    } catch {
      errs.push(`tier ${n} did not load (window.__game.tier.index !== ${n})`);
    }
    step(`tier ${n}: ${errs.length ? errs.length + ' error(s)' : 'ok'}`);
    errs.forEach((e) => fail(`tier ${n}: ${e}`));
    await ctx.close();
  }
} catch (e) {
  fail(`exception: ${e?.stack || e}`);
} finally {
  await browser?.close().catch(() => {});
  killVite();
}

if (failures.length) {
  console.error(`\n[e2e] ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\n[e2e] all checks passed');
process.exit(0);
