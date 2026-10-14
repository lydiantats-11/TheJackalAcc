/**
 * Diagnostic: are the deadlines the search API returns what the official topic pages show?
 *  1. Lists forthcoming + open grant topics (sorted by identifier, as the connector does) and counts
 *     how many are labelled open/forthcoming although every deadline has passed, and which clock times occur.
 *  2. For a sample of upcoming deadlines, fetches the portal's own topic data (the JSON behind the topic page)
 *     and prints both values side by side.
 * Read-only. Usage: npx tsx scripts/eu-ft-deadline-probe.ts > deadline-probe.json
 */
export {};
const SEARCH = "https://api.tech.ec.europa.eu/search-api/prod/rest/search";
const TOPIC = (id: string) => `https://ec.europa.eu/info/funding-tenders/opportunities/data/topicDetails/${id.toLowerCase()}.json`;
const QUERY = { bool: { must: [{ terms: { type: ["1"] } }, { terms: { status: ["31094501", "31094502"] } }] } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String);

const rows: { id: string; status: string; deadlines: string[]; url?: string }[] = [];
for (let page = 1; page <= 20; page++) {
  const fd = new FormData();
  fd.append("query", new Blob([JSON.stringify(QUERY)], { type: "application/json" }), "query.json");
  fd.append("languages", new Blob([JSON.stringify(["en"])], { type: "application/json" }), "languages.json");
  fd.append("sort", new Blob([JSON.stringify({ field: "identifier", order: "ASC" })], { type: "application/json" }), "sort.json");
  const res = await fetch(`${SEARCH}?apiKey=SEDIA&text=***&pageSize=100&pageNumber=${page}`, { method: "POST", body: fd });
  const json = (await res.json()) as { results?: { url?: string; metadata?: Record<string, unknown> }[]; totalResults?: number };
  for (const r of json.results ?? []) {
    const m = r.metadata ?? {};
    rows.push({ id: arr(m.identifier)[0] ?? "?", status: arr(m.status)[0] ?? "?", deadlines: arr(m.deadlineDate), url: arr(m.url)[0] ?? r.url });
  }
  await sleep(300);
  if ((json.results ?? []).length < 100) break;
}

const now = Date.now();
const latest = (r: (typeof rows)[number]) => Math.max(...r.deadlines.map((d) => Date.parse(d)).filter(Number.isFinite), -Infinity);
const passed = rows.filter((r) => r.deadlines.length && latest(r) < now);
const noDeadline = rows.filter((r) => !r.deadlines.length);
const clock: Record<string, number> = {};
for (const r of rows) for (const d of r.deadlines) { const k = d.slice(10); clock[k] = (clock[k] ?? 0) + 1; }
const byStatus = (list: typeof rows) => list.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});

// Sample: upcoming deadlines spread across the list
const upcoming = rows.filter((r) => latest(r) >= now);
const sample = [0, 0.2, 0.4, 0.6, 0.8, 0.99].map((f) => upcoming[Math.floor(f * (upcoming.length - 1))]).filter(Boolean) as typeof rows;
const compare = [];
for (const r of sample) {
  try {
    const res = await fetch(TOPIC(r.id));
    const text = await res.text();
    let detail: unknown = null;
    try {
      const j = JSON.parse(text) as { TopicDetails?: Record<string, unknown> };
      const t = j.TopicDetails ?? {};
      const actions = (t.actions as Record<string, unknown>[] | undefined) ?? [];
      detail = {
        deadlineDates: t.deadlineDates ?? null,
        deadlineModel: t.deadlineModel ?? null,
        actions: actions.map((a) => ({ deadlineDates: a.deadlineDates ?? null, deadlineModel: a.deadlineModel ?? null })),
        keys: Object.keys(t).slice(0, 40),
      };
    } catch { detail = { not_json: text.slice(0, 200) }; }
    compare.push({ id: r.id, page_url: r.url, search_api_deadlines: r.deadlines, topic_data_http: res.status, topic_data: detail });
  } catch (e) { compare.push({ id: r.id, error: String(e) }); }
  await sleep(500);
}

console.log(JSON.stringify({
  probed_at: new Date().toISOString(),
  rows: rows.length,
  status_counts: byStatus(rows),
  passed_all_deadlines: { count: passed.length, by_status: byStatus(passed), examples: passed.slice(0, 8).map((r) => ({ id: r.id, deadlines: r.deadlines })) },
  without_deadline: noDeadline.length,
  upcoming: upcoming.length,
  deadline_clock_times: Object.entries(clock).sort((a, b) => b[1] - a[1]).slice(0, 10),
  compare_with_topic_pages: compare,
}, null, 2));
