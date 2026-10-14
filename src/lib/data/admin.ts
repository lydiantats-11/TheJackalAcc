import type postgres from "postgres";
import { assertAdmin, type SessionUser } from "@/lib/auth/service";
import { getAdapter } from "@/lib/sources/adapters";

export interface SourceHealthRow {
  access_status: string; auth_required: string; robots_status: string; connector_version: string | null;
  last_content_at: Date | null; latest_publication_at: Date | null; terms_url: string | null; licence_notes: string | null;
  last_run: { status: string; started_at: Date; items_seen: number; items_new: number; items_changed: number; error: string | null } | null;
  id: string; slug: string; name: string; authority: string; scope: string; base_url: string; access_method: string;
  adapter: string; lifecycle: string; enabled: boolean; check_interval_minutes: number; compliance_notes: string | null;
  last_check_at: Date | null; last_success_at: Date | null; next_check_at: Date | null; consecutive_failures: number;
  last_error: string | null; runs_7d: number; failed_runs_7d: number;
}

export async function listSourceHealth(sql: postgres.Sql, actor: SessionUser | null): Promise<SourceHealthRow[]> {
  assertAdmin(actor);
  return sql<SourceHealthRow[]>`
    SELECT s.*,
      (SELECT count(*)::int FROM ingestion_runs r WHERE r.source_id = s.id AND r.started_at > now() - interval '7 days') AS runs_7d,
      (SELECT count(*)::int FROM ingestion_runs r WHERE r.source_id = s.id AND r.status = 'failed' AND r.started_at > now() - interval '7 days') AS failed_runs_7d,
      (SELECT to_jsonb(x) FROM (SELECT status, started_at, items_seen, items_new, items_changed, error FROM ingestion_runs r
                                WHERE r.source_id = s.id ORDER BY started_at DESC LIMIT 1) x) AS last_run
    FROM sources s ORDER BY s.scope, s.name`;
}

export async function setSourceEnabled(sql: postgres.Sql, actor: SessionUser | null, sourceId: string, enabled: boolean): Promise<{ ok: boolean; reason?: string }> {
  assertAdmin(actor);
  return sql.begin(async (tx) => {
    const [s] = await tx<{ lifecycle: string; adapter: string; access_status: string }[]>`SELECT lifecycle, adapter, access_status FROM sources WHERE id = ${sourceId} FOR UPDATE`;
    if (!s) return { ok: false, reason: "not_found" };
    if (enabled && s.access_status === "blocked_by_robots") return { ok: false, reason: "blocked_by_robots" };
    if (enabled && s.lifecycle === "configured") return { ok: false, reason: "must_pass_test_first" };
    if (enabled && (!getAdapter(s.adapter) || s.adapter === "manual")) return { ok: false, reason: "no_automated_adapter" };
    await tx`UPDATE sources SET enabled = ${enabled},
               lifecycle = CASE WHEN ${enabled} THEN 'active' ELSE 'inactive' END, updated_at = now() WHERE id = ${sourceId}`;
    await tx`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
             VALUES (${actor.id}, ${enabled ? "source_enabled" : "source_disabled"}, 'source', ${sourceId}, ${tx.json({ previous_lifecycle: s.lifecycle })})`;
    return { ok: true };
  });
}

export async function adminOverview(sql: postgres.Sql, actor: SessionUser | null) {
  assertAdmin(actor);
  const [row] = await sql<{ users: number; opportunities: number; pending_review: number; synthetic: number; sources_active: number; sources_total: number }[]>`
    SELECT (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS users,
           (SELECT count(*)::int FROM opportunities WHERE merged_into_id IS NULL) AS opportunities,
           (SELECT count(*)::int FROM opportunities WHERE review_status = 'pending') AS pending_review,
           (SELECT count(*)::int FROM opportunities WHERE is_synthetic) AS synthetic,
           (SELECT count(*)::int FROM sources WHERE lifecycle = 'active') AS sources_active,
           (SELECT count(*)::int FROM sources) AS sources_total`;
  return row!;
}
