/* Drawing helpers, particles, background. */
(function () {
  const S = window.Spark;
  const Gfx = S.Gfx = {};

  Gfx.glow = function (ctx, x, y, r, color, alpha, inner) {
    if (r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, Gfx.rgba(color, alpha * (inner === undefined ? 1 : inner)));
    g.addColorStop(0.4, Gfx.rgba(color, alpha * 0.45));
    g.addColorStop(1, Gfx.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, S.TAU); ctx.fill();
  };
  Gfx.circle = function (ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, S.TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  };
  Gfx.orb = function (ctx, x, y, r, color, glowMul) {
    Gfx.glow(ctx, x, y, r * (glowMul || 2.6), color, 0.55);
    Gfx.circle(ctx, x, y, r, Gfx.rgba(color, 0.95));
    Gfx.circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, 'rgba(255,255,255,0.45)');
  };
  Gfx.text = function (ctx, txt, x, y, size, color, align, weight) {
    ctx.font = (weight || '500') + ' ' + (size || 13) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = color || '#d8ecff';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  };
  Gfx.bar = function (ctx, x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(40,80,140,0.25)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * S.clamp(frac, 0, 1), h);
    ctx.strokeStyle = 'rgba(120,190,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (label) Gfx.text(ctx, label, x, y - 9, 11, '#9fc0e8', 'left');
  };
  Gfx.wobbly = function (ctx, x, y, r, t, amp, n, fill, stroke, lw) {
    n = n || 7; amp = amp === undefined ? 0.08 : amp;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * S.TAU;
      const rr = r * (1 + amp * Math.sin(a * n + t * 2.1) + amp * 0.5 * Math.sin(a * (n - 3) - t * 1.3));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  };

  // color helpers: colors are "r,g,b" strings or hex
  const cache = {};
  Gfx.rgb = function (c) {
    if (cache[c]) return cache[c];
    let out = c;
    if (c[0] === '#') {
      const h = c.length === 4 ? c.slice(1).split('').map(ch => ch + ch).join('') : c.slice(1);
      out = parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
    }
    cache[c] = out; return out;
  };
  Gfx.rgba = function (c, a) { return 'rgba(' + Gfx.rgb(c) + ',' + S.clamp(a, 0, 1) + ')'; };

  // ---------- living mitochondrion ----------
  // m: { a (angle), d (0..1 of radius), ph, split (0..1 while dividing) }
  Gfx.mito = function (ctx, cx, cy, R, m, t, scale) {
    scale = scale || 1;
    const x = cx + Math.cos(m.a) * R * m.d, y = cy + Math.sin(m.a) * R * m.d;
    const wig = 1 + 0.12 * Math.sin(t * 5 + (m.ph || 0));
    const len = 9 * scale * wig, wid = 5 * scale / wig;
    ctx.save(); ctx.translate(x, y); ctx.rotate((m.a || 0) + Math.sin(t * 1.3 + (m.ph || 0)) * 0.6);
    Gfx.glow(ctx, 0, 0, 14 * scale + (m.flash || 0) * 10, '#c48cff', 0.35 + (m.flash || 0) * 0.5);
    ctx.fillStyle = '#c48cff';
    if (m.split > 0) { // pinching in two
      const off = len * 0.6 * m.split;
      ctx.beginPath(); ctx.ellipse(-off, 0, len * (1 - 0.3 * m.split), wid, 0, 0, S.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(off, 0, len * (1 - 0.3 * m.split), wid, 0, 0, S.TAU); ctx.fill();
    } else { ctx.beginPath(); ctx.ellipse(0, 0, len, wid, 0, 0, S.TAU); ctx.fill(); }
    ctx.strokeStyle = '#3a1a5a'; ctx.lineWidth = Math.max(0.6, scale); ctx.beginPath();
    for (let k = -len * 0.7; k <= len * 0.7; k += Math.max(2.4, 3 * scale)) { ctx.moveTo(k, -wid * 0.6); ctx.lineTo(k + 1.2, wid * 0.6); }
    ctx.stroke(); ctx.restore();
    return { x, y };
  };
  // animate a list of mitos drifting inside a cell
  Gfx.mitoUpdate = function (list, dt, t) {
    list.forEach(m => {
      m.ph = m.ph || 0; m.a += Math.sin(t * 0.7 + m.ph) * 0.4 * dt; m.d += Math.cos(t * 0.5 + m.ph * 1.7) * 0.15 * dt;
      m.d = S.clamp(m.d, 0.15, 0.75); m.flash = Math.max(0, (m.flash || 0) - dt * 2);
      if (m.split > 0) m.split = Math.min(1, m.split + dt * 0.8);
    });
  };
  // small DNA loop (nucleoid) drawn inside a prokaryote
  Gfx.nucleoid = function (ctx, x, y, r, t, alpha) {
    ctx.strokeStyle = 'rgba(79,216,255,' + (alpha === undefined ? 0.7 : alpha) + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * S.TAU; const rr = r * (0.7 + 0.3 * Math.sin(a * 3 + t * 2)); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.6; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
    ctx.closePath(); ctx.stroke();
  };
  // membrane machinery dots on a cell rim: n synthases (green) and pumps (yellow)
  Gfx.rimParts = function (ctx, x, y, r, parts, t) {
    if (!parts) return;
    const n = (parts.synthase || 0) + (parts.pump || 0);
    for (let i = 0; i < n; i++) { const a = i / n * S.TAU + t * 0.2; const col = i < (parts.synthase || 0) ? '#8ef7c2' : '#ffd86b'; Gfx.circle(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 2.2, col); }
  };
  Gfx.newMito = function () { return { a: S.rand(S.TAU), d: S.rand(0.25, 0.65), ph: S.rand(S.TAU), split: 0, flash: 0 }; };

  // ---------- particles ----------
  class Particles {
    constructor() { this.list = []; }
    clear() { this.list.length = 0; }
    emit(o) {
      const n = o.n || 1;
      for (let i = 0; i < n; i++) {
        const a = S.rand(S.TAU), sp = S.rand(o.speed === undefined ? 40 : o.speed) ;
        this.list.push({
          x: o.x + S.rand(-(o.spread || 0), o.spread || 0), y: o.y + S.rand(-(o.spread || 0), o.spread || 0),
          vx: (o.vx || 0) + Math.cos(a) * sp, vy: (o.vy || 0) + Math.sin(a) * sp,
          life: o.life || 0.8, max: o.life || 0.8, size: o.size || 3, color: o.color || '#4fd8ff',
          drag: o.drag === undefined ? 0.96 : o.drag, glow: o.glow !== false
        });
      }
      if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt; if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; p.vy *= p.drag;
      }
    }
    draw(ctx) {
      for (const p of this.list) {
        const a = p.life / p.max;
        if (p.glow) Gfx.glow(ctx, p.x, p.y, p.size * 3, p.color, a * 0.5);
        Gfx.circle(ctx, p.x, p.y, p.size * (0.4 + 0.6 * a), Gfx.rgba(p.color, a));
      }
    }
  }
  Gfx.particles = new Particles();
  Gfx.burst = function (x, y, color, n, speed, size) {
    Gfx.particles.emit({ x, y, color, n: n || 12, speed: speed || 90, size: size || 3, life: 0.7 });
  };

  // ---------- background ----------
  const snow = [];
  let bgT = 0;
  Gfx.drawBackground = function (ctx, dt, def) {
    bgT += dt;
    const W = S.W, H = S.H;
    const base = (def && def.palette) || ['#02060f', '#031229', '#06234a'];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, base[0]); g.addColorStop(0.55, base[1]); g.addColorStop(1, base[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // light shafts
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = W * (0.2 + 0.3 * i) + Math.sin(bgT * 0.1 + i) * 60;
      const lg = ctx.createLinearGradient(x, 0, x + 80, H);
      lg.addColorStop(0, 'rgba(60,140,220,0.05)'); lg.addColorStop(1, 'rgba(60,140,220,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 260, H); ctx.lineTo(x - 120, H); ctx.fill();
    }
    ctx.restore();
    // marine snow
    while (snow.length < 90) snow.push({ x: S.rand(W), y: S.rand(H), r: S.rand(0.6, 2.2), s: S.rand(4, 14), ph: S.rand(S.TAU) });
    for (const p of snow) {
      p.y += p.s * dt; p.x += Math.sin(bgT * 0.5 + p.ph) * 6 * dt;
      if (p.y > H + 5) { p.y = -5; p.x = S.rand(W); }
      if (p.x < -5) p.x = W + 5; if (p.x > W + 5) p.x = -5;
      const a = 0.25 + 0.2 * Math.sin(bgT * 1.5 + p.ph);
      Gfx.circle(ctx, p.x, p.y, p.r, 'rgba(160,210,255,' + a + ')');
    }
  };
  Gfx.drawVignette = function (ctx) {
    const W = S.W, H = S.H;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,2,8,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
})();
