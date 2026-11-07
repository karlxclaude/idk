/** Pause menu, Settings panel and Scale Map. */
import type { Game } from '../core/Game';
import type { Settings } from '../core/state';
import { input } from '../core/input';
import { events } from '../core/events';
import { saveStore } from '../core/save';
import { colorToCss } from '../core/math';
import { TIERS } from '../scales/registry';
import { h, pow10Label } from './dom';

/** Open/close helper with fade. */
function makeScreen(cls: string) {
  const el = h('div', `eh-screen ${cls}`);
  let t = 0;
  return {
    el,
    get isOpen() {
      return el.classList.contains('open');
    },
    open() {
      window.clearTimeout(t);
      el.classList.add('open');
      void el.offsetWidth;
      el.classList.add('vis');
    },
    close(instant = false) {
      el.classList.remove('vis');
      window.clearTimeout(t);
      if (instant) el.classList.remove('open');
      else t = window.setTimeout(() => el.classList.remove('open'), 260);
    },
  };
}

const MAP_CSS = /* css */ `
.eh-map { width:min(94vw, 560px); height:min(92vh, 860px); padding:18px 0 14px; }
.eh-map .hd { display:flex; align-items:center; justify-content:space-between; padding:0 20px 10px; gap:10px; }
.eh-map .hd h2 { margin:0; font-size:18px; letter-spacing:.28em; font-weight:800; text-shadow:0 0 18px var(--eh-accent); }
.eh-map .zoom { display:flex; gap:6px; }
.eh-map .zoom button { width:34px; height:34px; border-radius:50%; border:1px solid var(--eh-edge); background:rgba(255,255,255,.08); font-size:18px; line-height:1; padding:0; }
.eh-map .ladder { position:relative; flex:1; overflow-y:auto; overflow-x:hidden; touch-action:pan-y; overscroll-behavior:contain; -webkit-mask-image:linear-gradient(transparent, #000 28px, #000 calc(100% - 28px), transparent); mask-image:linear-gradient(transparent, #000 28px, #000 calc(100% - 28px), transparent); }
.eh-map .inner { position:relative; width:100%; }
.eh-map .spine { position:absolute; left:58px; top:0; bottom:0; width:2px; background:linear-gradient(transparent, rgba(255,255,255,.35) 3%, rgba(255,255,255,.35) 97%, transparent); }
.eh-map .tick { position:absolute; left:0; width:52px; text-align:right; font-size:10px; letter-spacing:.06em; color:var(--eh-dim); transform:translateY(-50%); font-variant-numeric:tabular-nums; white-space:nowrap; }
.eh-map .tick::after { content:''; position:absolute; left:calc(100% + 2px); top:50%; width:8px; height:1px; background:rgba(255,255,255,.4); }
.eh-map .node { position:absolute; left:76px; right:18px; height:54px; transform:translateY(-50%); display:flex; align-items:center; gap:12px; padding:0 14px 0 10px; border-radius:16px; transition:box-shadow .2s; }
.eh-map .node::before { content:''; position:absolute; left:-20px; top:50%; width:20px; height:2px; background:var(--c, #fff); opacity:.6; }
.eh-map .dot { position:absolute; left:-23px; top:50%; width:10px; height:10px; margin-top:-5px; border-radius:50%; background:var(--c, #888); box-shadow:0 0 12px var(--c, #888); }
.eh-map .sw { flex:0 0 auto; width:34px; height:34px; border-radius:50%; background:var(--sw); box-shadow:0 0 14px -2px var(--c), inset 0 0 0 1px rgba(255,255,255,.25); display:grid; place-items:center; font-size:15px; font-weight:700; }
.eh-map .tx { min-width:0; flex:1; }
.eh-map .tx .n { font-size:15px; font-weight:700; letter-spacing:.06em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.eh-map .tx .s { font-size:12px; color:var(--eh-dim); font-variant-numeric:tabular-nums; margin-top:1px; letter-spacing:.06em; }
.eh-map .idx { font-size:11px; letter-spacing:.14em; color:var(--eh-dim); }
.eh-map .node.locked { opacity:.55; background:rgba(255,255,255,.04); }
.eh-map .node.locked .sw { background:#1a1626; box-shadow:inset 0 0 0 1px rgba(255,255,255,.12); color:rgba(255,255,255,.5); }
.eh-map .node.locked .n { letter-spacing:.3em; filter:blur(.2px); }
.eh-map .node.locked .dot { background:#555; box-shadow:none; }
.eh-map .node.cur { box-shadow:0 0 0 1.5px var(--c), 0 0 30px -4px var(--c); }
.eh-map .node.cur .here { display:block; }
.eh-map .here { display:none; font-size:9px; font-weight:800; letter-spacing:.16em; padding:3px 7px; border-radius:8px; background:var(--c); color:#07040f; white-space:nowrap; }
.eh-map .foot { text-align:center; padding:8px 20px 0; }
.eh-map .foot .eh-btn { margin-top:4px; min-height:44px; }
`;

export function mountMenus(game: Game, root: HTMLElement) {
  const style = h('style');
  style.textContent = MAP_CSS;
  root.appendChild(style);

  const pause = makeScreen('eh-pause');
  const settings = makeScreen('eh-settings');
  const map = makeScreen('eh-mapscreen');
  settings.el.style.zIndex = '2';
  map.el.style.zIndex = '2';
  root.append(pause.el, settings.el, map.el);

  const closeAll = (instant = false) => {
    pause.close(instant);
    settings.close(instant);
    map.close(instant);
  };

  // ------------------------------------------------------------ pause
  const card = h('div', 'eh-card eh-glass');
  card.innerHTML = `<h1 class="eh-title">PAUSED</h1><div class="eh-sub"></div>`;
  const sub = card.querySelector('.eh-sub') as HTMLElement;
  const mkBtn = (label: string, fn: () => void, cls = '') => {
    const b = h('button', `eh-btn ${cls}`, label);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
    card.appendChild(b);
    return b;
  };
  mkBtn('Resume', () => game.setPaused(false), 'primary');
  mkBtn('Scale Map', () => {
    buildMap();
    map.open();
    requestAnimationFrame(centerOnCurrent);
  });
  mkBtn('Settings', () => {
    syncSettings();
    settings.open();
  });
  mkBtn('Evolution', () => window.dispatchEvent(new CustomEvent('everhunger:openShop')));
  mkBtn('Save &amp; Quit to Title', () => {
    saveStore.save(game.state);
    closeAll(true);
    window.dispatchEvent(new CustomEvent('everhunger:openTitle'));
  }, 'ghost');
  pause.el.appendChild(card);

  const refreshSub = () => {
    const t = TIERS[game.tier.index - 1];
    sub.textContent = t ? `Tier ${t.index} · ${t.name}` : '';
  };

  // Show menu when the player pauses with the action (Esc/P/pause button); the Game toggles pause first.
  input.onAction('pause', () => {
    if (game.loop.paused) {
      refreshSub();
      pause.open();
    }
  });
  events.on('pause', ({ paused }) => {
    if (!paused) closeAll();
  });
  // Clicking the dimmed backdrop resumes.
  pause.el.addEventListener('pointerdown', (e) => {
    if (e.target === pause.el) game.setPaused(false);
  });

  // ------------------------------------------------------------ settings
  const sCard = h('div', 'eh-card eh-glass');
  sCard.innerHTML = `<h1 class="eh-title" style="font-size:22px">SETTINGS</h1><div class="eh-sub">Tune the experience</div><div class="eh-scroll"></div>`;
  const list = sCard.querySelector('.eh-scroll') as HTMLElement;
  const syncers: (() => void)[] = [];

  const commit = () => {
    const s: Settings = { ...game.state.settings };
    return s;
  };
  const apply = (patch: Partial<Settings>) => {
    const next: Settings = { ...commit(), ...patch };
    game.applySettings(next);
    saveStore.saveSettings(next);
    window.dispatchEvent(new CustomEvent('everhunger:settingsChanged', { detail: next }));
  };
  const section = (t: string) => list.appendChild(h('div', 'eh-section', t));
  const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume') => {
    const row = h('div', 'eh-row', `<label>${label}</label><input type="range" min="0" max="100" step="1"><span class="val"></span>`);
    const inp = row.querySelector('input') as HTMLInputElement;
    const val = row.querySelector('.val') as HTMLElement;
    inp.addEventListener('input', () => {
      val.textContent = `${inp.value}%`;
      apply({ [key]: Number(inp.value) / 100 } as Partial<Settings>);
    });
    syncers.push(() => {
      inp.value = String(Math.round(((game.state.settings as any)[key] as number) * 100));
      val.textContent = `${inp.value}%`;
    });
    list.appendChild(row);
  };
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const row = h('div', 'eh-row', `<label>${label}</label><button class="eh-switch" role="switch" aria-checked="false" aria-label="${label}"></button>`);
    const sw = row.querySelector('button') as HTMLButtonElement;
    sw.addEventListener('click', () => {
      const v = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(v));
      set(v);
    });
    syncers.push(() => sw.setAttribute('aria-checked', String(get())));
    list.appendChild(row);
  };
  const segment = <T extends string>(label: string, opts: T[], get: () => T, set: (v: T) => void) => {
    const row = h('div', 'eh-row', `<label>${label}</label><div class="eh-seg"></div>`);
    const seg = row.querySelector('.eh-seg') as HTMLElement;
    const bs = opts.map((o) => {
      const b = h('button', '', o);
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        set(o);
        sync();
      });
      seg.appendChild(b);
      return b;
    });
    const sync = () => bs.forEach((b, i) => b.setAttribute('aria-pressed', String(get() === opts[i])));
    syncers.push(sync);
    list.appendChild(row);
  };

  let muted = false;
  let preMute = { master: 0.8 };
  section('Audio');
  slider('Master', 'masterVolume');
  slider('Music', 'musicVolume');
  slider('Effects', 'sfxVolume');
  toggle('Mute all', () => muted, (v) => {
    muted = v;
    if (v) {
      preMute = { master: game.state.settings.masterVolume || 0.8 };
      apply({ masterVolume: 0 });
    } else apply({ masterVolume: preMute.master });
    syncSettings();
  });
  section('Accessibility');
  toggle('Reduce screen shake', () => game.state.settings.reduceShake, (v) => apply({ reduceShake: v }));
  toggle('Reduce flashing', () => game.state.settings.reduceFlashing, (v) => apply({ reduceFlashing: v }));
  toggle('Haptics', () => game.state.settings.haptics, (v) => apply({ haptics: v }));
  section('Display');
  segment('Quality', ['low', 'medium', 'high'] as Settings['quality'][], () => game.state.settings.quality, (v) => apply({ quality: v }));
  toggle('Show FPS', () => game.state.settings.showFps, (v) => apply({ showFps: v }));
  section('Controls');
  segment('Touch steering', ['follow', 'joystick'] as Settings['touchMode'][], () => game.state.settings.touchMode, (v) => apply({ touchMode: v }));

  const back = h('button', 'eh-btn', 'Back');
  back.addEventListener('click', () => settings.close());
  sCard.appendChild(back);
  settings.el.appendChild(sCard);
  settings.el.addEventListener('pointerdown', (e) => {
    if (e.target === settings.el) settings.close();
  });
  function syncSettings() {
    muted = game.state.settings.masterVolume === 0;
    syncers.forEach((f) => f());
  }
  syncSettings();

  // ------------------------------------------------------------ scale map
  const mCard = h('div', 'eh-card eh-glass eh-map');
  mCard.innerHTML = `
    <div class="hd"><h2>SCALE MAP</h2><div class="zoom"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div></div>
    <div class="ladder"><div class="inner"><div class="spine"></div></div></div>
    <div class="foot"><button class="eh-btn">Back</button></div>`;
  map.el.appendChild(mCard);
  map.el.addEventListener('pointerdown', (e) => {
    if (e.target === map.el) map.close();
  });
  mCard.querySelector('.foot button')!.addEventListener('click', () => map.close());
  const ladder = mCard.querySelector('.ladder') as HTMLElement;
  const inner = mCard.querySelector('.inner') as HTMLElement;

  const PAD = 44;
  const minExp = Math.min(...TIERS.map((t) => t.scaleExponent));
  const maxExp = Math.max(...TIERS.map((t) => t.scaleExponent));
  const MIN_PPD = 20, MAX_PPD = 130;
  let ppd = 40;
  const nodes: { el: HTMLElement; exp: number }[] = [];
  const ticks: { el: HTMLElement; exp: number }[] = [];
  const yOf = (exp: number) => PAD + (maxExp - exp) * ppd;
  const layout = () => {
    inner.style.height = `${PAD * 2 + (maxExp - minExp) * ppd}px`;
    for (const n of nodes) n.el.style.top = `${yOf(n.exp)}px`;
    for (const t of ticks) t.el.style.top = `${yOf(t.exp)}px`;
    // hide ticks that would crowd node cards at low zoom (keep every 5th when tight)
    const step = ppd < 30 ? 10 : 5;
    for (const t of ticks) t.el.style.display = t.exp % step === 0 ? '' : 'none';
  };
  const unlocked = (idx: number) => game.state.unlockedTiers.includes(idx) || idx <= game.state.maxTierReached;

  let built = false;
  function buildMap() {
    const cur = game.tier.index;
    if (!built) {
      built = true;
      for (let e = Math.ceil(minExp); e <= Math.floor(maxExp); e++) {
        if (e % 5 !== 0) continue;
        const t = h('div', 'tick', pow10Label(e).replace(' m', ''));
        inner.appendChild(t);
        ticks.push({ el: t, exp: e });
      }
      for (const tier of TIERS) {
        const n = h('div', 'node eh-glass');
        nodes.push({ el: n, exp: tier.scaleExponent });
        inner.appendChild(n);
      }
    }
    TIERS.forEach((tier, i) => {
      const n = nodes[i].el;
      const open = unlocked(tier.index);
      const c = colorToCss(tier.palette.accent);
      const p = tier.palette;
      n.className = `node eh-glass${open ? '' : ' locked'}${tier.index === cur ? ' cur' : ''}`;
      n.style.setProperty('--c', open ? c : '#777');
      n.style.setProperty('--sw', open ? `radial-gradient(circle at 35% 30%, ${colorToCss(p.bgCenter ?? p.bgTop)} 0%, ${colorToCss(p.bgTop)} 55%, ${colorToCss(p.accent)} 100%)` : '#1a1626');
      n.innerHTML = `<span class="dot"></span><span class="sw">${open ? '' : '?'}</span>
        <div class="tx"><div class="n">${open ? tier.name : '???'}</div><div class="s">${open ? tier.scaleLabel : '10? m'}</div></div>
        ${tier.index === cur ? '<span class="here">YOU ARE HERE</span>' : `<span class="idx">${String(tier.index).padStart(2, '0')}</span>`}`;
    });
    layout();
  }
  function centerOnCurrent() {
    const t = TIERS[game.tier.index - 1];
    if (!t) return;
    ladder.scrollTop = yOf(t.scaleExponent) - ladder.clientHeight / 2;
  }
  const zoomTo = (newPpd: number, focusY: number) => {
    newPpd = Math.max(MIN_PPD, Math.min(MAX_PPD, newPpd));
    if (newPpd === ppd) return;
    const exp = maxExp - (ladder.scrollTop + focusY - PAD) / ppd;
    ppd = newPpd;
    layout();
    ladder.scrollTop = PAD + (maxExp - exp) * ppd - focusY;
  };
  ladder.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = ladder.getBoundingClientRect();
    zoomTo(ppd * Math.exp(-e.deltaY * 0.0016), e.clientY - r.top);
  }, { passive: false });
  const zb = mCard.querySelectorAll<HTMLButtonElement>('.zoom button');
  zb[0].addEventListener('click', () => zoomTo(ppd * 1.35, ladder.clientHeight / 2));
  zb[1].addEventListener('click', () => zoomTo(ppd / 1.35, ladder.clientHeight / 2));
  // pinch
  let pinch = 0;
  const dist = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  ladder.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = dist(e);
  }, { passive: true });
  ladder.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinch > 0) {
      e.preventDefault();
      const d = dist(e);
      const r = ladder.getBoundingClientRect();
      zoomTo(ppd * (d / pinch), (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
      pinch = d;
    }
  }, { passive: false });
  ladder.addEventListener('touchend', () => (pinch = 0), { passive: true });

  return { pause, settings, map, closeAll };
}
