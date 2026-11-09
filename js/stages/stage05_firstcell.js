/* Stage 5: first cell. Harness a proton gradient, then build the machinery of a prokaryote. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const PARTS = {
    synthase: { name: 'ATP synthase', color: '#8ef7c2', cost: 0, desc: 'Protons flow in, rotor spins, ATP comes out' },
    pump: { name: 'Proton pump', color: '#ffd86b', cost: 12, desc: 'Burns H₂ electrons to push protons back out' }
  };
  const BUILDS = [
    { key: 'ribosome', name: 'Ribosome', cost: 30, color: '#b48cff', desc: 'RNA machine that builds proteins' },
    { key: 'enzymes', name: 'Metabolic enzymes', cost: 25, color: '#7fd0d8', desc: 'Catalysts: fix carbon, make parts' },
    { key: 'dna', name: 'DNA genome', cost: 40, color: '#4fd8ff', desc: 'Stable copy of the genes' }
  ];
  const SLOTS = 8;

  S.registerStage({
    id: 'firstcell', index: 5, title: 'First cell', years: 'about 3.8 to 3.5 billion years ago', ya: 3.7,
    palette: ['#02060f', '#061a38', '#1a1a0a'],
    objective: 'Drag ATP synthase into the membrane. Spend ATP on ribosomes, enzymes and DNA.',
    outro: 'A complete prokaryote: membrane energy, protein machinery, a stable genome. Now the only thing left to do is make more of yourself, and keep doing it.',
    create() {
      const st = {};
      let W, H, cx, cy, R, slots, held, atp, gradient, protonsOut, protonsIn, built, t, flags, done, hintT, rotor;

      st.enter = function () {
        W = S.W; H = S.H; layout();
        slots = Array.from({ length: SLOTS }, (_, i) => ({ a: -Math.PI / 2 + i / SLOTS * S.TAU, part: null }));
        held = null; atp = 0; gradient = 1; built = {}; t = 0; done = false; hintT = 0; rotor = 0;
        flags = { grad: false, pump: false, lowHint: false };
        protonsOut = []; protonsIn = [];
        for (let i = 0; i < 160; i++) protonsOut.push(randOutside());
        for (let i = 0; i < 20; i++) protonsIn.push(randInside());
        S.UI.hint(S.mobile ? 'Drag the ATP synthase (bottom) onto an empty membrane slot.' : 'Drag the ATP synthase from the left onto one of the empty membrane slots.', 8);
      };
      function layout() { if (S.mobile) { cx = W * 0.5; cy = H * 0.44; R = Math.min(W * 0.3, H * 0.17); } else { cx = W * 0.5; cy = H * 0.52; R = Math.min(W, H) * 0.26; } }
      st.resize = function () { W = S.W; H = S.H; layout(); };
      function randOutside() { let x, y; do { x = S.rand(W); y = S.rand(60, H - 40); } while (S.dist(x, y, cx, cy) < R + 12); return { x, y, vx: 0, vy: 0, ph: S.rand(S.TAU) }; }
      function randInside() { const a = S.rand(S.TAU), r = S.rand(R - 14); return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0, ph: S.rand(S.TAU) }; }
      const slotPos = (s) => ({ x: cx + Math.cos(s.a) * R, y: cy + Math.sin(s.a) * R });
      const palette = () => S.mobile ? [{ key: 'synthase', x: W * 0.28, y: H - 150 }, { key: 'pump', x: W * 0.62, y: H - 150 }] : [{ key: 'synthase', x: 70, y: H * 0.42 }, { key: 'pump', x: 70, y: H * 0.62 }];
      const buildRects = () => S.mobile ? BUILDS.map((b, i) => { const w = (W - 32) / 3; return { b, x: 12 + i * (w + 4), y: cy + R + 24, w, h: 64 }; }) : BUILDS.map((b, i) => ({ b, x: W - 230, y: H * 0.36 + i * 92, w: 210, h: 76 }));
      const count = (k) => slots.filter(s => s.part === k).length;

      st.update = function (dt) {
        t += dt;
        const nS = count('synthase'), nP = count('pump');
        // gradient dynamics: synthases drain it, pumps restore it, slow leak always
        gradient += dt * (nP * 0.09 - nS * 0.05 - 0.012);
        gradient = S.clamp(gradient, 0, 1);
        const atpRate = nS * 3 * gradient;
        atp += atpRate * dt; rotor += atpRate * dt * 2;
        // proton visuals: equilibrate pools to gradient
        const targetOut = 40 + Math.round(gradient * 130), targetIn = 20 + Math.round((1 - gradient) * 130);
        if (protonsOut.length < targetOut && S.chance(dt * 30)) protonsOut.push(randOutside());
        if (protonsIn.length < targetIn && S.chance(dt * 30)) {
          // protons enter through a synthase if there is one, else leak at a random spot
          const sl = slots.filter(s => s.part === 'synthase'); const p = sl.length ? slotPos(S.pick(sl)) : slotPos(S.pick(slots));
          const a = S.angleTo(p.x, p.y, cx, cy); protonsIn.push({ x: p.x, y: p.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, ph: S.rand(S.TAU) });
          if (protonsOut.length > 20) protonsOut.splice(S.randInt(0, protonsOut.length - 1), 1);
        }
        if (protonsIn.length > targetIn && nP > 0 && S.chance(dt * 25)) {
          const p = slotPos(S.pick(slots.filter(s => s.part === 'pump')));
          const a = S.angleTo(cx, cy, p.x, p.y); protonsIn.splice(S.randInt(0, protonsIn.length - 1), 1);
          protonsOut.push({ x: p.x, y: p.y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, ph: S.rand(S.TAU) });
        }
        if (protonsOut.length > targetOut && S.chance(dt * 10)) protonsOut.splice(S.randInt(0, protonsOut.length - 1), 1);
        const move = (p, inside) => {
          p.vx += Math.sin(t * 2 + p.ph) * 30 * dt; p.vy += Math.cos(t * 1.7 + p.ph) * 30 * dt; p.vx *= 0.97; p.vy *= 0.97;
          p.x += p.vx * dt; p.y += p.vy * dt;
          const d = S.dist(p.x, p.y, cx, cy);
          if (inside && d > R - 8) { const a = S.angleTo(cx, cy, p.x, p.y); p.x = cx + Math.cos(a) * (R - 8); p.y = cy + Math.sin(a) * (R - 8); p.vx *= -0.5; p.vy *= -0.5; }
          if (!inside && d < R + 8) { const a = S.angleTo(cx, cy, p.x, p.y); p.x = cx + Math.cos(a) * (R + 8); p.y = cy + Math.sin(a) * (R + 8); p.vx *= -0.5; p.vy *= -0.5; }
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 50) p.y = H - 40; if (p.y > H - 30) p.y = 60;
        };
        protonsOut.forEach(p => move(p, false)); protonsIn.forEach(p => move(p, true));
        // hints / unlocks
        if (nS > 0 && nP === 0 && gradient < 0.35 && !flags.lowHint) { flags.lowHint = true; S.UI.hint('The free gradient is running out. Drag a proton pump into the membrane to recharge it (costs 12 ATP).', 10); }
        if (held) { held.x += (S.input.x - held.x) * Math.min(1, dt * 20); held.y += (S.input.y - held.y) * Math.min(1, dt * 20); }
        const doneN = BUILDS.filter(b => built[b.key]).length;
        S.UI.setProgress(doneN / 3 * 0.85 + (nS ? 0.1 : 0) + (nP ? 0.05 : 0));
        if (doneN === 3 && !done) { done = true; S.unlock('luca', () => S.completeStage()); }
      };

      st.pointerDown = function (x, y) {
        for (const p of palette()) if (S.dist(x, y, p.x, p.y) < (S.touch ? 44 : 34)) {
          if (atp < PARTS[p.key].cost) { S.UI.toast('Need ' + PARTS[p.key].cost + ' ATP for a ' + PARTS[p.key].name); return; }
          held = { key: p.key, x, y }; S.Audio.sfx('click'); return;
        }
        for (const r of buildRects()) if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
          if (built[r.b.key]) return;
          if (atp >= r.b.cost) { atp -= r.b.cost; built[r.b.key] = true; S.Audio.sfx('react'); G.burst(r.x + r.w / 2, r.y + r.h / 2, r.b.color, 20, 100, 3); S.UI.toast(r.b.name + ' built'); }
          else S.UI.toast('Need ' + r.b.cost + ' ATP (have ' + Math.floor(atp) + ')');
          return;
        }
      };
      st.pointerUp = function (x, y) {
        if (!held) return;
        const h = held; held = null;
        let best = null, bd = S.touch ? 55 : 40;
        slots.forEach(s => { const p = slotPos(s); const d = S.dist(h.x, h.y, p.x, p.y); if (!s.part && d < bd) { bd = d; best = s; } });
        if (!best) { S.UI.toast('Drop it on an empty membrane slot'); return; }
        if (atp < PARTS[h.key].cost) { S.UI.toast('Not enough ATP'); return; }
        atp -= PARTS[h.key].cost; best.part = h.key; const p = slotPos(best);
        G.burst(p.x, p.y, PARTS[h.key].color, 18, 90, 3); S.Audio.sfx('bond');
        if (h.key === 'synthase' && !flags.grad) { flags.grad = true; S.unlock('gradient'); }
        if (h.key === 'pump' && !flags.pump) { flags.pump = true; S.unlock('pumps'); }
      };

      st.draw = function (ctx) {
        // ocean label and cell interior
        G.text(ctx, 'acidic ocean · many H⁺', cx, cy - R - (S.mobile ? 14 : 26), 12, '#ff9a8a');
        G.glow(ctx, cx, cy, R * 1.25, '#4fd8ff', 0.18);
        ctx.fillStyle = 'rgba(10,40,80,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, S.TAU); ctx.fill();
        G.text(ctx, 'inside · alkaline · few H⁺', cx, cy + R * 0.55, 12, '#9fc0e8');
        // protons
        protonsOut.forEach(p => G.circle(ctx, p.x, p.y, 2, 'rgba(255,140,120,0.85)'));
        protonsIn.forEach(p => G.circle(ctx, p.x, p.y, 2, 'rgba(255,140,120,0.85)'));
        // membrane bilayer
        ctx.strokeStyle = 'rgba(255,216,107,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, S.TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, S.TAU); ctx.stroke();
        // slots
        slots.forEach(s => {
          const p = slotPos(s);
          if (!s.part) { G.glow(ctx, p.x, p.y, 22, '#8ef7c2', 0.25 + 0.15 * Math.sin(t * 3)); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(142,247,194,' + (0.6 + 0.3 * Math.sin(t * 3)) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, S.TAU); ctx.stroke(); ctx.setLineDash([]); return; }
          drawPart(ctx, s.part, p.x, p.y, s.a, 1);
        });
        // built things inside
        let bi = 0; BUILDS.forEach(b => { if (!built[b.key]) return; const a = bi * 2.1 + t * 0.2; const x = cx + Math.cos(a) * R * 0.45, y = cy + Math.sin(a) * R * 0.45; G.orb(ctx, x, y, 14, b.color, 2); G.text(ctx, b.name, x, y + 26, 11, b.color); bi++; });
        // palette
        const pl = palette(); const lx = S.mobile ? W / 2 : 70, ly = pl[0].y - (S.mobile ? 48 : 62);
        G.text(ctx, 'MEMBRANE PARTS', lx, ly, 11, '#7f9bbd'); G.text(ctx, 'drag onto the membrane', lx, ly + 14, 10, '#7f9bbd');
        pl.forEach(p => { drawPart(ctx, p.key, p.x, p.y, -Math.PI / 2, 1.2); const d = PARTS[p.key]; G.text(ctx, d.name, p.x, p.y + 36, 12, d.color); G.text(ctx, d.cost ? d.cost + ' ATP' : 'free', p.x, p.y + 50, 11, atp >= d.cost ? '#8ef7c2' : '#ff9a8a'); });
        if (held) drawPart(ctx, held.key, held.x, held.y, -Math.PI / 2, 1.3);
        // build panel
        const br0 = buildRects()[0]; G.text(ctx, S.touch ? 'BUILD WITH ATP (tap)' : 'BUILD WITH ATP (click)', S.mobile ? W / 2 : W - 125, br0.y - 14, 11, '#7f9bbd');
        buildRects().forEach(r => {
          const ok = atp >= r.b.cost, isB = built[r.b.key];
          ctx.fillStyle = isB ? 'rgba(142,247,194,0.12)' : ok ? 'rgba(40,110,190,0.35)' : 'rgba(20,40,80,0.35)';
          ctx.strokeStyle = isB ? 'rgba(142,247,194,0.7)' : G.rgba(r.b.color, ok ? 0.8 : 0.3); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(r.x, r.y, r.w, r.h, 10) : ctx.rect(r.x, r.y, r.w, r.h); ctx.fill(); ctx.stroke();
          if (S.mobile) {
            G.orb(ctx, r.x + r.w / 2, r.y + 16, 8, r.b.color, 1.8);
            G.text(ctx, r.b.name, r.x + r.w / 2, r.y + 36, 10, '#d8ecff');
            G.text(ctx, isB ? 'built' : r.b.cost + ' ATP', r.x + r.w / 2, r.y + 52, 11, isB ? '#8ef7c2' : ok ? '#8ef7c2' : '#ff9a8a');
          } else {
            G.orb(ctx, r.x + 26, r.y + 38, 12, r.b.color, 1.8);
            G.text(ctx, r.b.name, r.x + 50, r.y + 22, 14, '#d8ecff', 'left');
            G.text(ctx, r.b.desc, r.x + 50, r.y + 40, 10, '#9fc0e8', 'left');
            G.text(ctx, isB ? 'built' : r.b.cost + ' ATP', r.x + 50, r.y + 58, 12, isB ? '#8ef7c2' : ok ? '#8ef7c2' : '#ff9a8a', 'left');
          }
        });
        // meters
        G.bar(ctx, 18, 92, Math.min(200, W - 40), 8, gradient, gradient > 0.35 ? '#ff9a8a' : '#ff5a5a', 'proton gradient (membrane battery) ' + Math.round(gradient * 100) + '%');
        G.text(ctx, 'ATP ' + Math.floor(atp) + '   (+' + (count('synthase') * 3 * gradient).toFixed(1) + ' / s)', 18, 118, 15, '#8ef7c2', 'left');
        G.text(ctx, count('pump') ? 'Pumps keep the battery charged.' : count('synthase') ? 'Synthase alone drains the natural gradient.' : 'Nothing is harvesting the gradient yet.', 18, 138, 11, '#7f9bbd', 'left');
      };
      function drawPart(ctx, key, x, y, a, scale) {
        const d = PARTS[key];
        G.glow(ctx, x, y, 26 * scale, d.color, 0.45);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2); ctx.scale(scale, scale);
        ctx.fillStyle = G.rgba(d.color, 0.9);
        if (key === 'synthase') {
          ctx.fillRect(-7, -14, 14, 20); // stalk through membrane
          ctx.save(); ctx.rotate(rotor); ctx.beginPath(); for (let i = 0; i < 6; i++) { const aa = i / 6 * S.TAU; ctx.arc(Math.cos(aa) * 7, 10 + Math.sin(aa) * 7, 4, 0, S.TAU); } ctx.fill(); ctx.restore();
          G.circle(ctx, 0, 10, 4, '#06234a');
        } else {
          ctx.beginPath(); ctx.moveTo(-9, -14); ctx.lineTo(9, -14); ctx.lineTo(6, 14); ctx.lineTo(-6, 14); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#06234a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.lineTo(-4, -4); ctx.moveTo(0, -8); ctx.lineTo(4, -4); ctx.stroke();
        }
        ctx.restore();
      }
      st.debug = () => ({ atp, gradient, slots: slots.map(s => ({ part: s.part, pos: slotPos(s) })), palette: palette(), builds: buildRects().map(r => ({ key: r.b.key, cost: r.b.cost, x: r.x + r.w / 2, y: r.y + r.h / 2, built: !!built[r.b.key] })), done });
      return st;
    }
  });
})();
