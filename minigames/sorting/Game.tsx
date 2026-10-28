import { useCallback, useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { TODAY, act, categoryLook, createGame, isOver, score, step, type Action, type GameState } from './logic';

const DEFAULT_DURATION = 50;
const W = 360;
const H = 400;
const BELT_Y = 70;
const SHELF_Y = 190;

const dateLabel = (day: number) => { const d = new Date(2026, 0, day); return `${d.getMonth() + 1}/${d.getDate()}`; };

const CSS = `
.mg-sorting-root{max-width:420px;margin:0 auto;font-family:system-ui,sans-serif;color:#e8ecf4;user-select:none;touch-action:manipulation}
.mg-sorting-hud{display:flex;justify-content:space-between;font-size:15px;padding:4px 6px;font-variant-numeric:tabular-nums}
.mg-sorting-canvas{width:100%;aspect-ratio:${W}/${H};display:block;background:#1b2130;border-radius:10px}
.mg-sorting-btns{display:grid;gap:6px;margin-top:8px}
.mg-sorting-shelf{display:flex;flex-direction:column;gap:4px}
.mg-sorting-shelf button,.mg-sorting-bin{border:0;border-radius:8px;color:#fff;font-size:13px;padding:10px 2px;min-height:44px;cursor:pointer}
.mg-sorting-bin{grid-column:1/-1;background:#7a2b2b;font-weight:600}
.mg-sorting-help{font-size:12px;opacity:.7;text-align:center;margin-top:6px}
`;

function draw(ctx: CanvasRenderingContext2D, s: GameState, flash: number) {
  const { difficulty: d, params } = s;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#2a3144';
  ctx.fillRect(0, BELT_Y, W, 56);
  ctx.fillStyle = '#e8ecf4';
  ctx.font = '11px system-ui';
  ctx.fillText(`TODAY ${dateLabel(TODAY)}  (older than shelf front -> FRONT)`, 6, 16);
  // shelves
  const sw = W / params.cats;
  for (let i = 0; i < params.cats; i++) {
    const look = categoryLook(d, i, params.cats);
    ctx.fillStyle = `hsl(${look.hue} 45% 28%)`;
    ctx.fillRect(i * sw + 3, SHELF_Y, sw - 6, 190);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px system-ui';
    ctx.fillText(`${i + 1} ${look.icon} ${look.name}`, i * sw + sw / 2, SHELF_Y + 18);
    const stock = s.shelves[i] ?? [];
    ctx.font = '12px system-ui';
    stock.forEach((e, k) => {
      ctx.fillStyle = k === 0 ? `hsl(${look.hue} 70% 65%)` : `hsl(${look.hue} 40% 45%)`;
      ctx.fillRect(i * sw + 10, SHELF_Y + 30 + k * 25, sw - 20, 21);
      ctx.fillStyle = '#10141d';
      ctx.fillText(k === 0 ? `> ${dateLabel(e)}` : dateLabel(e), i * sw + sw / 2, SHELF_Y + 45 + k * 25);
    });
  }
  // belt items: lead item is the one at the right end
  ctx.textAlign = 'center';
  s.belt.forEach((p, idx) => {
    const frac = (s.time - p.t) / params.travel;
    const x = 20 + frac * (W - 60);
    const look = categoryLook(d, p.cat, params.cats);
    ctx.fillStyle = `hsl(${look.hue} 65% 55%)`;
    ctx.fillRect(x - 22, BELT_Y + 4, 52, 48);
    if (idx === 0) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 22, BELT_Y + 4, 52, 48);
    }
    ctx.fillStyle = '#10141d';
    ctx.font = '18px system-ui';
    ctx.fillText(look.icon, x + 4, BELT_Y + 26);
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(dateLabel(p.expiry), x + 4, BELT_Y + 45);
  });
  // feedback
  if (flash > 0 && s.lastResult) {
    ctx.fillStyle = s.lastResult === 'ok' ? '#4caf50' : '#e53935';
    ctx.globalAlpha = Math.min(1, flash);
    ctx.font = 'bold 22px system-ui';
    ctx.fillText(s.lastResult === 'ok' ? 'OK' : s.lastResult === 'bad' ? 'WRONG' : 'MISSED', W / 2, 160);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const duration = durationSec ?? DEFAULT_DURATION;
  const stateRef = useRef<GameState>(createGame(seed, difficulty, duration));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Action[]>([]);
  const finished = useRef(false);
  const flash = useRef(0);
  const [hud, setHud] = useState({ left: duration, score: 0 });
  const cats = stateRef.current.params.cats;

  const send = useCallback((a: Action) => { queue.current.push(a); }, []);

  useEffect(() => {
    stateRef.current = createGame(seed, difficulty, duration);
    finished.current = false;
    const onKey = (e: KeyboardEvent) => {
      const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : NaN;
      if (n >= 1 && n <= cats) { send({ kind: 'shelf', shelf: n - 1, front: e.shiftKey }); e.preventDefault(); }
      else if (e.code === 'Space' || e.code === 'KeyB' || e.code === 'Digit0') { send({ kind: 'bin' }); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const before = s.handled + s.missed;
      const acts = queue.current.splice(0);
      step(s, dt, acts);
      if (s.handled + s.missed !== before) flash.current = 1;
      flash.current = Math.max(0, flash.current - dt * 2);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, s, flash.current);
      setHud((h) => {
        const left = Math.ceil(s.duration - s.time);
        const sc = Math.round(score(s) * 100);
        return h.left === left && h.score === sc ? h : { left, score: sc };
      });
      if (isOver(s)) {
        if (!finished.current) { finished.current = true; onFinish(score(s)); }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, difficulty, duration]);

  const s = stateRef.current;
  return (
    <div className="mg-sorting-root">
      <style>{CSS}</style>
      <div className="mg-sorting-hud">
        <span>Time {hud.left}s</span>
        <span>Done {s.handled} / Missed {s.missed}</span>
        <span>Score {hud.score}%</span>
      </div>
      <canvas ref={canvasRef} className="mg-sorting-canvas" width={W} height={H} />
      <div className="mg-sorting-btns" style={{ gridTemplateColumns: `repeat(${cats}, 1fr)` }}>
        {Array.from({ length: cats }, (_, i) => {
          const look = categoryLook(difficulty, i, cats);
          const bg = `hsl(${look.hue} 45% 35%)`;
          return (
            <div key={i} className="mg-sorting-shelf">
              <button style={{ background: bg }} onClick={() => send({ kind: 'shelf', shelf: i, front: true })}>{i + 1} Front</button>
              <button style={{ background: bg }} onClick={() => send({ kind: 'shelf', shelf: i, front: false })}>{i + 1} Back</button>
            </div>
          );
        })}
        <button className="mg-sorting-bin" onClick={() => send({ kind: 'bin' })}>Bin expired (Space)</button>
      </div>
      <div className="mg-sorting-help">Keys 1-{cats}: shelf back. Shift+1-{cats}: shelf front. Space: bin. Highlighted item goes first.</div>
    </div>
  );
}
