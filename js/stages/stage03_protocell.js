/* Stage 3: protocell. Wrap your RNA in a self-assembling fatty-acid membrane. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const SEGS = 24, GROW = 15;

  S.registerStage({
    id: 'protocell', index: 3, title: 'Protocell', years: 'about 3.9 billion years ago', ya: 3.9,
    palette: ['#02060f', '#061a38', '#0a2a4a'],
    objective: 'Steer your RNA into fatty acids. Close the membrane before hydrolysis eddies shred the strand.',
    outro: 'Your RNA now lives inside a bubble. Whatever it makes stays with it, so if it copies itself, the copies are its own. That changes everything.',
    create() {
      const st = {};
      let W, H, me, fats, vesicles, eddies, t, phase, flags, dead, seq, flying;
      const BASEC = { A: '#ff7ad9', U: '#ff9ad0', G: '#e06bff', C: '#ff6ba8' };

      st.enter = function () {
        W = S.W; H = S.H; t = 0; phase = 0; dead = false;
        flags = { ves: false, comp: false, hint: false };
        me = { x: W / 2, y: H / 2, vx: 0, vy: 0, membrane: 0, grown: 0, integrity: 1, r: 34, hurt: 0 };
        fats = []; vesicles = []; eddies = []; flying = [];
        seq = S.carryGet('rna', ['A', 'U', 'G', 'C', 'A', 'G', 'U', 'C', 'A', 'G']);
        for (let i = 0; i < 70; i++) fats.push(newFat(S.rand(W), S.rand(H)));
        for (let i = 0; i < 3; i++) eddies.push(newEddy());
        S.UI.hint('Move the mouse to steer. Each fatty acid you touch adds to the ring around your strand.', 8);
      };
      st.resize = function () { W = S.W; H = S.H; };
      function newFat(x, y) { return { x, y, a: S.rand(S.TAU), vx: S.rand(-10, 10), vy: S.rand(-10, 10), wob: S.rand(S.TAU) }; }
      function newEddy() {
        const side = S.randInt(0, 3); let x, y;
        if (side === 0) { x = -80; y = S.rand(H); } else if (side === 1) { x = W + 80; y = S.rand(H); } else if (side === 2) { x = S.rand(W); y = -80; } else { x = S.rand(W); y = H + 80; }
        const ang = S.angleTo(x, y, S.rand(W * 0.2, W * 0.8), S.rand(H * 0.2, H * 0.8));
        const sp = S.rand(25, 45);
        return { x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: S.rand(55, 85), ph: S.rand(S.TAU) };
      }
      const membraneFrac = () => Math.min(1, me.membrane / SEGS);

      st.update = function (dt) {
        t += dt;
        if (dead) return;
        // steer toward pointer
        if (S.input.x > -100) {
          const dx = S.input.x - me.x, dy = S.input.y - me.y, d = Math.hypot(dx, dy);
          if (d > 6) { me.vx += dx / d * 420 * dt; me.vy += dy / d * 420 * dt; }
        }
        me.vx *= 0.93; me.vy *= 0.93; me.x += me.vx * dt; me.y += me.vy * dt;
        me.x = S.clamp(me.x, 30, W - 30); me.y = S.clamp(me.y, 60, H - 60);
        me.hurt = Math.max(0, me.hurt - dt * 2);

        // fatty acids drift; self-assemble when crowded
        while (fats.length < 60) { const side = Math.random() < 0.5; fats.push(newFat(side ? -10 : S.rand(W), side ? S.rand(H) : -10)); }
        for (let i = fats.length - 1; i >= 0; i--) {
          const f = fats[i];
          f.vx += Math.sin(t * 1.2 + f.wob) * 14 * dt + 4 * dt; f.vy += Math.cos(t + f.wob) * 14 * dt;
          f.vx *= 0.985; f.vy *= 0.985; f.x += f.vx * dt; f.y += f.vy * dt; f.a += dt * 0.8;
          if (f.x > W + 20) f.x = -15; if (f.y > H + 20) f.y = -15; if (f.y < -20) f.y = H + 15; if (f.x < -20) f.x = W + 15;
          const d = S.dist(f.x, f.y, me.x, me.y);
          const need = phase === 0 ? me.membrane < SEGS : me.grown < GROW;
          if (d < me.r + 6 && need) {
            fats.splice(i, 1); S.Audio.sfx('catch');
            flying.push({ x: f.x, y: f.y, t: 0 });
            if (phase === 0) { me.membrane++; if (me.membrane >= SEGS) closeMembrane(); }
            else { me.grown++; me.r += 1.2; if (me.grown >= GROW) finish(); }
            S.UI.setProgress(phase === 0 ? me.membrane / SEGS * 0.6 : 0.6 + 0.4 * me.grown / GROW);
            continue;
          }
          // mild attraction between fats (self-assembly)
          if (S.chance(dt * 0.5)) {
            let n = 0, cx = 0, cy = 0;
            fats.forEach(o => { if (o !== f && S.dist(o.x, o.y, f.x, f.y) < 28) { n++; cx += o.x; cy += o.y; } });
            if (n >= 6) {
              const members = fats.filter(o => S.dist(o.x, o.y, f.x, f.y) < 28).slice(0, 7);
              members.forEach(o => fats.splice(fats.indexOf(o), 1));
              vesicles.push({ x: cx / n, y: cy / n, r: 14, vx: S.rand(-8, 8), vy: S.rand(-8, 8), n: members.length, ph: S.rand(S.TAU) });
              G.burst(cx / n, cy / n, '#ffd86b', 10, 50, 2);
              if (!flags.hint) { flags.hint = true; S.UI.toast('Fatty acids spontaneously formed a vesicle nearby'); }
              break;
            }
          }
        }
        // free vesicles drift, can be absorbed
        for (let i = vesicles.length - 1; i >= 0; i--) {
          const v = vesicles[i]; v.x += (v.vx + 4) * dt; v.y += v.vy * dt;
          if (v.x > W + 30) v.x = -20;
          if (S.dist(v.x, v.y, me.x, me.y) < me.r + v.r) {
            vesicles.splice(i, 1); S.Audio.sfx('bond'); G.burst(v.x, v.y, '#ffd86b', 14, 70, 2.5);
            if (phase === 0) { me.membrane = Math.min(SEGS, me.membrane + v.n); if (me.membrane >= SEGS) closeMembrane(); }
            else { me.grown = Math.min(GROW, me.grown + v.n); me.r += 1.2 * v.n; if (me.grown >= GROW) finish(); }
            S.UI.setProgress(phase === 0 ? me.membrane / SEGS * 0.6 : 0.6 + 0.4 * me.grown / GROW);
          }
        }
        for (let i = flying.length - 1; i >= 0; i--) { flying[i].t += dt * 3.5; if (flying[i].t >= 1) flying.splice(i, 1); }
        // eddies
        eddies.forEach((e, i) => {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < -150 || e.x > W + 150 || e.y < -150 || e.y > H + 150) eddies[i] = newEddy();
          const d = S.dist(e.x, e.y, me.x, me.y);
          if (d < e.r + me.r * 0.5 && phase === 0) {
            const exposure = 1 - membraneFrac();
            if (exposure > 0.02) {
              me.integrity -= dt * 0.28 * exposure; me.hurt = 1;
              if (S.chance(dt * 10)) G.particles.emit({ x: me.x + S.rand(-20, 20), y: me.y + S.rand(-20, 20), color: '#ff5a7a', speed: 40, life: 0.5, size: 2 });
              if (me.integrity <= 0) die();
            }
          }
        });
        if (eddies.length < 4 && S.chance(dt * 0.1)) eddies.push(newEddy());
      };

      function closeMembrane() {
        phase = 1; S.Audio.sfx('milestone'); G.burst(me.x, me.y, '#ffd86b', 40, 120, 3);
        S.unlock('vesicles', () => { S.UI.objective('Membrane closed. Keep collecting fatty acids to grow the vesicle.'); S.UI.hint('The eddies cannot reach the strand now. Grow by absorbing ' + GROW + ' more fatty acids.', 7); });
      }
      function finish() { S.carrySet('membrane', SEGS + GROW); S.unlock('compartment', () => S.completeStage()); }
      function die() {
        dead = true; S.Audio.sfx('hurt'); G.burst(me.x, me.y, '#ff5a7a', 40, 150, 3);
        S.UI.popup({ tag: 'Strand hydrolyzed', title: 'Your RNA fell apart', years: 'about 3.9 billion years ago', body: 'Exposed RNA in warm water does not last. Most strands that ever formed ended this way. Try again: close the ring faster and steer away from the eddies while it is open.', button: 'Try again' }, () => S.restartStage());
      }

      st.draw = function (ctx) {
        // eddies
        eddies.forEach(e => {
          const pulse = 1 + 0.08 * Math.sin(t * 3 + e.ph);
          G.glow(ctx, e.x, e.y, e.r * pulse, '#ff5a9a', 0.35);
          ctx.strokeStyle = 'rgba(255,120,170,0.35)'; ctx.lineWidth = 1.5;
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.25 * k) * pulse, t * (1 + k * 0.4) + e.ph, t * (1 + k * 0.4) + e.ph + 4); ctx.stroke(); }
          G.text(ctx, 'hydrolysis eddy', e.x, e.y - e.r - 8, 10, 'rgba(255,150,190,0.7)');
        });
        // free fats
        fats.forEach(f => drawFat(ctx, f.x, f.y, f.a, 0.9));
        vesicles.forEach(v => { G.glow(ctx, v.x, v.y, v.r * 2, '#ffd86b', 0.3); ctx.strokeStyle = 'rgba(255,216,107,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.x, v.y, v.r, 0, S.TAU); ctx.stroke(); G.text(ctx, 'vesicle', v.x, v.y - v.r - 8, 10, 'rgba(255,216,107,0.8)'); });

        // me: RNA strand
        const frac = membraneFrac();
        if (me.hurt > 0) G.glow(ctx, me.x, me.y, me.r * 2, '#ff5a7a', me.hurt * 0.5);
        G.glow(ctx, me.x, me.y, me.r * 1.6, '#ff7ad9', 0.25 + 0.2 * frac);
        if (phase === 1) { ctx.fillStyle = 'rgba(255,216,107,0.08)'; ctx.beginPath(); ctx.arc(me.x, me.y, me.r, 0, S.TAU); ctx.fill(); }
        const n0 = seq.length, pos = (i) => { const a = i / n0 * 1.7 * Math.PI + t * 0.6; const rr = me.r * 0.45 * (0.6 + 0.4 * Math.sin(i + t * 2)); return { x: me.x + Math.cos(a) * rr, y: me.y + Math.sin(a) * rr }; };
        ctx.strokeStyle = G.rgba('#ff7ad9', 0.9 * me.integrity + 0.1); ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i < n0; i++) { const p = pos(i); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        for (let i = 0; i < n0; i++) { const p = pos(i); G.circle(ctx, p.x, p.y, 4.5, G.rgba(BASEC[seq[i]] || '#ff9ad0', 0.3 + 0.7 * me.integrity)); G.text(ctx, seq[i], p.x, p.y, 7, '#2a0a1e', 'center', '700'); }
        // membrane segments
        const n = (phase === 1 ? SEGS + me.grown : me.membrane) - flying.length;
        const total = phase === 1 ? SEGS + me.grown : SEGS;
        flying.forEach((f, j) => { const a = (n + j) / total * S.TAU + t * 0.3; const tx = me.x + Math.cos(a) * me.r, ty = me.y + Math.sin(a) * me.r; const k = 1 - Math.pow(1 - f.t, 2); drawFat(ctx, f.x + (tx - f.x) * k, f.y + (ty - f.y) * k, a + Math.PI, 1); });
        for (let i = 0; i < n; i++) {
          const a = i / total * S.TAU + t * 0.3;
          drawFat(ctx, me.x + Math.cos(a) * me.r, me.y + Math.sin(a) * me.r, a + Math.PI, 1);
          drawFat(ctx, me.x + Math.cos(a) * (me.r - 9), me.y + Math.sin(a) * (me.r - 9), a, 1);
        }
        if (phase === 0 && n < SEGS) { ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(255,216,107,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(me.x, me.y, me.r - 4, n / SEGS * S.TAU + t * 0.3, S.TAU + t * 0.3); ctx.stroke(); ctx.setLineDash([]); }
        // bars
        G.bar(ctx, me.x - 30, me.y + me.r + 14, 60, 5, me.integrity, me.integrity > 0.4 ? '#ff7ad9' : '#ff5a7a');
        G.text(ctx, 'RNA integrity', me.x, me.y + me.r + 28, 10, '#ff9ad0');
        G.text(ctx, phase === 0 ? 'your RNA · membrane ' + Math.round(frac * 100) + '%' : 'protocell', me.x, me.y - me.r - 14, 11, '#ffd86b');
        // legend
        G.text(ctx, S.mobile ? 'Fatty acid: polar head + oily tail' : 'Fatty acid: polar head (yellow) + oily tail. Alone in water they want to hide their tails.', 18, 72, 12, '#ffd86b', 'left');
        G.text(ctx, S.mobile ? 'Pink eddies hydrolyze exposed RNA' : 'Pink eddies: warm water that hydrolyzes exposed RNA.', 18, 90, 12, '#ff9ad0', 'left');
      };
      function drawFat(ctx, x, y, a, alpha) {
        ctx.strokeStyle = 'rgba(200,220,255,' + 0.6 * alpha + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); ctx.lineTo(x + Math.cos(a) * 7 + Math.cos(a + 0.6) * 4, y + Math.sin(a) * 7 + Math.sin(a + 0.6) * 4); ctx.stroke();
        G.circle(ctx, x, y, 2.6, 'rgba(255,216,107,' + alpha + ')');
      }
      st.debug = () => ({ me, fats, eddies, vesicles, phase, dead });
      return st;
    }
  });
})();
