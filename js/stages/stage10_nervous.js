/* Stage 10: nervous system. Nerve net (react only) then a cephalized flatworm (steer and choose). */
(function () {
  const S = window.Spark, G = S.Gfx;
  const NET_GOAL = 6, BRAIN_GOAL = 10;

  S.registerStage({
    id: 'nervous', index: 10, title: 'Nervous system', years: 'about 600 to 540 million years ago', ya: 0.57,
    palette: ['#02060f', '#04102a', '#06203a'],
    objective: 'Phase 1: you are a nerve net. You cannot steer. Food only counts when it touches you.',
    create() {
      const st = {};
      let W, H, phase, t, jelly, worm, food, hazards, flashes, caught, flags, done, pulseCd;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; phase = 0; caught = 0; done = false; pulseCd = 0;
        flags = { net: false, ceph: false };
        jelly = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 60, contract: 0, tent: Array.from({ length: 10 }, (_, i) => ({ a: i / 10 * S.TAU, pull: 0 })) };
        food = []; hazards = []; flashes = [];
        for (let i = 0; i < 14; i++) food.push(newFood());
        S.UI.hint('Click to pulse your bell. The direction is up to the currents, not you. Food you happen to touch triggers a reflex.', 10);
      };
      st.resize = function () { W = S.W; H = S.H; };
      function newFood() { const side = S.randInt(0, 3); const x = side === 0 ? -10 : side === 1 ? W + 10 : S.rand(W), y = side === 2 ? 50 : side === 3 ? H - 50 : S.rand(60, H - 60); return { x, y, vx: S.rand(-25, 25), vy: S.rand(-25, 25), wob: S.rand(S.TAU) }; }

      // ---- phase 0: nerve net ----
      function pulse() {
        if (pulseCd > 0) return;
        pulseCd = 0.9; jelly.contract = 1;
        const a = S.rand(S.TAU); jelly.vx += Math.cos(a) * 160; jelly.vy += Math.sin(a) * 160;
        flashes.push({ x: jelly.x, y: jelly.y, r: 0, max: jelly.r * 1.3, life: 0.5 });
        S.Audio.sfx('click');
      }
      function updateNet(dt) {
        pulseCd = Math.max(0, pulseCd - dt); jelly.contract = Math.max(0, jelly.contract - dt * 1.6);
        jelly.vx += Math.sin(t * 0.4) * 20 * dt; jelly.vy += Math.cos(t * 0.3) * 20 * dt;
        jelly.vx *= 0.97; jelly.vy *= 0.97; jelly.x += jelly.vx * dt; jelly.y += jelly.vy * dt;
        if (jelly.x < 80 || jelly.x > W - 80) jelly.vx *= -0.8; if (jelly.y < 120 || jelly.y > H - 120) jelly.vy *= -0.8;
        jelly.x = S.clamp(jelly.x, 80, W - 80); jelly.y = S.clamp(jelly.y, 120, H - 120);
        jelly.tent.forEach(tn => tn.pull = Math.max(0, tn.pull - dt * 1.5));
        while (food.length < 14) food.push(newFood());
        for (let i = food.length - 1; i >= 0; i--) {
          const f = food[i]; f.vx += Math.sin(t + f.wob) * 20 * dt; f.vy += Math.cos(t * 0.8 + f.wob) * 20 * dt; f.vx *= 0.99; f.vy *= 0.99; f.x += f.vx * dt; f.y += f.vy * dt;
          if (f.x < -30 || f.x > W + 30 || f.y < 20 || f.y > H) { food.splice(i, 1); continue; }
          // tentacle touch
          for (const tn of jelly.tent) {
            const tx = jelly.x + Math.cos(tn.a) * jelly.r * 0.9, ty = jelly.y + Math.sin(tn.a) * jelly.r * 0.9 + 50 * (1 - tn.pull);
            if (S.dist(f.x, f.y, tx, ty) < 22 || S.dist(f.x, f.y, jelly.x, jelly.y) < jelly.r * 0.8) {
              food.splice(i, 1); tn.pull = 1; caught++; S.Audio.sfx('eat');
              flashes.push({ x: tx, y: ty, r: 0, max: jelly.r * 2, life: 0.6 });
              G.burst(f.x, f.y, '#ffd86b', 10, 60, 2);
              S.UI.setProgress(caught / NET_GOAL * 0.4);
              if (caught >= NET_GOAL && !flags.net) { flags.net = true; S.unlock('nerve-net', startWorm); }
              break;
            }
          }
        }
      }
      function drawNet(ctx) {
        const j = jelly, r = j.r * (1 - 0.15 * j.contract);
        G.glow(ctx, j.x, j.y, r * 2, '#4fd8ff', 0.25);
        // tentacles
        j.tent.forEach(tn => {
          const bx = j.x + Math.cos(tn.a) * r * 0.9, by = j.y + Math.sin(tn.a) * r * 0.3 + r * 0.3; const len = 70 * (1 - 0.7 * tn.pull);
          ctx.strokeStyle = 'rgba(142,247,194,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, by);
          ctx.quadraticCurveTo(bx + Math.sin(t * 3 + tn.a) * 15, by + len * 0.6, bx + Math.sin(t * 2 + tn.a) * 20, by + len); ctx.stroke();
        });
        // bell
        ctx.fillStyle = 'rgba(79,216,255,0.18)'; ctx.strokeStyle = 'rgba(160,230,255,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(j.x, j.y, r, r * 0.7, 0, Math.PI, S.TAU); ctx.quadraticCurveTo(j.x + r * 0.5, j.y + r * 0.25, j.x, j.y + r * 0.25); ctx.quadraticCurveTo(j.x - r * 0.5, j.y + r * 0.25, j.x - r, j.y); ctx.fill(); ctx.stroke();
        // nerve net: a web of lines across the bell
        ctx.strokeStyle = 'rgba(255,216,107,0.35)'; ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) { const a1 = i / 12 * Math.PI + Math.PI, a2 = ((i + 5) % 12) / 12 * Math.PI + Math.PI; ctx.beginPath(); ctx.moveTo(j.x + Math.cos(a1) * r * 0.9, j.y + Math.sin(a1) * r * 0.6); ctx.lineTo(j.x + Math.cos(a2) * r * 0.9, j.y + Math.sin(a2) * r * 0.6); ctx.stroke(); }
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI + Math.PI; G.circle(ctx, j.x + Math.cos(a) * r * 0.9, j.y + Math.sin(a) * r * 0.6, 2, 'rgba(255,216,107,0.8)'); }
        // reflex flashes
        flashes.forEach(f => { ctx.strokeStyle = 'rgba(255,216,107,' + f.life + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, S.TAU); ctx.stroke(); });
        G.text(ctx, 'reflexes fired ' + caught + ' / ' + NET_GOAL, j.x, j.y - r * 0.7 - 16, 12, '#ffd86b');
        G.text(ctx, 'Nerve net: every neuron talks to its neighbours. No centre, no map, no choice.', 18, 72, 12, '#ffd86b', 'left');
        G.text(ctx, 'Click = pulse (random direction). Food must touch you.', 18, 90, 12, '#7f9bbd', 'left');
      }

      // ---- phase 1: flatworm ----
      function startWorm() {
        phase = 1; caught = 0; food = []; hazards = [];
        worm = { segs: Array.from({ length: 14 }, (_, i) => ({ x: W / 2 - i * 9, y: H / 2 })), vx: 0, vy: 0, brain: 0, hurt: 0 };
        for (let i = 0; i < 10; i++) food.push({ x: S.rand(60, W - 60), y: S.rand(80, H - 80), vx: 0, vy: 0, wob: S.rand(S.TAU) });
        for (let i = 0; i < 5; i++) hazards.push({ x: S.rand(100, W - 100), y: S.rand(120, H - 120), r: S.rand(45, 70), ph: S.rand(S.TAU) });
        S.UI.objective('Phase 2: eyespots and a head. Steer with the mouse. Eat, avoid the dark patches.');
        S.UI.hint('Now you can see ahead and steer. Two foods? Pick the safer one.', 8);
        S.UI.setProgress(0.4);
      }
      function updateWorm(dt) {
        const w = worm, head = w.segs[0];
        if (S.input.x > -100) { const dx = S.input.x - head.x, dy = S.input.y - head.y, d = Math.hypot(dx, dy); if (d > 6) { w.vx += dx / d * 900 * dt; w.vy += dy / d * 900 * dt; } }
        const sp = Math.hypot(w.vx, w.vy), max = 170; if (sp > max) { w.vx *= max / sp; w.vy *= max / sp; }
        w.vx *= 0.9; w.vy *= 0.9; head.x += w.vx * dt; head.y += w.vy * dt;
        head.x = S.clamp(head.x, 20, W - 20); head.y = S.clamp(head.y, 70, H - 70);
        for (let i = 1; i < w.segs.length; i++) { const p = w.segs[i - 1], s = w.segs[i]; const d = S.dist(p.x, p.y, s.x, s.y); if (d > 9) { s.x += (p.x - s.x) * (d - 9) / d; s.y += (p.y - s.y) * (d - 9) / d; } }
        w.hurt = Math.max(0, w.hurt - dt * 2);
        hazards.forEach(h => { if (S.dist(h.x, h.y, head.x, head.y) < h.r) { w.hurt = 1; w.brain = Math.max(0, w.brain - dt * 0.6); if (S.chance(dt * 6)) G.particles.emit({ x: head.x, y: head.y, color: '#ff5a7a', speed: 50, life: 0.4, size: 2 }); if (S.chance(dt * 1.5)) S.UI.toast('Toxic patch: steer out'); } });
        while (food.length < 8) { let f; do { f = { x: S.rand(60, W - 60), y: S.rand(80, H - 80), vx: 0, vy: 0, wob: S.rand(S.TAU) }; } while (hazards.some(h => S.dist(h.x, h.y, f.x, f.y) < h.r + 30) === false && S.chance(0.4)); food.push(f); }
        for (let i = food.length - 1; i >= 0; i--) {
          const f = food[i]; f.x += Math.sin(t + f.wob) * 10 * dt; f.y += Math.cos(t * 0.7 + f.wob) * 10 * dt;
          if (S.dist(f.x, f.y, head.x, head.y) < 16) {
            food.splice(i, 1); caught++; w.brain = Math.min(1, w.brain + 0.1); S.Audio.sfx('eat'); G.burst(f.x, f.y, '#ffd86b', 10, 60, 2);
            S.UI.setProgress(0.4 + 0.6 * caught / BRAIN_GOAL);
            if (caught >= 4 && !flags.ceph) { flags.ceph = true; S.unlock('cephalization'); }
            if (caught >= BRAIN_GOAL && !done) { done = true; S.unlock('brain', () => S.completeStage()); }
          }
        }
      }
      function drawWorm(ctx) {
        const w = worm, head = w.segs[0];
        const ang = Math.atan2(w.vy, w.vx) || 0;
        // vision cone
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const cg = ctx.createRadialGradient(head.x, head.y, 10, head.x, head.y, 260);
        cg.addColorStop(0, 'rgba(255,216,107,0.10)'); cg.addColorStop(1, 'rgba(255,216,107,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(head.x, head.y); ctx.arc(head.x, head.y, 260, ang - 0.7, ang + 0.7); ctx.closePath(); ctx.fill(); ctx.restore();
        hazards.forEach(h => { G.glow(ctx, h.x, h.y, h.r * 1.1, '#5a1a3a', 0.9); G.wobbly(ctx, h.x, h.y, h.r, t * 0.5 + h.ph, 0.1, 5, 'rgba(60,10,40,0.7)', 'rgba(255,90,122,0.4)', 1.5); G.text(ctx, 'toxic', h.x, h.y, 10, 'rgba(255,120,150,0.6)'); });
        food.forEach(f => G.orb(ctx, f.x, f.y, 5, '#ffd86b', 2.2));
        // body
        G.glow(ctx, head.x, head.y, 50, w.hurt ? '#ff5a7a' : '#8ef7c2', 0.3 + w.hurt * 0.4);
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(142,247,194,0.85)';
        for (let i = 1; i < w.segs.length; i++) { const a = w.segs[i - 1], b = w.segs[i]; ctx.lineWidth = 16 * (1 - i / w.segs.length) + 4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        // nerve cords (two lines along body) and brain
        ctx.strokeStyle = 'rgba(255,216,107,0.7)'; ctx.lineWidth = 1.5;
        [-3, 3].forEach(off => { ctx.beginPath(); w.segs.forEach((s, i) => { const nx = i < w.segs.length - 1 ? w.segs[i + 1] : s; const a = Math.atan2(nx.y - s.y, nx.x - s.x) + Math.PI / 2; const x = s.x + Math.cos(a) * off, y = s.y + Math.sin(a) * off; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); });
        const br = 4 + w.brain * 9; G.glow(ctx, head.x, head.y, br * 3, '#ffd86b', 0.5 + 0.3 * Math.sin(t * 6)); G.circle(ctx, head.x, head.y, br, 'rgba(255,216,107,0.9)');
        // eyespots
        [-0.5, 0.5].forEach(o => { const ex = head.x + Math.cos(ang + o) * 9, ey = head.y + Math.sin(ang + o) * 9; G.circle(ctx, ex, ey, 3, '#1a0a05', '#fff', 1); });
        G.text(ctx, 'brain ' + Math.round(w.brain * 100) + '% · food ' + caught + ' / ' + BRAIN_GOAL, head.x, head.y - 28, 11, '#ffd86b');
        G.text(ctx, 'Sensors at the front, nerves bunched behind them: a head.', 18, 72, 12, '#ffd86b', 'left');
        G.text(ctx, 'You see ahead and choose where to go. Toxic patches shrink the brain; food grows it.', 18, 90, 12, '#7f9bbd', 'left');
      }

      st.update = function (dt) {
        t += dt;
        flashes.forEach(f => { f.life -= dt; f.r += (f.max - f.r) * dt * 6; }); for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].life <= 0) flashes.splice(i, 1);
        if (phase === 0) updateNet(dt); else updateWorm(dt);
      };
      st.draw = function (ctx) {
        if (phase === 0) { food.forEach(f => G.orb(ctx, f.x, f.y, 5, '#ffd86b', 2.2)); drawNet(ctx); } else drawWorm(ctx);
      };
      st.pointerDown = function () { if (phase === 0) pulse(); };
      st.key = function (code) { if (code === 'Space' && phase === 0) pulse(); };
      return st;
    }
  });
})();
