/* Spark engine core: canvas, loop, input, stage manager, persistent state. */
(function () {
  const TAU = Math.PI * 2;
  const Spark = window.Spark = {
    TAU,
    stages: [],
    current: null,
    currentIndex: -1,
    canvas: null, ctx: null, W: 0, H: 0, dpr: 1,
    time: 0,
    paused: false,
    input: { x: -999, y: -999, down: false, keys: {}, justDown: false, justUp: false },
    state: { unlocked: 1, completed: [], codex: [], muted: false },
    _listeners: {},

    // ---------- utils ----------
    rand(a, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); },
    randInt(a, b) { return Math.floor(Spark.rand(a, b + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
    angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
    chance(p) { return Math.random() < p; },

    on(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    emit(ev, data) { (this._listeners[ev] || []).forEach(fn => fn(data)); },

    // ---------- state ----------
    load() {
      try {
        const raw = localStorage.getItem('spark-save');
        if (raw) Object.assign(this.state, JSON.parse(raw));
      } catch (e) { /* private mode etc. */ }
    },
    save() {
      try { localStorage.setItem('spark-save', JSON.stringify(this.state)); } catch (e) { }
    },
    reset() {
      this.state = { unlocked: 1, completed: [], codex: [], muted: this.state.muted };
      this.save();
    },

    // ---------- stages ----------
    registerStage(def) {
      this.stages.push(def);
      this.stages.sort((a, b) => a.index - b.index);
    },
    stageByIndex(i) { return this.stages.find(s => s.index === i); },

    goToStage(index) {
      const def = this.stageByIndex(index);
      if (!def) return;
      if (this.current && this.current.exit) this.current.exit();
      this.currentIndex = index;
      this.current = def.create();
      this.current.def = def;
      this.time = 0;
      Spark.UI.setStage(def);
      Spark.UI.setProgress(0);
      Spark.UI.hint('');
      Spark.Gfx.particles.clear();
      if (this.current.enter) this.current.enter();
      this.emit('stage', def);
    },
    restartStage() { if (this.currentIndex > 0) this.goToStage(this.currentIndex); },

    completeStage() {
      const idx = this.currentIndex;
      if (!this.state.completed.includes(idx)) this.state.completed.push(idx);
      this.state.unlocked = Math.max(this.state.unlocked, idx + 1);
      this.save();
      const next = this.stageByIndex(idx + 1);
      Spark.Audio.sfx('milestone');
      if (next) {
        Spark.UI.popup({
          tag: 'Stage complete',
          title: this.current.def.title + ' — done',
          years: 'Next: ' + next.title + ' · ' + next.years,
          body: this.current.def.outro || 'A new problem appears. Life keeps going anyway.',
          button: 'Continue to ' + next.title
        }, () => this.goToStage(idx + 1));
      } else {
        Spark.UI.popup({
          tag: 'Ending', title: 'You can think.',
          years: 'about 550 million years ago, and every moment since',
          body: 'From a rock pore catching gas to a creature that can look ahead and decide: every step only worked because the previous one solved a problem for it. ' +
                'The whole story is still being pieced together. The parts marked as hypotheses are where scientists still argue. Thanks for playing.',
          button: 'Back to title'
        }, () => Spark.UI.showTitle());
      }
    },

    // ---------- codex ----------
    unlock(id, cb) {
      const entry = Spark.Codex.get(id);
      if (!entry) { console.warn('no codex entry', id); if (cb) cb(); return; }
      const fresh = !this.state.codex.includes(id);
      if (fresh) { this.state.codex.push(id); this.save(); }
      Spark.Audio.sfx('unlock');
      Spark.UI.popup({
        tag: entry.hypothesis ? 'Hypothesis · codex unlocked' : 'Codex unlocked',
        hyp: !!entry.hypothesis,
        title: entry.title, years: entry.years, body: entry.body, button: 'Got it'
      }, cb);
    },

    // ---------- boot ----------
    init() {
      this.load();
      const canvas = this.canvas = document.getElementById('game');
      this.ctx = canvas.getContext('2d');
      const resize = () => {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.W = window.innerWidth; this.H = window.innerHeight;
        canvas.width = Math.floor(this.W * this.dpr); canvas.height = Math.floor(this.H * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        if (this.current && this.current.resize) this.current.resize();
      };
      window.addEventListener('resize', resize); resize();

      const toLocal = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      canvas.addEventListener('pointerdown', (e) => {
        const p = toLocal(e); this.input.x = p.x; this.input.y = p.y; this.input.down = true; this.input.justDown = true;
        Spark.Audio.resume();
        if (this.current && this.current.pointerDown && !Spark.UI.isBlocking()) this.current.pointerDown(p.x, p.y, e);
      });
      canvas.addEventListener('pointermove', (e) => {
        const p = toLocal(e); this.input.x = p.x; this.input.y = p.y;
        if (this.current && this.current.pointerMove && !Spark.UI.isBlocking()) this.current.pointerMove(p.x, p.y, e);
      });
      const up = (e) => {
        if (!this.input.down) return;
        this.input.down = false; this.input.justUp = true;
        if (this.current && this.current.pointerUp && !Spark.UI.isBlocking()) this.current.pointerUp(this.input.x, this.input.y, e);
      };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); window.addEventListener('pointerup', up);
      canvas.addEventListener('contextmenu', e => e.preventDefault());

      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.input.keys[e.code] = true;
        if (e.code === 'Backquote') { Spark.UI.toggleStages(); return; }
        if (e.code === 'Escape') { Spark.UI.closeAll(); return; }
        if (Spark.UI.isBlocking()) { if (e.code === 'Space' || e.code === 'Enter') Spark.UI.popupOk(); return; }
        if (e.code === 'Space') e.preventDefault();
        if (this.current && this.current.key) this.current.key(e.code, e);
      });
      window.addEventListener('keyup', (e) => { this.input.keys[e.code] = false; });

      let last = performance.now();
      const frame = (now) => {
        let dt = (now - last) / 1000; last = now;
        if (dt > 0.05) dt = 0.05;
        this.tick(dt);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    tick(dt) {
      const ctx = this.ctx;
      const blocked = Spark.UI.isBlocking();
      ctx.clearRect(0, 0, this.W, this.H);
      Spark.Gfx.drawBackground(ctx, dt, this.current ? this.current.def : null);
      if (this.current) {
        if (!blocked) { this.time += dt; this.current.update(dt); }
        this.current.draw(ctx);
      }
      if (!blocked) Spark.Gfx.particles.update(dt);
      Spark.Gfx.particles.draw(ctx);
      Spark.Gfx.drawVignette(ctx);
      this.input.justDown = false; this.input.justUp = false;
    }
  };
})();
