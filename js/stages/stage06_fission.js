/* Stage 6: asexual reproduction. Eat, grow, divide; traits mutate; rivals compete. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const GOAL = 15, CAP = 60;

  S.registerStage({
    id: 'fission', index: 6, title: 'Asexual reproduction', years: 'about 3.5 billion years ago', ya: 3.5,
    palette: ['#02060f', '#07203d', '#062a3a'],
    objective: 'Eat (green), grow, press Space to divide. Bigger cells eat smaller ones. Out-breed the red rivals.',
    outro: 'Your lineage dominates this patch of ocean. Bacteria will run the planet alone like this for well over a billion years. Then one of them swallows something it does not digest.',
    create() {
      const st = {};
      let W, H, cells, food, me, t, flags, done, nextId;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; done = false; nextId = 1;
        flags = { fis: false, traits: false };
        cells = []; food = [];
        me = newCell(W * 0.3, H * 0.5, { speed: 1, size: 1, spikes: 0 }, 'me', 10); me.me = true; cells.push(me);
        for (let i = 0; i < 6; i++) cells.push(newCell(S.rand(W * 0.55, W * 0.9), S.rand(H * 0.2, H * 0.8), { speed: S.rand(0.8, 1.2), size: S.rand(0.8, 1.2), spikes: S.randInt(0, 1) }, 'rival', S.rand(6, 14)));
        for (let i = 0; i < 60; i++) food.push({ x: S.rand(W), y: S.rand(60, H - 60) });
        S.UI.hint('Steer with the mouse. Fill the bar by eating, then Space to divide. Each division mutates your traits a little.', 9);
      };
      st.resize = function () { W = S.W; H = S.H; };
      function newCell(x, y, tr, lineage, mass) {
        return { id: nextId++, x, y, vx: 0, vy: 0, tr, lineage, mass, age: 0, wob: S.rand(S.TAU), flash: 0, cd: 0 };
      }
      const radius = (c) => 7 + Math.sqrt(c.mass) * 2.6;
      const divideAt = (c) => 16 * c.tr.size;
      function mutate(tr) {
        const n = { speed: S.clamp(tr.speed * S.rand(0.85, 1.15), 0.4, 2.2), size: S.clamp(tr.size * S.rand(0.85, 1.15), 0.5, 2.2), spikes: tr.spikes };
        if (S.chance(0.35)) n.spikes = S.clamp(n.spikes + (S.chance(0.5) ? 1 : -1), 0, 4);
        return n;
      }
      function divide(c) {
        if (c.mass < divideAt(c)) return false;
        const a = S.rand(S.TAU), r = radius(c);
        c.mass /= 2;
        const child = newCell(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, mutate(c.tr), c.lineage, c.mass);
        c.tr = mutate(c.tr); c.x -= Math.cos(a) * r * 0.5; c.y -= Math.sin(a) * r * 0.5;
        child.vx = Math.cos(a) * 80; child.vy = Math.sin(a) * 80; c.vx = -child.vx; c.vy = -child.vy; c.flash = 1; child.flash = 1;
        cells.push(child); S.Audio.sfx('divide'); G.burst(c.x, c.y, c.lineage === 'me' ? '#8ef7c2' : '#ff6b6b', 12, 70, 2.5);
        if (c.me && !flags.fis) { flags.fis = true; S.unlock('fission'); }
        return true;
      }
      const mine = () => cells.filter(c => c.lineage === 'me');

      st.update = function (dt) {
        t += dt;
        if (food.length < 70 && S.chance(dt * 14)) food.push({ x: S.rand(W), y: S.rand(60, H - 60) });
        for (let i = cells.length - 1; i >= 0; i--) {
          const c = cells[i]; const r = radius(c);
          const speed = (120 * c.tr.speed) / (0.6 + 0.4 * c.tr.size) * (1 - 0.06 * c.tr.spikes);
          let tx, ty;
          if (c.me) { tx = S.input.x; ty = S.input.y; }
          else {
            // AI: flee bigger neighbours, chase food or smaller cells
            let threat = null, td = 1e9;
            cells.forEach(o => { if (o !== c && canEat(o, c)) { const d = S.dist(o.x, o.y, c.x, c.y); if (d < 140 && d < td) { td = d; threat = o; } } });
            if (threat) { tx = c.x + (c.x - threat.x); ty = c.y + (c.y - threat.y); }
            else {
              if (!c.goal || c.goal.gone || S.chance(dt * 0.3)) { let best = null, bd = 1e9; food.forEach(f => { const d = S.dist(c.x, c.y, f.x, f.y); if (d < bd) { bd = d; best = f; } }); c.goal = best; }
              if (c.goal) { tx = c.goal.x; ty = c.goal.y; }
            }
          }
          if (tx !== undefined && tx > -100) { const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d > 3) { c.vx += dx / d * speed * 5 * dt; c.vy += dy / d * speed * 5 * dt; } }
          const sp = Math.hypot(c.vx, c.vy); if (sp > speed) { c.vx *= speed / sp; c.vy *= speed / sp; }
          c.vx *= 0.92; c.vy *= 0.92; c.x += c.vx * dt; c.y += c.vy * dt;
          c.x = S.clamp(c.x, r, W - r); c.y = S.clamp(c.y, 60 + r, H - 60 - r);
          c.flash = Math.max(0, c.flash - dt * 2); c.age += dt; c.cd = Math.max(0, c.cd - dt);
          // metabolism
          c.mass -= dt * (0.25 + 0.25 * c.tr.speed + 0.12 * c.tr.spikes) * (0.5 + 0.5 * Math.sqrt(c.mass) / 3);
          if (c.mass < 2) { die(i, c, 'starved'); continue; }
          // eat food
          for (let j = food.length - 1; j >= 0; j--) { const f = food[j]; if (S.dist(f.x, f.y, c.x, c.y) < r + 3) { food.splice(j, 1); f.gone = true; c.mass += 3; if (c.me) S.Audio.sfx('eat'); } }
          // eat cells
          for (let j = cells.length - 1; j >= 0; j--) {
            const o = cells[j]; if (o === c) continue;
            const d = S.dist(o.x, o.y, c.x, c.y);
            if (d < r && canEat(c, o)) { c.mass += o.mass * 0.7; G.burst(o.x, o.y, o.lineage === 'me' ? '#8ef7c2' : '#ff6b6b', 16, 90, 3); if (c.me || o.me) S.Audio.sfx('hurt'); die(j, o, 'eaten'); if (j < i) i--; }
            else if (d < r + radius(o)) { const push = (r + radius(o) - d) * 2; const a = S.angleTo(o.x, o.y, c.x, c.y); c.vx += Math.cos(a) * push; c.vy += Math.sin(a) * push; }
          }
          if (!c.me && c.mass >= divideAt(c) && S.chance(dt * 1.2)) divide(c);
        }
        if (cells.length > CAP) { let wi = -1, wm = 1e9; cells.forEach((c, i) => { if (!c.me && c.mass < wm) { wm = c.mass; wi = i; } }); if (wi >= 0) die(wi, cells[wi], 'starved'); }
        const n = mine().length;
        S.UI.setProgress(n / GOAL);
        if (n >= 5 && !flags.traits) { flags.traits = true; S.unlock('traits'); }
        if (n >= GOAL && !done) { done = true; S.unlock('competition', () => S.completeStage()); }
      };
      function canEat(big, small) { return radius(big) > radius(small) * (1.25 + 0.3 * small.tr.spikes); }
      function die(i, c, why) {
        if (cells[i] !== c) i = cells.indexOf(c); if (i < 0) return;
        cells.splice(i, 1);
        if (c.me) {
          const kin = mine(); if (kin.length) { const n = kin.reduce((a, b) => a.mass > b.mass ? a : b); n.me = true; me = n; S.UI.toast('You were ' + why + '. You continue as another cell of your lineage.'); }
          else S.UI.popup({ tag: 'Extinct', title: 'Your lineage died out', years: 'about 3.5 billion years ago', body: 'Every cell carrying your genes was ' + why + '. That happened to almost every lineage that ever existed. Try again: eat steadily, divide as soon as the bar fills, and keep away from cells bigger than you.', button: 'Try again' }, () => S.restartStage());
        }
      }
      st.key = function (code) { if (code === 'Space') { if (!divide(me)) S.UI.toast('Not big enough to divide yet'); } };
      st.pointerDown = function () { if (me.mass >= divideAt(me)) divide(me); };

      st.draw = function (ctx) {
        food.forEach(f => G.circle(ctx, f.x, f.y, 2.5, 'rgba(142,247,194,0.85)'));
        cells.forEach(c => {
          const r = radius(c), col = c.lineage === 'me' ? (c.me ? '#8ef7c2' : '#5fd39a') : '#ff6b6b';
          G.glow(ctx, c.x, c.y, r * 2 + c.flash * 20, col, (c.me ? 0.5 : 0.2) + c.flash * 0.4);
          if (c.tr.spikes) { ctx.strokeStyle = G.rgba(col, 0.8); ctx.lineWidth = 2; ctx.beginPath(); const n = 6 + c.tr.spikes * 3; for (let k = 0; k < n; k++) { const a = k / n * S.TAU + t * 0.3; ctx.moveTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); ctx.lineTo(c.x + Math.cos(a) * (r + 3 + c.tr.spikes * 2), c.y + Math.sin(a) * (r + 3 + c.tr.spikes * 2)); } ctx.stroke(); }
          G.wobbly(ctx, c.x, c.y, r, t + c.wob, 0.06, 6, G.rgba(col, 0.18), G.rgba(col, c.me ? 1 : 0.7), c.me ? 2.5 : 1.5);
          // flagella hint for speed
          const n = Math.round(c.tr.speed * 2); ctx.strokeStyle = G.rgba(col, 0.5); ctx.lineWidth = 1;
          for (let k = 0; k < n; k++) { const a = Math.atan2(-c.vy, -c.vx) + (k - (n - 1) / 2) * 0.35; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r); ctx.quadraticCurveTo(c.x + Math.cos(a + 0.3) * (r + 10), c.y + Math.sin(a + 0.3) * (r + 10) + Math.sin(t * 12 + k) * 4, c.x + Math.cos(a) * (r + 18), c.y + Math.sin(a) * (r + 18)); ctx.stroke(); }
          if (c.me) { G.bar(ctx, c.x - 20, c.y + r + 8, 40, 4, c.mass / divideAt(c), c.mass >= divideAt(c) ? '#8ef7c2' : '#ffd86b'); G.text(ctx, c.mass >= divideAt(c) ? 'SPACE: divide' : 'you', c.x, c.y + r + 20, 10, '#8ef7c2'); }
        });
        // panel
        const kin = mine(), riv = cells.filter(c => c.lineage === 'rival');
        G.text(ctx, 'Your lineage ' + kin.length + ' / ' + GOAL + '   rivals ' + riv.length, 18, 72, 13, '#d8ecff', 'left');
        const avg = (arr, k) => arr.length ? arr.reduce((a, c) => a + c.tr[k], 0) / arr.length : 0;
        [['speed', 2.2, 'speed'], ['size', 2.2, 'size at division'], ['spikes', 4, 'defense spikes']].forEach(([k, max, label], i) => {
          const y = 100 + i * 30;
          G.text(ctx, label, 18, y - 2, 10, '#7f9bbd', 'left');
          G.bar(ctx, 18, y + 4, 120, 4, avg(kin, k) / max, '#8ef7c2'); G.bar(ctx, 18, y + 10, 120, 4, avg(riv, k) / max, '#ff6b6b');
          G.text(ctx, 'you ' + avg(kin, k).toFixed(1) + ' · rivals ' + avg(riv, k).toFixed(1), 146, y + 9, 10, '#7f9bbd', 'left');
        });
        G.text(ctx, 'Speed and spikes cost energy. Spikes make you harder to swallow.', 18, 196, 10, '#7f9bbd', 'left');
      };
      st.debug = () => ({ me, cells: cells.map(c => ({ x: c.x, y: c.y, r: radius(c), lineage: c.lineage, me: !!c.me, mass: c.mass, spikes: c.tr.spikes })), food, canDivide: me.mass >= divideAt(me), mine: mine().length, done });
      return st;
    }
  });
})();
