import { useEffect, useRef, useState } from 'react';
import type { MiniGameProps } from '../types';
import { FIELDS, TA, accuracy, cpm, createGame, currentField, currentRecord, pressKey, score, step, type FieldName, type GameState } from './logic';

const LABEL: Record<FieldName, string> = { name: 'Customer', sku: 'SKU', qty: 'Qty', price: 'Price' };

const CSS = `
.mg-typing_accuracy-root{font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:12px;box-sizing:border-box;color:#e8eaf0}
.mg-typing_accuracy-bar{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px;opacity:.9}
.mg-typing_accuracy-card{background:#1b2030;border-radius:10px;padding:12px;margin-bottom:10px}
.mg-typing_accuracy-row{display:flex;align-items:baseline;gap:8px;padding:6px 8px;border-radius:6px;margin:2px 0;border:1px solid transparent}
.mg-typing_accuracy-row.active{background:#26304a;border-color:#5b8cff}
.mg-typing_accuracy-label{width:70px;font-size:12px;text-transform:uppercase;opacity:.65;flex:none}
.mg-typing_accuracy-text{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;word-break:break-all}
.mg-typing_accuracy-ok{color:#7be495}.mg-typing_accuracy-bad{color:#ff6b6b;text-decoration:underline}.mg-typing_accuracy-rest{opacity:.85}
.mg-typing_accuracy-input{width:100%;box-sizing:border-box;font:inherit;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;padding:12px;border-radius:8px;border:2px solid #5b8cff;background:#0f1320;color:#fff}
.mg-typing_accuracy-hint{font-size:12px;opacity:.65;margin-top:6px}
.mg-typing_accuracy-btn{margin-top:8px;width:100%;padding:12px;font-size:16px;border:0;border-radius:8px;background:#5b8cff;color:#fff}
`;

export default function Game({ seed, difficulty, onFinish, durationSec }: MiniGameProps) {
  const ref = useRef<GameState>();
  if (!ref.current) ref.current = createGame(seed, difficulty, durationSec ?? TA.defaultDurationSec);
  const s = ref.current;
  const [, setTick] = useState(0);
  const finished = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishCb = useRef(onFinish);
  finishCb.current = onFinish;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      step(s, Math.min(0.1, (now - last) / 1000));
      last = now;
      setTick((n) => (n + 1) % 1e9);
      if (s.done) {
        if (!finished.current) {
          finished.current = true;
          finishCb.current(score(s));
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [s]);

  useEffect(() => inputRef.current?.focus(), []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.length > s.buffer.length) for (const ch of v.slice(s.buffer.length)) pressKey(s, ch);
    else for (let i = 0; i < s.buffer.length - v.length; i++) pressKey(s, 'Backspace');
  };
  const commit = () => pressKey(s, 'Enter');
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      commit();
    }
  };

  const rec = currentRecord(s);
  const field = currentField(s);
  const left = Math.max(0, Math.ceil(s.durationSec - s.t));

  return (
    <div className="mg-typing_accuracy-root" onClick={() => inputRef.current?.focus()}>
      <style>{CSS}</style>
      <div className="mg-typing_accuracy-bar">
        <span>Time {left}s</span>
        <span>Acc {Math.round(accuracy(s) * 100)}%</span>
        <span>{Math.round(cpm(s))} cpm</span>
        <span>Score {Math.round(score(s) * 100)}</span>
      </div>
      <div className="mg-typing_accuracy-card">
        <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 4 }}>Invoice #{s.recordIdx + 1}</div>
        {FIELDS.map((f) => {
          const target = rec[f];
          const active = f === field;
          const typed = active ? s.buffer : (s.entries[s.recordIdx]?.[f] ?? '');
          const shown = active || f in (s.entries[s.recordIdx] ?? {});
          return (
            <div key={f} className={`mg-typing_accuracy-row${active ? ' active' : ''}`}>
              <span className="mg-typing_accuracy-label">{LABEL[f]}</span>
              <span className="mg-typing_accuracy-text">
                {[...target].map((c, i) => (
                  <span key={i} className={shown && i < typed.length ? (typed[i] === c ? 'mg-typing_accuracy-ok' : 'mg-typing_accuracy-bad') : 'mg-typing_accuracy-rest'}>
                    {c}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        className="mg-typing_accuracy-input"
        value={s.buffer}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={s.done}
        placeholder={`Type ${LABEL[field]}...`}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-label={`Enter ${LABEL[field]}`}
      />
      <button type="button" className="mg-typing_accuracy-btn" onClick={commit} disabled={s.done}>
        Next field (Enter)
      </button>
      <div className="mg-typing_accuracy-hint">Type the highlighted field exactly, then press Enter. Watch O/0 and l/1. Tired hands drop or lag keys.</div>
    </div>
  );
}
