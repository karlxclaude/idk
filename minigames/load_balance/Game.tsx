import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { DEFAULT_DURATION_SEC, createGame, score, step, type LoadBalanceState } from './logic';

const W = 360;
const H = 300;
const MAX_DT = 0.05;

function draw(ctx: CanvasRenderingContext2D, s: LoadBalanceState): void {
  const p = s.params;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(0, 0, W, H);
  // Scaffold posts + beam
  const beamY = 220;
  ctx.fillStyle = '#3a4756';
  for (let x = 20; x <= W - 20; x += 80) ctx.fillRect(x - 3, beamY, 6, H - beamY);
  ctx.fillStyle = '#c28a3d';
  ctx.fillRect(10, beamY - 6, W - 20, 10);
  // Drop-limit gauge (arc of safe tilt) above the carrier
  const px = 30 + (W - 60) * Math.min(1, s.pos / p.beamLength);
  ctx.save();
  ctx.translate(px, beamY - 6);
  if (s.penalty > 0) {
    ctx.fillStyle = '#e8734a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dropped! Restacking ' + s.penalty.toFixed(1) + 's', 0, -60);
    // scattered boards on the beam
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-30, -6, 24, 5);
    ctx.fillRect(4, -4, 26, 5);
  } else {
    // worker
    ctx.fillStyle = '#e6c15a';
    ctx.fillRect(-6, -34, 12, 28);
    ctx.beginPath();
    ctx.arc(0, -42, 7, 0, Math.PI * 2);
    ctx.fill();
    // stack tilting about the hands (inverted pendulum)
    ctx.translate(0, -34);
    ctx.rotate(s.tilt);
    const danger = Math.abs(s.tilt) / p.dropTilt;
    ctx.fillStyle = danger > 0.75 ? '#e8734a' : danger > 0.45 ? '#e6c15a' : '#7bc47f';
    for (let i = 0; i < 4; i++) ctx.fillRect(-18, -(i + 1) * 12, 36, 10);
  }
  ctx.restore();
  // Tilt meter
  const mx = W / 2;
  ctx.fillStyle = '#2f3b4a';
  ctx.fillRect(mx - 120, 20, 240, 10);
  ctx.fillStyle = '#7a3b2e';
  ctx.fillRect(mx - 120, 20, 20, 10);
  ctx.fillRect(mx + 100, 20, 20, 10);
  const t = Math.max(-1, Math.min(1, s.tilt / p.dropTilt));
  ctx.fillStyle = '#fff';
  ctx.fillRect(mx + t * 118 - 2, 16, 4, 18);
}

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const duration = durationSec ?? DEFAULT_DURATION_SEC;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState({ left: duration, delivered: 0, drops: 0, pct: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const state = createGame(seed, difficulty, duration);
    const keys = { left: false, right: false };
    let drag: number | null = null; // pointer-derived dir
    let finished = false;
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;

    const keyDir = (): number => (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = down;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = down;
      else return;
      e.preventDefault();
    };
    const kd = onKey(true);
    const ku = onKey(false);
    const pointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width; // 0..1 across the canvas; centre = neutral
      drag = Math.max(-1, Math.min(1, (x - 0.5) * 3));
    };
    const pDown = (e: PointerEvent) => { canvas.setPointerCapture(e.pointerId); pointer(e); };
    const pMove = (e: PointerEvent) => { if (drag !== null) pointer(e); };
    const pUp = () => { drag = null; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', pDown);
    canvas.addEventListener('pointermove', pMove);
    canvas.addEventListener('pointerup', pUp);
    canvas.addEventListener('pointercancel', pUp);

    const frame = (now: number) => {
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      const dir = drag !== null ? drag : keyDir();
      step(state, dt, { dir });
      draw(ctx, state);
      if (now - hudAt > 100 || state.done) {
        hudAt = now;
        setHud({ left: Math.max(0, duration - state.time), delivered: state.delivered, drops: state.drops, pct: score(state) });
      }
      if (state.done && !finished) {
        finished = true;
        onFinish(score(state));
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      canvas.removeEventListener('pointerdown', pDown);
      canvas.removeEventListener('pointermove', pMove);
      canvas.removeEventListener('pointerup', pUp);
      canvas.removeEventListener('pointercancel', pUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, difficulty, duration]);

  return (
    <div className="mg-load_balance-root" style={{ width: '100%', maxWidth: 480, margin: '0 auto', color: '#e8edf2', fontFamily: 'sans-serif' }}>
      <style>{`
        .mg-load_balance-hud { display: flex; justify-content: space-between; padding: 6px 8px; font-size: 14px; }
        .mg-load_balance-canvas { width: 100%; height: auto; aspect-ratio: ${W} / ${H}; display: block; touch-action: none; border-radius: 8px; }
        .mg-load_balance-help { padding: 6px 8px; font-size: 12px; opacity: 0.8; }
      `}</style>
      <div className="mg-load_balance-hud">
        <span>Time {hud.left.toFixed(0)}s</span>
        <span>Delivered {hud.delivered}</span>
        <span>Drops {hud.drops}</span>
        <span>Score {(hud.pct * 100).toFixed(0)}%</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="mg-load_balance-canvas" aria-label="Carry the stack across the beam" />
      <div className="mg-load_balance-help">Steer against the lean: Left/Right (or A/D), or hold and drag on the screen. Right of centre pushes right.</div>
    </div>
  );
}
