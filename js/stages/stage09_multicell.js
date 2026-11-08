/* Stage 9: multicellularity. Cells stick together and specialize. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const ROLES = ['feeder', 'mover', 'sensor'];
  const ROLEC = { feeder: '#8ef7c2', mover: '#4fd8ff', sensor: '#ffd86b', stem: '#9fc0e8' };
  const CELL_GOAL = 12, ROLE_GOAL = 3, ENERGY_GOAL = 100, DIVIDE_COST = 20;
  const DIRS = [[1, 0], [0.5, 0.87], [-0.5, 0.87], [-1, 0], [-0.5, -0.87], [0.5, -0.87]];

  S.registerStage({
    id: 'multicell', index: 9, title: 'Multicellularity', years: 'about 800 to 600 million years ago', ya: 0.7,
    palette: ['#02060f', '#061a38', '#0a3040'],
    objective: 'Space divides (cells stay stuck). Click a cell to change its job. Feed, move, sense.',
    outro: 'A body with jobs. Feeders feed, movers move, sensors sense. But nothing connects them yet: a sensor that sees food cannot tell a mover to turn.',
    create() {
      const st = {};
      let W, H, col, food, predator, t, flags, done, energy;

      st.enter = function () {
        W = S.W; H = S.H; t = 0; done = false; energy = 80;
        flags = { mc: false, spec: false, hintRole: false };
        col = { x: W / 2, y: H / 2, vx: 0, vy: 0, cells: [{ dx: 0, dy: 0, role: 'feeder', ph: 0 }] };
        food = []; for (let i = 0; i < 55; i++) food.push({ x: S.rand(W), y: S.rand(70, H - 70) });
        predator = { x: -100, y: H / 2, vx: 0, vy: 0, r: 34, t: 0 };
        S.UI.hint('You are one cell. Press Space to divide. Your daughter cell will stay attached.', 8);
      };
      st.resize = function () { W = S.W; H = S.H; };
      const CR = 13; // cell radius
      const count = (r) => col.cells.filter(c => c.role === r).length;
      const senseR = () => 130 + 90 * count('sensor');
      function addCell() {
        // find a free hex neighbour of a random existing cell
        for (let tries = 0; tries < 40; tries++) {
          const p = S.pick(col.cells), d = S.pick(DIRS);
          const nx = p.dx + d[0] * CR * 2, ny = p.dy + d[1] * CR * 2;
          if (!col.cells.some(c => S.dist(c.dx, c.dy, nx, ny) < CR)) { col.cells.push({ dx: nx, dy: ny, role: 'stem', ph: S.rand(S.TAU) }); return true; }
        }
        return false;
      }
      function divide() {
        if (energy < DIVIDE_COST) { S.UI.toast('Need ' + DIVIDE_COST + ' energy to divide (' + Math.floor(energy) + ')'); return; }
        if (col.cells.length >= 18) { S.UI.toast('Big enough'); return; }
        energy -= DIVIDE_COST; addCell(); S.Audio.sfx('divide'); G.burst(col.x, col.y, '#9fc0e8', 12, 70, 2.5);
        if (col.cells.length >= 4 && !flags.mc) { flags.mc = true; S.unlock('multicell', () => S.UI.hint('Click a cell to give it a job: feeder, mover or sensor. Grey stem cells do nothing yet.', 9)); }
        if (!flags.hintRole && col.cells.length === 2) { flags.hintRole = true; S.UI.hint('Click the new grey cell to give it a job.', 6); }
      }

      st.update = function (dt) {
        t += dt;
        const movers = count('mover'), feeders = count('feeder'), sensors = count('sensor');
        // move toward pointer, speed from movers divided by drag of body size
        const speed = (40 + 110 * movers) / Math.sqrt(col.cells.length) * 1.4;
        if (S.input.x > -100) { const dx = S.input.x - col.x, dy = S.input.y - col.y, d = Math.hypot(dx, dy); if (d > 8) { col.vx += dx / d * speed * 4 * dt; col.vy += dy / d * speed * 4 * dt; } }
        const s2 = Math.hypot(col.vx, col.vy); if (s2 > speed) { col.vx *= speed / s2; col.vy *= speed / s2; }
        col.vx *= 0.93; col.vy *= 0.93; col.x += col.vx * dt; col.y += col.vy * dt;
        col.x = S.clamp(col.x, 50, W - 50); col.y = S.clamp(col.y, 100, H - 100);
        // energy: feeders eat food touching any cell; upkeep per cell
        energy -= dt * (0.2 + col.cells.length * 0.14 + movers * 0.3);
        if (food.length < 60 && S.chance(dt * 9)) food.push({ x: S.rand(W), y: S.rand(70, H - 70) });
        for (let i = food.length - 1; i >= 0; i--) {
          const f = food[i];
          for (const c of col.cells) {
            if (S.dist(f.x, f.y, col.x + c.dx, col.y + c.dy) < CR + 3) {
              food.splice(i, 1);
              const gain = c.role === 'feeder' ? 10 : c.role === 'stem' ? 3 : 1;
              energy = Math.min(ENERGY_GOAL, energy + gain); S.Audio.sfx('eat'); G.burst(f.x, f.y, '#8ef7c2', 5, 40, 2); break;
            }
          }
        }
        if (energy <= 0) { starve(); return; }
        // predator: roams; eats colonies of 3 or fewer cells
        const pr = predator; pr.t += dt;
        const chase = col.cells.length <= 3;
        const tx = chase ? col.x : W * 0.5 + Math.sin(pr.t * 0.25) * W * 0.4, ty = chase ? col.y : H * 0.5 + Math.cos(pr.t * 0.19) * H * 0.3;
        const a = S.angleTo(pr.x, pr.y, tx, ty); pr.vx += Math.cos(a) * 60 * dt; pr.vy += Math.sin(a) * 60 * dt;
        const ps = Math.hypot(pr.vx, pr.vy), pm = chase ? 70 : 45; if (ps > pm) { pr.vx *= pm / ps; pr.vy *= pm / ps; }
        pr.x += pr.vx * dt; pr.y += pr.vy * dt;
        const pd = S.dist(pr.x, pr.y, col.x, col.y);
        if (pd < pr.r + CR) {
          if (chase) { eaten(); return; }
          // bounce: it cannot swallow a clump
          const ang = S.angleTo(col.x, col.y, pr.x, pr.y); pr.vx = Math.cos(ang) * 120; pr.vy = Math.sin(ang) * 120;
          if (S.chance(dt * 3)) S.UI.toast('Too big to swallow');
        }
        const ok = col.cells.length >= CELL_GOAL && feeders >= ROLE_GOAL && movers >= ROLE_GOAL && sensors >= ROLE_GOAL;
        S.UI.setProgress(Math.min(1, col.cells.length / CELL_GOAL) * 0.4 + Math.min(1, (Math.min(feeders, 3) + Math.min(movers, 3) + Math.min(sensors, 3)) / 9) * 0.4 + (ok ? Math.min(1, energy / ENERGY_GOAL) : 0) * 0.2);
        S.UI.objective('Cells ' + col.cells.length + ' / ' + CELL_GOAL + ' · feeders ' + feeders + ' · movers ' + movers + ' · sensors ' + sensors + ' (3 each) · energy ' + Math.floor(energy) + (ok ? ' / ' + ENERGY_GOAL : ''));
        if (feeders && movers && sensors && !flags.spec) { flags.spec = true; S.unlock('specialization'); }
        if (ok && energy >= ENERGY_GOAL && !done) { done = true; setTimeout(() => S.completeStage(), 300); }
      };
      function starve() { S.UI.popup({ tag: 'Starved', title: 'The colony ran out of energy', years: 'about 700 million years ago', body: 'Every cell costs upkeep, and movers cost extra. Keep enough feeders for the body size, and keep moving toward food you can see.', button: 'Try again' }, () => S.restartStage()); }
      function eaten() { S.UI.popup({ tag: 'Eaten', title: 'Swallowed whole', years: 'about 700 million years ago', body: 'A single cell, or a tiny clump, fits in a predator\'s mouth. Divide early: a clump of four is already too big for it.', button: 'Try again' }, () => S.restartStage()); }

      st.key = function (code) { if (code === 'Space') divide(); };
      st.pointerDown = function (x, y) {
        for (const c of col.cells) {
          if (S.dist(x, y, col.x + c.dx, col.y + c.dy) < CR) {
            c.role = c.role === 'stem' ? 'feeder' : ROLES[(ROLES.indexOf(c.role) + 1) % ROLES.length];
            S.Audio.sfx('click'); G.burst(col.x + c.dx, col.y + c.dy, ROLEC[c.role], 8, 50, 2); return;
          }
        }
      };

      st.draw = function (ctx) {
        const sr = senseR();
        // fog: only things inside sense radius are visible
        const vis = (x, y) => S.dist(x, y, col.x, col.y) < sr;
        food.forEach(f => { if (vis(f.x, f.y)) G.circle(ctx, f.x, f.y, 3, 'rgba(142,247,194,0.85)'); });
        if (vis(predator.x, predator.y) || S.dist(predator.x, predator.y, col.x, col.y) < predator.r + 60) {
          G.glow(ctx, predator.x, predator.y, predator.r * 2, '#ff5a7a', 0.35);
          G.wobbly(ctx, predator.x, predator.y, predator.r, t * 0.7, 0.12, 5, 'rgba(255,90,122,0.2)', 'rgba(255,90,122,0.8)', 2);
          G.text(ctx, col.cells.length <= 3 ? 'predator · hunting you' : 'predator · you are too big for it', predator.x, predator.y - predator.r - 10, 10, '#ff9a8a');
        }
        // sense radius
        ctx.setLineDash([4, 8]); ctx.strokeStyle = 'rgba(255,216,107,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(col.x, col.y, sr, 0, S.TAU); ctx.stroke(); ctx.setLineDash([]);
        G.text(ctx, 'what you can sense', col.x, col.y - sr - 8, 10, 'rgba(255,216,107,0.5)');
        // colony
        G.glow(ctx, col.x, col.y, 30 + col.cells.length * 6, '#4fd8ff', 0.2);
        col.cells.forEach(c => {
          const x = col.x + c.dx, y = col.y + c.dy, colr = ROLEC[c.role];
          // adhesion lines
          col.cells.forEach(o => { if (o !== c && S.dist(c.dx, c.dy, o.dx, o.dy) < CR * 2.2) { ctx.strokeStyle = 'rgba(160,200,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(col.x + o.dx, col.y + o.dy); ctx.stroke(); } });
        });
        col.cells.forEach(c => {
          const x = col.x + c.dx, y = col.y + c.dy, colr = ROLEC[c.role];
          G.glow(ctx, x, y, CR * 1.6, colr, 0.35);
          G.wobbly(ctx, x, y, CR, t + c.ph, 0.05, 5, G.rgba(colr, 0.25), G.rgba(colr, 0.9), 1.5);
          if (c.role === 'mover') { ctx.strokeStyle = G.rgba(colr, 0.8); ctx.lineWidth = 1.5; const a = Math.atan2(-col.vy, -col.vx); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * CR, y + Math.sin(a) * CR); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * (CR + 10), y + Math.sin(a + 0.4) * (CR + 10) + Math.sin(t * 14) * 4, x + Math.cos(a) * (CR + 20), y + Math.sin(a) * (CR + 20)); ctx.stroke(); }
          if (c.role === 'sensor') G.circle(ctx, x, y, 4, '#2a1a05', colr, 1.5);
          if (c.role === 'feeder') { ctx.strokeStyle = G.rgba(colr, 0.8); ctx.lineWidth = 1; for (let k = 0; k < 5; k++) { const a = k / 5 * S.TAU + t; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * CR, y + Math.sin(a) * CR); ctx.lineTo(x + Math.cos(a) * (CR + 4), y + Math.sin(a) * (CR + 4)); ctx.stroke(); } }
          if (c.role === 'stem') G.text(ctx, '?', x, y, 11, colr);
        });
        // legend
        G.text(ctx, 'energy', 18, 72, 11, '#9fc0e8', 'left'); G.bar(ctx, 18, 78, 160, 7, energy / ENERGY_GOAL, energy > 25 ? '#8ef7c2' : '#ff5a7a');
        G.text(ctx, 'Space: divide (' + DIVIDE_COST + ' energy). Click a cell: feeder → mover → sensor.', 18, 100, 11, '#7f9bbd', 'left');
        G.text(ctx, 'Feeders eat · movers push (cost energy) · sensors widen what you can see', 18, 116, 11, '#7f9bbd', 'left');
        G.text(ctx, 'Alone, each role would starve. Together they are a body.', 18, 132, 11, '#7f9bbd', 'left');
      };
      st.debug = () => ({ col, food, predator, energy, senseR: senseR(), done });
      return st;
    }
  });
})();
