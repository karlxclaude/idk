import { it } from 'vitest';
import { createGame, presetPlans, runOutcome, DEFAULT_CHOICE } from '../minigames/client_programming/logic';
it('explore', () => {
  const t = Date.now();
  for (let i = 0; i < 16; i++) {
    const g = createGame('s' + i, 1);
    const o = presetPlans(g.client.goal).map((p) => runOutcome(g.client, g.seed, p).toFixed(4));
    const d = runOutcome(g.client, g.seed, DEFAULT_CHOICE);
    console.log(g.client.goal, g.client.sex, g.client.liftingYears, g.client.bodyFat.toFixed(2), o.join(' '), 'def', d.toFixed(4));
  }
  console.log('ms', Date.now() - t);
}, 100000);
