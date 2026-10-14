/**
 * Source runner used by the background worker and by admin "test now" actions.
 *
 *  - One run per source at a time: PostgreSQL advisory lock (a second worker gets status "skipped_locked").
 *  - Network calls go through the SSRF-safe fetcher with bounded exponential backoff.
 *  - A failed run changes NO opportunity: outages are recorded on the source, never interpreted as closures.
 *  - Each item is ingested in its own transaction, so one bad item cannot roll back the rest.
 *  - Interrupted runs (worker crash) are detected and marked "interrupted" on the next start.
 */
import type postgres from "postgres";
import { getAdapter } from "@/lib/sources/adapters";
import { safeFetch, withRetry, DEFAULT_RETRY, type RetryOptions } from "@/lib/sources/fetcher";
import { SchemaDriftError, type SourceConfig } from "@/lib/sources/types";
import { ingestItem, markUnlisted, type ItemOutcome } from "./pipeline";
import { recalcMatches } from "./matches";

export interface RunOptions {
  trigger: "schedule" | "manual" | "test";
  triggeredBy?: string | null;
  now?: () => Date;
  fetchImpl?: typeof fetch;
  retry?: Partial<RetryOptions>;
  log?: (msg: string, data?: Record<string, unknown>) => void;
  contactEmail?: string;
}

export interface RunSummary {
  run_id: string | null;
  status: "succeeded" | "partial" | "failed" | "skipped_locked" | "skipped_disabled" | "no_adapter";
  outcomes: Partial<Record<ItemOutcome, number>>;
  skipped_by_adapter: number;
  unlisted_marked_unverified: number;
  error?: string;
  matches?: { assessed: number; changed: number };
}

const DEGRADE_AFTER_FAILURES = 3;
const sanitize = (e: unknown) => String(e instanceof Error ? `${e.name}: ${e.message}` : e).replace(/[\r\n]+/g, " ").slice(0, 500);

export async function runSource(sql: postgres.Sql, sourceId: string, opts: RunOptions): Promise<RunSummary> {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? (() => {});
  const reserved = await sql.reserve();
  const lockKey = `source:${sourceId}`;
  try {
    const [{ locked } = { locked: false }] = await reserved<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtextextended(${lockKey}, 0)) AS locked`;
    if (!locked) {
      const [run] = await sql<{ id: string }[]>`INSERT INTO ingestion_runs (source_id, trigger, triggered_by, status, finished_at)
                                                 VALUES (${sourceId}, ${opts.trigger}, ${opts.triggeredBy ?? null}, 'skipped_locked', now()) RETURNING id`;
      return { run_id: run!.id, status: "skipped_locked", outcomes: {}, skipped_by_adapter: 0, unlisted_marked_unverified: 0 };
    }
    try {
      return await runLocked(sql, sourceId, opts, now, log);
    } finally {
      await reserved`SELECT pg_advisory_unlock(hashtextextended(${lockKey}, 0))`;
    }
  } finally {
    reserved.release();
  }
}

async function runLocked(sql: postgres.Sql, sourceId: string, opts: RunOptions, now: () => Date, log: NonNullable<RunOptions["log"]>): Promise<RunSummary> {
  const [source] = await sql<(SourceConfig & { check_interval_minutes: number; consecutive_failures: number; retry_policy: Partial<RetryOptions> })[]>`
    SELECT * FROM sources WHERE id = ${sourceId}`;
  if (!source) throw new Error("source not found");
  const empty = { outcomes: {}, skipped_by_adapter: 0, unlisted_marked_unverified: 0 };
  if (opts.trigger === "schedule" && !source.enabled) return { run_id: null, status: "skipped_disabled", ...empty };
  const adapter = getAdapter(source.adapter);
  if (!adapter || adapter.key === "manual") return { run_id: null, status: "no_adapter", ...empty };

  const startedAt = now();
  const [run] = await sql<{ id: string }[]>`
    INSERT INTO ingestion_runs (source_id, trigger, triggered_by, connector_version, heartbeat_at)
    VALUES (${source.id}, ${opts.trigger}, ${opts.triggeredBy ?? null}, ${adapter.version}, now()) RETURNING id`;
  const runId = run!.id;
  const retry: RetryOptions = { ...DEFAULT_RETRY, ...(source.retry_policy ?? {}), ...(opts.retry ?? {}) };
  const userAgent = `FundingRadarMonitor/0.2 (+${opts.contactEmail || "contact-not-configured"})`;
  let attempts = 0;

  let discovered;
  try {
    const r = await withRetry((a) => {
      attempts = a;
      return adapter.discover(source, {
        fetch: (url, init) => safeFetch(url, { allowedHosts: source.allowed_hosts, userAgent }, opts.fetchImpl ?? fetch, init),
        policy: { allowedHosts: source.allowed_hosts, userAgent },
        log,
      });
    }, retry);
    discovered = r.value;
  } catch (err) {
    const failures = source.consecutive_failures + 1;
    const backoffMin = Math.min(source.check_interval_minutes * 2 ** Math.min(failures - 1, 5), 24 * 60);
    const error = sanitize(err);
    await sql.begin(async (tx) => {
      await tx`UPDATE ingestion_runs SET status = 'failed', finished_at = now(), attempts = ${attempts}, error = ${error},
                 metrics = ${tx.json({ schema_drift: err instanceof SchemaDriftError } as never)} WHERE id = ${runId}`;
      await tx`UPDATE sources SET consecutive_failures = ${failures}, last_error = ${error}, last_check_at = ${now()},
                 next_check_at = ${new Date(now().getTime() + backoffMin * 60_000)},
                 lifecycle = CASE WHEN lifecycle = 'active' AND ${failures} >= ${DEGRADE_AFTER_FAILURES} THEN 'degraded' ELSE lifecycle END,
                 access_status = CASE WHEN access_status = 'untested' THEN 'inaccessible' ELSE access_status END,
                 updated_at = now()
               WHERE id = ${source.id}`;
    });
    log("source run failed", { source: source.slug, error });
    return { run_id: runId, status: "failed", error, ...empty };
  }

  const outcomes: Partial<Record<ItemOutcome, number>> = {};
  const affected = new Set<string>();
  const seen: string[] = [];
  let itemErrors = 0;
  let latestPublication: Date | null = null;
  for (const item of discovered.items) {
    try {
      const res = await sql.begin((tx) => ingestItem(tx, source, runId, item, now()));
      outcomes[res.outcome] = (outcomes[res.outcome] ?? 0) + 1;
      if (res.opportunity_id) {
        seen.push(res.opportunity_id);
        if (res.outcome !== "unchanged" && res.outcome !== "skipped_stale") affected.add(res.opportunity_id);
      }
      const m = item.source_modified_at ? new Date(item.source_modified_at) : null;
      if (m && !Number.isNaN(m.getTime()) && (!latestPublication || m > latestPublication)) latestPublication = m;
    } catch (err) {
      itemErrors++;
      log("item failed", { source: source.slug, item: item.canonical_url, error: sanitize(err) });
    }
    await sql`UPDATE ingestion_runs SET heartbeat_at = now() WHERE id = ${runId}`;
  }

  let unlisted = 0;
  if (!discovered.truncated && itemErrors === 0) unlisted = await sql.begin((tx) => markUnlisted(tx, source.id, seen, now()));
  const status = discovered.truncated || itemErrors > 0 ? "partial" : "succeeded";
  const finished = now();
  await sql.begin(async (tx) => {
    await tx`UPDATE ingestion_runs SET status = ${status}, finished_at = ${finished}, attempts = ${attempts},
               items_seen = ${discovered.items.length}, items_new = ${outcomes.new ?? 0}, items_changed = ${outcomes.changed ?? 0},
               items_skipped = ${discovered.skipped.length + (outcomes.skipped_stale ?? 0)}, items_conflicted = ${outcomes.conflict ?? 0},
               metrics = ${tx.json({ outcomes, pages: discovered.pages_fetched, truncated: discovered.truncated, item_errors: itemErrors,
                                     unlisted_marked_unverified: unlisted,
                                     skip_reasons: discovered.skipped.reduce<Record<string, number>>((a, s) => ((a[s.reason] = (a[s.reason] ?? 0) + 1), a), {}),
                                     duration_ms: finished.getTime() - startedAt.getTime() } as never)}
             WHERE id = ${runId}`;
    await tx`UPDATE sources SET consecutive_failures = 0, last_error = NULL, last_check_at = ${finished}, last_success_at = ${finished},
               last_content_at = CASE WHEN ${discovered.items.length} > 0 THEN ${finished} ELSE last_content_at END,
               latest_publication_at = GREATEST(latest_publication_at, ${latestPublication}),
               next_check_at = ${new Date(finished.getTime() + source.check_interval_minutes * 60_000)},
               connector_version = ${getAdapter(source.adapter)!.version},
               access_status = CASE WHEN access_status IN ('untested','inaccessible') THEN 'verified' ELSE access_status END,
               access_verified_at = ${finished},
               lifecycle = CASE WHEN lifecycle = 'configured' AND ${opts.trigger} = 'test' THEN 'tested'
                                WHEN lifecycle = 'degraded' AND enabled THEN 'active' ELSE lifecycle END,
               updated_at = now()
             WHERE id = ${source.id}`;
  });
  const matches = affected.size > 0 ? await recalcMatches(sql, { opportunityIds: [...affected], now: finished }) : { assessed: 0, changed: 0 };
  log("source run finished", { source: source.slug, status, outcomes, unlisted });
  return { run_id: runId, status, outcomes, skipped_by_adapter: discovered.skipped.length, unlisted_marked_unverified: unlisted, matches };
}

/** Runs left in "running" by a crashed worker (no heartbeat for `staleMinutes`) are closed as interrupted. */
export async function recoverInterruptedRuns(sql: postgres.Sql, staleMinutes = 30): Promise<number> {
  const rows = await sql`UPDATE ingestion_runs SET status = 'interrupted', finished_at = now(), error = 'worker stopped before the run finished'
                         WHERE status = 'running' AND coalesce(heartbeat_at, started_at) < now() - make_interval(mins => ${staleMinutes})
                         RETURNING id`;
  return rows.length;
}

export async function dueSourceIds(sql: postgres.Sql, now: Date): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM sources WHERE enabled AND lifecycle IN ('active','degraded') AND (next_check_at IS NULL OR next_check_at <= ${now})
    ORDER BY next_check_at NULLS FIRST LIMIT 20`;
  return rows.map((r) => r.id);
}

/** Retention: expired sessions and old login attempts are personal data with no further purpose. */
export async function purgeExpired(sql: postgres.Sql): Promise<{ sessions: number; login_attempts: number }> {
  const s = await sql`DELETE FROM sessions WHERE expires_at < now() RETURNING 1`;
  const l = await sql`DELETE FROM login_attempts WHERE attempted_at < now() - interval '30 days' RETURNING 1`;
  return { sessions: s.length, login_attempts: l.length };
}
