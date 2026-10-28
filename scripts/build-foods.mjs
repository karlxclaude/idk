// Builds data/foods/foods.generated.json from hand-curated specs (data/foods/spec/*.json) + USDA SR Legacy CSVs.
// Usage: node scripts/build-foods.mjs <path-to-FoodData_Central_sr_legacy_food_csv_2018-04> [--only <spec.json>] [--dry]
//   --only: process a single spec file; --dry: print a per-food summary instead of writing the output file.
// Missing nutrient values are recorded as 0 (SR Legacy omits some vitamin D / leucine values); a few are estimated:
// leucine falls back to 8% of protein when absent.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
if (!dir) throw new Error('usage: build-foods.mjs <sr_legacy_dir>');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const parseCsvLine = (line) => {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
};
const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx > 0 ? path.basename(process.argv[onlyIdx + 1]) : null;
const dry = process.argv.includes('--dry');
const specs = fs.readdirSync(path.join(root, 'data/foods/spec')).filter((f) => f.endsWith('.json') && (!only || f === only))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(root, 'data/foods/spec', f), 'utf8')).map((s) => ({ ...s, _file: f })));
const wanted = new Set(specs.filter((s) => s.fdcId).map((s) => String(s.fdcId)));
const desc = new Map();
for (const line of fs.readFileSync(path.join(dir, 'food.csv'), 'utf8').split('\n').slice(1)) {
  if (!line) continue; const c = parseCsvLine(line); if (wanted.has(c[0])) desc.set(c[0], c[2]);
}
const NUT = { 1008: 'kcal', 1003: 'proteinG', 1004: 'fatG', 1005: 'carbG', 1079: 'fiberG', 1051: 'waterG', 1018: 'alcoholG', 1093: 'sodiumMg', 1092: 'potassiumMg', 1087: 'calciumMg', 1089: 'ironMg', 1090: 'magnesiumMg', 1095: 'zincMg', 1178: 'b12Ug', 1110: 'vitDIU', 1213: 'leucineG', 1272: 'dha', 1278: 'epa', 1404: 'ala' };
const nut = new Map();
const text = fs.readFileSync(path.join(dir, 'food_nutrient.csv'), 'utf8');
let start = text.indexOf('\n') + 1;
while (start < text.length) {
  let end = text.indexOf('\n', start); if (end < 0) end = text.length;
  const line = text.slice(start, end); start = end + 1;
  const c = parseCsvLine(line); const fdc = c[1];
  if (!wanted.has(fdc)) continue; const key = NUT[c[2]]; if (!key) continue;
  if (!nut.has(fdc)) nut.set(fdc, {}); nut.get(fdc)[key] = Number(c[3]);
}
const problems = [];
const ids = new Set();
const out = specs.map((s) => {
  if (ids.has(s.id)) problems.push(`duplicate id ${s.id} (${s._file})`); ids.add(s.id);
  let per;
  if (s.fdcId) {
    const n = nut.get(String(s.fdcId));
    if (!n || !desc.has(String(s.fdcId))) { problems.push(`${s.id}: fdcId ${s.fdcId} not found in SR Legacy`); return null; }
    per = {
      kcal: n.kcal ?? 0, proteinG: n.proteinG ?? 0, fatG: n.fatG ?? 0, carbG: n.carbG ?? 0, fiberG: n.fiberG ?? 0, waterG: n.waterG ?? 0, alcoholG: n.alcoholG ?? 0,
      sodiumMg: n.sodiumMg ?? 0, potassiumMg: n.potassiumMg ?? 0, calciumMg: n.calciumMg ?? 0, ironMg: n.ironMg ?? 0, magnesiumMg: n.magnesiumMg ?? 0, zincMg: n.zincMg ?? 0,
      b12Ug: n.b12Ug ?? 0, vitDIU: n.vitDIU ?? 0, omega3G: (n.dha ?? 0) + (n.epa ?? 0) + (n.ala ?? 0), leucineG: n.leucineG ?? (n.proteinG ?? 0) * 0.08,
    };
  } else {
    if (!s.manualPer100g) { problems.push(`${s.id}: fdcId null requires manualPer100g`); return null; }
    per = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, fiberG: 0, waterG: 0, alcoholG: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 0, b12Ug: 0, vitDIU: 0, omega3G: 0, leucineG: 0, ...s.manualPer100g };
  }
  const { _file, ...spec } = s;
  return { ...spec, usdaDescription: s.fdcId ? desc.get(String(s.fdcId)) : 'manual (not in SR Legacy)', per100g: per, pricePer100g: Math.round((s.priceUsd / s.priceUnitG) * 100 * 10000) / 10000 };
}).filter(Boolean);
const REQUIRED = ['id', 'name', 'group', 'fdcId', 'priceUsd', 'priceUnitG', 'servingG', 'prepMinutes', 'shelfLifeDays', 'satietyIndex', 'satietySource', 'diaas', 'diaasSource', 'hemeFraction', 'readyToEat'];
for (const s of specs) for (const k of REQUIRED) if (!(k in s)) problems.push(`${s.id ?? '?'}: missing field ${k}`);
if (dry) {
  for (const f of out) console.log(`${f.id.padEnd(28)} | ${String(f.fdcId).padEnd(7)} | ${f.usdaDescription.slice(0, 60).padEnd(60)} | ${f.per100g.kcal} kcal ${f.per100g.proteinG}P ${f.per100g.carbG}C ${f.per100g.fatG}F | $${f.pricePer100g}/100g`);
} else {
  fs.writeFileSync(path.join(root, 'data/foods/foods.generated.json'), JSON.stringify(out, null, 1) + '\n');
}
console.log(`${out.length} foods written; ${problems.length} problems`);
for (const p of problems) console.log(' -', p);
if (problems.length) process.exit(1);
