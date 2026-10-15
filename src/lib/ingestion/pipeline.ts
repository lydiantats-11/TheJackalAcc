/**
 * Ingestion pipeline: turns one DiscoveredItem into database state, transactionally and idempotently.
 *
 * Guarantees (each covered by tests):
 *  - same item twice                      → one opportunity, one document, no second event
 *  - item already known from another source → no duplicate; evidence recorded; differing deadlines → conflict, not overwrite
 *  - changed facts                        → previous state snapshotted in opportunity_versions before update
 *  - stale item (older source timestamp)  → ignored
 *  - closed call "reopened" without newer evidence → not reopened; flagged for review
 */
import type postgres from "postgres";
import { normaliseDeadline } from "@/lib/domain/deadline";
import type { OpportunityStatus } from "@/lib/domain/eligibility";
import { canonicalizeUrl, contentFingerprint, type DiscoveredItem, type SourceConfig } from "@/lib/sources/types";
import { PROGRAMME_DEFAULTS } from "@/lib/domain/programme-defaults";

type Tx = postgres.TransactionSql | postgres.Sql;

export type ItemOutcome = "new" | "changed" | "unchanged" | "duplicate_other_source" | "conflict" | "skipped_stale";

export interface ItemResult {
  outcome: ItemOutcome;
  opportunity_id: string | null;
  detail?: string;
}

interface ExistingOpp {
  id: string;
  source_id: string | null;
  status: OpportunityStatus;
  closes_at: Date | null;
  deadline_kind: string;
  content_fingerprint: string | null;
  source_modified_at: Date | null;
  version: number;
  has_conflict: boolean;
}

const CLOSED: OpportunityStatus[] = ["closed", "cancelled", "archived"];
const LIVE: OpportunityStatus[] = ["open", "upcoming", "extended"];

async function recordEvent(tx: Tx, oppId: string, type: string, key: string, payload: Record<string, unknown>) {
  await tx`INSERT INTO opportunity_events (opportunity_id, event_type, dedupe_key, payload)
           VALUES (${oppId}, ${type}, ${key}, ${tx.json(payload as never)}) ON CONFLICT (dedupe_key) DO NOTHING`;
}

async function snapshot(tx: Tx, oppId: string, version: number, kind: string, summary: string, documentId: string | null) {
  await tx`INSERT INTO opportunity_versions (opportunity_id, version, snapshot, change_kind, change_summary, document_id)
           SELECT id, ${version}, to_jsonb(o.*) - 'version', ${kind}, ${summary}, ${documentId} FROM opportunities o WHERE id = ${oppId}
           ON CONFLICT (opportunity_id, version) DO NOTHING`;
}

async function evidence(tx: Tx, oppId: string, field: string, value: unknown, url: string, docId: string | null, rank: number, review: string) {
  await tx`INSERT INTO opportunity_field_evidence (opportunity_id, field, value, source_url, document_id, method, evidence_rank, confidence, review_status)
           VALUES (${oppId}, ${field}, ${tx.json(value as never)}, ${url}, ${docId}, 'parser', ${rank}, 'high', ${review})`;
}


/** Display-only official details: refreshed on every run, never part of the fingerprint or the version history. */
async function writeDetails(tx: Tx, id: string, item: DiscoveredItem, now: Date): Promise<void> {
  if (item.details === undefined) return;
  await tx`UPDATE opportunities SET official_details = ${tx.json({ ...item.details, retrieved_at: now.toISOString() } as never)} WHERE id = ${id}`;
}

export async function ingestItem(tx: Tx, source: SourceConfig, runId: string, item: DiscoveredItem, now: Date): Promise<ItemResult> {
  const canonical = canonicalizeUrl(item.canonical_url);
  if (!canonical.startsWith("https://")) return { outcome: "skipped_stale", opportunity_id: null, detail: "non_https_url" };
  const hash = contentFingerprint(item.text);
  const rank = item.trust === "official_structured" ? 2 : 3;

  // 1. Store the source document once per distinct content.
  const inserted = await tx<{ id: string }[]>`
    INSERT INTO source_documents (source_id, run_id, url, canonical_url, content_hash, title, text_content, classification)
    VALUES (${source.id}, ${runId}, ${item.canonical_url}, ${canonical}, ${hash}, ${item.title.slice(0, 1000)}, ${item.text.slice(0, 200_000)}, 'opportunity')
    ON CONFLICT (source_id, canonical_url, content_hash) DO NOTHING RETURNING id`;
  const docId = inserted[0]?.id ??
    (await tx<{ id: string }[]>`SELECT id FROM source_documents WHERE source_id = ${source.id} AND canonical_url = ${canonical} AND content_hash = ${hash}`)[0]?.id ?? null;

  // 2. Normalise facts. Unknown stays unknown.
  const f = item.facts;
  const tz = f?.deadline_timezone ?? "Europe/Athens";
  const reading = { utcLabelIsLocalTime: f?.deadline_utc_label_is_local === true };
  // Multi-cut-off calls: the deadline that matters is the NEXT one still ahead; when all have passed, the latest.
  // (Live finding 2026-10-14: using the first cut-off showed calls with a 2027 cut-off as "deadline passed".)
  const rawDeadlines = [f?.deadline_raw, ...(f?.additional_deadlines_raw ?? [])].filter((x): x is string => !!x && !!x.trim());
  const timed = rawDeadlines.map((raw) => ({ raw, n: normaliseDeadline(raw, tz, reading) })).filter((d) => d.n.closes_at)
    .sort((a, b) => a.n.closes_at!.getTime() - b.n.closes_at!.getTime());
  const chosen = timed.find((d) => d.n.closes_at! >= now) ?? timed.at(-1);
  const dl = chosen ? chosen.n : normaliseDeadline(f?.deadline_raw, tz, reading);
  const otherDeadlines = chosen ? rawDeadlines.filter((r) => r !== chosen.raw) : (f?.additional_deadlines_raw ?? []);
  // A source that still lists a call as open/upcoming after its last deadline is not evidence that it is open.
  // Same rule as sweepPassedDeadlines, applied at import, so import and sweep agree (no open ⇄ unverified flip-flop).
  const sourceStatus: OpportunityStatus = f?.status ?? "unverified";
  const pastLastDeadline = !!dl.closes_at && dl.deadline_kind === "official" && dl.closes_at < now && LIVE.includes(sourceStatus);
  const status: OpportunityStatus = pastLastDeadline ? "unverified" : sourceStatus;
  const statusReasonNew = pastLastDeadline ? "deadline_passed_source_still_lists_open" : f?.status ? "source_status" : "source_status_unrecognised";
  const opens = f?.opens_at_raw ? normaliseDeadline(f.opens_at_raw, tz, reading).closes_at : null;
  const modifiedAt = item.source_modified_at ? new Date(item.source_modified_at) : null;
  const validModified = modifiedAt && !Number.isNaN(modifiedAt.getTime()) ? modifiedAt : null;

  // 3. Find an existing record: cross-source identity first, then source identifier, then URL.
  const [existing] = await tx<ExistingOpp[]>`
    SELECT id, source_id, status, closes_at, deadline_kind, content_fingerprint, source_modified_at, version, has_conflict
    FROM opportunities
    WHERE merged_into_id IS NULL AND (
      (${item.external_key ?? null}::text IS NOT NULL AND external_key = ${item.external_key ?? null})
      OR (${item.official_identifier ?? null}::text IS NOT NULL AND source_id = ${source.id} AND official_identifier = ${item.official_identifier ?? null})
      OR canonical_url = ${canonical})
    ORDER BY COALESCE(external_key = ${item.external_key ?? ""}, false) DESC
    LIMIT 1 FOR UPDATE`;

  if (!existing) {
    const [row] = await tx<{ id: string }[]>`
      INSERT INTO opportunities (
        source_id, official_identifier, external_key, official_title, title_lang, opportunity_type, publishing_authority, programme,
        canonical_url, application_url, opens_at, closes_at, deadline_state, deadline_kind, deadline_original_text, deadline_is_date_only,
        deadline_timezone, additional_deadlines, status, status_confidence, status_reason, status_evidence,
        last_retrieved_at, last_verified_at, source_modified_at, publication_basis, review_status, content_fingerprint,
        requirement_set_completeness)
      VALUES (
        ${source.id}, ${item.official_identifier ?? null}, ${item.external_key ?? null}, ${(f?.official_title ?? item.title).slice(0, 1000)},
        ${f?.title_lang ?? "el"}, ${f?.opportunity_type ?? "unknown"}, ${f?.publishing_authority ?? source.authority}, ${f?.programme ?? null},
        ${canonical}, ${f?.application_url ?? null}, ${opens}, ${dl.closes_at}, ${dl.closes_at ? "known" : "unknown"}, ${dl.deadline_kind},
        ${dl.deadline_original_text}, ${dl.deadline_is_date_only}, ${dl.deadline_timezone},
        ${otherDeadlines.length ? tx.json(otherDeadlines as never) : null},
        ${status}, ${f?.status && !pastLastDeadline ? "high" : "low"}, ${statusReasonNew},
        ${tx.json({ source_url: canonical, status_raw: f?.status_raw ?? null, document_id: docId } as never)},
        ${now}, ${now}, ${validModified}, ${item.trust}, ${item.trust === "official_structured" ? "approved" : "pending"}, ${hash}, 'unknown')
      RETURNING id`;
    const id = row!.id;
    await snapshot(tx, id, 1, "created", `discovered by ${source.slug}`, docId);
    await tx`INSERT INTO opportunity_status_history (opportunity_id, from_status, to_status, reason, evidence, actor)
             VALUES (${id}, NULL, ${status}, 'discovered', ${tx.json({ source_url: canonical, status_raw: f?.status_raw ?? null } as never)}, 'system')`;
    await evidence(tx, id, "status", { status, raw: f?.status_raw ?? null }, canonical, docId, rank, "approved");
    await evidence(tx, id, "deadline", { closes_at: dl.closes_at, original: dl.deadline_original_text, date_only: dl.deadline_is_date_only }, canonical, docId, rank, "approved");
    for (const d of PROGRAMME_DEFAULTS[f?.programme ?? ""] ?? []) {
      await tx`INSERT INTO opportunity_requirements (opportunity_id, requirement_key, category, kind, value, original_text, original_lang, interpretation,
                                                     evidence, evidence_rank, confidence, flags, origin)
               VALUES (${id}, ${d.key}, ${d.category}, ${d.kind}, ${tx.json(d.value as never)}, ${d.original_text}, ${d.original_lang}, ${d.interpretation ?? null},
                       ${tx.json(d.evidence as never)}, ${d.evidence_rank}, ${d.confidence}, ${d.flags}, 'programme_default')
               ON CONFLICT (opportunity_id, requirement_key, version) DO NOTHING`;
    }
    await writeDetails(tx, id, item, now);
    await recordEvent(tx, id, "new_opportunity", `new_opportunity:${id}`, { source: source.slug, status });
    return { outcome: "new", opportunity_id: id };
  }

  const id = existing.id;
  // 4a. Stale item: the source timestamp is older than what we already applied.
  if (validModified && existing.source_modified_at && validModified < existing.source_modified_at)
    return { outcome: "skipped_stale", opportunity_id: id, detail: "older_source_timestamp" };

  // 4b. Same call reported by a DIFFERENT source: keep one record, record evidence, surface conflicts.
  if (existing.source_id && existing.source_id !== source.id) {
    await evidence(tx, id, "deadline", { closes_at: dl.closes_at, original: dl.deadline_original_text, source: source.slug }, canonical, docId, rank, "pending");
    const differs = dl.closes_at && existing.closes_at && dl.closes_at.getTime() !== existing.closes_at.getTime();
    if (differs) {
      await tx`UPDATE opportunities SET has_conflict = true, updated_at = now() WHERE id = ${id}`;
      await tx`UPDATE opportunity_field_evidence SET review_status = 'conflict' WHERE opportunity_id = ${id} AND field = 'deadline'`;
      await recordEvent(tx, id, "conflict_detected", `conflict:deadline:${id}:${hash.slice(0, 16)}`, {
        field: "deadline", existing: existing.closes_at, other: dl.closes_at, other_source: source.slug,
      });
      return { outcome: "conflict", opportunity_id: id, detail: "deadline_differs_between_sources" };
    }
    return { outcome: "duplicate_other_source", opportunity_id: id };
  }

  // 4c. Same source, nothing material changed → just record that we re-verified it.
  const deadlineChanged = (existing.closes_at?.getTime() ?? null) !== (dl.closes_at?.getTime() ?? null);
  if (existing.content_fingerprint === hash && existing.status === status && !deadlineChanged) {
    await tx`UPDATE opportunities SET last_retrieved_at = ${now}, last_verified_at = ${now},
               source_modified_at = GREATEST(source_modified_at, ${validModified}) WHERE id = ${id}`;
    await writeDetails(tx, id, item, now);
    return { outcome: "unchanged", opportunity_id: id };
  }

  // 4d. A closed call may only reopen on NEWER source evidence (protects against stale caches / index lag).
  const reopening = CLOSED.includes(existing.status) && LIVE.includes(status);
  if (reopening && !(validModified && existing.source_modified_at && validModified > existing.source_modified_at)) {
    await tx`UPDATE opportunities SET has_conflict = true, updated_at = now() WHERE id = ${id}`;
    await recordEvent(tx, id, "conflict_detected", `conflict:reopen:${id}:${hash.slice(0, 16)}`, {
      field: "status", existing: existing.status, reported: status, reason: "reopen_without_newer_evidence",
    });
    return { outcome: "conflict", opportunity_id: id, detail: "reopen_without_newer_evidence" };
  }

  // 4e. Material change: snapshot the previous state, then update.
  const newVersion = existing.version + 1;
  const statusChanged = existing.status !== status;
  // Same official facts, but time moved past a cut-off: the next cut-off becomes current. Not an extension or amendment.
  const nextCutoff = existing.content_fingerprint === hash && deadlineChanged;
  const kind = nextCutoff ? (statusChanged ? "status" : "amendment")
    : deadlineChanged && dl.closes_at && existing.closes_at && dl.closes_at > existing.closes_at ? "extension"
    : deadlineChanged ? "amendment" : statusChanged ? "status" : "amendment";
  await snapshot(tx, id, existing.version, existing.version === 1 ? "created" : "amendment", "state before update", docId);
  const finalStatus: OpportunityStatus = kind === "extension" && status === "open" ? "extended" : status;
  const reason = pastLastDeadline ? "deadline_passed_source_still_lists_open" : nextCutoff ? "next_cutoff" : kind;
  await tx`
    UPDATE opportunities SET
      official_title = ${(f?.official_title ?? item.title).slice(0, 1000)}, programme = ${f?.programme ?? null},
      opens_at = ${opens}, closes_at = ${dl.closes_at}, deadline_state = ${dl.closes_at ? "known" : "unknown"}, deadline_kind = ${dl.deadline_kind},
      deadline_original_text = ${dl.deadline_original_text}, deadline_is_date_only = ${dl.deadline_is_date_only},
      additional_deadlines = ${otherDeadlines.length ? tx.json(otherDeadlines as never) : null},
      status = ${finalStatus}, status_confidence = ${f?.status && !pastLastDeadline ? "high" : "low"}, status_reason = ${reason},
      status_evidence = ${tx.json({ source_url: canonical, status_raw: f?.status_raw ?? null, document_id: docId } as never)},
      last_retrieved_at = ${now}, last_verified_at = ${now}, source_modified_at = GREATEST(source_modified_at, ${validModified}),
      content_fingerprint = ${hash}, version = ${newVersion}, updated_at = now()
    WHERE id = ${id}`;
  await writeDetails(tx, id, item, now);
  await snapshot(tx, id, newVersion, kind, nextCutoff ? `next cut-off now current (${source.slug})` : `${kind} detected by ${source.slug}`, docId);
  if (statusChanged || finalStatus !== existing.status) {
    await tx`INSERT INTO opportunity_status_history (opportunity_id, from_status, to_status, reason, evidence, actor)
             VALUES (${id}, ${existing.status}, ${finalStatus}, ${kind}, ${tx.json({ source_url: canonical, status_raw: f?.status_raw ?? null } as never)}, 'system')`;
    await recordEvent(tx, id, "status_changed", `status_changed:${id}:v${newVersion}`, { from: existing.status, to: finalStatus });
  }
  if (deadlineChanged && !nextCutoff) { // a cut-off simply passing is not a change to the official schedule: no alert
    await evidence(tx, id, "deadline", { closes_at: dl.closes_at, original: dl.deadline_original_text }, canonical, docId, rank, "approved");
    await recordEvent(tx, id, "deadline_changed", `deadline_changed:${id}:v${newVersion}`, { from: existing.closes_at, to: dl.closes_at, kind });
  }
  return { outcome: "changed", opportunity_id: id, detail: kind };
}

/**
 * After a COMPLETE (non-truncated) successful run, live opportunities from this source that were not listed
 * are marked "unverified" — absence from a listing is NOT proof that a call closed.
 */
export async function markUnlisted(tx: Tx, sourceId: string, seenIds: string[], now: Date): Promise<number> {
  const rows = await tx<{ id: string; status: OpportunityStatus; version: number }[]>`
    SELECT id, status, version FROM opportunities
    WHERE source_id = ${sourceId} AND merged_into_id IS NULL AND status IN ('open','upcoming','extended')
      AND NOT (id = ANY(${seenIds}::uuid[])) FOR UPDATE`;
  for (const r of rows) {
    await tx`UPDATE opportunities SET status = 'unverified', status_reason = 'no_longer_listed_by_source', status_confidence = 'low', updated_at = now() WHERE id = ${r.id}`;
    await tx`INSERT INTO opportunity_status_history (opportunity_id, from_status, to_status, reason, actor)
             VALUES (${r.id}, ${r.status}, 'unverified', 'no_longer_listed_by_source', 'system')`;
    await recordEvent(tx, r.id, "status_unverified", `unlisted:${r.id}:${now.toISOString().slice(0, 10)}`, { from: r.status });
  }
  return rows.length;
}

/** Deadlines that passed without confirmation → "unverified" (never "closed" without evidence). */
export async function sweepPassedDeadlines(tx: Tx, now: Date): Promise<number> {
  const rows = await tx<{ id: string; status: OpportunityStatus }[]>`
    UPDATE opportunities o SET status = 'unverified', status_reason = 'deadline_passed_pending_recheck', status_confidence = 'low', updated_at = now()
    FROM (SELECT id, status FROM opportunities WHERE status IN ('open','extended','upcoming') AND deadline_kind = 'official'
          AND closes_at < ${now} AND merged_into_id IS NULL AND NOT is_synthetic FOR UPDATE) prev
    WHERE o.id = prev.id RETURNING o.id, prev.status`;
  for (const r of rows) {
    await tx`INSERT INTO opportunity_status_history (opportunity_id, from_status, to_status, reason, actor)
             VALUES (${r.id}, ${r.status}, 'unverified', 'deadline_passed_pending_recheck', 'system')`;
    await recordEvent(tx, r.id, "status_unverified", `deadline_passed:${r.id}`, { from: r.status });
  }
  return rows.length;
}
