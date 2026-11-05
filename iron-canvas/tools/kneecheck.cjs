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
    const V3 = g.camera.position.constructor, Q4 = g.camera.quaternion.constructor;
    g.setSetting('roundLen', 90); g.autopilot = true; g.startFight({ p0: 0, p1: 1 });
    const r3 = v => v.toArray().map(x => +x.toFixed(3)), res = [];
    const I = { hip: { L: 13, R: 18 }, kn: { L: 14, R: 19 }, an: { L: 15, R: 20 }, toe: { L: 16, R: 21 }, heel: { L: 17, R: 22 } };
    for (let i = 0; i < 120 * 200 && res.length < 4; i++) {
      g.noRender = true; real(1 / 120); if (g.state === 'break') g.nextRound();
      for (const f of g.fighters) {
        if (!f.isDown() || !f.rag.active) continue; f.obj.root.updateMatrixWorld(true); const b = f.obj.bones;
        for (const S of ['L', 'R']) {
          const hip = b['thigh' + S].getWorldPosition(new V3()), kn = b['shin' + S].getWorldPosition(new V3()), an = b['foot' + S].getWorldPosition(new V3());
          const u = kn.clone().sub(hip).normalize(), w = an.clone().sub(kn).normalize(), cr = u.clone().cross(w);
          const Hf = new V3(1, 0, 0).applyQuaternion(b['foot' + S].getWorldQuaternion(new Q4()));
          if (cr.length() < 0.3 || cr.dot(Hf) > 0) continue;
          const x = f.rag.x, px = { hip: x[I.hip[S]], kn: x[I.kn[S]], an: x[I.an[S]], toe: x[I.toe[S]], heel: x[I.heel[S]] };
          const pcr = px.kn.clone().sub(px.hip).normalize().cross(px.an.clone().sub(px.kn).normalize());
          const z = px.toe.clone().sub(px.heel).normalize(), yh = px.an.clone().sub(px.toe.clone().add(px.heel).multiplyScalar(0.5)), pLat = yh.clone().cross(z).normalize();
          res.push({ who: f.def.id + S, side: f.side, boneBend: r3(cr.normalize()), footLatBone: r3(Hf), partBend: r3(pcr.normalize()), partFootLat: r3(pLat), href: r3(f.rag.href['leg' + S]), boneKnee: r3(kn), partKnee: r3(px.kn), boneAnkle: r3(an), partAnkle: r3(px.an), hipB: r3(hip), hipP: r3(px.hip) });
        }
      }
    }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); await browser.close();
})();
