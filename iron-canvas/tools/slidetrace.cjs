// trace the frames around a planted-foot slide: target ball (f.w), target ankle, rendered ankle and ball
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
    const V3 = g.camera.position.constructor;
    g.setSetting('roundLen', 90); g.autopilot = true; g.startFight({ p0: 0, p1: 1 });
    const ring = {}, ph = {}, found = [];
    const r3 = v => v.toArray().map(x => +x.toFixed(3));
    for (let i = 0; i < 120 * 100 && found.length < 3; i++) {
      const s0 = g.simT; g.noRender = true; real(1 / 120); const dt = g.simT - s0;
      if (g.state === 'break') g.nextRound();
      const live = ['fight', 'knockdown', 'count', 'roundEnd'].includes(g.state) && dt > 0;
      for (const f of g.fighters) {
        f.obj.root.updateMatrixWorld(true);
        for (const S of ['L', 'R']) {
          const vS = f.side > 0 ? S : (S === 'L' ? 'R' : 'L'), ft = f.feet[vS], key = f.def.id + S;
          const busy = (f.state === 'kick' && vS === 'R') || (f.state === 'check' && vS === 'L');
          const planted = live && !f.isDown() && ft.step < 0 && !busy;
          const ball = f.obj.bones['foot' + S].localToWorld((ft.r < 0 ? f.heelLocal : f.ballLocal).clone());
          const ank = f.obj.bones['foot' + S].getWorldPosition(new V3()), tank = f.ankleFromBall(ft, new V3());
          const rec = { t: +g.simT.toFixed(4), st: f.state, step: +ft.step.toFixed(2), r: +ft.r.toFixed(3), w: r3(ft.w), ball: r3(ball), ank: r3(ank), tank: r3(tank), pos: r3(f.pos), yaw: +f.yaw.toFixed(3), short: +f.rig.leg[S].short.toFixed(3), rag: f.rag.active ? f.rag.mode + ' w' + f.rag.w[14].toFixed(2) : '-', fc: f.sm.fc[S], side: f.side };
          (ring[key] || (ring[key] = [])).push(rec); if (ring[key].length > 14) ring[key].shift();
          const st = ph[key] || (ph[key] = { on: false });
          const piv = ft.r < 0 ? 'heel' : 'ball';
          if (planted) {
            if (!st.on || st.piv !== piv) Object.assign(st, { on: true, ax: ball.x, az: ball.z, piv });
            const d = Math.hypot(ball.x - st.ax, ball.z - st.az);
            if (d > 0.03) { found.push({ key, d: +d.toFixed(3), trace: ring[key].slice() }); st.on = false; }
          } else st.on = false;
        }
      }
    }
    return found;
  });
  fs.writeFileSync('/home/user/work/slidetrace.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
