// Renders the pending shift's mini-game: instructions -> game -> result. Calls completeShift(perf) exactly once.
import { Suspense, lazy, useMemo, useRef, useState, type ComponentType } from 'react';
import { MINIGAMES } from '../../minigames';
import type { MiniGameProps } from '../../minigames/types';
import { jobDef, miniGameDifficulty } from '../../engine/jobs';
import { Card, EmptyState, Stat } from '../components';
import { ctxOf, useActions, useGame, usePendingShift } from '../store';
import { fmtPct } from '../units';

type Phase = 'intro' | 'playing' | 'done';

export default function MiniGame() {
  const game = useGame();
  const pending = usePendingShift();
  const { completeShift, cancelShift, playShift, setScreen } = useActions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [perf, setPerf] = useState(0);
  const finished = useRef(false);

  const meta = pending ? MINIGAMES[jobDef(pending.jobId).miniGame] : null;
  const Game = useMemo<ComponentType<MiniGameProps> | null>(() => (meta ? lazy(meta.load) : null), [meta]);

  if (phase === 'done') {
    return (
      <Card title="Shift complete">
        <Stat label="Performance" value={fmtPct(perf)} />
        <div className="row"><button className="primary" onClick={() => { setPhase('intro'); finished.current = false; setScreen('dashboard'); }}>Back to dashboard</button></div>
      </Card>
    );
  }

  if (!game || !pending || !meta || !Game) {
    return (
      <EmptyState title="No shift waiting" text="Mini-games open when a shift needs to be played."
        action={<div className="row"><button onClick={() => { if (playShift().ok) setPhase('intro'); else setScreen('dashboard'); }}>Work today's shift</button></div>} />
    );
  }

  const job = jobDef(pending.jobId);
  const difficulty = miniGameDifficulty(ctxOf(game), game.character);
  const seed = `${game.seed}:${job.id}:${pending.day}`;

  if (phase === 'intro') {
    return (
      <Card title={`${job.name}: ${meta.name}`}>
        <p>{meta.instructions}</p>
        <p className="muted">
          Your performance sets today's pay and stress. Playing it once also unlocks auto-resolving this job's shifts.
          Today's difficulty factor: {fmtPct(difficulty)} (sleep debt, low readiness and stress make it harder).
        </p>
        <div className="row">
          <button className="primary" onClick={() => setPhase('playing')}>Start shift</button>
          <button onClick={cancelShift}>Not now</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`${job.name}: ${meta.name}`}>
      <div className="mg-stage">
        <Suspense fallback={<p className="muted">Loading...</p>}>
          <Game
            seed={seed}
            difficulty={difficulty}
            onFinish={(p) => {
              if (finished.current) return;
              finished.current = true;
              setPerf(p);
              setPhase('done');
              completeShift(p);
            }}
          />
        </Suspense>
      </div>
    </Card>
  );
}
