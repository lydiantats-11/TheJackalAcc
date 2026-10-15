/**
 * Diagnostic: which official, structured details (budget, grant size, action type, conditions) does the EU Funding &
 * Tenders Portal publish per topic? Read-only. Prints field names and short samples; nothing is stored in the database.
 * Usage: npx tsx scripts/eu-ft-details-probe.ts > details-probe.json
 */
export {};
const SEARCH = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const TOPIC = (id: string) => `https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/${id.toLowerCase()}.json`;
const QUERY = { bool: { must: [{ terms: { type: ["1"] } }, { terms: { status: ["31094502"] } }] } };
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const short = (v: unknown, n = 600) => { const s = typeof v === "string" ? v : JSON.stringify(v); return s && s.length > n ? s.slice(0, n) + "…" : s; };

const fd = new FormData();
fd.append("query", new Blob([JSON.stringify(QUERY)], { type: "application/json" }), "query.json");
fd.append("languages", new Blob([JSON.stringify(["en"])], { type: "application/json" }), "languages.json");
fd.append("sort", new Blob([JSON.stringify({ field: "identifier", order: "ASC" })], { type: "application/json" }), "sort.json");
const res = await fetch(`${SEARCH}?apiKey=SEDIA&text=***&pageSize=50&pageNumber=1`, { method: "POST", body: fd });
const json = (await res.json()) as { results?: { metadata?: Record<string, unknown> }[]; totalResults?: number };
const results = json.results ?? [];
const keyCount: Record<string, number> = {};
for (const r of results) for (const k of Object.keys(r.metadata ?? {})) keyCount[k] = (keyCount[k] ?? 0) + 1;

const pick = [0, Math.floor(results.length / 2), results.length - 1].filter((i, j, a) => results[i] && a.indexOf(i) === j);
const samples = [];
for (const i of pick) {
  const m = results[i].metadata ?? {};
  const id = String(arr(m.identifier)[0]);
  const interesting: Record<string, unknown> = {};
  for (const k of Object.keys(m)) if (/budget|action|type|programme|call|deadline|start|description|condition|keyword|tags|crossCutting|focusArea|destination/i.test(k)) interesting[k] = short(m[k], 900);
  let topic: Record<string, unknown> | string = "not fetched";
  try {
    const t = await fetch(TOPIC(id));
    const tj = (await t.json()) as { TopicDetails?: Record<string, unknown> };
    const d = tj.TopicDetails ?? {};
    topic = { status: t.status, keys: Object.keys(d) };
    for (const k of Object.keys(d)) if (/budget|action|condition|eligib|description|deadline|cutoff/i.test(k)) (topic as Record<string, unknown>)[k] = short(d[k], 900);
  } catch (e) { topic = `error: ${(e as Error).message}`; }
  samples.push({ id, search_metadata: interesting, topic_details: topic });
}
console.log(JSON.stringify({ when: new Date().toISOString(), totalResults: json.totalResults, metadataKeys: keyCount, samples }, null, 2));
