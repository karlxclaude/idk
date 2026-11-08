/* Stage 2: polymerization on a mineral surface. Water breaks chains; clay protects them. */
(function () {
  const S = window.Spark, G = S.Gfx;
  const BASES = [{ n: 'A', c: '#ff7ad9' }, { n: 'U', c: '#ff9ad0' }, { n: 'G', c: '#e06bff' }, { n: 'C', c: '#ff6ba8' }];
  const AMINOS = ['#8ef7c2', '#6be0a8', '#a8ffd0', '#5fd39a'];
  const GOAL = { rna: 10, pep: 6 };

  S.registerStage({
    id: 'polymer', index: 2, title: 'Polymerization', years: 'about 4.0 billion years ago', ya: 3.98,
    palette: ['#02060f', '#07203d', '#2a1a0c'],
    objective: 'Drag nucleotides onto the RNA chain and amino acids onto the peptide chain.',
    outro: 'You have a real RNA strand. But it is sitting naked on a rock, and anything it does helps every molecule nearby just as much as itself. It needs a boundary.',
    create() {
      const st = {};
      let W, H, clayY, blocks, chains, held, t, tide, breaks, flags, done;

      st.enter = function () {
        W = S.W; H = S.H; clayY = H * 0.72;
        blocks = []; held = null; t = 0; breaks = 0; done = false;
        flags = { hydro: false, surf: false, rna: false, hintClay: false };
        tide = { t: 0, period: 13, dryFrom: 8 }; // wet for 8s, dry for 5s
        chains = [
          { kind: 'nuc', where: 'water', x: W * 0.5, y: H * 0.3, items: [seed('nuc')], wob: S.rand(S.TAU), label: 'RNA in open water' },
          { kind: 'nuc', where: 'clay', x: W * 0.12, y: clayY + 28, items: [seed('nuc')], label: 'RNA on clay' },
          { kind: 'pep', where: 'clay', x: W * 0.12, y: clayY + 78, items: [seed('pep')], label: 'peptide on clay' }
        ];
        for (let i = 0; i < 12; i++) spawn(true);
        S.UI.hint('Drag a building block to the end of a chain. Pink = nucleotides, green = amino acids.', 8);
      };
      st.resize = function () { W = S.W; H = S.H; };
      function seed(kind) { return kind === 'nuc' ? { kind, base: S.pick(BASES) } : { kind, color: S.pick(AMINOS) }; }
      function spawn(anywhere) {
        const kind = Math.random() < 0.55 ? 'nuc' : 'pep';
        const b = seed(kind);
        b.x = anywhere ? S.rand(40, W - 40) : (Math.random() < 0.5 ? -12 : W + 12);
        b.y = anywhere ? S.rand(80, clayY - 20) : S.rand(80, clayY - 20);
        b.vx = b.x < 0 ? S.rand(10, 25) : b.x > W ? -S.rand(10, 25) : S.rand(-15, 15); b.vy = S.rand(-8, 8); b.wob = S.rand(S.TAU);
        blocks.push(b);
      }
      function endPos(ch) {
        const n = ch.items.length;
        if (ch.where === 'clay') return { x: ch.x + n * 20, y: ch.y };
        const i = n; return { x: ch.x + i * 18 + Math.sin(t * 1.5 + ch.wob + i * 0.6) * 6, y: ch.y + Math.sin(t * 1.1 + i * 0.9) * 10 };
      }
      function itemPos(ch, i) {
        if (ch.where === 'clay') return { x: ch.x + i * 20, y: ch.y };
        return { x: ch.x + i * 18 + Math.sin(t * 1.5 + ch.wob + i * 0.6) * 6, y: ch.y + Math.sin(t * 1.1 + i * 0.9) * 10 };
      }
      const isDry = () => tide.t > tide.dryFrom;

      function breakChain(ch, idx) {
        const lost = ch.items.splice(idx);
        lost.forEach((b, j) => { const p = itemPos(ch, idx + j); b.x = p.x; b.y = p.y; b.vx = S.rand(-30, 30); b.vy = S.rand(-40, -10); b.wob = S.rand(S.TAU); blocks.push(b); });
        const p = itemPos(ch, idx); G.burst(p.x, p.y, '#4fd8ff', 14, 90, 2.5);
        S.Audio.sfx('break'); breaks++;
        if (!flags.hydro) { flags.hydro = true; S.unlock('hydrolysis'); }
        if (ch.where === 'water' && breaks >= 2 && !flags.hintClay) { flags.hintClay = true; S.UI.hint('Water keeps hydrolyzing the bond. Try the mineral surface at the bottom, especially when the tide drops.', 9); }
        if (ch.where === 'water') S.UI.toast('Hydrolysis: the chain broke in open water');
        else S.UI.toast('A bond broke on the clay. Rare, and never while it is dry.');
        progress();
      }
      function progress() {
        const rna = Math.max(...chains.filter(c => c.kind === 'nuc').map(c => c.items.length));
        const pep = Math.max(...chains.filter(c => c.kind === 'pep').map(c => c.items.length));
        S.UI.setProgress((Math.min(rna, GOAL.rna) / GOAL.rna + Math.min(pep, GOAL.pep) / GOAL.pep) / 2);
        S.UI.objective('RNA strand ' + rna + ' / ' + GOAL.rna + ' nucleotides · peptide ' + pep + ' / ' + GOAL.pep + ' amino acids');
        if (rna >= GOAL.rna && !flags.rna) { flags.rna = true; S.unlock('rna'); }
        if (rna >= GOAL.rna && pep >= GOAL.pep && !done) { done = true; setTimeout(() => S.completeStage(), 500); }
      }

      st.update = function (dt) {
        t += dt; tide.t = (tide.t + dt) % tide.period;
        if (blocks.length < 16 && S.chance(dt * 2)) spawn(false);
        blocks.forEach(b => {
          if (b === held) return;
          b.vx += Math.sin(t + b.wob) * 10 * dt; b.vy += Math.cos(t * 0.8 + b.wob) * 10 * dt;
          b.vx *= 0.99; b.vy *= 0.99; b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y > clayY - 8) { b.y = clayY - 8; b.vy = -Math.abs(b.vy) * 0.5; }
          if (b.y < 60) { b.y = 60; b.vy = Math.abs(b.vy); }
          if (b.x < -40) b.x = W + 30; if (b.x > W + 40) b.x = -30;
        });
        if (held) { held.x += (S.input.x - held.x) * Math.min(1, dt * 20); held.y += (S.input.y - held.y) * Math.min(1, dt * 20); }
        // hydrolysis
        chains.forEach(ch => {
          if (ch.items.length < 2) return;
          const rate = ch.where === 'water' ? 0.45 : (isDry() ? 0 : 0.045);
          if (S.chance(dt * rate)) breakChain(ch, S.randInt(1, ch.items.length - 1));
        });
        // water chain drifts
        const wc = chains[0]; wc.x += Math.sin(t * 0.3) * 8 * dt; wc.y += Math.cos(t * 0.23) * 6 * dt;
      };

      st.pointerDown = function (x, y) {
        let best = null, bd = 26;
        blocks.forEach(b => { const d = S.dist(x, y, b.x, b.y); if (d < bd) { bd = d; best = b; } });
        if (best) { held = best; S.Audio.sfx('click'); }
      };
      st.pointerUp = function (x, y) {
        if (!held) return;
        const b = held; held = null;
        for (const ch of chains) {
          if (ch.kind !== b.kind) continue;
          const e = endPos(ch);
          const radius = ch.where === 'clay' && isDry() ? 48 : 30;
          if (S.dist(b.x, b.y, e.x, e.y) < radius) {
            blocks.splice(blocks.indexOf(b), 1); ch.items.push(b);
            G.burst(e.x, e.y, b.kind === 'nuc' ? '#ff7ad9' : '#8ef7c2', 10, 70, 2.5); S.Audio.sfx('bond');
            if (ch.where === 'clay' && ch.items.length >= 4 && !flags.surf) { flags.surf = true; S.unlock('surfaces'); }
            progress(); return;
          }
        }
        // wrong type near a chain end?
        chains.forEach(ch => { const e = endPos(ch); if (S.dist(b.x, b.y, e.x, e.y) < 40 && ch.kind !== b.kind) S.UI.toast(ch.kind === 'nuc' ? 'Only nucleotides join an RNA strand' : 'Only amino acids join a peptide'); });
      };

      function drawBlock(ctx, b, x, y, scale) {
        scale = scale || 1;
        if (b.kind === 'nuc') {
          G.glow(ctx, x, y, 16 * scale, b.base.c, 0.45);
          ctx.fillStyle = b.base.c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 7 * scale, y - 9 * scale, 14 * scale, 18 * scale, 3) : ctx.rect(x - 7, y - 9, 14, 18); ctx.fill();
          G.text(ctx, b.base.n, x, y, 10 * scale, '#2a0a1e', 'center', '700');
        } else {
          G.glow(ctx, x, y, 14 * scale, b.color, 0.45);
          G.circle(ctx, x, y, 7 * scale, b.color);
        }
      }

      st.draw = function (ctx) {
        const dry = isDry();
        // water surface above clay moves with tide
        const waterTop = dry ? clayY + 10 + (tide.t - tide.dryFrom) * 8 : clayY - 20 - Math.min(tide.t, 1) * 0 ;
        // clay band
        const cg = ctx.createLinearGradient(0, clayY, 0, H); cg.addColorStop(0, '#5a3a22'); cg.addColorStop(1, '#2a1a0c');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, clayY + Math.sin(x * 0.03) * 5 + Math.sin(x * 0.13) * 2);
        ctx.lineTo(W, H); ctx.fill();
        // mineral sparkle
        for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = clayY + 10 + (i * 53.7) % (H - clayY - 20); const a = 0.2 + 0.2 * Math.sin(t * 2 + i); G.circle(ctx, x, y, 1.2, 'rgba(255,220,170,' + a + ')'); }
        // tide shading: when dry, the clay surface is exposed (lighter) 
        if (dry) { ctx.fillStyle = 'rgba(255,200,140,0.07)'; ctx.fillRect(0, clayY - 10, W, H - clayY + 10); }
        else { ctx.fillStyle = 'rgba(40,120,220,0.10)'; ctx.fillRect(0, clayY, W, H - clayY); }
        G.text(ctx, dry ? 'TIDE OUT · surface dry · bonds locked' : 'TIDE IN · surface wet · slow hydrolysis', W - 20, clayY - 14, 12, dry ? '#ffcf7a' : '#7fc0ff', 'right');
        G.bar(ctx, W - 180, clayY - 34, 160, 5, dry ? 1 - (tide.t - tide.dryFrom) / (tide.period - tide.dryFrom) : tide.t / tide.dryFrom, dry ? '#ffcf7a' : '#4fa0ff');

        // chains
        chains.forEach(ch => {
          const e = endPos(ch);
          G.text(ctx, ch.label, ch.x - 10, ch.y - 22, 11, ch.where === 'water' ? '#7fc0ff' : '#ffcf7a', 'left');
          ctx.strokeStyle = ch.where === 'water' ? 'rgba(127,192,255,0.5)' : 'rgba(255,207,122,0.6)'; ctx.lineWidth = 3; ctx.beginPath();
          ch.items.forEach((b, i) => { const p = itemPos(ch, i); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
          ctx.stroke();
          ch.items.forEach((b, i) => { const p = itemPos(ch, i); drawBlock(ctx, b, p.x, p.y, 1); });
          // drop target
          const pulse = 0.5 + 0.3 * Math.sin(t * 4);
          ctx.setLineDash([4, 4]); ctx.strokeStyle = G.rgba(ch.kind === 'nuc' ? '#ff7ad9' : '#8ef7c2', pulse); ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, S.TAU); ctx.stroke(); ctx.setLineDash([]);
          G.text(ctx, ch.items.length + '', e.x + 22, e.y, 11, '#9fc0e8', 'left');
        });
        // free blocks
        blocks.forEach(b => drawBlock(ctx, b, b.x, b.y, b === held ? 1.25 : 1));
        // legend
        G.text(ctx, 'Open water: bonds break about every 2 s', 18, 72, 12, '#7fc0ff', 'left');
        G.text(ctx, 'Clay surface: 10× slower, and never while the tide is out', 18, 90, 12, '#ffcf7a', 'left');
        G.text(ctx, 'Chains broken: ' + breaks, 18, 108, 12, '#7f9bbd', 'left');
      };
      return st;
    }
  });
})();
