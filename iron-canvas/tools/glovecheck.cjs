// at the first frame of each punch's hit window: rig tip (group→world) vs rendered tip vs goal (pose tg → world) vs aim
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const HTML = path.resolve(process.argv[2]);
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
    const rows = [];
    for (let i = 0; i < 120 * 270 && rows.length < 12; i++) {
      g.noRender = true; real(1 / 120); if (g.state === 'break') g.nextRound();
      for (const f of g.fighters) {
        const a = f.act; if (!a || a.kind !== 'punch' || a.__gc || a.t < a.tS || a.t >= a.tS + a.tA) continue; a.__gc = true;
        f.obj.root.updateMatrixWorld(true); const S = a.realHand, R = f.rig, ar = R.arm[S];
        const rend = f.obj.root.localToWorld(f.tips[S].clone()), rigTip = f.obj.root.localToWorld(ar.tipL.clone().applyQuaternion(R.Q['hand' + S]).add(R.P['hand' + S]));
        const goalL = f.sm.tg[S].clone(); const goalW = f.obj.root.localToWorld(goalL);
        const e = rend.distanceTo(a.aim) * 100; if (e < 1) continue;
        rows.push({ type: a.type, err: +e.toFixed(2), rendVsRig: +(rend.distanceTo(rigTip) * 100).toFixed(2), rigVsGoal: +(rigTip.distanceTo(goalW) * 100).toFixed(2), goalVsAim: +(goalW.distanceTo(a.aim) * 100).toFixed(2), tw: f.sm.tw[S], rag: f.rag.active, side: f.side, rigErr: +(ar.err * 100).toFixed(2) });
      }
    }
    return rows;
  });
  console.log(JSON.stringify(out, null, 0)); await browser.close();
})();
