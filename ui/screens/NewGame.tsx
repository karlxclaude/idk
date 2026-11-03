import { ARCHETYPES } from '../../data/archetypes';
import { Card } from '../components';
import { useActions } from '../store';

// Placeholder: a bare archetype quick-start so the shell is usable. The real screen adds the creator, seed and mode.
export default function NewGame() {
  const { newGame } = useActions();
  return (
    <>
      <h2>New game</h2>
      <p className="muted">Pick a starting character. (Placeholder: the full archetype browser and creator replace this screen.)</p>
      <div className="grid">
        {ARCHETYPES.map((a) => (
          <Card key={a.id} title={a.name} actions={<button className="primary" onClick={() => newGame({ archetypeId: a.id })}>Start</button>}>
            <p className="muted">{a.backstory}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
