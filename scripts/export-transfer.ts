// Exports the generated exercise transfer matrix (sparse: coefficients above transferMin) to docs/transfer-matrix.json.
import { writeFileSync } from 'node:fs';
import { makeContext, transfersFrom } from '../engine/context';

const ctx = makeContext();
const out: Record<string, Record<string, number>> = {};
for (const id of ctx.exercises.keys()) {
  out[id] = Object.fromEntries(transfersFrom(ctx, id).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));
}
writeFileSync('docs/transfer-matrix.json', JSON.stringify(out, null, 1));
console.log(`${ctx.exercises.size} exercises exported`);
