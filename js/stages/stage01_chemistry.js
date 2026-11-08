/* Stage 1: primordial chemistry at a hydrothermal vent. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const MOL = {
    H2:  { label: 'H₂',  color: '#cfe9ff', r: 6 },
    CO2: { label: 'CO₂', color: '#7fd0d8', r: 8 },
    NH3: { label: 'NH₃', color: '#b48cff', r: 7 },
    H2S: { label: 'H₂S', color: '#ffd86b', r: 7 },
    PO4: { label: 'PO₄', color: '#ff9f5a', r: 8 }
  };
  const RECIPES = [
    { name: 'amino acid', key: 'amino', color: '#8ef7c2', need: { CO2: 2, NH3: 1, H2: 1 } },
    { name: 'nucleotide', key: 'nuc', color: '#ff7ad9', need: { CO2: 1, NH3: 2, H2: 1, PO4: 1 } }
  ];
  const GOAL = { amino: 6, nuc: 4 };
  const MAXPER = { CO2: 2, NH3: 2, H2: 1, PO4: 1 }, POCKET = 6;

  S.registerStage({
    id: 'chemistry', index: 1, title: 'Primordial chemistry', years: 'about 4.0 billion years ago', ya: 4.0,
    palette: ['#02060f', '#061a33', '#1a1208'],
    objective: 'Catch molecules in your pore. Heat or lightning gives the energy to react them.',
    outro: 'You have amino acids and nucleotides, but they are loose and alone. Something has to chain them together, and water is going to fight you the whole way.',
    create() {
      const st = {};
      let W, H, ridgeY, pore, mols, energy, counts, plumes, lightning, t, done, flags, pocketWarnT, energyT;

      st.enter = function () {
        W = S.W; H = S.H; ridgeY = H * 0.78;
        pore = { x: W / 2, y: ridgeY, r: 26, pocket: [], flash: 0 };
        mols = []; energy = 0.3; counts = { amino: 0, nuc: 0 }; t = 0; done = false; pocketWarnT = 0; energyT = 0;
        flags = { blocks: false, energy: false, started: false };
        plumes = [0.25, 0.5, 0.75].map(f => ({ x: W * f, phase: S.rand(S.TAU), speed: S.rand(0.05, 0.12) }));
        lightning = { next: 6, flash: 0, packets: [] };
        for (let i = 0; i < 14; i++) { spawnMol(); const m = mols[mols.length - 1]; m.y = S.rand(H * 0.1, ridgeY - 40); m.x = S.rand(40, W - 40); }
        S.unlock('vents', () => { S.UI.hint('Move the pore along the vent. Catch CO₂, NH₃ and H₂, then wait near a hot plume.', 9); });
      };
      st.resize = function () { W = S.W; H = S.H; ridgeY = H * 0.78; pore.y = ridgeY; };

      function spawnMol() {
        const roll = Math.random();
        let type, x, y, vx, vy;
        if (roll < 0.42) { // CO2 sinking from the ocean above
          type = 'CO2'; x = S.rand(W); y = -10; vx = S.rand(-10, 10); vy = S.rand(50, 80);
        } else if (roll < 0.5) { // phosphate from the sides
          type = 'PO4'; x = Math.random() < 0.5 ? -10 : W + 10; y = S.rand(H * 0.2, ridgeY - 120); vx = (x < 0 ? 1 : -1) * S.rand(14, 26); vy = S.rand(8, 16);
        } else { // vent gases rising from plumes
          type = S.pick(['H2', 'H2', 'NH3', 'NH3', 'H2S', 'H2']);
          const p = S.pick(plumes); x = p.x + S.rand(-40, 40); y = ridgeY + 10; vx = S.rand(-12, 12); vy = -S.rand(28, 50);
        }
        mols.push({ type, x, y, vx, vy, life: S.rand(22, 30), wob: S.rand(S.TAU) });
      }

      function recipeReady() {
        const have = {}; pore.pocket.forEach(m => have[m] = (have[m] || 0) + 1);
        // recipes whose goal is still unmet get priority; a finished product only forms when the pocket is full
        const order = RECIPES.slice().sort((a, b) => (counts[a.key] >= GOAL[a.key] ? 1 : 0) - (counts[b.key] >= GOAL[b.key] ? 1 : 0));
        for (const r of order) {
          let ok = true; for (const k in r.need) if ((have[k] || 0) < r.need[k]) { ok = false; break; }
          if (ok && (counts[r.key] < GOAL[r.key] || pore.pocket.length >= POCKET)) return r;
        }
        return null;
      }
      function react(r) {
        for (const k in r.need) for (let i = 0; i < r.need[k]; i++) pore.pocket.splice(pore.pocket.indexOf(k), 1);
        energy -= 0.6; counts[r.key]++; pore.flash = 1;
        G.burst(pore.x, pore.y - 10, r.color, 26, 140, 4);
        S.Audio.sfx('react');
        S.UI.toast(r.name + ' formed');
        S.UI.setProgress((counts.amino / GOAL.amino + counts.nuc / GOAL.nuc) / 2);
        if (!flags.blocks) { flags.blocks = true; S.unlock('building-blocks'); }
        else if (!flags.energy && counts.amino + counts.nuc >= 3) { flags.energy = true; S.unlock('energy'); }
        if (counts.amino >= GOAL.amino && counts.nuc >= GOAL.nuc && !done) { done = true; setTimeout(() => S.completeStage(), 600); }
      }

      st.update = function (dt) {
        t += dt;
        // pore follows pointer x along the ridge
        if (S.input.x > -100) pore.x += (S.clamp(S.input.x, 30, W - 30) - pore.x) * Math.min(1, dt * 8);
        plumes.forEach(p => { p.x += Math.sin(t * p.speed + p.phase) * 20 * dt; p.x = S.clamp(p.x, 60, W - 60); });

        // energy from heat
        const nearPlume = plumes.some(p => Math.abs(p.x - pore.x) < 55);
        energy = Math.min(1, energy + dt * (nearPlume ? 0.22 : 0.03));
        if (nearPlume && S.chance(dt * 12)) G.particles.emit({ x: pore.x + S.rand(-20, 20), y: ridgeY, vy: -60, speed: 15, color: '#ffb36b', life: 0.6, size: 2 });

        // molecules
        if (mols.length < 26 && S.chance(dt * 4)) spawnMol();
        for (let i = mols.length - 1; i >= 0; i--) {
          const m = mols[i];
          m.vx += Math.sin(t * 1.3 + m.wob) * 18 * dt; m.vy += Math.cos(t * 0.9 + m.wob) * 12 * dt;
          if (m.type === 'CO2' || m.type === 'PO4') { m.vy += 12 * dt; if (m.vy > 85) m.vy = 85; } else m.vy -= 4 * dt;
          const drag = Math.pow(0.75, dt); m.vx *= drag; if (m.vy < 0) m.vy *= drag;
          m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
          if (m.y > ridgeY - 4 && m.vy > 0) { m.y = ridgeY - 4; m.vy = -m.vy * 0.4; }
          if (m.life <= 0 || m.y < -40 || m.x < -60 || m.x > W + 60) { mols.splice(i, 1); continue; }
          if (S.dist(m.x, m.y, pore.x, pore.y - 6) < pore.r + MOL[m.type].r) {
            mols.splice(i, 1);
            if (m.type === 'H2S') { energy = Math.min(1, energy + 0.25); G.burst(pore.x, pore.y, '#ffd86b', 10, 80, 2); S.UI.toast('H₂S feeds the iron-sulfur catalyst: +energy'); S.Audio.sfx('catch'); continue; }
            const have = pore.pocket.filter(k => k === m.type).length;
            if (have >= MAXPER[m.type]) { m.vy = -70; m.y -= 10; mols.push(m); if (S.chance(0.5)) S.UI.toast('Pocket already holds enough ' + MOL[m.type].label); continue; }
            if (pore.pocket.length < POCKET) { pore.pocket.push(m.type); S.Audio.sfx('catch'); G.burst(m.x, m.y, MOL[m.type].color, 6, 50, 2); }
            else { m.vy = -60; mols.push(m); }
          }
        }

        // lightning
        lightning.next -= dt;
        if (lightning.next <= 0) {
          lightning.next = S.rand(9, 14); lightning.flash = 1; lightning.x = S.rand(W * 0.15, W * 0.85);
          lightning.packets.push({ x: lightning.x, y: 10, vy: 70, life: 12 });
          S.Audio.sfx('zap');
        }
        lightning.flash = Math.max(0, lightning.flash - dt * 3);
        for (let i = lightning.packets.length - 1; i >= 0; i--) {
          const p = lightning.packets[i];
          p.y += p.vy * dt; p.x += Math.sin(t * 2 + p.y * 0.02) * 20 * dt; p.life -= dt;
          if (S.chance(dt * 20)) G.particles.emit({ x: p.x, y: p.y, color: '#ffffff', speed: 30, life: 0.4, size: 2 });
          if (S.dist(p.x, p.y, pore.x, pore.y) < pore.r + 14) {
            lightning.packets.splice(i, 1); energy = 1; G.burst(pore.x, pore.y, '#ffffff', 30, 160, 3);
            S.UI.toast('Lightning energy: pore fully charged'); S.Audio.sfx('zap');
            if (!flags.energy) { flags.energy = true; S.unlock('energy'); }
            continue;
          }
          if (p.y > ridgeY || p.life <= 0) lightning.packets.splice(i, 1);
        }

        // reactions
        const r = recipeReady();
        if (r) {
          if (energy >= 0.6) react(r);
          else { energyT += dt; if (energyT > 1.5 && energyT < 1.6) S.UI.hint('Right parts, not enough energy. Hover a hot plume, or catch a lightning packet.', 6); }
        } else energyT = 0;
        if (pore.pocket.length >= POCKET && !r) { pocketWarnT += dt; if (pocketWarnT > 1 && pocketWarnT < 1.1) S.UI.hint('Pocket full with no recipe. Click to flush it. Amino acid: 2 CO₂ + NH₃ + H₂. Nucleotide: CO₂ + 2 NH₃ + H₂ + PO₄.', 8); }
        else pocketWarnT = 0;
        pore.flash = Math.max(0, pore.flash - dt * 2);
      };

      st.pointerDown = function () {
        if (pore.pocket.length) {
          pore.pocket.forEach((type, i) => mols.push({ type, x: pore.x + S.rand(-10, 10), y: pore.y - 20, vx: S.rand(-40, 40), vy: -S.rand(40, 90), life: 12, wob: S.rand(S.TAU) }));
          pore.pocket = []; S.Audio.sfx('click');
        }
      };

      st.draw = function (ctx) {
        // lightning flash
        if (lightning.flash > 0) {
          ctx.fillStyle = 'rgba(200,230,255,' + lightning.flash * 0.25 + ')'; ctx.fillRect(0, 0, W, H);
          ctx.strokeStyle = 'rgba(255,255,255,' + lightning.flash + ')'; ctx.lineWidth = 2; ctx.beginPath();
          let x = lightning.x, y = 0; ctx.moveTo(x, y);
          while (y < 90) { y += 15; x += S.rand(-14, 14); ctx.lineTo(x, y); }
          ctx.stroke();
        }
        // vent plumes
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        plumes.forEach(p => {
          const g = ctx.createLinearGradient(0, ridgeY, 0, ridgeY - 260);
          g.addColorStop(0, 'rgba(255,140,60,0.35)'); g.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.x - 30, ridgeY);
          for (let i = 0; i <= 10; i++) { const yy = ridgeY - i * 26; ctx.lineTo(p.x - 30 - i * 5 + Math.sin(t * 2 + i) * 8, yy); }
          for (let i = 10; i >= 0; i--) { const yy = ridgeY - i * 26; ctx.lineTo(p.x + 30 + i * 5 + Math.cos(t * 1.7 + i) * 8, yy); }
          ctx.fill();
        });
        ctx.restore();
        // vent rock
        ctx.fillStyle = '#120d0a'; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ridgeY + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.11) * 3);
        ctx.lineTo(W, H); ctx.fill();
        plumes.forEach(p => { ctx.fillStyle = '#1b120c'; ctx.beginPath(); ctx.moveTo(p.x - 50, ridgeY + 2); ctx.lineTo(p.x - 18, ridgeY - 40); ctx.lineTo(p.x + 18, ridgeY - 40); ctx.lineTo(p.x + 50, ridgeY + 2); ctx.fill();
          G.glow(ctx, p.x, ridgeY - 30, 40, '#ff8a3c', 0.5); });
        // ridge line glow (iron-sulfur minerals)
        ctx.strokeStyle = 'rgba(255,170,90,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
        for (let x = 0; x <= W; x += 20) { const y = ridgeY + Math.sin(x * 0.02) * 6 + Math.sin(x * 0.11) * 3; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();

        // molecules
        mols.forEach(m => { const d = MOL[m.type]; G.orb(ctx, m.x, m.y, d.r, d.color, 2.2); G.text(ctx, d.label, m.x, m.y - d.r - 9, 10, G.rgba(d.color, 0.9)); });
        // lightning packets
        lightning.packets.forEach(p => { G.glow(ctx, p.x, p.y, 30, '#ffffff', 0.8); G.circle(ctx, p.x, p.y, 5, '#fff'); G.text(ctx, 'energy', p.x, p.y - 20, 10, '#fff'); });

        // pore
        const px = pore.x, py = pore.y;
        G.glow(ctx, px, py, 70 + pore.flash * 40, '#ffb36b', 0.25 + energy * 0.35 + pore.flash * 0.4);
        ctx.fillStyle = '#0b1a2a'; ctx.beginPath(); ctx.arc(px, py - 6, pore.r, 0, S.TAU); ctx.fill();
        ctx.strokeStyle = G.rgba('#ffcf7a', 0.5 + energy * 0.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py - 6, pore.r, 0, S.TAU); ctx.stroke();
        pore.pocket.forEach((type, i) => { const a = i / POCKET * S.TAU - Math.PI / 2 + t; const d = MOL[type]; G.orb(ctx, px + Math.cos(a) * 12, py - 6 + Math.sin(a) * 12, 4.5, d.color, 2); });
        G.bar(ctx, px - 30, py + 28, 60, 6, energy, energy >= 0.6 ? '#ffd86b' : '#ff9f5a');
        G.text(ctx, energy >= 0.6 ? 'energy ready' : 'energy', px, py + 44, 10, '#ffcf7a');
        G.text(ctx, 'FeS pore', px, py - 6 - pore.r - 10, 11, '#ffcf7a');

        // tally
        const tx = 18, ty = 72;
        G.text(ctx, 'Amino acids ' + counts.amino + ' / ' + GOAL.amino, tx, ty, 13, '#8ef7c2', 'left');
        G.text(ctx, 'Nucleotides ' + counts.nuc + ' / ' + GOAL.nuc, tx, ty + 20, 13, '#ff7ad9', 'left');
        G.text(ctx, 'amino acid = 2 CO₂ + NH₃ + H₂', tx, ty + 44, 11, '#7f9bbd', 'left');
        G.text(ctx, 'nucleotide = CO₂ + 2 NH₃ + H₂ + PO₄', tx, ty + 60, 11, '#7f9bbd', 'left');
        G.text(ctx, 'H₂S = catalyst boost · click = flush pocket', tx, ty + 76, 11, '#7f9bbd', 'left');
      };
      st.debug = () => ({ pore, mols, plumes, energy, counts, packets: lightning.packets, ridgeY, done });
      return st;
    }
  });
})();
