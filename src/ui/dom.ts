/** Small DOM helpers + shared UI theme (injected once). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

/** Convert plain "10^-5" style strings to superscripts (labels from tiers are usually already formatted). */
export function superscript(n: number | string): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

export function pow10Label(exp: number): string {
  return `10${superscript(Math.round(exp))} m`;
}

export const isTouchDevice = () =>
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

let injected = false;
export function injectTheme() {
  if (injected) return;
  injected = true;
  try {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  } catch {
    /* offline: system fonts */
  }
  const s = document.createElement('style');
  s.id = 'ehx-theme';
  s.textContent = THEME_CSS;
  document.head.appendChild(s);
}

const THEME_CSS = /* css */ `
#ui-root {
  --ehx-font: 'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --ehx-accent: #7ad7ff;
  --ehx-glass: rgba(14, 10, 32, .52);
  --ehx-glass-strong: rgba(10, 6, 24, .78);
  --ehx-edge: rgba(255, 255, 255, .16);
  --ehx-text: #f4f1ff;
  --ehx-dim: rgba(244, 241, 255, .62);
  font-family: var(--ehx-font);
  color: var(--ehx-text);
}
#ui-root * { box-sizing: border-box; }
#ui-root button { font-family: inherit; color: inherit; cursor: pointer; }

.ehx-glass {
  background: var(--ehx-glass);
  border: 1px solid var(--ehx-edge);
  backdrop-filter: blur(14px) saturate(1.4);
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  box-shadow: 0 6px 30px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.14);
}

/* ---------- screens (pause / settings / map) ---------- */
.ehx-screen {
  position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, rgba(20,10,50,.5), rgba(3,1,10,.82));
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  pointer-events: auto; opacity: 0; transition: opacity .25s ease;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}
.ehx-screen.open { display: flex; }
.ehx-screen.vis { opacity: 1; }
.ehx-card {
  width: min(92vw, 420px); max-height: 100%; border-radius: 26px; padding: 26px 24px;
  transform: translateY(14px) scale(.97); transition: transform .35s cubic-bezier(.2,.9,.3,1.2);
  display: flex; flex-direction: column;
}
.vis > .ehx-card { transform: none; }
.ehx-title {
  margin: 0 0 4px; text-align: center; font-weight: 800; font-size: 26px; letter-spacing: .32em; padding-left: .32em;
  text-shadow: 0 0 22px var(--ehx-accent);
}
.ehx-sub { text-align: center; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; color: var(--ehx-dim); margin-bottom: 18px; }
.ehx-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px; margin-top: 10px; padding: 0 18px;
  font-size: 15px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
  border-radius: 16px; border: 1px solid var(--ehx-edge); background: rgba(255,255,255,.07);
  transition: background .15s, box-shadow .15s, transform .1s, border-color .15s;
}
.ehx-btn:hover { background: rgba(255,255,255,.14); border-color: var(--ehx-accent); box-shadow: 0 0 22px -4px var(--ehx-accent); }
.ehx-btn:active { transform: scale(.97); }
.ehx-btn.primary { background: linear-gradient(135deg, color-mix(in srgb, var(--ehx-accent) 55%, transparent), rgba(255,255,255,.08)); border-color: var(--ehx-accent); box-shadow: 0 0 24px -6px var(--ehx-accent); }
.ehx-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.ehx-btn.ghost { background: transparent; opacity: .8; }

/* settings */
.ehx-scroll { overflow-y: auto; overscroll-behavior: contain; margin: 0 -8px; padding: 0 8px; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.ehx-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 48px; border-bottom: 1px solid rgba(255,255,255,.07); font-size: 15px; }
.ehx-row label { flex: 0 0 auto; letter-spacing: .06em; }
.ehx-row .val { width: 38px; text-align: right; font-variant-numeric: tabular-nums; color: var(--ehx-dim); font-size: 13px; }
.ehx-row input[type=range] { flex: 1; min-width: 80px; accent-color: var(--ehx-accent); height: 28px; touch-action: pan-y; }
.ehx-switch { position: relative; width: 50px; height: 28px; flex: 0 0 auto; border-radius: 14px; border: 1px solid var(--ehx-edge); background: rgba(255,255,255,.1); transition: background .2s; padding: 0; }
.ehx-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .2s; }
.ehx-switch[aria-checked=true] { background: var(--ehx-accent); box-shadow: 0 0 14px -2px var(--ehx-accent); }
.ehx-switch[aria-checked=true]::after { transform: translateX(22px); }
.ehx-seg { display: flex; border: 1px solid var(--ehx-edge); border-radius: 12px; overflow: hidden; }
.ehx-seg button { border: 0; background: transparent; padding: 7px 12px; font-size: 13px; letter-spacing: .08em; text-transform: capitalize; }
.ehx-seg button[aria-pressed=true] { background: var(--ehx-accent); color: #07040f; font-weight: 700; }
.ehx-section { margin: 14px 0 2px; font-size: 11px; letter-spacing: .26em; text-transform: uppercase; color: var(--ehx-accent); opacity: .9; }

@media (prefers-reduced-motion: reduce) {
  .ehx-screen, .ehx-card { transition: none; }
}
`;
