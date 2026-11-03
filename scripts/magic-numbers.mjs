// Lists numeric literals in engine/*.ts outside comments/strings that are not structural (unit conversions, indices).
// Used by tests/no-magic-numbers.test.ts.
import fs from 'node:fs';
import path from 'node:path';
export const ALLOWED = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '10', '12', '14', '20', '28', '30', '40', '50', '60', '100', '1000', '3600', '365', '365.25', '0.5', '24', '1e-9', '1e-6', '1e-4', '1e-5', '0.1', '0.05', '9999', '200', '15', '1.75', '75', '25', '35', '80', '0.995', '0.99', '1.5', '180']);
// 1.5 / 0.5 appear as RIR rounding thresholds and clamp caps; 180 converts degrees to radians.
export function scan(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = src.split('\n');
    let inBlock = false;
    lines.forEach((line, i) => {
      let l = line;
      if (inBlock) { const e = l.indexOf('*/'); if (e < 0) return; l = l.slice(e + 2); inBlock = false; }
      l = l.replace(/\/\*.*?\*\//g, '');
      const b = l.indexOf('/*'); if (b >= 0) { inBlock = true; l = l.slice(0, b); }
      const c = l.indexOf('//'); if (c >= 0) l = l.slice(0, c);
      l = l.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
      for (const m of l.matchAll(/(?<![\w.])(\d+\.?\d*(?:e-?\d+)?)(?![\w])/g)) {
        if (!ALLOWED.has(m[1])) out.push(`${f}:${i + 1}: ${m[1]}  | ${line.trim().slice(0, 110)}`);
      }
    });
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('magic-numbers.mjs')) {
  const r = scan(process.argv[2] ?? 'engine');
  console.log(r.join('\n'));
  console.log(r.length, 'literals');
}
