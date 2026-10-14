/**
 * Diagnostic: does paging through the EU Funding & Tenders search API return a complete, stable list?
 * Fetches the same query (grant topics, forthcoming + open) twice per variant and reports, per pass:
 * totalResults, rows fetched, unique identifiers, and how much the two passes agree.
 * Read-only; ~25 requests per variant with a pause between requests.
 * Usage: npx tsx scripts/eu-ft-paging-probe.ts > probe.json
 */
export {}; // ES module: allows top-level await
const ENDPOINT = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const QUERY = { bool: { must: [{ terms: { type: ["1"] } }, { terms: { status: ["31094501", "31094502"] } }] } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Variant { name: string; pageSize: number; sort?: unknown }
const VARIANTS: Variant[] = [
  { name: "current (no sort, 100/page)", pageSize: 100 },
  { name: "no sort, 50/page", pageSize: 50 },
  { name: "sort identifier ASC", pageSize: 100, sort: { field: "identifier", order: "ASC" } },
  { name: "sort reference ASC", pageSize: 100, sort: { field: "reference", order: "ASC" } },
  { name: "sort startDate DESC", pageSize: 100, sort: { field: "startDate", order: "DESC" } },
  { name: "sort deadlineDate ASC", pageSize: 100, sort: { field: "deadlineDate", order: "ASC" } },
];

function first(v: unknown): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return typeof x === "string" && x.trim() ? x.trim() : undefined;
}

async function pass(v: Variant) {
  const ids: string[] = [];
  let total: number | null = null;
  let pages = 0;
  for (let page = 1; page <= 30; page++) {
    const fd = new FormData();
    fd.append("query", new Blob([JSON.stringify(QUERY)], { type: "application/json" }), "query.json");
    fd.append("languages", new Blob([JSON.stringify(["en"])], { type: "application/json" }), "languages.json");
    if (v.sort) fd.append("sort", new Blob([JSON.stringify(v.sort)], { type: "application/json" }), "sort.json");
    const url = `${ENDPOINT}?apiKey=SEDIA&text=${encodeURIComponent("***")}&pageSize=${v.pageSize}&pageNumber=${page}`;
    const res = await fetch(url, { method: "POST", body: fd, headers: { accept: "application/json" } });
    pages++;
    if (!res.ok) return { error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`, pages };
    const json = (await res.json()) as { results?: { metadata?: Record<string, unknown> }[]; totalResults?: number };
    total = Number(json.totalResults ?? NaN);
    const results = json.results ?? [];
    for (const r of results) { const id = first(r.metadata?.identifier) ?? first(r.metadata?.callIdentifier); if (id) ids.push(id.toUpperCase()); }
    await sleep(300);
    if (results.length < v.pageSize || (Number.isFinite(total) && page * v.pageSize >= total)) break;
  }
  return { total, pages, rows: ids.length, unique: new Set(ids).size, ids: [...new Set(ids)] };
}

const out: Record<string, unknown>[] = [];
for (const v of VARIANTS) {
  const a = await pass(v);
  const b = await pass(v);
  if ("error" in a || "error" in b) { out.push({ variant: v.name, error: ("error" in a ? a.error : (b as { error: string }).error) }); continue; }
  const sa = new Set(a.ids), sb = new Set(b.ids);
  const both = [...sa].filter((x) => sb.has(x)).length;
  out.push({
    variant: v.name, totalResults: a.total, pages: a.pages,
    pass1: { rows: a.rows, unique: a.unique }, pass2: { rows: b.rows, unique: b.unique },
    in_both_passes: both, union: new Set([...sa, ...sb]).size,
    complete_and_stable: a.unique === a.total && b.unique === b.total && both === a.unique,
  });
  console.error(JSON.stringify(out.at(-1)));
}
console.log(JSON.stringify({ probed_at: new Date().toISOString(), results: out }, null, 2));
