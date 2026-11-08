/* HUD, popups, codex, stage select, title. */
(function () {
  const S = window.Spark;
  const $ = (id) => document.getElementById(id);
  const UI = S.UI = { queue: [], popupCb: null, open: null };

  UI.isBlocking = function () { return !$('overlay').classList.contains('hidden'); };

  UI.setStage = function (def) {
    $('stage-title').innerHTML = 'Stage ' + def.index + ' of 10 <b>' + def.title + '</b>';
    $('timeline-label').textContent = def.years;
    const frac = S.clamp((4.0 - def.ya) / (4.0 - 0.5), 0, 1);
    $('timeline-fill').style.width = (frac * 100) + '%';
    $('timeline-marker').style.left = (frac * 100) + '%';
    UI.objective(def.objective || '');
  };
  UI.objective = function (txt) { $('objective-text').textContent = txt; };
  UI.setProgress = function (f) { $('progress-fill').style.width = (S.clamp(f, 0, 1) * 100) + '%'; };
  let hintTimer = null;
  UI.hint = function (txt, seconds) {
    const h = $('hint'); h.textContent = txt;
    h.classList.toggle('show', !!txt);
    if (hintTimer) clearTimeout(hintTimer);
    if (txt && seconds) hintTimer = setTimeout(() => h.classList.remove('show'), seconds * 1000);
  };
  let toastTimer = null;
  UI.toast = function (txt) {
    const t = $('toast'); t.textContent = txt; t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  };

  // ---- popups (queued) ----
  UI.popup = function (o, cb) {
    UI.queue.push({ o, cb });
    if (!UI.open) UI._next();
  };
  UI._next = function () {
    const item = UI.queue.shift();
    if (!item) { UI.closeAll(); return; }
    const { o, cb } = item;
    UI.hideAllPanels(); $('overlay').classList.remove('hidden');
    const tag = $('popup-tag'); tag.textContent = o.tag || ''; tag.className = 'tag' + (o.hyp ? ' hyp' : '');
    $('popup-title').textContent = o.title || '';
    $('popup-years').textContent = o.years || '';
    $('popup-body').textContent = o.body || '';
    $('popup-ok').textContent = o.button || 'Continue';
    $('popup').classList.remove('hidden');
    UI.open = 'popup'; UI.popupCb = cb;
  };
  UI.popupOk = function () {
    if (UI.open !== 'popup') return;
    const cb = UI.popupCb; UI.popupCb = null; UI.open = null;
    $('popup').classList.add('hidden');
    if (cb) cb();
    if (UI.queue.length) UI._next(); else if (UI.open === null) UI.closeAll();
  };

  UI.hideAllPanels = function () { ['popup', 'codex', 'stages', 'title'].forEach(id => $(id).classList.add('hidden')); };
  UI.closeAll = function () {
    if (UI.open === 'popup') { UI.popupOk(); return; }
    if (UI.open === 'title') return; // title stays until play
    UI.hideAllPanels(); $('overlay').classList.add('hidden'); UI.open = null;
  };
  UI.showPanel = function (id) {
    UI.hideAllPanels(); $('overlay').classList.remove('hidden'); $(id).classList.remove('hidden'); UI.open = id;
  };

  // ---- codex ----
  UI.showCodex = function () {
    const list = $('codex-list'); list.innerHTML = '';
    S.stages.forEach(def => {
      const es = S.Codex.forStage(def.index); if (!es.length) return;
      const h = document.createElement('div'); h.className = 'codex-stage';
      h.textContent = 'Stage ' + def.index + ' · ' + def.title + ' · ' + def.years; list.appendChild(h);
      es.forEach(e => {
        const d = document.createElement('div');
        const got = S.state.codex.includes(e.id);
        d.className = 'codex-entry' + (got ? '' : ' locked');
        d.innerHTML = '<h3>' + (got ? e.title : 'Locked entry') + '</h3>' +
          (got ? '<div class="years">' + (e.hypothesis ? '<span class="tag hyp">hypothesis</span> ' : '') + e.years + '</div><p>' + e.body + '</p>' : '<p class="muted">Reach the milestone in this stage to unlock.</p>');
        list.appendChild(d);
      });
    });
    UI.showPanel('codex');
  };

  // ---- stage select ----
  UI.showStages = function () {
    const list = $('stage-list'); list.innerHTML = '';
    S.stages.forEach(def => {
      const b = document.createElement('button');
      const done = S.state.completed.includes(def.index), locked = def.index > S.state.unlocked;
      b.className = 'stage-card' + (done ? ' done' : '') + (locked ? ' locked' : '');
      b.innerHTML = '<div class="n">Stage ' + def.index + (done ? ' · complete' : locked ? ' · locked (debug open)' : '') + '</div><div class="t">' + def.title + '</div><div class="y">' + def.years + '</div>';
      b.onclick = () => { UI.closeAll(); UI.open = null; $('overlay').classList.add('hidden'); S.goToStage(def.index); };
      list.appendChild(b);
    });
    const r = document.createElement('button'); r.className = 'stage-card'; r.innerHTML = '<div class="n">Save</div><div class="t">Reset all progress</div>';
    r.onclick = () => { S.reset(); UI.showStages(); };
    list.appendChild(r);
    UI.showPanel('stages');
  };
  UI.toggleStages = function () {
    if (UI.open === 'stages') { UI.hideAllPanels(); $('overlay').classList.add('hidden'); UI.open = null; }
    else if (UI.open !== 'popup') UI.showStages();
  };

  // ---- title ----
  UI.showTitle = function () {
    $('btn-continue').classList.toggle('hidden', !(S.state.unlocked > 1 || S.state.completed.length));
    UI.showPanel('title');
  };

  UI.init = function () {
    $('popup-ok').onclick = UI.popupOk;
    document.querySelectorAll('.close').forEach(b => b.onclick = () => { UI.hideAllPanels(); $('overlay').classList.add('hidden'); UI.open = null; });
    $('btn-codex').onclick = () => { if (UI.open === 'codex') UI.closeAll(); else if (UI.open !== 'popup') UI.showCodex(); };
    $('btn-stages').onclick = UI.toggleStages;
    $('btn-restart').onclick = () => { if (!UI.isBlocking()) S.restartStage(); };
    const mute = $('btn-mute');
    const refreshMute = () => mute.textContent = S.state.muted ? 'Sound: off' : 'Sound: on';
    mute.onclick = () => { S.Audio.resume(); S.Audio.setMuted(!S.state.muted); refreshMute(); };
    refreshMute();
    $('btn-play').onclick = () => { S.Audio.resume(); UI.hideAllPanels(); $('overlay').classList.add('hidden'); UI.open = null; S.goToStage(1); };
    $('btn-continue').onclick = () => { S.Audio.resume(); UI.hideAllPanels(); $('overlay').classList.add('hidden'); UI.open = null; S.goToStage(Math.min(S.state.unlocked, 10)); };
    $('overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay' && UI.open !== 'title' && UI.open !== 'popup') UI.closeAll(); });
  };
})();
