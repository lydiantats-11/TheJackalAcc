/**
 * Background worker.
 *   npm run worker                 → loop: due sources, deadline sweep, retention, heartbeat (every 60 s)
 *   npm run worker -- --once       → one pass, then exit
 *   npm run worker -- --test <slug> → run one source now (even if disabled); success moves it configured → tested
 *   npm run worker -- --recalc     → recompute all stored matches
 *   npm run worker -- --extract <opportunity-id> <official-document-url> <admin-email>
 *                                   → fetch the document, run AI extraction (only if enabled + key + budget), stage for review
 */
import "../scripts/load-env";
import { hostname } from "node:os";
import postgres from "postgres";
import { dueSourceIds, purgeExpired, recoverInterruptedRuns, runSource } from "@/lib/ingestion/worker";
import { sweepPassedDeadlines } from "@/lib/ingestion/pipeline";
import { recalcMatches } from "@/lib/ingestion/matches";

const log = (msg: string, data?: Record<string, unknown>) => console.log(JSON.stringify({ t: new Date().toISOString(), msg, ...data }));
const sql = postgres(process.env.DATABASE_URL ?? "", { max: 4, onnotice: () => {} });
const workerId = `${hostname()}:${process.pid}`;
const contactEmail = process.env.MONITOR_CONTACT_EMAIL;
let stopping = false;

async function pass() {
  await sql`INSERT INTO worker_heartbeats (worker_id, started_at, last_beat_at) VALUES (${workerId}, now(), now())
            ON CONFLICT (worker_id) DO UPDATE SET last_beat_at = now()`;
  const interrupted = await recoverInterruptedRuns(sql);
  if (interrupted) log("marked interrupted runs", { interrupted });
  for (const id of await dueSourceIds(sql, new Date())) {
    if (stopping) break;
    const r = await runSource(sql, id, { trigger: "schedule", log, contactEmail });
    log("run", { source_id: id, status: r.status, outcomes: r.outcomes, error: r.error });
  }
  const swept = await sql.begin((tx) => sweepPassedDeadlines(tx, new Date()));
  if (swept) { log("deadline sweep", { marked_unverified: swept }); await recalcMatches(sql); }
  const purged = await purgeExpired(sql);
  if (purged.sessions || purged.login_attempts) log("retention purge", purged);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const args = process.argv.slice(2);
  if (args[0] === "--test") {
    const slug = args[1];
    const [s] = await sql<{ id: string }[]>`SELECT id FROM sources WHERE slug = ${slug ?? ""}`;
    if (!s) throw new Error(`unknown source slug: ${slug}`);
    const r = await runSource(sql, s.id, { trigger: "test", log, contactEmail });
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = r.status === "succeeded" || r.status === "partial" ? 0 : 1;
    return;
  }
  if (args[0] === "--extract") {
    const [, oppId, url, email] = args;
    const { configuredProvider } = await import("@/lib/ai");
    const { runExtraction } = await import("@/lib/ai/extraction");
    const { attachOfficialDocument } = await import("@/lib/data/review");
    const provider = configuredProvider();
    if (!provider) throw new Error("AI extraction is disabled: set AI_EXTRACTION_ENABLED=true and ANTHROPIC_API_KEY after approving the cost");
    const [admin] = await sql<{ id: string; email: string; role: "admin"; locale: "el" }[]>`SELECT id, email, role, locale FROM users WHERE lower(email) = ${String(email).toLowerCase()} AND role = 'admin'`;
    if (!admin) throw new Error("third argument must be an admin's email");
    const docId = await attachOfficialDocument(sql, admin, String(oppId), String(url));
    const r = await runExtraction(sql, { opportunityId: String(oppId), documentId: docId, provider, monthlyBudgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD ?? 0) });
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (args[0] === "--recalc") { log("recalc", await recalcMatches(sql)); return; }
  if (args[0] === "--once") { await pass(); return; }
  process.on("SIGTERM", () => { stopping = true; });
  process.on("SIGINT", () => { stopping = true; });
  log("worker started", { workerId });
  while (!stopping) {
    try { await pass(); } catch (err) { log("pass failed", { error: String(err) }); }
    for (let i = 0; i < 60 && !stopping; i++) await new Promise((r) => setTimeout(r, 1000));
  }
  log("worker stopped", { workerId });
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => sql.end());
