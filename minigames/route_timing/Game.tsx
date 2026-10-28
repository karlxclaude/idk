import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { GRID, carPos, createGame, isRed, isRoad, score, step, type Dir, type GameState } from './logic';

const SIZE = 450; // logical canvas px
const CELL = SIZE / GRID;
const DEFAULT_DURATION = 55;
const MAX_FRAME_DT = 0.1;
const TAP_HOLD_MS = 900;

const KEYS: Record<string, Dir> = {
  ArrowUp: { dx: 0, dy: -1 }, w: { dx: 0, dy: -1 }, W: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 }, s: { dx: 0, dy: 1 }, S: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 }, a: { dx: -1, dy: 0 }, A: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 }, d: { dx: 1, dy: 0 }, D: { dx: 1, dy: 0 },
};

function draw(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      ctx.fillStyle = isRoad(x, y) ? '#3b3f46' : '#7d6b5a';
      ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
    }
  }
  for (const l of s.lights) {
    const h = !isRed(s, l.x, l.y, true, s.t);
    ctx.fillStyle = '#111';
    ctx.fillRect(l.x * CELL, l.y * CELL, CELL - 1, CELL - 1);
    ctx.fillStyle = h ? '#3ddc84' : '#ff5252'; // horizontal bar colour
    ctx.fillRect(l.x * CELL + 3, l.y * CELL + CELL / 2 - 4, CELL - 7, 8);
    ctx.fillStyle = h ? '#ff5252' : '#3ddc84'; // vertical bar colour
    ctx.fillRect(l.x * CELL + CELL / 2 - 4, l.y * CELL + 3, 8, CELL - 7);
  }
  for (const c of s.cars) {
    const p = carPos(c, s.t);
    ctx.fillStyle = '#4aa3ff';
    ctx.fillRect(p.x * CELL + 8, p.y * CELL + 12, CELL - 17, CELL - 24);
  }
  const o = s.order;
  if (o) {
    const t = o.picked ? o.drop : o.pickup;
    ctx.fillStyle = o.picked ? '#ffd23f' : '#ff9f1c';
    ctx.beginPath();
    ctx.arc(t.x * CELL + CELL / 2, t.y * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(o.picked ? 'D' : 'P', t.x * CELL + CELL / 2, t.y * CELL + CELL / 2 + 6);
  }
  const m = s.move;
  const px = m ? m.from.x + (m.to.x - m.from.x) * Math.min(1, m.prog) : s.player.x;
  const py = m ? m.from.y + (m.to.y - m.from.y) * Math.min(1, m.prog) : s.player.y;
  ctx.fillStyle = s.stall > 0 ? '#ff7043' : '#ffffff';
  ctx.beginPath();
  ctx.arc(px * CELL + CELL / 2, py * CELL + CELL / 2, CELL / 4, 0, Math.PI * 2);
  ctx.fill();
}

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGame(seed, difficulty, durationSec ?? DEFAULT_DURATION));
  const held = useRef<Dir[]>([]);
  const tap = useRef<(Dir & { until: number }) | null>(null);
  const finished = useRef(false);
  const finishCb = useRef(onFinish);
  finishCb.current = onFinish;
  const [hud, setHud] = useState({ left: durationSec ?? DEFAULT_DURATION, score: 0, orderLeft: 0, delivered: 0, note: '' });

  useEffect(() => {
    stateRef.current = createGame(seed, difficulty, durationSec ?? DEFAULT_DURATION);
    finished.current = false;
    held.current = [];
    tap.current = null;
  }, [seed, difficulty, durationSec]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (!d) return;
      e.preventDefault();
      held.current = [...held.current.filter((h) => h !== d), d];
    };
    const up = (e: KeyboardEvent) => {
      const d = KEYS[e.key];
      if (d) held.current = held.current.filter((h) => h !== d);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const frame = (now: number) => {
      const s = stateRef.current;
      const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
      last = now;
      const dir = tap.current ?? held.current[held.current.length - 1] ?? null;
      const before = s.moves;
      step(s, dt, dir);
      if (tap.current && (s.moves !== before || now > tap.current.until)) tap.current = null;
      if (ctx) draw(ctx, s);
      if (now - hudAt > 100 || s.done) {
        hudAt = now;
        const o = s.order;
        setHud({
          left: Math.max(0, s.duration - s.t), score: score(s), delivered: s.delivered,
          orderLeft: o ? Math.max(0, o.allowed - (s.t - o.startT)) : 0, note: s.stall > 0 ? s.stallReason : '',
        });
      }
      if (s.done && !finished.current) {
        finished.current = true;
        finishCb.current(score(s));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seed, difficulty, durationSec]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - r.left) / r.width) * GRID);
    const cy = Math.floor(((e.clientY - r.top) / r.height) * GRID);
    const p = stateRef.current.player;
    const ddx = cx - p.x, ddy = cy - p.y;
    if (ddx === 0 && ddy === 0) return;
    const until = performance.now() + TAP_HOLD_MS;
    tap.current = Math.abs(ddx) >= Math.abs(ddy) ? { dx: Math.sign(ddx), dy: 0, until } : { dx: 0, dy: Math.sign(ddy), until };
  };

  const o = stateRef.current.order;
  const pad = (label: string, d: Dir) => (
    <button
      key={label}
      className="mg-route_timing-pad"
      onPointerDown={() => { tap.current = { ...d, until: performance.now() + TAP_HOLD_MS }; }}
      aria-label={label}
    >{label}</button>
  );
  return (
    <div className="mg-route_timing-root" style={{ maxWidth: 480, margin: '0 auto', color: '#eee', fontFamily: 'sans-serif', userSelect: 'none' }}>
      <style>{`
        .mg-route_timing-pad{width:56px;height:44px;font-size:20px;border-radius:8px;border:1px solid #666;background:#2a2d33;color:#eee;touch-action:manipulation}
        .mg-route_timing-bar{height:6px;background:#333;border-radius:3px;overflow:hidden}
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 2px' }}>
        <span>Time {hud.left.toFixed(0)}s</span>
        <span>Delivered {hud.delivered}</span>
        <span>Score {(hud.score * 100).toFixed(0)}%</span>
      </div>
      <div className="mg-route_timing-bar">
        <div style={{ height: '100%', width: `${o ? Math.min(100, (hud.orderLeft / o.allowed) * 100) : 0}%`, background: hud.orderLeft < 4 ? '#ff5252' : '#3ddc84' }} />
      </div>
      <div style={{ fontSize: 13, padding: '4px 2px', minHeight: 20 }}>
        {hud.note || (o?.picked ? 'Deliver to the yellow D' : 'Pick up at the orange P')}
      </div>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} onPointerDown={onPointer} style={{ width: '100%', aspectRatio: '1', touchAction: 'none', borderRadius: 8, background: '#222' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 6, justifyContent: 'center', marginTop: 8 }}>
        <span />{pad('↑', { dx: 0, dy: -1 })}<span />
        {pad('←', { dx: -1, dy: 0 })}{pad('↓', { dx: 0, dy: 1 })}{pad('→', { dx: 1, dy: 0 })}
      </div>
      <div style={{ fontSize: 11, opacity: 0.7, textAlign: 'center', marginTop: 6 }}>
        Arrows/WASD or tap a cell. Lights: bar colour shows who may go.
      </div>
    </div>
  );
}
