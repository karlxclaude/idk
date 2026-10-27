// Regenerates SOURCES.md and fills `constantsInformed` in data/sources.json from the constant registry.
// Run: npm run sources:md
import fs from 'node:fs';
import path from 'node:path';
import { SourcesFileSchema, type Source } from '../data/schemas';
import { allConstants } from '../data/constants';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const srcPath = path.join(root, 'data', 'sources.json');
const sources = SourcesFileSchema.parse(JSON.parse(fs.readFileSync(srcPath, 'utf8')));
const byId = new Map<string, Source>(sources.map((s) => [s.id, s]));

const constants = allConstants();
for (const s of sources) s.constantsInformed = [];
const missing = new Set<string>();
for (const c of constants) {
  for (const sid of c.sourceIds) {
    const s = byId.get(sid);
    if (!s) {
      missing.add(sid);
      continue;
    }
    // collapse curve points to their curve id
    const cid = c.id.includes('@') ? (c.id.split('@')[0] as string) : c.id;
    if (!s.constantsInformed.includes(cid)) s.constantsInformed.push(cid);
  }
}
if (missing.size) {
  console.error('Unknown source ids referenced by constants:', [...missing].join(', '));
  process.exit(1);
}
fs.writeFileSync(srcPath, JSON.stringify(sources, null, 2) + '\n');

const verified = sources.filter((s) => s.verified);
const unverified = sources.filter((s) => !s.verified);
const corrections = sources.filter((s) => /CORRECTION|DOWNGRADE/.test(s.notes));

let md = `# SOURCES\n\n`;
md += `Generated from \`data/sources.json\` by \`npm run sources:md\`. Do not edit by hand.\n\n`;
md += `**Citation honesty.** The citation list in the build prompt was compiled from memory by an AI model. `;
md += `Each entry below was resolved against PubMed (E-utilities) or Crossref during the build and its abstract read for the numbers it informs. `;
md += `\`verified: true\` means the bibliographic record was resolved and the claim checked against the abstract or paper; `;
md += `\`verified: false\` means the record could not be resolved online (books, practitioner sources, reports) and values are kept from memory with lowered confidence.\n\n`;
md += `- Sources: ${sources.length} (verified ${verified.length}, unverified ${unverified.length})\n`;
md += `- Constants: ${constants.length} (curve points counted individually)\n`;
md += `- Constants with \`verified: false\`: ${constants.filter((c) => !c.verified).length}\n\n`;

md += `## Corrections to the prompt's citations\n\n`;
for (const s of corrections) md += `- **${s.id}** — ${s.notes}\n`;
md += `\n## Unverified sources\n\n`;
for (const s of unverified) md += `- **${s.id}** — ${s.authors} (${s.year ?? 'n.d.'}). *${s.title}*. ${s.journal}. ${s.notes}\n`;

md += `\n## All sources\n\n`;
md += `| id | citation | kind | verified | constants informed |\n|---|---|---|---|---|\n`;
for (const s of sources) {
  const cite = `${s.authors} (${s.year ?? 'n.d.'}). ${s.title}. *${s.journal}*.${s.doi ? ` doi:${s.doi}` : ''}${s.pmid ? ` PMID:${s.pmid}` : ''}`;
  md += `| ${s.id} | ${cite.replace(/\|/g, '/')} | ${s.kind} | ${s.verified ? 'yes' : 'no'} | ${s.constantsInformed.join(', ')} |\n`;
}

md += `\n## Constants by confidence\n\n`;
for (const conf of ['H', 'M', 'L', 'HEUR'] as const) {
  const cs = constants.filter((c) => c.confidence === conf && !c.id.includes('@'));
  md += `### ${conf} (${cs.length})\n\n`;
  for (const c of cs) md += `- \`${c.id}\` = ${c.value} ${c.unit} [${c.range[0]}, ${c.range[1]}] (${c.sourceIds.join(', ')})${c.verified ? '' : ' — unverified'}\n`;
  md += `\n`;
}
fs.writeFileSync(path.join(root, 'SOURCES.md'), md);
console.log(`SOURCES.md written: ${sources.length} sources, ${constants.length} constants`);
