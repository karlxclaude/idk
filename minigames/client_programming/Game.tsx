import { useCallback, useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import {
  BALANCE_RANGE, createGame, describeOutcome, evaluate, lockPlan, setChoice, step,
  type GameState, type Intensity, type PlanChoice, type SetsLevel, type TemplateId,
} from './logic';

const CSS = `
.mg-client_programming-root{font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:12px;box-sizing:border-box;color:#e8e8ee;background:#1b1d26;border-radius:10px}
.mg-client_programming-root h3{margin:0 0 6px;font-size:16px}
.mg-client_programming-bar{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px}
.mg-client_programming-card{background:#252836;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:14px;line-height:1.5}
.mg-client_programming-row{margin:8px 0}
.mg-client_programming-row label{display:block;font-size:12px;opacity:.75;margin-bottom:3px}
.mg-client_programming-opts{display:flex;flex-wrap:wrap;gap:6px}
.mg-client_programming-opt{flex:1 1 auto;min-width:56px;padding:8px 6px;border-radius:6px;border:1px solid #444a66;background:#2d3148;color:inherit;font-size:13px;cursor:pointer}
.mg-client_programming-opt[aria-pressed=true]{background:#4f6bff;border-color:#8da0ff}
.mg-client_programming-root input[type=range]{width:100%}
.mg-client_programming-go{width:100%;padding:12px;margin-top:10px;border:0;border-radius:8px;background:#2fbf71;color:#04110a;font-weight:700;font-size:15px;cursor:pointer}
.mg-client_programming-go:disabled{opacity:.5}
`;

const TEMPLATES: Array<[TemplateId, string]> = [['full_body', 'Full body A/B'], ['strength_focus', 'Strength 5x5'], ['custom_volume', 'Custom sets']];
const SETS: SetsLevel[] = ['low', 'medium', 'high'];
const GOAL_NAME = { strength: 'Get stronger', muscle: 'Build muscle', fat_loss: 'Lose fat', '5k': 'Run a faster 5K' } as const;

function Opts<T extends string | number>({ value, items, onPick }: { value: T; items: Array<[T, string]>; onPick: (v: T) => void }) {
  return (
    <div className="mg-client_programming-opts">
      {items.map(([v, label]) => (
        <button key={String(v)} type="button" className="mg-client_programming-opt" aria-pressed={v === value} onClick={() => onPick(v)}>{label}</button>
      ))}
    </div>
  );
}

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const gameRef = useRef<GameState | null>(null);
  if (gameRef.current === null) gameRef.current = createGame(seed, difficulty, durationSec);
  const g = gameRef.current;
  const [, setTick] = useState(0);
  const [result, setResult] = useState<{ score: number; text: string } | null>(null);
  const finished = useRef(false);
  const redraw = useCallback(() => setTick((t) => t + 1), []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    lockPlan(g);
    const s = evaluate(g);
    setResult({ score: s, text: describeOutcome(g) });
    redraw();
    window.setTimeout(() => onFinish(s), 2500);
  }, [g, onFinish, redraw]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!g.locked) {
        step(g, dt);
        redraw();
      }
      if (g.locked) { finish(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g, finish, redraw]);

  const c = g.choice;
  const edit = (patch: Partial<PlanChoice>) => { setChoice(g, patch); redraw(); };
  const intensityMode = c.intensity.mode;
  const intensityVal = c.intensity.mode === 'rir' ? c.intensity.rir : c.intensity.pct;
  const setIntensity = (i: Intensity) => edit({ intensity: i });
  const f = g.form;

  return (
    <div className="mg-client_programming-root">
      <style>{CSS}</style>
      <div className="mg-client_programming-bar">
        <span>Time {Math.ceil(g.timeLeft)}s</span>
        <span>{result ? `Score ${Math.round(result.score * 100)}%` : 'Build an 8-week plan'}</span>
      </div>
      <div className="mg-client_programming-card">
        <h3>New client: {GOAL_NAME[f.goal]}</h3>
        {f.sex}, {f.ageYears} y<br />
        Body fat: {f.bodyFat === null ? 'not provided' : `~${Math.round(f.bodyFat * 100)}%`}<br />
        Lifting experience: {f.liftingYears === null ? 'not provided' : `~${f.liftingYears} y`}
      </div>
      {result ? (
        <div className="mg-client_programming-card">8 weeks done. {result.text}</div>
      ) : (
        <>
          <div className="mg-client_programming-row"><label>Lifting days per week</label>
            <Opts value={c.days} items={[[2, '2'], [3, '3'], [4, '4'], [5, '5']]} onPick={(v) => edit({ days: v as PlanChoice['days'] })} /></div>
          <div className="mg-client_programming-row"><label>Template</label>
            <Opts value={c.template} items={TEMPLATES} onPick={(v) => edit({ template: v })} /></div>
          {c.template === 'custom_volume' && (
            <div className="mg-client_programming-row"><label>Weekly sets per muscle</label>
              <Opts value={c.sets} items={SETS.map((s): [SetsLevel, string] => [s, s])} onPick={(v) => edit({ sets: v })} /></div>
          )}
          <div className="mg-client_programming-row"><label>Intensity</label>
            <Opts value={intensityMode} items={[['rir', 'RIR'], ['pct', '% of 1RM']]}
              onPick={(m) => setIntensity(m === 'rir' ? { mode: 'rir', rir: 2 } : { mode: 'pct', pct: 75 })} />
            <input type="range" aria-label="intensity" min={intensityMode === 'rir' ? 0 : 60} max={intensityMode === 'rir' ? 4 : 90} step={intensityMode === 'rir' ? 1 : 5}
              value={intensityVal} onChange={(e) => setIntensity(intensityMode === 'rir' ? { mode: 'rir', rir: +e.target.value } : { mode: 'pct', pct: +e.target.value })} />
            <small>{intensityMode === 'rir' ? `${intensityVal} reps in reserve` : `${intensityVal}% of 1RM`}</small></div>
          <div className="mg-client_programming-row"><label>Easy 30 min runs per week</label>
            <Opts value={c.cardio} items={[[0, 'none'], [1, '1'], [2, '2'], [3, '3']]} onPick={(v) => edit({ cardio: v as PlanChoice['cardio'] })} /></div>
          <div className="mg-client_programming-row"><label>Calories vs maintenance</label>
            <input type="range" aria-label="calories" min={BALANCE_RANGE[0]} max={BALANCE_RANGE[1]} step={50} value={c.balanceKcal}
              onChange={(e) => edit({ balanceKcal: +e.target.value })} />
            <small>{c.balanceKcal > 0 ? '+' : ''}{c.balanceKcal} kcal/day</small></div>
          <button type="button" className="mg-client_programming-go" onClick={finish} disabled={g.locked}>Start the 8 weeks</button>
        </>
      )}
    </div>
  );
}
