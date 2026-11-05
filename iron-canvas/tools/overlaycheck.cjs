// node tools/overlaycheck.cjs <game.html> <outDir>   — F3 overlay screenshots + error capture
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const HTML = path.resolve(process.argv[2]), OUT = path.resolve(process.argv[3] || 'verify/after');
const THREE_LOCAL = process.env.THREE_LOCAL || '/home/user/dl/three/three.module.js';
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://ironcanvas.test/')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML) });
    if (/three@0\.160\.0\/build\/three\.module\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(THREE_LOCAL), headers: { 'access-control-allow-origin': '*' } });
    return route.continue();
  });
  await page.addInitScript(() => { try { localStorage.setItem('ironcanvas.quality', JSON.stringify('low')); localStorage.setItem('ironcanvas.fps', 'false'); } catch (e) {} });
  await page.goto('http://ironcanvas.test/index.html');
  await page.waitForFunction(() => window.ironCanvas && window.ironCanvas.state === 'title', null, { timeout: 240000, polling: 500 });
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8') });
  const res = {};
  res.f3 = await page.evaluate(() => { const d = window.ironCanvas.debug; const a = d.on; return { start: a }; });
  await page.keyboard.press('F3'); res.afterF3 = await page.evaluate(() => window.ironCanvas.debug.on);
  await page.keyboard.press('F3'); res.afterF3b = await page.evaluate(() => window.ironCanvas.debug.on);
  await page.evaluate(() => window.ironCanvas.debug.toggle(true));
  for (const k of ['idle', 'jab', 'hit', 'ko']) {
    res[k] = await page.evaluate(async kind => window.__probe.stage(kind), k);
    await page.evaluate(() => window.__probe.renderFrozen(2));
    res[k].dbg = await page.evaluate(() => { const g = window.ironCanvas; return g.fighters.map(f => ({ st: f.state, margin: f.bal.margin, poly: f.bal.poly.length, viol: Object.keys(f.rig.viol), rviol: Object.keys(f.rag.viol || {}) })); });
    await page.screenshot({ path: path.join(OUT, `overlay-${k}.png`) });
  }
  res.errors = errors; console.log(JSON.stringify(res, null, 1)); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
