/* Stage 4: RNA world. Copy yourself with errors; the population evolves. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const BASEC = ['#ff7ad9', '#e06bff', '#ff6ba8', '#ffa3e6'];
  const BASEN = ['A', 'U', 'G', 'C'];
  const LEN = 8, COPY_COST = 8, CAP = 36, POP_GOAL = 20, FIT_GOAL = 0.7;

  S.registerStage({
    id: 'rnaworld', index: 4, title: 'RNA world', years: 'about 3.9 to 3.8 billion years ago', ya: 3.85,
    palette: ['#02060f', '#0a1a3a', '#1a0a30'],
    objective: 'Collect nucleotides, press Space (or click) to copy yourself. Copies compete for food.',
    outro: 'Your lineage copies well, but it still runs on whatever energy happens to leak through the membrane. To be a real cell it needs a power supply it controls.',
    create() {
      const st = {};
      let W, H, cells, nucs, target, t, me, flags, history, histT, done, nextId, deaths;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; histT = 0; done = false; nextId = 1; deaths = 0;
        flags = { copy: false, sel: false };
        target = Array.from({ length: LEN }, () => S.randInt(0, 3));
        cells = []; nucs = []; history = [];
        const carried = S.carryGet('rna', null);
        const g0 = carried ? carried.slice(0, LEN).map(b => Math.max(0, BASEN.indexOf(b))) : Array.from({ length: LEN }, () => S.randInt(0, 3));
        while (g0.length < LEN) g0.push(S.randInt(0, 3));
        me = newCell(W / 2, H / 2, g0, 0); me.me = true; cells.push(me);
        for (let i = 0; i < 5; i++) cells.push(newCell(S.rand(W * 0.2, W * 0.8), S.rand(H * 0.2, H * 0.8), Array.from({ length: LEN }, () => S.randInt(0, 3)), 0));
        for (let i = 0; i < 50; i++) nucs.push({ x: S.rand(W), y: S.rand(H) });
        S.UI.hint('You are the glowing protocell. Eat 8 nucleotides, then press Space to copy. Copies mutate.', 8);
      };
      st.resize = function () { W = S.W; H = S.H; };

      function fitness(g) { let m = 0; for (let i = 0; i < LEN; i++) if (g[i] === target[i]) m++; return m / LEN; }
      function newCell(x, y, g, gen) {
        const f = fitness(g);
        return { id: nextId++, x, y, vx: 0, vy: 0, g, fit: f, nucs: 0, age: 0, life: 20 + 50 * f + S.rand(-12, 12), gen, r: 16, flash: 0, wob: S.rand(S.TAU) };
      }
      function mutate(g, fit) {
        const rate = 0.12 - 0.08 * fit; // better ribozyme copies more accurately
        return g.map(b => Math.random() < rate ? S.randInt(0, 3) : b);
      }
      function copy(c) {
        if (c.nucs < COPY_COST) return false;
        c.nucs -= COPY_COST;
        const child = newCell(c.x + S.rand(-30, 30), c.y + S.rand(-30, 30), mutate(c.g, c.fit), c.gen + 1);
        child.parent = c.id; cells.push(child); c.flash = 1;
        G.burst(c.x, c.y, '#ff7ad9', 14, 80, 2.5); S.Audio.sfx('divide');
        if (c.me && !flags.copy) { flags.copy = true; S.unlock('copying'); }
        return true;
      }
      function avgFit() { return cells.reduce((a, c) => a + c.fit, 0) / Math.max(1, cells.length); }

      st.update = function (dt) {
        t += dt;
        // food
        if (nucs.length < 90 && S.chance(dt * 16)) nucs.push({ x: S.rand(W), y: S.rand(60, H - 60) });
        // cells
        for (let i = cells.length - 1; i >= 0; i--) {
          const c = cells[i];
          const speed = c.me ? 100 + 100 * c.fit : 40 + 170 * c.fit;
          let tx, ty;
          if (c.me) { tx = S.input.x; ty = S.input.y; }
          else {
            if (!c.goal || c.goal.gone) { let best = null, bd = 1e9; for (const n of nucs) { const d = S.dist(c.x, c.y, n.x, n.y); if (d < bd) { bd = d; best = n; } } c.goal = best; }
            if (c.goal) { tx = c.goal.x; ty = c.goal.y; } else { tx = c.x + Math.sin(t + c.wob) * 50; ty = c.y + Math.cos(t + c.wob) * 50; }
          }
          if (tx !== undefined && tx > -100) {
            const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
            if (d > 4) { c.vx += dx / d * speed * 6 * dt; c.vy += dy / d * speed * 6 * dt; }
          }
          const sp = Math.hypot(c.vx, c.vy); if (sp > speed) { c.vx *= speed / sp; c.vy *= speed / sp; }
          c.vx *= 0.9; c.vy *= 0.9; c.x += c.vx * dt; c.y += c.vy * dt;
          c.x = S.clamp(c.x, 20, W - 20); c.y = S.clamp(c.y, 60, H - 60);
          c.flash = Math.max(0, c.flash - dt * 2); c.age += dt;
          // eat
          for (let j = nucs.length - 1; j >= 0; j--) {
            const n = nucs[j];
            if (S.dist(n.x, n.y, c.x, c.y) < c.r + 4) { nucs.splice(j, 1); n.gone = true; c.nucs++; if (c.me) S.Audio.sfx('eat'); }
          }
          if (!c.me && c.nucs >= COPY_COST && S.chance(dt * 1.5)) copy(c);
          // death
          if (c.age > c.life) kill(i, c, 'age');
        }
        // population floor: new protocells keep drifting in from the vent field
        if (cells.length < 6 && S.chance(dt * 0.8)) { const c = newCell(S.chance(0.5) ? 10 : W - 10, S.rand(80, H - 80), Array.from({ length: LEN }, () => S.randInt(0, 3)), 0); c.nucs = 4; cells.push(c); }
        // crowding: limited food, weakest die
        if (cells.length > CAP) {
          let wi = -1, wf = 2; cells.forEach((c, i) => { if (!c.me && c.fit < wf) { wf = c.fit; wi = i; } });
          if (wi >= 0) kill(wi, cells[wi], 'crowd');
        }
        // history + progress
        histT += dt; if (histT > 1) { histT = 0; history.push(avgFit()); if (history.length > 120) history.shift(); }
        const af = avgFit();
        S.UI.setProgress(Math.min(1, (Math.min(cells.length, POP_GOAL) / POP_GOAL) * 0.4 + Math.min(1, af / FIT_GOAL) * 0.6));
        if (af > 0.5 && cells.length >= 10 && !flags.sel) { flags.sel = true; S.unlock('selection'); }
        if (af >= FIT_GOAL && cells.length >= POP_GOAL && !done) { done = true; const best = cells.reduce((a, b) => a.fit > b.fit ? a : b); S.carrySet('genome', best.g.map(b => BASEN[b])); S.carrySet('fitness', best.fit); S.unlock('rna-world', () => S.completeStage()); }
      };
      function kill(i, c, why) {
        cells.splice(i, 1); deaths++;
        G.particles.emit({ x: c.x, y: c.y, color: '#7f9bbd', n: 8, speed: 40, life: 0.6, size: 2 });
        if (c.me) {
          // continue as the fittest descendant, or the fittest cell alive
          let next = null; cells.forEach(o => { if (o.parent === c.id && (!next || o.fit > next.fit)) next = o; });
          if (!next) cells.forEach(o => { if (!next || o.fit > next.fit) next = o; });
          if (next) { next.me = true; me = next; S.UI.toast(why === 'age' ? 'Your strand wore out. You continue as your best copy.' : 'You starved. You continue as your best copy.'); }
          else { me = newCell(W / 2, H / 2, c.g, c.gen); me.me = true; cells.push(me); }
        }
      }

      st.copyNow = function () { if (!copy(me)) S.UI.toast('Need ' + COPY_COST + ' nucleotides to copy (' + me.nucs + ' / ' + COPY_COST + ')'); };
      st.key = function (code) { if (code === 'Space') st.copyNow(); };
      st.action = st.copyNow; st.actionLabel = () => 'Copy ' + me.nucs + '/' + COPY_COST; st.actionReady = () => me.nucs >= COPY_COST;
      st.pointerDown = function () { if (me.nucs >= COPY_COST) st.copyNow(); };

      st.draw = function (ctx) {
        nucs.forEach(n => { G.circle(ctx, n.x, n.y, 2.5, 'rgba(255,160,230,0.9)'); });
        cells.forEach(c => {
          const col = c.me ? '#8ef7c2' : '#ff7ad9';
          G.glow(ctx, c.x, c.y, c.r * (c.me ? 3 : 1.8) + c.flash * 20, col, (c.me ? 0.5 : 0.22) + c.flash * 0.5);
          G.wobbly(ctx, c.x, c.y, c.r, t + c.wob, 0.07, 6, 'rgba(255,216,107,0.08)', G.rgba('#ffd86b', c.me ? 0.9 : 0.5), c.me ? 2.5 : 1.5);
          // genome beads
          // lipid membrane carried from the protocell stage
          for (let k = 0; k < 12; k++) { const a = k / 12 * S.TAU + t * 0.3 + c.wob; G.circle(ctx, c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 1.6, 'rgba(255,216,107,' + (c.me ? 0.9 : 0.5) + ')'); }
          c.g.forEach((b, i) => { const a = i / LEN * S.TAU + t * 0.5 + c.wob; const bx = c.x + Math.cos(a) * 7, by = c.y + Math.sin(a) * 7; G.circle(ctx, bx, by, c.me ? 3.4 : 2.6, b === target[i] ? BASEC[b] : 'rgba(120,120,160,0.8)'); if (c.me) G.text(ctx, BASEN[b], bx, by, 6, '#2a0a1e', 'center', '700'); });
          if (c.me) {
            G.bar(ctx, c.x - 20, c.y + c.r + 8, 40, 4, c.nucs / COPY_COST, c.nucs >= COPY_COST ? '#8ef7c2' : '#ff9ad0');
            G.text(ctx, c.nucs >= COPY_COST ? (S.touch ? 'tap Copy' : 'SPACE to copy') : c.nucs + ' / ' + COPY_COST, c.x, c.y + c.r + 20, 10, '#8ef7c2');
            G.text(ctx, 'you · copies ' + Math.round(c.fit * 100) + '% well', c.x, c.y - c.r - 10, 11, '#8ef7c2');
          }
        });
        // panel
        const af = avgFit();
        G.text(ctx, 'Population ' + cells.length + ' / ' + POP_GOAL + (S.mobile ? '' : ' (food supports about ' + CAP + ')'), 18, 72, 13, '#d8ecff', 'left');
        G.text(ctx, 'Average copying skill ' + Math.round(af * 100) + '% (goal ' + Math.round(FIT_GOAL * 100) + '%)', 18, 92, 13, '#d8ecff', 'left');
        G.text(ctx, 'Your strand ' + me.g.map(b => BASEN[b]).join('') + ' · generation ' + me.gen + ' · deaths ' + deaths, 18, 112, 12, '#7f9bbd', 'left');
        G.text(ctx, S.mobile ? 'Bright beads help the strand copy. Grey do not.' : 'Bright beads = bases that help the strand fold into a working copier. Grey = not yet.', 18, 130, 11, '#7f9bbd', 'left');
        // graph
        const gx = 18, gy = H - (S.mobile ? 170 : 130), gw = S.mobile ? 140 : 180, gh = 60;
        ctx.fillStyle = 'rgba(4,12,30,0.5)'; ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = 'rgba(120,190,255,0.3)'; ctx.strokeRect(gx + 0.5, gy + 0.5, gw, gh);
        ctx.strokeStyle = 'rgba(142,247,194,0.4)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(gx, gy + gh * (1 - FIT_GOAL)); ctx.lineTo(gx + gw, gy + gh * (1 - FIT_GOAL)); ctx.stroke(); ctx.setLineDash([]);
        if (history.length > 1) { ctx.strokeStyle = '#8ef7c2'; ctx.lineWidth = 2; ctx.beginPath(); history.forEach((v, i) => { const x = gx + i / 119 * gw, y = gy + gh * (1 - v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); }
        G.text(ctx, 'average copying skill over time', gx, gy - 8, 10, '#7f9bbd', 'left');
      };
      st.debug = () => ({ me, cells, nucs, avg: avgFit(), done });
      return st;
    }
  });
})();
