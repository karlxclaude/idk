// Fetches PubMed metadata + abstracts for each query in scripts/source-queries.json.
// Usage: node scripts/verify-sources.mjs <outfile.json>
// Results are raw data used to manually verify citations (see SOURCES.md).
import fs from 'node:fs';
const queries = JSON.parse(fs.readFileSync(new URL('./source-queries.json', import.meta.url), 'utf8'));
const out = process.argv[2] ?? 'source-verification.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
async function get(url) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.text();
    } catch {}
    await sleep(1000 * 2 ** i);
  }
  throw new Error('fetch failed ' + url);
}
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function parseArticles(xml) {
  const arts = xml.split('<PubmedArticle>').slice(1);
  return arts.map((a) => {
    const pick = (re) => { const m = a.match(re); return m ? strip(m[1]) : ''; };
    const authors = [...a.matchAll(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?(?:<Initials>([^<]+)<\/Initials>)?[\s\S]*?<\/Author>/g)].map((m) => `${m[1]} ${m[2] ?? ''}`.trim());
    const abstract = [...a.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => strip(m[1])).join(' ');
    return {
      pmid: pick(/<PMID[^>]*>(\d+)<\/PMID>/),
      title: pick(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/),
      journal: pick(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/) || pick(/<Title>([\s\S]*?)<\/Title>/),
      year: pick(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) || pick(/<PubDate>[\s\S]*?<MedlineDate>(\d{4})/),
      doi: pick(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/) || pick(/<ELocationID EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/),
      authors: authors.slice(0, 6),
      abstract,
    };
  });
}
const results = [];
for (const q of queries) {
  if (!q.term) continue;
  try {
    const s = JSON.parse(await get(`${base}esearch.fcgi?db=pubmed&retmode=json&retmax=3&term=${encodeURIComponent(q.term)}`));
    const ids = s.esearchresult?.idlist ?? [];
    await sleep(400);
    let arts = [];
    if (ids.length) {
      arts = parseArticles(await get(`${base}efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(',')}`));
      await sleep(400);
    }
    results.push({ id: q.id, claim: q.claim, term: q.term, count: Number(s.esearchresult?.count ?? 0), hits: arts });
    process.stdout.write(`${q.id}: ${arts.length} hits\n`);
  } catch (e) {
    results.push({ id: q.id, claim: q.claim, term: q.term, error: String(e) });
    process.stdout.write(`${q.id}: ERROR\n`);
  }
}
fs.writeFileSync(out, JSON.stringify(results, null, 1));
console.log('wrote', out);
