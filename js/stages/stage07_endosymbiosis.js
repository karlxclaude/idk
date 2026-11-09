/* Stage 7: endosymbiosis. Hit the surface/volume wall, then keep a bacterium that breathes oxygen. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const MITO_GOAL = 4, SIZE_GOAL = 64;

  S.registerStage({
    id: 'endosymbiosis', index: 7, title: 'Endosymbiosis', years: 'about 2.0 to 1.8 billion years ago', ya: 1.9,
    palette: ['#02060f', '#0a1a30', '#102a2a'],
    objective: 'Eat green bacteria to grow. Watch your energy as you get bigger.',
    outro: 'Thousands of internal power plants mean energy is no longer the limit on size or genome. The eukaryotic cell can afford to get complicated.',
    create() {
      const st = {};
      let W, H, me, bugs, oxy, t, mitos, choice, flags, done, netNegT, o2level;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; done = false; netNegT = 0; o2level = 0;
        flags = { sv: false, o2: false, endo: false, choiceHint: false };
        me = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 26, energy: 60, hurt: 0 };
        bugs = []; oxy = []; mitos = []; choice = null;
        for (let i = 0; i < 25; i++) bugs.push(newBug(S.rand(W), S.rand(60, H - 60), false));
        S.UI.hint('Steer with the mouse. Eat the green bacteria to grow.', 7);
      };
      st.resize = function () { W = S.W; H = S.H; };
      function newBug(x, y, purple) { return { x, y, vx: S.rand(-20, 20), vy: S.rand(-20, 20), purple, wob: S.rand(S.TAU), r: purple ? 7 : 5 }; }
      const production = () => me.r * 0.09 + mitos.length * 2.2;        // surface + mitochondria
      const consumption = () => me.r * me.r * 0.0019 + 0.4;             // "volume"

      st.update = function (dt) {
        t += dt;
        if (choice) return; // waiting on the digest/keep decision
        // steer
        const speed = S.clamp(260 - me.r * 1.6, 90, 240);
        if (S.input.x > -100) { const dx = S.input.x - me.x, dy = S.input.y - me.y, d = Math.hypot(dx, dy); if (d > 5) { me.vx += dx / d * speed * 5 * dt; me.vy += dy / d * speed * 5 * dt; } }
        const sp = Math.hypot(me.vx, me.vy); if (sp > speed) { me.vx *= speed / sp; me.vy *= speed / sp; }
        me.vx *= 0.92; me.vy *= 0.92; me.x += me.vx * dt; me.y += me.vy * dt;
        me.x = S.clamp(me.x, me.r, W - me.r); me.y = S.clamp(me.y, 60 + me.r, H - 60 - me.r);
        me.hurt = Math.max(0, me.hurt - dt * 2);
        // energy budget
        const net = production() - consumption();
        me.energy = S.clamp(me.energy + net * dt, 0, 100);
        if (net < 0 && me.r > 36 && mitos.length === 0) { netNegT += dt; if (netNegT > 2.5 && !flags.sv) { flags.sv = true; S.unlock('surface-volume', () => S.UI.hint('Growing bigger now costs more than the membrane can make. The purple bacteria are different: try engulfing one.', 10)); } } else netNegT = 0;
        if (me.energy <= 0) { me.r -= dt * 6; me.hurt = 1; if (me.r < 14) { die(); return; } }
        // oxygen rises over time (Great Oxidation)
        o2level = Math.min(1, o2level + dt * 0.012);
        if (oxy.length < 6 + o2level * 50 && S.chance(dt * 6)) oxy.push({ x: S.rand(W), y: H + 10, vy: -S.rand(20, 45), vx: S.rand(-10, 10), wob: S.rand(S.TAU), r: S.rand(3, 6) });
        for (let i = oxy.length - 1; i >= 0; i--) {
          const o = oxy[i]; o.y += o.vy * dt; o.x += (o.vx + Math.sin(t * 2 + o.wob) * 15) * dt;
          if (o.y < 40) { oxy.splice(i, 1); continue; }
          if (S.dist(o.x, o.y, me.x, me.y) < me.r + o.r) {
            oxy.splice(i, 1);
            if (mitos.length) { me.energy = Math.min(100, me.energy + 4); G.burst(o.x, o.y, '#8ef7c2', 8, 60, 2); }
            else { me.energy -= 5; me.hurt = 1; G.burst(o.x, o.y, '#ff5a7a', 8, 60, 2); S.Audio.sfx('hurt'); if (!flags.o2) { flags.o2 = true; S.unlock('oxygen'); } }
          }
        }
        // bacteria
        const purpleCount = bugs.filter(b => b.purple).length;
        if (bugs.length < 28 && S.chance(dt * 4)) bugs.push(newBug(S.chance(0.5) ? -10 : W + 10, S.rand(60, H - 60), o2level > 0.08 && purpleCount < 3 && S.chance(0.3)));
        for (let i = bugs.length - 1; i >= 0; i--) {
          const b = bugs[i];
          b.vx += Math.sin(t * 1.5 + b.wob) * 30 * dt; b.vy += Math.cos(t * 1.2 + b.wob) * 30 * dt;
          const d = S.dist(b.x, b.y, me.x, me.y);
          if (d < 110) { const a = S.angleTo(me.x, me.y, b.x, b.y); b.vx += Math.cos(a) * 60 * dt; b.vy += Math.sin(a) * 60 * dt; }
          const bs = b.purple ? 70 : 55; const s2 = Math.hypot(b.vx, b.vy); if (s2 > bs) { b.vx *= bs / s2; b.vy *= bs / s2; }
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < -30) b.x = W + 20; if (b.x > W + 30) b.x = -20; if (b.y < 50) b.y = H - 50; if (b.y > H - 40) b.y = 60;
          if (d < me.r) {
            bugs.splice(i, 1);
            if (b.purple) { choice = { bug: b, t: 0 }; S.Audio.sfx('catch'); S.UI.hint('', 0); }
            else { me.r = Math.min(90, me.r + 1.6); me.energy = Math.min(100, me.energy + 8); S.Audio.sfx('eat'); G.burst(b.x, b.y, '#8ef7c2', 6, 50, 2); }
          }
        }
        // mitochondria multiply inside
        mitos.forEach(m => { m.a += dt * 0.4; m.t += dt; if (m.t > 18 && mitos.length < 8 && S.chance(dt * 0.3)) { m.t = 0; mitos.push({ a: S.rand(S.TAU), d: S.rand(0.3, 0.7), t: 0 }); S.UI.toast('A mitochondrion divided inside you'); } });
        S.UI.setProgress(Math.min(1, (Math.min(mitos.length, MITO_GOAL) / MITO_GOAL) * 0.6 + Math.min(1, me.r / SIZE_GOAL) * 0.4));
        if (mitos.length >= MITO_GOAL && me.r >= SIZE_GOAL && !done) { done = true; setTimeout(() => S.completeStage(), 400); }
      };
      function die() {
        S.UI.popup({ tag: 'Starved', title: 'Too big to feed itself', years: 'about 2.0 billion years ago', body: 'Your membrane could not make enough energy for your volume, and the oxygen made it worse. Stay smaller until you have a lodger that can burn oxygen for you.', button: 'Try again' }, () => S.restartStage());
      }
      function resolve(keep) {
        if (!choice) return;
        const b = choice.bug; choice = null;
        if (keep) {
          mitos.push({ a: S.rand(S.TAU), d: S.rand(0.3, 0.7), t: 0 }); S.Audio.sfx('milestone'); G.burst(me.x, me.y, '#c48cff', 30, 110, 3);
          if (!flags.endo) { flags.endo = true; S.unlock('endosymbiosis', () => { S.UI.objective('Keep ' + MITO_GOAL + ' mitochondria and grow to a complex-cell size. They also turn oxygen into energy now.'); }); }
          else S.UI.toast('Another oxygen-breathing lodger kept');
        } else { me.r = Math.min(90, me.r + 2); me.energy = Math.min(100, me.energy + 14); S.Audio.sfx('eat'); S.UI.toast('Digested. Short-term food, long-term nothing.'); }
      }
      st.key = function (code) { if (!choice) return; if (code === 'KeyK') resolve(true); if (code === 'KeyD') resolve(false); };
      st.pointerDown = function (x, y) {
        if (!choice) return;
        const bx = W / 2, by = H / 2 + 60, off = Math.min(125, W / 4), hw = Math.min(105, W / 4 - 8);
        if (Math.abs(y - by) < 30) { if (Math.abs(x - (bx - off)) < hw) resolve(false); else if (Math.abs(x - (bx + off)) < hw) resolve(true); }
      };

      st.draw = function (ctx) {
        // oxygen
        oxy.forEach(o => { G.circle(ctx, o.x, o.y, o.r, 'rgba(200,240,255,0.12)', 'rgba(200,240,255,0.6)', 1); G.text(ctx, 'O₂', o.x, o.y, 7, 'rgba(200,240,255,0.8)'); });
        bugs.forEach(b => { const col = b.purple ? '#c48cff' : '#8ef7c2'; G.glow(ctx, b.x, b.y, b.r * 3, col, b.purple ? 0.6 : 0.3); ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.5, b.r, 0, 0, S.TAU); ctx.fill(); ctx.restore(); if (b.purple) G.text(ctx, 'breathes O₂', b.x, b.y - 14, 9, '#c48cff'); });
        // me
        G.glow(ctx, me.x, me.y, me.r * 1.8, me.hurt ? '#ff5a7a' : '#4fd8ff', 0.3 + me.hurt * 0.4);
        G.wobbly(ctx, me.x, me.y, me.r, t, 0.05, 7, 'rgba(79,216,255,0.12)', 'rgba(79,216,255,0.9)', 2.5);
        G.circle(ctx, me.x, me.y, me.r * 0.28, 'rgba(120,160,255,0.35)', 'rgba(160,200,255,0.7)', 1.5); // nucleus-ish
        mitos.forEach(m => { const x = me.x + Math.cos(m.a) * me.r * m.d, y = me.y + Math.sin(m.a) * me.r * m.d; G.glow(ctx, x, y, 16, '#c48cff', 0.5); ctx.save(); ctx.translate(x, y); ctx.rotate(m.a); ctx.fillStyle = '#c48cff'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, S.TAU); ctx.fill(); ctx.strokeStyle = '#3a1a5a'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = -6; k <= 6; k += 3) { ctx.moveTo(k, -3); ctx.lineTo(k + 1.5, 3); } ctx.stroke(); ctx.restore(); });
        // meters
        const prod = production(), cons = consumption();
        G.bar(ctx, me.x - 30, me.y + me.r + 10, 60, 5, me.energy / 100, me.energy > 30 ? '#8ef7c2' : '#ff5a7a');
        G.text(ctx, 'energy', me.x, me.y + me.r + 24, 10, '#9fc0e8');
        G.text(ctx, (S.mobile ? 'Made at surface: ' : 'Energy made at the surface: ') + prod.toFixed(1) + ' / s' + (mitos.length && !S.mobile ? '  (incl. ' + mitos.length + ' mitochondria)' : ''), 18, 72, 13, '#8ef7c2', 'left');
        G.text(ctx, (S.mobile ? 'Spent by volume: ' : 'Energy spent by the volume: ') + cons.toFixed(1) + ' / s', 18, 92, 13, prod >= cons ? '#d8ecff' : '#ff9a8a', 'left');
        G.text(ctx, 'Radius ' + Math.round(me.r) + ' (goal ' + SIZE_GOAL + ') · mitochondria ' + mitos.length + ' / ' + MITO_GOAL, 18, 112, 12, '#9fc0e8', 'left');
        G.bar(ctx, 18, 134, 160, 6, o2level, '#cfefff', S.mobile ? 'oxygen (rising)' : 'oxygen in the water (rising)');
        // choice dialog
        if (choice) {
          ctx.fillStyle = 'rgba(0,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
          const bx = W / 2, by = H / 2 + 60;
          G.text(ctx, 'You engulfed an oxygen-breathing bacterium.', bx, by - 70, S.mobile ? 15 : 20, '#d8ecff');
          G.text(ctx, 'It is still alive inside you. What happens next?', bx, by - 42, 14, '#9fc0e8');
          const off = Math.min(125, W / 4), hw = Math.min(105, W / 4 - 8);
          [[bx - off, S.touch ? 'Digest it' : 'Digest it  (D)', '+food now', '#8ef7c2'], [bx + off, S.touch ? 'Keep it' : 'Keep it  (K)', 'let it live inside you', '#c48cff']].forEach(([x, l, sub, col]) => {
            ctx.fillStyle = 'rgba(20,50,100,0.6)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - hw, by - 26, hw * 2, 52, 10) : ctx.rect(x - hw, by - 26, hw * 2, 52); ctx.fill(); ctx.stroke();
            G.text(ctx, l, x, by - 7, 15, col); G.text(ctx, sub, x, by + 12, 11, '#9fc0e8');
          });
        }
      };
      st.debug = () => ({ me, bugs, oxy, mitos: mitos.length, choice: !!choice, done });
      return st;
    }
  });
})();
