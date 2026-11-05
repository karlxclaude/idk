// In-page probe for the Iron Canvas harness. Works on the original and the revised file: it only reads public
// state (window.ironCanvas, fighters, bones, acts) and drives the game through its own simulate/frame hooks.
window.__probe = (() => {
  const g = window.ironCanvas;
  // the page's own requestAnimationFrame loop is gated off: only the probe advances or renders frames
  const realFrame = g.frame.bind(g);
  g.frame = function (dt) { if (window.__probeDrive) return realFrame(dt); };
  const F = dt => { window.__probeDrive = true; try { realFrame(dt); } finally { window.__probeDrive = false; } };
  const V3 = g.camera.position.constructor, Q4 = g.camera.quaternion.constructor;
  const v = () => new V3(), DEG = 180 / Math.PI, SIDES = ['L', 'R'], FLIPS = { L: 'R', R: 'L' };
  const T = Array.from({ length: 16 }, v), TQ = new Q4();
  const RIx = { sh: { L: 7, R: 10 }, el: { L: 8, R: 11 }, wr: { L: 9, R: 12 }, hip: { L: 13, R: 18 }, kn: { L: 14, R: 19 }, an: { L: 15, R: 20 } };
  const realS = (f, S) => (f.side > 0 ? S : FLIPS[S]);
  const info = f => {
    if (f.__pi) return f.__pi;
    const J = f.obj.J, B = n => new V3(...J[n]), o = { ball: {}, hE: {}, hK: {} };
    for (const S of SIDES) {
      o.ball[S] = new V3(0, 0.012 - J['foot' + S][1], 0.13);      // ball of the foot, in the foot bone's frame (bind = group axes)
      o.hE[S] = B('fore' + S).sub(B('arm' + S)).normalize().cross(B('hand' + S).sub(B('fore' + S)).normalize()).normalize();
    }
    return (f.__pi = o);
  };
  const bw = (f, n, out) => f.obj.bones[n].getWorldPosition(out);
  // signed flexion (deg) at b: magnitude from the segment directions, sign from the hinge reference H
  function sflex(a, b, c, H) {
    const u = T[0].subVectors(b, a).normalize(), w = T[1].subVectors(c, b).normalize(), cr = T[2].crossVectors(u, w);
    const th = Math.acos(Math.max(-1, Math.min(1, u.dot(w)))) * DEG;
    return cr.length() > 0.02 ? th * Math.sign(cr.dot(H) || 1) : th;
  }
  const quant = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
  const stats = arr => arr.length ? { n: arr.length, mean: +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(4), p50: +quant(arr, 0.5).toFixed(4), p95: +quant(arr, 0.95).toFixed(4), max: +Math.max(...arr).toFixed(4), min: +Math.min(...arr).toFixed(4) } : { n: 0 };

  function makeRec() {
    return { slides: [], slideY: [], knee: { min: 1e9, bad: 0, frames: 0 }, elbow: { min: 1e9, bad: 0, frames: 0 }, ragKnee: { min: 1e9, bad: 0, frames: 0 }, ragElbow: { min: 1e9, bad: 0, frames: 0 },
      strikes: [], glove: [], plant: {}, prevTip: {}, prevFoot: {}, prevShin: {}, cur: null, kd: 0, frames: 0 };
  }
  // one sample after each simulated frame
  function sample(f, rec, dt, live) {
    const pi = info(f); f.obj.root.updateMatrixWorld(true); rec.frames++;
    // --- planted-foot slide (ball of the foot, horizontal) ---
    for (const S of SIDES) {
      const R = realS(f, S), ft = f.feet[S], busy = (f.state === 'kick' && S === 'R') || (f.state === 'check' && S === 'L');
      const planted = live && !f.isDown() && ft.step < 0 && !busy && (ft.planted === undefined || ft.planted);
      // the planted foot's actual pivot: the ball (heel up or flat) or the heel (toes up) when the fighter exposes it
      const loc = f.ballLocal ? (ft.r < 0 ? f.heelLocal : f.ballLocal) : pi.ball[R];
      const ball = f.obj.bones['foot' + R].localToWorld(T[3].copy(loc));
      const st = rec.plant[R] || (rec.plant[R] = { on: false, ax: 0, az: 0, ay: 0, max: 0, maxY: 0, n: 0, piv: null });
      const piv = f.ballLocal && ft.r < 0 ? 'heel' : 'ball';
      if (planted) {
        if (!st.on) { st.on = true; st.ax = ball.x; st.az = ball.z; st.ay = ball.y; st.max = 0; st.maxY = 0; st.n = 0; st.piv = piv; }
        else if (piv !== st.piv) { st.ax = ball.x; st.az = ball.z; st.ay = ball.y; st.piv = piv; }   // contact handed from heel to ball (or back): re-anchor on the new pivot
        st.max = Math.max(st.max, Math.hypot(ball.x - st.ax, ball.z - st.az)); st.maxY = Math.max(st.maxY, Math.abs(ball.y - st.ay)); st.n++;
      } else if (st.on) { st.on = false; if (st.n >= 3) { rec.slides.push(st.max * 1000); rec.slideY.push(st.maxY * 1000); if (st.max > 0.005) (rec.bigSlides || (rec.bigSlides = [])).push({ mm: +(st.max * 1000).toFixed(1), ctx: st.ctx }); } }
      if (planted && st.on) st.ctx = f.state + (f.rag && f.rag.active ? '/rag' : '') + ' r' + ft.r.toFixed(2) + ' short' + (f.rig.leg ? f.rig.leg[R].short.toFixed(3) : '');
    }
    // --- knees and elbows: no hyperextension (CDC limits: knee extension 1.0°, elbow extension 0.8°) ---
    for (const R of SIDES) {
      const hip = bw(f, 'thigh' + R, T[4]), kn = bw(f, 'shin' + R, T[5]), an = bw(f, 'foot' + R, T[6]);
      const Hk = T[7].set(1, 0, 0).applyQuaternion(f.obj.bones['foot' + R].getWorldQuaternion(TQ));   // knee axis ≈ foot's lateral axis
      const kf = sflex(hip, kn, an, Hk); rec.knee.min = Math.min(rec.knee.min, kf); rec.knee.frames++; if (kf < -1.0) { rec.knee.bad++; const k = g.state + '/' + f.state; (rec.knee.where || (rec.knee.where = {}))[k] = (rec.knee.where[k] || 0) + 1; }
      const sh = bw(f, 'arm' + R, T[8]), el = bw(f, 'fore' + R, T[9]), wr = bw(f, 'hand' + R, T[10]);
      const He = T[11].copy(pi.hE[R]).applyQuaternion(f.obj.bones['arm' + R].getWorldQuaternion(TQ));
      const ef = sflex(sh, el, wr, He); rec.elbow.min = Math.min(rec.elbow.min, ef); rec.elbow.frames++; if (ef < -0.8) { rec.elbow.bad++; const k = g.state + '/' + f.state + (f.rag && f.rag.active ? '/' + f.rag.mode : ''); (rec.elbow.where || (rec.elbow.where = {}))[k] = (rec.elbow.where[k] || 0) + 1; }
      const rg = f.rag;
      if (rg && rg.active && rg.href) {
        const x = rg.x, k2 = sflex(x[RIx.hip[R]], x[RIx.kn[R]], x[RIx.an[R]], rg.href['leg' + R]), e2 = sflex(x[RIx.sh[R]], x[RIx.el[R]], x[RIx.wr[R]], rg.href['arm' + R]);
        rec.ragKnee.min = Math.min(rec.ragKnee.min, k2); rec.ragKnee.frames++; if (k2 < -1.0) rec.ragKnee.bad++;
        rec.ragElbow.min = Math.min(rec.ragElbow.min, e2); rec.ragElbow.frames++; if (e2 < -0.8) rec.ragElbow.bad++;
      }
    }
    // --- strikes: peak glove / foot speed, glove error at full extension ---
    const a = f.act, strike = a && (a.kind === 'punch' || a.kind === 'kick');
    const finish = c => { if (c.done) return; c.done = true; rec.strikes.push({ type: c.type, kind: c.kind, vTip: c.vTip, vFoot: c.vFoot, vShin: c.vShin, result: c.result || c.act.result, hitInfo: c.act.hitInfo || null }); };
    if (rec.cur && rec.cur.act !== a) { finish(rec.cur); rec.cur = null; }
    if (strike && !rec.cur && live) rec.cur = { act: a, type: a.type, kind: a.kind, vTip: 0, vFoot: 0, vShin: 0, err: null, result: null };
    const c = rec.cur, H = c ? c.act.realHand : null;
    for (const R of SIDES) {
      const tip = f.tipWorld(R, T[12]);
      const foot = f.obj.bones['foot' + R].localToWorld(T[13].copy(pi.ball[R]).multiplyScalar(0.5));   // midfoot
      const shin = T[14].lerpVectors(bw(f, 'shin' + R, T[14]), bw(f, 'foot' + R, T[15]), 0.62);
      if (c && R === H && dt > 0.002 && c.act.t <= c.act.tS + c.act.tA + 0.02) {   // hit-stop micro steps are too short to differentiate
        if (rec.prevTip[R]) c.vTip = Math.max(c.vTip, rec.prevTip[R].distanceTo(tip) / dt);
        if (rec.prevFoot[R]) c.vFoot = Math.max(c.vFoot, rec.prevFoot[R].distanceTo(foot) / dt);
        if (rec.prevShin[R]) c.vShin = Math.max(c.vShin, rec.prevShin[R].distanceTo(shin) / dt);
      }
      (rec.prevTip[R] || (rec.prevTip[R] = v())).copy(tip); (rec.prevFoot[R] || (rec.prevFoot[R] = v())).copy(foot); (rec.prevShin[R] || (rec.prevShin[R] = v())).copy(shin);
    }
    if (c) {
      const ca = c.act;
      if (ca.kind === 'punch' && ca.t >= ca.tS && ca.t < ca.tS + ca.tA && f.act === ca && c.err === null) {   // first frame of the hit window: e = 1, full extension
        const tip = f.obj.root.localToWorld(T[12].copy(f.tips[H])), sh = bw(f, 'arm' + H, T[13]);   // as rendered (root at animation time)
        c.err = tip.distanceTo(ca.aim) * 100; c.aimDist = sh.distanceTo(ca.aim);
        if (ca.goal) c.errGoal = tip.distanceTo(ca.goal) * 100;
        if (ca.reachable !== undefined) c.reachable = ca.reachable;
        rec.glove.push({ err: c.err, aimDist: c.aimDist, errGoal: c.errGoal, reachable: c.reachable, type: c.type, rag: f.rag && f.rag.active ? f.rag.mode : null, state: f.state, rigErr: f.rig.arm && f.rig.arm[H] ? f.rig.arm[H].err * 100 : null, viol: f.rig.viol ? Object.keys(f.rig.viol).join(',') : '' });
      }
      if (ca.result && !c.result) c.result = ca.result;
      if (ca.t > ca.tS + ca.tA + 0.02) finish(c);
    }
  }
  function summarize(recs) {
    const all = { slides: [], slideY: [], glove: [], strikes: [] }, knee = { min: 1e9, bad: 0, frames: 0 }, elbow = { min: 1e9, bad: 0, frames: 0 }, rk = { min: 1e9, bad: 0, frames: 0 }, re = { min: 1e9, bad: 0, frames: 0 };
    for (const r of recs) { all.slides.push(...r.slides); all.slideY.push(...r.slideY); all.glove.push(...r.glove); all.strikes.push(...r.strikes);
      for (const [d, s] of [[knee, r.knee], [elbow, r.elbow], [rk, r.ragKnee], [re, r.ragElbow]]) { d.min = Math.min(d.min, s.min); d.bad += s.bad; d.frames += s.frames; } }
    const by = {};
    for (const s of all.strikes) { const k = s.type; (by[k] || (by[k] = { vTip: [], vFoot: [], vShin: [], results: {} })); by[k].results[s.result] = (by[k].results[s.result] || 0) + 1;
      if (!s.result) continue;   // peak speeds only for strikes that reached the target or its line (interrupted ones never got up to speed)
      by[k].vTip.push(s.vTip); by[k].vFoot.push(s.vFoot); by[k].vShin.push(s.vShin); }
    // cited ranges (mean ± SD): [W05] straight punches 9.14 ± 2.06; [DL20] cross 8.1 ± 2.1, hook 11.2 ± 2.0, uppercut 10.2 ± 1.8; [GS17] kick foot 13.24 ± 2.30
    const BAND = { jab: [9.14, 2.06, 'tip'], cross: [9.14, 2.06, 'tip'], hook: [11.2, 2.0, 'tip'], upper: [10.2, 1.8, 'tip'], kick: [13.24, 2.30, 'foot'] };
    const speeds = {}; for (const k in by) { const b = BAND[k], arr = b ? (b[2] === 'tip' ? by[k].vTip : by[k].vFoot) : [];
      speeds[k] = { tip: stats(by[k].vTip), foot: stats(by[k].vFoot), shin: stats(by[k].vShin), results: by[k].results,
        band: b ? { mean: b[0], sd: b[1], measure: b[2], within1sd: +(arr.filter(v => Math.abs(v - b[0]) <= b[1]).length / Math.max(1, arr.length)).toFixed(3), within2sd: +(arr.filter(v => Math.abs(v - b[0]) <= 2 * b[1]).length / Math.max(1, arr.length)).toFixed(3) } : null }; }
    const reach = all.glove.filter(x => x.reachable !== false), unreach = all.glove.filter(x => x.reachable === false);
    return {
      footSlideMm: stats(all.slides), over5mm: all.slides.filter(x => x > 5).length, bigSlides: recs.flatMap(r => r.bigSlides || []), footLiftMm: stats(all.slideY),
      knee: { minSignedFlexDeg: +knee.min.toFixed(3), framesHyperextended: knee.bad, frames: knee.frames, where: recs.reduce((o, r) => { for (const k in (r.knee.where || {})) o[k] = (o[k] || 0) + r.knee.where[k]; return o; }, {}) }, elbow: { minSignedFlexDeg: +elbow.min.toFixed(3), framesHyperextended: elbow.bad, frames: elbow.frames, where: recs.reduce((o, r) => { for (const k in (r.elbow.where || {})) o[k] = (o[k] || 0) + r.elbow.where[k]; return o; }, {}) },
      ragdollKnee: { minSignedFlexDeg: rk.frames ? +rk.min.toFixed(3) : null, framesHyperextended: rk.bad, frames: rk.frames }, ragdollElbow: { minSignedFlexDeg: re.frames ? +re.min.toFixed(3) : null, framesHyperextended: re.bad, frames: re.frames },
      gloveMisses: all.glove.filter(x => x.reachable !== false && (x.errGoal ?? x.err) > 1).slice(0, 12), gloveErrCm: stats(all.glove.map(x => x.err)), gloveErrReachableCm: stats(reach.map(x => x.errGoal ?? x.err)), unreachablePunches: unreach.length, gloveOver1cmReachable: reach.filter(x => (x.errGoal ?? x.err) > 1).length,
      speeds, strikes: all.strikes.length,
    };
  }
  // ---------------------------------------------------------------- 3-round AI vs AI
  async function fight({ rounds = 3, roundLen = 90, dt = 1 / 120, maxSim = 900 } = {}) {
    g.setSetting('rules', 'kickboxing'); g.setSetting('roundLen', roundLen); g.setSetting('rounds', 3); g.setSetting('slowmo', 40);
    g.autopilot = true;
    const pairs = [[0, 1], [1, 2], [2, 0], [1, 0]]; let pi = 0;
    const recs = [], fights = [];
    let fightT = 0, simT = 0, frames = 0, frameMs = 0, kds = 0, kos = 0;
    const start = () => { g.startFight({ p0: pairs[pi % pairs.length][0], p1: pairs[pi % pairs.length][1] }); pi++; for (const f of g.fighters) { f.__rec = makeRec(); recs.push(f.__rec); f.__pi = null; } fights.push({ pair: [g.fighters[0].def.id, g.fighters[1].def.id], end: null }); };
    start();
    let lastKd = null;
    while (fightT < rounds * roundLen && simT < maxSim) {
      const s0 = g.simT, t0 = performance.now();
      g.noRender = true; F(dt); g.noRender = false;
      frameMs += performance.now() - t0; frames++;
      const sdt = g.simT - s0; simT += dt;
      const live = ['fight', 'knockdown', 'count', 'roundEnd'].includes(g.state);
      if (g.state === 'fight') fightT += sdt;
      for (const f of g.fighters) sample(f, f.__rec, sdt, live && sdt > 0);
      if (g.kd && g.kd !== lastKd) { lastKd = g.kd; kds++; if (g.kd.final) kos++; }
      if (g.state === 'break') g.nextRound();
      if (g.state === 'koEnd' && g.stateT > 0.5) { fights[fights.length - 1].end = g.endMethod; if (fightT < rounds * roundLen) start(); else break; }
      if (frames % 1500 === 0) await new Promise(r => setTimeout(r, 0));
    }
    fights[fights.length - 1].end = fights[fights.length - 1].end || g.state;
    g.autopilot = false;
    const out = summarize(recs);
    return Object.assign(out, { fightSeconds: +fightT.toFixed(1), simSeconds: +simT.toFixed(1), frames, msPerFrame: +(frameMs / frames).toFixed(3), knockdowns: kds, finishes: kos, fights });
  }
  // ---------------------------------------------------------------- sim cost per frame (no rendering)
  async function perf() {
    g.setSetting('rules', 'kickboxing'); g.autopilot = true; g.startFight({ p0: 0, p1: 1 });
    for (let i = 0; i < 600; i++) { g.noRender = true; F(1 / 60); }
    const proto = Object.getPrototypeOf(g.fighters[0]), orig = proto.update; let acc = 0, n = 0;
    proto.update = function (dt) { const t = performance.now(); orig.call(this, dt); acc += performance.now() - t; n++; };
    let tot = 0; const N = 3600;
    for (let i = 0; i < N; i++) { const t0 = performance.now(); g.noRender = true; F(1 / 60); tot += performance.now() - t0; if (g.state === 'break') g.nextRound(); if (g.state === 'koEnd') g.startFight({ p0: 0, p1: 1 }); if (i % 600 === 0) await new Promise(r => setTimeout(r, 0)); }
    proto.update = orig; g.noRender = false; g.autopilot = false;
    // render cost (software rasteriser — only a relative number, not a GPU frame time)
    let rt = 0; for (let i = 0; i < 6; i++) { const t0 = performance.now(); g.freeze = true; F(1 / 60); rt += performance.now() - t0; } g.freeze = false;
    return { frameSimMs: +(tot / N).toFixed(3), fighterUpdateMsEach: +(acc / n).toFixed(3), softwareRenderMs: +(rt / 6).toFixed(1) };
  }
  // ---------------------------------------------------------------- staged shots
  async function stage(kind) {
    g.autopilot = false; g.setSetting('rules', 'kickboxing'); g.setSetting('camera', 'broadcast'); g.setSetting('slowmo', 0); g.setSetting('shake', 0);
    g.startFight({ p0: 0, p1: 1 });
    for (let i = 0; i < 700 && g.state !== 'fight'; i++) { g.noRender = true; F(1 / 60); }
    g.noRender = false;
    const [a, b] = g.fighters;
    const freezeAI = () => { const it = b.intent; it.mx = it.mz = 0; it.guard = false; it.punch = null; it.slip = null; it.body = false; };
    g.ai.update = freezeAI;
    a.place(-0.47, 0, Math.PI / 2); b.place(0.47, 0, -Math.PI / 2); g.camDir.camYaw = null;
    const step = (n, dt = 1 / 120) => { for (let i = 0; i < n; i++) { g.noRender = true; F(dt); } g.noRender = false; };
    step(120);
    const out = { kind };
    const throwIt = (type, cond, maxN = 240) => { a.intent.punch = type; a.intent.body = false; for (let i = 0; i < maxN; i++) { step(1); if (cond()) return i; } return -1; };
    if (kind === 'jab' || kind === 'cross') { out.frames = throwIt(kind, () => a.act && a.act.extended); }
    else if (kind === 'kick') { out.frames = throwIt('kick', () => a.act && (a.act.resolved || a.act.extended)); }
    else if (kind === 'hit') { out.frames = throwIt('cross', () => a.act && a.act.resolved); step(26); out.result = a.act && a.act.result; }
    else if (kind === 'ko') { b.hp = -30; b.kdTotal = 2; out.frames = throwIt('cross', () => a.act && a.act.resolved); out.result = a.act && a.act.result; g.state = 'fight'; step(70); g.state = 'fight'; }
    out.state = g.state; out.aState = a.state; out.bState = b.state;
    return out;
  }
  async function renderFrozen(n = 2) {
    g.freeze = true; g.noRender = true; for (let i = 0; i < 45; i++) F(1 / 30); g.noRender = false;
    for (let i = 0; i < n; i++) F(1 / 60);
    g.freeze = false;
  }
  return { fight, perf, stage, renderFrozen, summarize };
})();
