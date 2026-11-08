/* Ambient deep-ocean drone + small event sounds, Web Audio only. */
(function () {
  const S = window.Spark;
  const A = S.Audio = { ctx: null, master: null, started: false };

  A.resume = function () {
    if (A.started) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = A.ctx = new Ctx();
      A.master = ctx.createGain();
      A.master.gain.value = S.state.muted ? 0 : 0.5;
      A.master.connect(ctx.destination);
      // low drone: two detuned oscillators through a slow filter
      const drone = ctx.createGain(); drone.gain.value = 0.18; drone.connect(A.master);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.connect(drone);
      [55, 55.6, 82.4].forEach((fr, i) => {
        const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = fr;
        const g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5; o.connect(g); g.connect(f); o.start();
      });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      // filtered noise = water
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.6;
      const ng = ctx.createGain(); ng.gain.value = 0.035;
      src.connect(nf); nf.connect(ng); ng.connect(A.master); src.start();
      const nl = ctx.createOscillator(); nl.frequency.value = 0.11; const nlg = ctx.createGain(); nlg.gain.value = 250;
      nl.connect(nlg); nlg.connect(nf.frequency); nl.start();
      A.started = true;
    } catch (e) { console.warn('audio failed', e); }
  };

  A.setMuted = function (m) {
    S.state.muted = m; S.save();
    if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.5, A.ctx.currentTime, 0.05);
  };

  const sfx = {
    catch: [[660, 0.08, 'sine']],
    react: [[330, 0.25, 'triangle'], [495, 0.25, 'triangle'], [660, 0.3, 'sine']],
    bond: [[440, 0.1, 'sine'], [550, 0.1, 'sine']],
    break: [[220, 0.2, 'sawtooth']],
    unlock: [[523, 0.3, 'sine'], [659, 0.3, 'sine'], [784, 0.4, 'sine']],
    milestone: [[392, 0.4, 'sine'], [523, 0.4, 'sine'], [659, 0.5, 'sine'], [1046, 0.8, 'sine']],
    hurt: [[150, 0.25, 'square']],
    eat: [[520, 0.07, 'sine']],
    divide: [[300, 0.2, 'triangle'], [600, 0.2, 'sine']],
    zap: [[1200, 0.12, 'sawtooth'], [80, 0.2, 'square']],
    click: [[880, 0.04, 'sine']]
  };
  A.sfx = function (name) {
    if (!A.started || S.state.muted) return;
    const def = sfx[name]; if (!def) return;
    const ctx = A.ctx, t0 = ctx.currentTime;
    def.forEach(([fr, dur, type], i) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t0 + i * 0.06); g.gain.linearRampToValueAtTime(0.12, t0 + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + i * 0.06 + dur);
      o.connect(g); g.connect(A.master); o.start(t0 + i * 0.06); o.stop(t0 + i * 0.06 + dur + 0.05);
    });
  };
})();
