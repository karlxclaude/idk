// Settings. DECISION: "accelerated" is a property of a game (it changes the physiology constants of its SimContext), so
// toggling it never changes a running game. It seeds NEW games only; the running game's own mode is shown read-only.
import { useState } from 'react';
import { Badge, Card, Modal, Tabs } from '../components';
import { useActions, useGame, useSettings, type ThemeSetting } from '../store';
import type { Units } from '../units';

const THEMES = [{ id: 'system', label: 'System' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }] as const;
const UNIT_TABS = [{ id: 'kg', label: 'Kilograms' }, { id: 'lb', label: 'Pounds' }] as const;

export default function Settings() {
  const settings = useSettings();
  const game = useGame();
  const { setSettings, setScreen } = useActions();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <h2>Settings</h2>
      <div className="grid">
        <Card title="Units">
          <Tabs<Units> tabs={UNIT_TABS} value={settings.units} onChange={(units) => setSettings({ units })} />
          <p className="muted">The simulation is metric; this only changes how masses and loads are displayed.</p>
        </Card>

        <Card title="Theme">
          <Tabs<ThemeSetting> tabs={THEMES} value={settings.theme} onChange={(theme) => setSettings({ theme })} />
        </Card>

        <Card title="Accelerated mode" actions={<Badge tone="bad">UNREALISTIC</Badge>}>
          <p><strong className="danger-text">UNREALISTIC:</strong> accelerated mode multiplies muscle, strength and aerobic adaptation rates so progress is fast. Results do not reflect real timescales.</p>
          <label className="check">
            <input type="checkbox" checked={settings.accelerated} onChange={(e) => (e.target.checked ? setConfirm(true) : setSettings({ accelerated: false }))} />
            Use accelerated mode for new games
          </label>
          <p className="muted">
            Applies to <strong>new games only</strong>; a running game keeps the mode it started with{game ? ` (this game: ${game.settings.accelerated ? 'accelerated' : 'realistic'})` : ''}.
          </p>
          <button onClick={() => setScreen('newGame')}>Start a new game</button>
        </Card>

        <Card title="This game">
          {game ? (
            <dl className="kv">
              <dt>Seed</dt><dd><code>{game.seed}</code></dd>
              <dt>Mode</dt><dd>{game.settings.accelerated ? 'Accelerated (UNREALISTIC)' : 'Realistic'}</dd>
              <dt>Day</dt><dd>{game.character.day}</dd>
            </dl>
          ) : <p className="muted">No active game.</p>}
        </Card>
      </div>

      <p className="muted disclaimer">This is a game, not medical or nutrition advice.</p>

      <Modal open={confirm} title="Enable accelerated mode?" onClose={() => setConfirm(false)}
        footer={<>
          <button onClick={() => setConfirm(false)}>Cancel</button>
          <button className="primary" onClick={() => { setSettings({ accelerated: true }); setConfirm(false); }}>Enable for new games</button>
        </>}>
        <p><strong className="danger-text">UNREALISTIC.</strong> Adaptation runs several times faster than real physiology. It affects only games you start from now on.</p>
      </Modal>
    </>
  );
}
