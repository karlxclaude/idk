import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { SCREEN_BY_ID, SCREENS, type ScreenId } from './screens';
import { addDays, fmtDate, fmtMoney } from './units';
import { useActions, useGame, useNotice, usePendingShift, useScreen, useSettings } from './store';

/** Autoplay speed. */
const AUTOPLAY_DAYS_PER_SECOND = 4;
const MS_PER_SECOND = 1000;
const FAST_FORWARD = [1, 7, 28] as const;

class ScreenBoundary extends Component<{ children: ReactNode; screen: ScreenId }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error): { error: Error } { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo): void { console.error('screen crashed', error, info.componentStack); }
  override componentDidUpdate(prev: { screen: ScreenId }): void { if (prev.screen !== this.props.screen && this.state.error) this.setState({ error: null }); }
  override render(): ReactNode {
    if (this.state.error) return <div className="card"><h3>Something went wrong on this screen</h3><pre className="muted">{this.state.error.message}</pre></div>;
    return this.props.children;
  }
}

function useTheme(): void {
  const { theme } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme);
  }, [theme]);
}

function useAutoPlay(): void {
  const { autoPlay } = useSettings();
  const { advance } = useActions();
  useEffect(() => {
    if (!autoPlay) return;
    const t = window.setInterval(() => advance(1), MS_PER_SECOND / AUTOPLAY_DAYS_PER_SECOND);
    return () => window.clearInterval(t);
  }, [autoPlay, advance]);
}

function TopBar() {
  const game = useGame();
  const { autoPlay } = useSettings();
  const pending = usePendingShift();
  const notice = useNotice();
  const { advance, setAutoPlay, setScreen, clearNotice } = useActions();
  const canRun = !!game && !pending;
  const date = game ? addDays(game.character.startDate, game.character.day) : null;
  return (
    <header className="topbar">
      <div className="brand">PHENOTYPE</div>
      {game && date && (
        <div className="topinfo">
          <span title={date}>{fmtDate(date)}</span>
          <span className="sep">&middot;</span>
          <span>Day {game.character.day}</span>
          <span className="sep">&middot;</span>
          <span className={game.ledger.cash < 0 ? 'danger-text' : ''} title="Cash">{fmtMoney(game.ledger.cash)}</span>
          {game.settings.accelerated && <span className="badge badge-bad" title="Accelerated mode is UNREALISTIC">ACCEL</span>}
        </div>
      )}
      <div className="ff" role="group" aria-label="Fast forward">
        {FAST_FORWARD.map((n) => <button key={n} disabled={!canRun} onClick={() => advance(n)}>+{n}<span className="hide-sm">{n === 1 ? ' day' : ' days'}</span></button>)}
        <button disabled={!canRun} aria-pressed={autoPlay} className={autoPlay ? 'primary' : ''} onClick={() => setAutoPlay(!autoPlay)} title="Auto-play about 4 days per second; stops on injuries and important events">
          {autoPlay ? '❚❚ Pause' : '▶ Auto'}
        </button>
        <button aria-label="Settings" title="Settings" onClick={() => setScreen('settings')}>{'⚙'}</button>
      </div>
      {notice && <div className="notice" role="status"><span>{notice}</span><button className="link" onClick={clearNotice} aria-label="Dismiss">{'×'}</button></div>}
    </header>
  );
}

export default function App() {
  const game = useGame();
  const screen = useScreen();
  const pending = usePendingShift();
  const { setScreen } = useActions();
  useTheme();
  useAutoPlay();

  const def = SCREEN_BY_ID[screen];
  // Without a game only screens that do not need one are reachable; the rest fall back to the new-game screen.
  const activeId: ScreenId = !game && def.requiresGame ? 'newGame' : screen;
  const Active = SCREEN_BY_ID[activeId].component;
  const items = SCREENS.filter((s) => (s.nav || (s.id === 'minigame' && !!pending)) && (!s.requiresGame || !!game));

  return (
    <div className="app">
      <TopBar />
      <nav className="nav" aria-label="Screens">
        {items.map((s) => (
          <button key={s.id} className={`navitem${s.id === activeId ? ' active' : ''}`} aria-current={s.id === activeId ? 'page' : undefined} onClick={() => setScreen(s.id)}>
            <span className="navicon" aria-hidden="true">{s.icon}</span>
            <span className="navlabel">{s.label}</span>
            {s.id === 'minigame' && <span className="dot" aria-label="shift waiting" />}
          </button>
        ))}
      </nav>
      <main className="main">
        <ScreenBoundary screen={activeId}>
          <Suspense fallback={<p className="muted">Loading...</p>}><Active /></Suspense>
        </ScreenBoundary>
      </main>
    </div>
  );
}
