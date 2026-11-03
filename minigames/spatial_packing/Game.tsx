import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { TOTE_H, TOTE_W, act, createGame, fits, frontItem, score, step } from './logic';
import type { PackAction, PackState } from './logic';

// Canvas layout in logical pixels (scaled to the container by CSS).
const CELL = 48;
const W = 360;
const TOTE_X = (W - TOTE_W * CELL) / 2;
const TOTE_Y = 12;
const QUEUE_Y = TOTE_Y + TOTE_H * CELL + 24;
const H = QUEUE_Y + 84;
const MINI = 14;
const PALETTE = ['#5aa9e6', '#7fc8a9', '#f2c14e', '#b79ced', '#f4a259', '#8fd3f4'];

const KEYS: Record<string, PackAction> = {
  ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down',
  q: 'rotate', e: 'rotate', r: 'rotate', ' ': 'place', Enter: 'place', x: 'reject', Backspace: 'reject', c: 'seal',
};

const css = `
.mg-spatial_packing-root{font-family:system-ui,sans-serif;color:#e8eef5;background:#14202b;border-radius:10px;padding:10px;max-width:420px;margin:0 auto;user-select:none;touch-action:manipulation}
.mg-spatial_packing-hud{display:flex;justify-content:space-between;font-size:15px;margin-bottom:6px}
.mg-spatial_packing-canvas{width:100%;display:block;border-radius:8px;background:#1c2b39;touch-action:none}
.mg-spatial_packing-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.mg-spatial_packing-btns button{padding:11px 0;font-size:15px;border:0;border-radius:8px;background:#2d4256;color:#e8eef5;cursor:pointer}
.mg-spatial_packing-btns button:active{background:#44627f}
.mg-spatial_packing-btns .mg-spatial_packing-go{background:#2f8f6b}
.mg-spatial_packing-btns .mg-spatial_packing-no{background:#a8473f}
.mg-spatial_packing-hint{font-size:12px;opacity:.7;margin-top:6px;line-height:1.35}
`;

function drawCells(ctx: CanvasRenderingContext2D, cells: readonly (readonly [number, number])[], ox: number, oy: number, size: number, fill: string, stroke = '#0e1720') {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  for (const [cx, cy] of cells) {
    ctx.fillRect(ox + cx * size, oy + cy * size, size, size);
    ctx.strokeRect(ox + cx * size + 1, oy + cy * size + 1, size - 2, size - 2);
  }
}

function draw(ctx: CanvasRenderingContext2D, s: PackState): void {
  ctx.clearRect(0, 0, W, H);
  // tote
  ctx.fillStyle = '#0e1720';
  ctx.fillRect(TOTE_X - 4, TOTE_Y - 4, TOTE_W * CELL + 8, TOTE_H * CELL + 8);
  for (let y = 0; y < TOTE_H; y++) {
    for (let x = 0; x < TOTE_W; x++) {
      const id = s.grid[y]?.[x] ?? 0;
      ctx.fillStyle = id ? (PALETTE[id % PALETTE.length] ?? '#888') : (x + y) % 2 ? '#22364a' : '#1f3143';
      ctx.fillRect(TOTE_X + x * CELL, TOTE_Y + y * CELL, CELL, CELL);
      if (id) {
        ctx.strokeStyle = '#0e1720';
        ctx.lineWidth = 2;
        ctx.strokeRect(TOTE_X + x * CELL + 1, TOTE_Y + y * CELL + 1, CELL - 2, CELL - 2);
      }
    }
  }
  const item = frontItem(s);
  if (item && s.piece && !s.finished) {
    const ok = item.distractor || fits(s.grid, s.piece.cells, s.piece.x, s.piece.y);
    ctx.globalAlpha = 0.8;
    drawCells(ctx, s.piece.cells, TOTE_X + s.piece.x * CELL, TOTE_Y + s.piece.y * CELL, CELL,
      item.distractor ? '#d9534f' : ok ? (PALETTE[item.id % PALETTE.length] ?? '#888') : '#8a8f94');
    ctx.globalAlpha = 1;
    if (item.distractor) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('NOT ON ORDER - reject (X)', W / 2, TOTE_Y + TOTE_H * CELL + 18);
    }
  }
  // upcoming queue
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '12px system-ui';
  ctx.textAlign = 'left';
  if (!(item && item.distractor)) ctx.fillText('Next:', TOTE_X, QUEUE_Y - 4 + 20);
  let qx = TOTE_X + 40;
  for (let i = 1; i <= 5; i++) {
    const it = s.queue[s.index + i];
    if (!it) break;
    const w = Math.max(...it.cells.map((c) => c[0])) + 1;
    drawCells(ctx, it.cells, qx, QUEUE_Y + 12, MINI, it.distractor ? '#d9534f' : (PALETTE[it.id % PALETTE.length] ?? '#888'));
    qx += w * MINI + 14;
  }
}

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps): JSX.Element {
  const stateRef = useRef<PackState>(createGame(seed, difficulty, durationSec));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);
  const [hud, setHud] = useState({ t: stateRef.current.timeLeft, sc: 0, packed: 0, wrong: 0 });

  const press = (a: PackAction) => { act(stateRef.current, a); };

  useEffect(() => {
    stateRef.current = createGame(seed, difficulty, durationSec);
    doneRef.current = false;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = stateRef.current;
      step(s, Math.min(0.1, (now - last) / 1000));
      last = now;
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) draw(ctx, s);
      setHud({ t: s.timeLeft, sc: score(s), packed: s.packed, wrong: s.wrong });
      if (s.finished && !doneRef.current) {
        doneRef.current = true;
        onFinish(score(s));
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => {
      const a = KEYS[e.key] ?? KEYS[e.key.toLowerCase()];
      if (!a) return;
      e.preventDefault();
      act(stateRef.current, a);
    };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, difficulty, durationSec]);

  const moveToPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const c = canvasRef.current;
    if (!c || !s.piece || s.finished) return;
    const r = c.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    const w = Math.max(...s.piece.cells.map((q) => q[0])) + 1;
    const h = Math.max(...s.piece.cells.map((q) => q[1])) + 1;
    const gx = Math.round((px - TOTE_X) / CELL - w / 2);
    const gy = Math.round((py - TOTE_Y) / CELL - h / 2);
    s.piece.x = Math.max(0, Math.min(TOTE_W - w, gx));
    s.piece.y = Math.max(0, Math.min(TOTE_H - h, gy));
  };

  const mm = Math.floor(hud.t / 60);
  const ss = String(Math.ceil(hud.t % 60)).padStart(2, '0');
  const btn = (label: string, a: PackAction, cls = '') => (
    <button key={a} className={cls} onClick={() => press(a)}>{label}</button>
  );

  return (
    <div className="mg-spatial_packing-root">
      <style>{css}</style>
      <div className="mg-spatial_packing-hud">
        <span>Time {mm}:{ss}</span>
        <span>Packed {hud.packed}</span>
        <span>Wrong {hud.wrong}</span>
        <span>Score {Math.round(hud.sc * 100)}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="mg-spatial_packing-canvas"
        width={W}
        height={H}
        onPointerMove={(e) => { if (e.pointerType === 'mouse') moveToPointer(e); }}
        onPointerDown={(e) => {
          moveToPointer(e);
          if (e.pointerType === 'mouse' && e.button === 0) press('place');
          else if (e.pointerType === 'mouse' && e.button === 2) press('rotate');
        }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={() => press('rotate')}
      />
      <div className="mg-spatial_packing-btns">
        {btn('Left', 'left')}{btn('Up', 'up')}{btn('Down', 'down')}{btn('Right', 'right')}
        {btn('Rotate', 'rotate')}{btn('Place', 'place', 'mg-spatial_packing-go')}
        {btn('Reject', 'reject', 'mg-spatial_packing-no')}{btn('Seal tote', 'seal')}
      </div>
      <div className="mg-spatial_packing-hint">
        Pack blue/green boxes tightly. Red boxes are not on the order: reject them. Keys: arrows/WASD move, Q/E/R rotate,
        Space place, X reject, C seal tote. Mouse: move, click place, right-click or wheel rotate. Touch: tap to aim, then Place.
      </div>
    </div>
  );
}
