// where in a hook does the knuckles' peak speed happen? per-frame trace of e, tip speed (world and fighter-local), tw
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const HTML = path.resolve(process.argv[2]), OUT = process.argv[3];
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  await page.route('**/*', r => { const u = r.request().url();
    if (u.startsWith('http://ironcanvas.test/')) return r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(HTML) });
    if (/three@0\.160\.0\/build\/three\.module\.js/.test(u)) return r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync('/home/user/dl/three/three.module.js') });
    return r.continue(); });
  await page.addInitScript(() => { localStorage.setItem('ironcanvas.quality', '"low"'); });
  await page.goto('http://ironcanvas.test/index.html');
  await page.waitForFunction(() => window.ironCanvas && window.ironCanvas.state === 'title', null, { timeout: 240000, polling: 500 });
  const out = await page.evaluate(() => {
    const g = window.ironCanvas, real = g.frame.bind(g); g.frame = () => {};
    g.setSetting('roundLen', 90); g.autopilot = true; g.startFight({ p0: 0, p1: 1 });
    const hooks = [], cur = new Map();
    for (let i = 0; i < 120 * 150 && hooks.length < 25; i++) {
      const s0 = g.simT; g.noRender = true; real(1 / 120); const dt = g.simT - s0;
      if (g.state === 'break') g.nextRound();
      for (const f of g.fighters) {
        const a = f.act; f.obj.root.updateMatrixWorld(true);
        if (a && a.kind === 'punch' && (a.type === 'hook' || a.type === 'upper')) {
          let c = cur.get(f); if (!c || c.act !== a) { c = { act: a, rows: [], prevW: null, prevL: null }; cur.set(f, c); }
          const tipW = f.obj.root.localToWorld(f.tips[a.realHand].clone()), tipL = f.tips[a.realHand].clone();
          if (c.prevW && dt > 0.002) c.rows.push({ t: +a.t.toFixed(3), u: +(a.t / a.tS).toFixed(2), vW: +(c.prevW.distanceTo(tipW) / dt).toFixed(1), vL: +(c.prevL.distanceTo(tipL) / dt).toFixed(1), tw: +f.sm.tw[a.realHand].toFixed(2), viol: Object.keys(f.rig.viol).filter(k => /hand|fore|arm/.test(k)).join(',') });
          c.prevW = tipW; c.prevL = tipL;
          if (a.t > a.tS + a.tA && !c.done) { c.done = true; const pk = c.rows.reduce((m, r) => r.vW > m.vW ? r : m, { vW: 0 }); hooks.push({ who: f.def.id, type: a.type, tS: +a.tS.toFixed(3), p: +a.p.toFixed(2), vT: +a.vT.toFixed(1), result: a.result, peak: pk, rows: pk.vW > 14 ? c.rows : undefined }); }
        }
      }
    }
    return hooks;
  });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); await browser.close();
})();
