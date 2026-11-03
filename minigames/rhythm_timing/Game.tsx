import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { LANES, LANE_KEYS, LANE_NAMES, breakdown, createGame, isDone, score, step, type Game as GameState } from './logic';

const DEFAULT_DURATION_SEC = 50;
const LOOKAHEAD_SEC = 2.2;
const MAX_W = 480;
const H = 520;
const HIT_Y = H - 90;
const TOP_Y = 56;
const MAX_DT = 0.05;
const FEEDBACK_SEC = 0.6;
const LANE_COLORS = ['#e8743b', '#f2c14e', '#6fcf97', '#56a8e8'];
const DISH_COLORS = ['#ffffff', '#ffd6a5', '#bde0fe', '#caffbf', '#ffc6ff'];

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const gameRef = useRef<GameState>(createGame(seed, difficulty, durationSec ?? DEFAULT_DURATION_SEC));
  const pressesRef = useRef<number[]>([]);
  const flashRef = useRef<number[]>(new Array<number>(LANES).fill(-1));
  const [hud, setHud] = useState({ left: durationSec ?? DEFAULT_DURATION_SEC, score: 0, served: 0, total: 0 });

  useEffect(() => {
    gameRef.current = createGame(seed, difficulty, durationSec ?? DEFAULT_DURATION_SEC);
    pressesRef.current = [];
    let raf = 0;
    let last = performance.now();
    let finished = false;
    let hudAt = 0;

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const lane = LANE_KEYS.indexOf(e.key.toLowerCase() as (typeof LANE_KEYS)[number]);
      if (lane >= 0) {
        e.preventDefault();
        pressesRef.current.push(lane);
      }
    };
    window.addEventListener('keydown', onKey);

    const draw = (g: GameState) => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const w = Math.min(MAX_W, wrap.clientWidth || MAX_W);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(H * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${H}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#1c1a1a';
      ctx.fillRect(0, 0, w, H);
      const laneW = w / LANES;
      const yOf = (time: number) => HIT_Y - ((time - g.t) / LOOKAHEAD_SEC) * (HIT_Y - TOP_Y);
      const winPx = (g.window / LOOKAHEAD_SEC) * (HIT_Y - TOP_Y);
      ctx.textAlign = 'center';
      for (let l = 0; l < LANES; l++) {
        const x = l * laneW;
        const flash = g.t - flashRef.current[l]!;
        ctx.fillStyle = l % 2 ? '#262323' : '#2d2a2a';
        ctx.fillRect(x, 0, laneW, H);
        if (flash >= 0 && flash < 0.15) {
          ctx.fillStyle = `${LANE_COLORS[l]}55`;
          ctx.fillRect(x, TOP_Y, laneW, HIT_Y - TOP_Y + 40);
        }
        ctx.fillStyle = `${LANE_COLORS[l]}33`;
        ctx.fillRect(x + 4, HIT_Y - winPx, laneW - 8, winPx * 2);
        ctx.fillStyle = LANE_COLORS[l]!;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillText(LANE_NAMES[l]!, x + laneW / 2, HIT_Y + 44);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillText(LANE_KEYS[l]!.toUpperCase(), x + laneW / 2, HIT_Y + 64);
      }
      ctx.fillStyle = '#ffffffcc';
      ctx.fillRect(0, HIT_Y - 1, w, 2);
      for (const n of g.notes) {
        const y = yOf(n.time);
        if (y < TOP_Y - 20 || y > H) continue;
        if (n.state === 'hit') continue;
        const cx = n.lane * laneW + laneW / 2;
        ctx.globalAlpha = n.state === 'miss' ? 0.3 : 1;
        ctx.fillStyle = LANE_COLORS[n.lane]!;
        ctx.beginPath();
        ctx.roundRect(cx - laneW / 2 + 8, y - 13, laneW - 16, 26, 8);
        ctx.fill();
        ctx.strokeStyle = DISH_COLORS[n.dish % DISH_COLORS.length]!;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#1c1a1a';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(`#${n.dish + 1}`, cx, y + 4);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#1c1a1a';
      ctx.fillRect(0, 0, w, TOP_Y - 4);
      const fb = g.lastFeedback;
      if (fb && g.t - fb.at < FEEDBACK_SEC) {
        ctx.globalAlpha = 1 - (g.t - fb.at) / FEEDBACK_SEC;
        ctx.fillStyle = fb.good ? '#6fcf97' : '#ff7b72';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(fb.label, fb.lane * laneW + laneW / 2, HIT_Y - 26);
        ctx.globalAlpha = 1;
      }
    };

    const frame = (now: number) => {
      const g = gameRef.current;
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      const presses = pressesRef.current.splice(0);
      for (const p of presses) flashRef.current[p] = g.t;
      step(g, dt, { presses });
      draw(g);
      if (now - hudAt > 120 || isDone(g)) {
        hudAt = now;
        const b = breakdown(g);
        setHud({ left: Math.max(0, g.durationSec - g.t), score: score(g), served: b.dishesServed, total: b.dishesTotal });
      }
      if (isDone(g) && !finished) {
        finished = true;
        finishRef.current(score(g));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [seed, difficulty, durationSec]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const lane = Math.min(LANES - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * LANES)));
    pressesRef.current.push(lane);
  };

  return (
    <div ref={wrapRef} className="mg-rhythm_timing-root" style={{ width: '100%', maxWidth: MAX_W, margin: '0 auto', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 4px', fontSize: 14 }}>
        <span>Time {hud.left.toFixed(0)}s</span>
        <span>Served {hud.served}/{hud.total}</span>
        <span>Score {(hud.score * 100).toFixed(0)}</span>
      </div>
      <canvas ref={canvasRef} onPointerDown={onPointerDown} style={{ display: 'block', touchAction: 'none', borderRadius: 8, userSelect: 'none' }} />
      <div style={{ fontSize: 12, opacity: 0.7, padding: '6px 4px' }}>Press D F J K (or tap a lane) as each action reaches the line. Early undercooks, late burns.</div>
    </div>
  );
}
