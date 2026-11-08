/* Stage 8: sexual reproduction. Mix genes with mates; parasites crack the clones. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const GENES = 4, GENEC = ['#4fd8ff', '#8ef7c2', '#ffd86b', '#ff7ad9'];
  const WAVES = 3, KIN_GOAL = 10, WAVE_EVERY = 22;

  S.registerStage({
    id: 'sex', index: 8, title: 'Sexual reproduction', years: 'about 1.5 to 1.2 billion years ago', ya: 1.3,
    palette: ['#02060f', '#061a38', '#0a2a3a'],
    objective: 'Touch a glowing mate to make offspring with mixed genes. Survive the parasite waves.',
    outro: 'Your kin are all different, so no single parasite can take them all. The clones next door were not so lucky. Now your cells will try something else: not separating after they divide.',
    create() {
      const st = {};
      let W, H, cells, parasites, me, t, wave, waveT, waveActive, flags, done, nextId, clonesStart, born;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; wave = 0; waveT = WAVE_EVERY - 6; waveActive = 0; done = false; nextId = 1; born = 0;
        flags = { sex: false, rq: false };
        cells = []; parasites = [];
        const cloneG = [S.randInt(0, 3), S.randInt(0, 3), S.randInt(0, 3), S.randInt(0, 3)];
        for (let i = 0; i < 14; i++) cells.push(newCell(S.rand(W * 0.08, W * 0.32), S.rand(H * 0.2, H * 0.8), cloneG.slice(), 'clone'));
        clonesStart = 14;
        me = newCell(W * 0.65, H * 0.5, randG(), 'kin'); me.me = true; cells.push(me);
        for (let i = 0; i < 7; i++) cells.push(newCell(S.rand(W * 0.5, W * 0.92), S.rand(H * 0.2, H * 0.8), randG(), 'kin'));
        S.UI.hint('Left: a clone colony, all one genotype. Right: you and your kin. Swim into a glowing kin to mate.', 9);
      };
      st.resize = function () { W = S.W; H = S.H; };
      const randG = () => Array.from({ length: GENES }, () => S.randInt(0, 3));
      function newCell(x, y, g, side) { return { id: nextId++, x, y, vx: 0, vy: 0, g, side, cd: 0, wob: S.rand(S.TAU), flash: 0, age: 0 }; }
      const kin = () => cells.filter(c => c.side === 'kin'), clones = () => cells.filter(c => c.side === 'clone');
      function mate(a, b) {
        a.cd = 6; b.cd = 6; a.flash = 1; b.flash = 1;
        for (let k = 0; k < 2; k++) {
          const g = a.g.map((v, i) => (S.chance(0.5) ? v : b.g[i]));
          if (S.chance(0.1)) g[S.randInt(0, GENES - 1)] = S.randInt(0, 3);
          const c = newCell((a.x + b.x) / 2 + S.rand(-20, 20), (a.y + b.y) / 2 + S.rand(-20, 20), g, 'kin'); c.cd = 5; c.vx = S.rand(-60, 60); c.vy = S.rand(-60, 60); cells.push(c); born++;
        }
        G.burst((a.x + b.x) / 2, (a.y + b.y) / 2, '#ff7ad9', 20, 100, 3); S.Audio.sfx('divide');
        if ((a.me || b.me) && !flags.sex) { flags.sex = true; S.unlock('sex'); }
      }
      function commonGenotype() {
        const m = {}; let best = null, bn = 0;
        cells.forEach(c => { const k = c.g.join(''); m[k] = (m[k] || 0) + 1; if (m[k] > bn) { bn = m[k]; best = c.g.slice(); } });
        return best;
      }
      const matches = (g, tg) => g.reduce((a, v, i) => a + (v === tg[i] ? 1 : 0), 0);

      st.update = function (dt) {
        t += dt;
        // cells move
        cells.forEach(c => {
          c.cd = Math.max(0, c.cd - dt); c.flash = Math.max(0, c.flash - dt * 2); c.age += dt;
          let tx, ty;
          if (c.me) { tx = S.input.x; ty = S.input.y; }
          else if (c.side === 'clone') { tx = W * 0.2 + Math.sin(t * 0.5 + c.wob) * 100; ty = H * 0.5 + Math.cos(t * 0.4 + c.wob) * 150; }
          else {
            // kin: seek a mate when ready, else wander
            if (c.cd === 0 && S.chance(dt * 2)) { let best = null, bd = 1e9; kin().forEach(o => { if (o !== c && o.cd === 0 && !o.me) { const d = S.dist(c.x, c.y, o.x, o.y); if (d < bd) { bd = d; best = o; } } }); c.goal = best; }
            if (c.goal && c.cd === 0 && cells.includes(c.goal)) { tx = c.goal.x; ty = c.goal.y; }
            else { tx = W * 0.7 + Math.sin(t * 0.4 + c.wob) * 180; ty = H * 0.5 + Math.cos(t * 0.33 + c.wob * 2) * 160; }
          }
          // flee parasites
          parasites.forEach(p => { const d = S.dist(p.x, p.y, c.x, c.y); if (d < 90 && !c.me) { tx = c.x + (c.x - p.x); ty = c.y + (c.y - p.y); } });
          if (tx !== undefined && tx > -100) { const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); const sp = c.me ? 200 : 90; if (d > 4) { c.vx += dx / d * sp * 5 * dt; c.vy += dy / d * sp * 5 * dt; } const s2 = Math.hypot(c.vx, c.vy); if (s2 > sp) { c.vx *= sp / s2; c.vy *= sp / s2; } }
          c.vx *= 0.9; c.vy *= 0.9; c.x += c.vx * dt; c.y += c.vy * dt;
          c.x = S.clamp(c.x, 16, W - 16); c.y = S.clamp(c.y, 76, H - 76);
        });
        // clones reproduce asexually (slowly), kin mate on touch
        if (clones().length && clones().length < 24 && S.chance(dt * 0.5)) { const p = S.pick(clones()); cells.push(newCell(p.x + S.rand(-15, 15), p.y + S.rand(-15, 15), p.g.slice(), 'clone')); }
        const ks = kin();
        for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
          const a = ks[i], b = ks[j];
          if (a.cd === 0 && b.cd === 0 && a.age > 3 && b.age > 3 && S.dist(a.x, a.y, b.x, b.y) < 30 && ks.length < 30) { if (a.me || b.me || S.chance(dt * 3)) mate(a, b); }
        }
        // waves
        waveT -= dt;
        if (waveT <= 0 && wave < WAVES && waveActive <= 0) {
          wave++; waveActive = 11; waveT = WAVE_EVERY;
          const tg = commonGenotype();
          for (let i = 0; i < 10; i++) parasites.push({ x: S.rand(W), y: S.chance(0.5) ? 40 : H - 40, vx: 0, vy: 0, g: tg, wob: S.rand(S.TAU), life: 11 });
          S.UI.toast('Parasite wave ' + wave + ': it targets the most common genotype'); S.Audio.sfx('zap');
        }
        if (waveActive > 0) { waveActive -= dt; if (waveActive <= 0) { parasites.length = 0; if (!flags.rq) { flags.rq = true; S.unlock('red-queen'); } } }
        for (let i = parasites.length - 1; i >= 0; i--) {
          const p = parasites[i];
          let target = null, bd = 1e9; cells.forEach(c => { if (matches(c.g, p.g) >= 3) { const d = S.dist(c.x, c.y, p.x, p.y); if (d < bd) { bd = d; target = c; } } });
          if (target) { const a = S.angleTo(p.x, p.y, target.x, target.y); p.vx += Math.cos(a) * 400 * dt; p.vy += Math.sin(a) * 400 * dt; }
          else { p.vx += Math.sin(t * 2 + p.wob) * 60 * dt; p.vy += Math.cos(t * 1.5 + p.wob) * 60 * dt; }
          const s2 = Math.hypot(p.vx, p.vy); if (s2 > 130) { p.vx *= 130 / s2; p.vy *= 130 / s2; }
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (target && S.dist(p.x, p.y, target.x, target.y) < 14) { infect(target); p.x = S.rand(W); p.y = S.chance(0.5) ? 40 : H - 40; }
        }
        S.UI.setProgress(Math.min(1, (wave - (waveActive > 0 ? 1 : 0)) / WAVES * 0.7 + Math.min(1, ks.length / KIN_GOAL) * 0.3));
        S.UI.objective(wave < WAVES || waveActive > 0 ? 'Kin ' + ks.length + ' (need ' + KIN_GOAL + ') · clones ' + clones().length + ' · waves survived ' + Math.max(0, wave - (waveActive > 0 ? 1 : 0)) + ' / ' + WAVES + (waveActive > 0 ? ' · PARASITES ACTIVE' : ' · next wave in ' + Math.ceil(waveT) + 's') : 'Waves done. Kin ' + ks.length + ' / ' + KIN_GOAL);
        if (wave >= WAVES && waveActive <= 0 && ks.length >= KIN_GOAL && !done) { done = true; setTimeout(() => S.completeStage(), 300); }
        if (wave >= WAVES && waveActive <= 0 && ks.length < KIN_GOAL && ks.length < 2 && !done) { done = true; extinct(); }
      };
      function infect(c) {
        const i = cells.indexOf(c); if (i < 0) return;
        cells.splice(i, 1); G.burst(c.x, c.y, '#ff5a5a', 14, 90, 2.5);
        if (c.me) { S.Audio.sfx('hurt'); const ks = kin(); if (ks.length) { me = ks[0]; me.me = true; S.UI.toast('Infected. You continue as one of your offspring.'); } else extinct(); }
      }
      function extinct() { S.UI.popup({ tag: 'Extinct', title: 'No kin left', years: 'about 1.2 billion years ago', body: 'Keep mating early so the population is big and varied before each wave hits. Variety is the whole defence.', button: 'Try again' }, () => S.restartStage()); }

      st.draw = function (ctx) {
        // zones
        ctx.fillStyle = 'rgba(255,160,80,0.04)'; ctx.fillRect(0, 60, W * 0.4, H - 120);
        G.text(ctx, 'CLONE COLONY · one genotype · ' + clones().length + ' cells', W * 0.2, 80, 12, '#ffb36b');
        G.text(ctx, 'YOUR KIN · mixed genotypes · ' + kin().length + ' cells · ' + born + ' born', W * 0.7, 80, 12, '#8ef7c2');
        cells.forEach(c => {
          const col = c.side === 'clone' ? '#ffb36b' : c.me ? '#8ef7c2' : '#4fd8ff';
          const ready = c.side === 'kin' && c.cd === 0 && c.age > 3;
          if (ready && !c.me) G.glow(ctx, c.x, c.y, 34 + 4 * Math.sin(t * 5), '#ff7ad9', 0.5);
          G.glow(ctx, c.x, c.y, 24 + c.flash * 30, col, (c.me ? 0.6 : 0.25) + c.flash * 0.5);
          G.wobbly(ctx, c.x, c.y, 12, t + c.wob, 0.07, 5, G.rgba(col, 0.2), G.rgba(col, c.me ? 1 : 0.7), c.me ? 2.5 : 1.5);
          // genes as 4 coloured dots
          c.g.forEach((v, k) => { const a = k / GENES * S.TAU - Math.PI / 2; G.circle(ctx, c.x + Math.cos(a) * 5.5, c.y + Math.sin(a) * 5.5, 2.4, GENEC[v]); });
          if (c.me) G.text(ctx, c.cd > 0 ? 'you · recovering ' + Math.ceil(c.cd) + 's' : 'you · ready to mate', c.x, c.y - 24, 11, '#8ef7c2');
        });
        parasites.forEach(p => {
          G.glow(ctx, p.x, p.y, 18, '#ff5a5a', 0.5); ctx.fillStyle = '#ff5a5a'; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a = k / 8 * S.TAU + t * 3; const r = k % 2 ? 4 : 8; ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); } ctx.fill();
          p.g.forEach((v, k) => { const a = k / GENES * S.TAU - Math.PI / 2; G.circle(ctx, p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 11, 1.8, GENEC[v]); });
        });
        G.text(ctx, 'A parasite kills any cell sharing 3 of its 4 gene colours.', 18, H - 70, 11, '#ff9a8a', 'left');
        G.text(ctx, 'Clones: ' + clones().length + ' of ' + clonesStart + ' founders\' line left', 18, H - 54, 11, '#ffb36b', 'left');
      };
      return st;
    }
  });
})();
