// one-off diagnostics: run AI vs AI and dump the frames where a glove jumps or a knee folds the wrong way
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const HTML = path.resolve(process.argv[2]);
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; page.on('pageerror', e => errs.push(e.stack || e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
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
    const prev = {}, spikes = [], slides = [], strikes = [], ph = {}, hist = {}, gl = [], kn2 = [];
    for (let i = 0; i < 120 * 200; i++) {
      const s0 = g.simT; g.noRender = true; real(1 / 120); const dt = g.simT - s0;
      if (g.state === 'break') g.nextRound();
      const live = ['fight', 'knockdown', 'count', 'roundEnd'].includes(g.state) && dt > 0;
      for (const f of g.fighters) {
        f.obj.root.updateMatrixWorld(true);
        const a = f.act;
        // strikes: details at extension
        if (a && a.kind === 'punch' && a.extended && !a.__logged) { a.__logged = true; const ar = f.rig.arm[a.realHand];
          strikes.push({ who: f.def.id, type: a.type, tS: +a.tS.toFixed(3), p: +a.p.toFixed(2), vT: +a.vT.toFixed(1), vPeak: +a.vPeak.toFixed(1), short: +ar.short.toFixed(3), prot: +ar.prot.toFixed(2), err: +(ar.err*100).toFixed(2), reach: a.reachable }); }
        if (a && a.kind === 'kick' && a.extended && !a.__logged) { a.__logged = true; strikes.push({ who: f.def.id, type: 'kick', tS: +a.tS.toFixed(3), p2: a.p2 && +a.p2.toFixed(2), vT: +a.vT.toFixed(1), vPeak: +a.vPeak.toFixed(1) }); }
        if (a && a.kind === 'punch' && a.extended && !a.__g) { a.__g = true; const tip = f.tipWorld(a.realHand, new V3()), e = tip.distanceTo(a.aim) * 100, ar = f.rig.arm[a.realHand];
          if (e > 1 && a.reachable && gl.length < 12) gl.push({ t: +g.simT.toFixed(3), who: f.def.id, type: a.type, err: +e.toFixed(2), rigErr: +(ar.err * 100).toFixed(2), short: +ar.short.toFixed(3), prot: +ar.prot.toFixed(2), rag: f.rag.active && f.rag.mode, wWr: f.rag.active ? +f.rag.w[a.realHand === 'L' ? 9 : 12].toFixed(2) : 0, viol: Object.keys(f.rig.viol).join(',') }); }
        for (const S of ['L', 'R']) {
          const bb = f.obj.bones, hip = bb['thigh' + S].getWorldPosition(new V3()), kn = bb['shin' + S].getWorldPosition(new V3()), an = bb['foot' + S].getWorldPosition(new V3());
          const u = kn.clone().sub(hip).normalize(), w = an.clone().sub(kn).normalize(), cr = u.clone().cross(w), H = new V3(1, 0, 0).applyQuaternion(bb['foot' + S].getWorldQuaternion(new f.obj.root.quaternion.constructor()));
          const th = Math.acos(Math.max(-1, Math.min(1, u.dot(w)))) * 57.2958, sg = cr.length() > 0.02 ? Math.sign(cr.dot(H)) : 1;
          if (sg * th < -1 && kn2.length < 40 && live) kn2.push({ t: +g.simT.toFixed(3), who: f.def.id + S, flex: +(sg * th).toFixed(1), state: f.state, act: a && (a.kind + ':' + (a.type || a.phase || '')), down: f.isDown(), rag: f.rag.active && f.rag.mode, fa: f.sm.fa[S], fp: +f.sm.fp[S].toFixed(2), fy: +f.sm.fy[S].toFixed(2), kp: f.sm.kp[S].toArray().map(x => +x.toFixed(2)), wKn: f.rag.active ? +f.rag.w[S === 'L' ? 14 : 19].toFixed(2) : 0, fc: f.sm.fc[S], phase: f.act && f.act.phase, at: f.act && +(f.act.t||0).toFixed(3), mode: f.rag.mode, wTh: f.rag.active ? +f.rag.w[S==='L'?14:19].toFixed(2) : 0, wAn: f.rag.active ? +f.rag.w[S==='L'?15:20].toFixed(2) : 0, wPel: f.rag.active ? +f.rag.w[0].toFixed(2) : 0 });
        }
        for (const S of ['L', 'R']) {
          const tip = f.tipWorld(S, new V3()), k = f.def.id + S;
          if (prev[k] && dt > 0.002) { const v = prev[k].distanceTo(tip) / dt;
            if (v > 25 && spikes.length < 10) spikes.push({ t: +g.simT.toFixed(3), who: k, v: +v.toFixed(1), state: f.state, gstate: g.state, act: a && (a.kind + ':' + (a.type || '') + ' t=' + (a.t || 0).toFixed(3) + ' hand=' + a.realHand), rag: f.rag.active && f.rag.mode, w: f.rag.active ? +f.rag.w[S === 'L' ? 9 : 12].toFixed(2) : 0 }); }
          prev[k] = tip;
          // planted-foot slide with context
          const vS = f.side > 0 ? S : (S === 'L' ? 'R' : 'L'), ft = f.feet[vS];
          const busy = (f.state === 'kick' && vS === 'R') || (f.state === 'check' && vS === 'L');
          const planted = live && !f.isDown() && ft.step < 0 && !busy;
          const loc = ft.r < 0 ? f.heelLocal : f.ballLocal, pt = f.obj.bones['foot' + S].localToWorld(loc.clone());
          const key = f.def.id + S, st = ph[key] || (ph[key] = { on: false });
          const piv = ft.r < 0 ? 'heel' : 'ball';
          if (planted) {
            if (!st.on) { Object.assign(st, { on: true, ax: pt.x, az: pt.z, max: 0, t0: g.simT, ctx: new Set(), maxAt: null, piv }); }
            else if (st.piv !== piv) { st.ax = pt.x; st.az = pt.z; st.piv = piv; }
            const d = Math.hypot(pt.x - st.ax, pt.z - st.az); if (d > st.max) { st.max = d; st.maxAt = { t: +g.simT.toFixed(3), state: f.state, act: a && a.kind + ':' + (a.type || ''), r: +ft.r.toFixed(3), rag: f.rag.active && f.rag.mode, wKn: f.rag.active ? +f.rag.w[S === 'L' ? 14 : 19].toFixed(2) : 0, short: +f.rig.leg[S].short.toFixed(3), drop: +f.pDrop.toFixed(3), lost: f.reachLost[vS], fc: f.sm.fc[S], wy: +ft.wy.toFixed(2), ankErr: +f.rig.P['foot' + S].distanceTo(f.rig.PA['foot' + S]).toFixed(3), pelD: +f.rig.P.pelvis.distanceTo(f.rig.PA.pelvis).toFixed(3), wPel: f.rag.active ? +f.rag.w[0].toFixed(2) : 0, step: ft.step, otherStep: f.feet[vS === 'L' ? 'R' : 'L'].step }; }
            st.ctx.add(f.state + (f.rag.active ? '/rag' : ''));
          } else if (st.on) { st.on = false; if (st.max > 0.02 && slides.length < 14) slides.push({ who: key, mm: +(st.max * 1000).toFixed(1), dur: +(g.simT - st.t0).toFixed(3), ctx: [...st.ctx].join(','), at: st.maxAt }); }
        }
      }
    }
    return { spikes, slides, strikes: strikes.slice(0, 40), gl, kn2 };
  });
  require('fs').writeFileSync('/home/user/work/debug.json', JSON.stringify(out)); console.log('errors', errs.slice(0, 5));
  await browser.close();
})();
