// Shared placeholder for screens other agents have not built yet. Delete usages as screens are implemented.
import { Card } from '../components';

export default function Placeholder({ name, blurb }: { name: string; blurb: string }) {
  return (
    <Card title={name}>
      <p className="muted">{blurb}</p>
      <p className="muted">Placeholder screen: replace <code>ui/screens/{name.replace(/\W/g, '')}.tsx</code>.</p>
    </Card>
  );
}
