// Headless verification harness for Iron Canvas (software rendering, no GPU).
//   node tools/harness.cjs <game.html> <outDir> [fight] [shots] [perf]
// The page is served from a fake origin by request interception; three.js r160 is served from a local copy
// of the same pinned CDN file; Google Fonts are blocked (the game falls back after 1.5 s).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , htmlArg, outArg, ...modes] = process.argv;
if (!htmlArg || !outArg) { console.error('usage: node harness.cjs <game.html> <outDir> [fight] [shots] [perf]'); process.exit(2); }
const HTML = path.resolve(htmlArg), OUT = path.resolve(outArg);
const THREE_LOCAL = process.env.THREE_LOCAL || '/home/user/dl/three/three.module.js';
fs.mkdirSync(OUT, { recursive: true });
const want = m => modes.includes(m);
const ROUNDS = +(process.env.ROUNDS || 3), ROUND_LEN = +(process.env.ROUND_LEN || 90), DT = +(process.env.DT || 1 / 120);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], warnings = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith('http://ironcanvas.test/')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML) });
    if (/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/build\/three\.module\.js/.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(THREE_LOCAL), headers: { 'access-control-allow-origin': '*' } });
    // Google Fonts load from the network as in normal play
    if (u.startsWith('blob:') || u.startsWith('data:')) return route.continue();
    return route.continue();
  });
  await page.addInitScript(() => { try { localStorage.setItem('ironcanvas.quality', JSON.stringify('low')); localStorage.setItem('ironcanvas.fps', 'false'); } catch (e) {} });
  const t0 = Date.now();
  await page.goto('http://ironcanvas.test/index.html');
  await page.waitForFunction(() => window.ironCanvas && window.ironCanvas.state === 'title', null, { timeout: 240000, polling: 500 });
  const report = { file: HTML, bootMs: Date.now() - t0 };
  const gl = await page.evaluate(() => { const r = window.ironCanvas.post.r; const c = r.getContext(); const d = c.getExtension('WEBGL_debug_renderer_info'); return { webgl2: r.capabilities.isWebGL2, renderer: d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER) }; });
  report.gl = gl;
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8') });

  if (want('fight')) {
    report.fight = await page.evaluate(async ({ ROUNDS, ROUND_LEN, DT }) => window.__probe.fight({ rounds: ROUNDS, roundLen: ROUND_LEN, dt: DT }), { ROUNDS, ROUND_LEN, DT });
  }
  if (want('perf')) {
    report.perf = await page.evaluate(() => window.__probe.perf());
  }
  if (want('shots')) {
    const kinds = (process.env.SHOTS || 'jab,cross,kick,hit,ko').split(',');
    report.shots = {};
    for (const k of kinds) {
      const info = await page.evaluate(async kind => window.__probe.stage(kind), k);
      // render a few frames with the simulation frozen so the camera, shadows and post settle on the staged pose
      await page.evaluate(() => window.__probe.renderFrozen(2));
      const file = path.join(OUT, `shot-${k}.png`);
      await page.screenshot({ path: file });
      report.shots[k] = Object.assign({ file }, info);
    }
  }
  report.consoleErrors = errors; report.consoleWarnings = warnings.slice(0, 40);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, (k, v) => (k === 'samples' ? undefined : v), 1).slice(0, 20000));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
