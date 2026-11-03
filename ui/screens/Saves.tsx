import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Card, EmptyState } from '../components';
import { deleteSave, exportSaveBlob, importSave, listSaves, loadSave, saveGame, AUTOSAVE_NAME, type SaveSummary } from '../saves';
import { useActions, useGame } from '../store';

export default function Saves() {
  const game = useGame();
  const { loadGame } = useActions();
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => { listSaves().then(setSaves).catch((e: unknown) => setMsg({ tone: 'bad', text: `Storage unavailable: ${String(e)}` })); }, []);
  useEffect(refresh, [refresh]);

  const run = async (fn: () => Promise<string | void>): Promise<void> => {
    try { const text = await fn(); if (text) setMsg({ tone: 'good', text }); refresh(); } catch (e) { setMsg({ tone: 'bad', text: e instanceof Error ? e.message : String(e) }); }
  };

  const download = (): void => {
    if (!game) return;
    const url = URL.createObjectURL(exportSaveBlob(game));
    const a = document.createElement('a');
    a.href = url;
    a.download = `phenotype-day${game.character.day}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h2>Saves</h2>
      <div className="grid">
        <Card title="Save current game">
          {game ? (
            <form className="row" onSubmit={(e) => { e.preventDefault(); const n = name.trim() || `Day ${game.character.day}`; void run(async () => { await saveGame(n, game); setName(''); return `Saved "${n}"`; }); }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Day ${game.character.day}`} aria-label="Save name" />
              <button className="primary" type="submit">Save</button>
            </form>
          ) : <p className="muted">Start or load a game first.</p>}
          <p className="muted">An "{AUTOSAVE_NAME}" slot is written automatically every 7 in-game days.</p>
        </Card>

        <Card title="Export / import">
          <div className="row">
            <button disabled={!game} onClick={download}>Export JSON</button>
            <button onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void run(async () => { loadGame(importSave(await f.text())); return `Imported ${f.name}`; });
              }} />
          </div>
        </Card>
      </div>

      {msg && <p className={msg.tone === 'good' ? 'ok-text' : 'danger-text'} role="status">{msg.text}</p>}

      <Card title="Saved games">
        {saves.length === 0 ? <EmptyState title="No saves yet" text="Saves live in this browser's storage." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Day</th><th>Saved</th><th /></tr></thead>
              <tbody>
                {saves.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name} {s.name === AUTOSAVE_NAME && <Badge tone="info">auto</Badge>}</td>
                    <td>{s.day}</td>
                    <td>{new Date(s.updatedAt).toLocaleString()}</td>
                    <td className="right">
                      <button onClick={() => void run(async () => { const st = await loadSave(s.id); if (!st) throw new Error('Save not found'); loadGame(st); })}>Load</button>{' '}
                      <button className="danger" onClick={() => void run(async () => { await deleteSave(s.id); })}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
