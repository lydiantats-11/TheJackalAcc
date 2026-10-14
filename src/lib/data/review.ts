/**
 * Human review of AI-extracted candidates (admin only, audited).
 * Approval rules:
 *  - a requirement can only be approved if its quote was found VERBATIM in the stored official document
 *    and its value matches the engine format (or it is a free-text "other" rule, which the engine never auto-decides);
 *  - approving replaces the current rule with the same key as a NEW version (history kept);
 *  - affected users' matches are recalculated.
 */
import type postgres from "postgres";
import { assertAdmin, type SessionUser } from "@/lib/auth/service";
import { normaliseDeadline } from "@/lib/domain/deadline";
import { VALUE_SCHEMAS, isKnownCategory } from "@/lib/domain/engine/requirement";
import { safeFetch } from "@/lib/sources/fetcher";
import { canonicalizeUrl, contentFingerprint } from "@/lib/sources/types";
import { documentToText } from "@/lib/documents/text";
import { recalcMatches } from "@/lib/ingestion/matches";

export interface CandidateRow {
  id: string; opportunity_id: string; official_title: string; candidate_type: "requirement" | "fact";
  payload: Record<string, any>; quote: string; quote_verified: boolean; value_valid: boolean; review_reasons: string[];
  status: string; created_at: Date; document_url: string | null; injection_suspected: boolean;
}

export async function listPendingCandidates(sql: postgres.Sql, actor: SessionUser | null, opportunityId?: string): Promise<CandidateRow[]> {
  assertAdmin(actor);
  return sql<CandidateRow[]>`
    SELECT c.*, o.official_title, d.canonical_url AS document_url, r.injection_suspected
    FROM extraction_candidates c JOIN opportunities o ON o.id = c.opportunity_id
    JOIN extraction_runs r ON r.id = c.run_id LEFT JOIN source_documents d ON d.id = c.document_id
    WHERE c.status = 'pending' ${opportunityId ? sql`AND c.opportunity_id = ${opportunityId}` : sql``}
    ORDER BY o.official_title, c.candidate_type DESC, c.created_at`;
}

export type ReviewResult = { ok: true } | { ok: false; reason: string };

export async function approveCandidate(
  sql: postgres.Sql, actor: SessionUser | null, candidateId: string,
  opts: { evidenceRank?: 1 | 2 | 3; note?: string; now?: Date } = {},
): Promise<ReviewResult> {
  assertAdmin(actor);
  const now = opts.now ?? new Date();
  const res = await sql.begin(async (tx): Promise<ReviewResult & { opp?: string }> => {
    const [c] = await tx<(CandidateRow & { document_id: string | null })[]>`
      SELECT c.*, d.canonical_url AS document_url FROM extraction_candidates c LEFT JOIN source_documents d ON d.id = c.document_id
      WHERE c.id = ${candidateId} FOR UPDATE OF c`;
    if (!c) return { ok: false, reason: "not_found" };
    if (c.status !== "pending") return { ok: false, reason: "not_pending" };
    if (!c.quote_verified) return { ok: false, reason: "quote_not_verified" };
    if (!c.value_valid) return { ok: false, reason: "value_invalid" };
    const p = c.payload;
    const evidence = { source_url: c.document_url ?? "https://invalid.example/", excerpt: c.quote, location: p.location || undefined };

    if (c.candidate_type === "requirement") {
      const category = isKnownCategory(p.category) ? p.category : "other";
      if (category !== "other" && !VALUE_SCHEMAS[category]!.safeParse(p.value).success) return { ok: false, reason: "value_invalid" };
      const [prev] = await tx<{ version: number }[]>`
        UPDATE opportunity_requirements SET superseded_at = ${now}
        WHERE opportunity_id = ${c.opportunity_id} AND requirement_key = ${p.key} AND superseded_at IS NULL RETURNING version`;
      const [{ max } = { max: 0 }] = await tx<{ max: number }[]>`
        SELECT coalesce(max(version), 0)::int AS max FROM opportunity_requirements WHERE opportunity_id = ${c.opportunity_id} AND requirement_key = ${p.key}`;
      await tx`INSERT INTO opportunity_requirements (opportunity_id, requirement_key, version, category, kind, applies_to, value, original_text, original_lang,
                                                     evidence, evidence_rank, confidence, flags, origin, verified_at, candidate_id, reviewed_by)
               VALUES (${c.opportunity_id}, ${p.key}, ${max + 1}, ${category}, ${p.kind}, ${p.applies_to?.length ? p.applies_to : null},
                       ${tx.json(p.value ?? null)}, ${c.quote}, ${/[Ͱ-Ͽ]/.test(c.quote) ? "el" : "en"},
                       ${tx.json(evidence as never)}, ${opts.evidenceRank ?? 2}, 'high', ${["ai_extracted"]}, 'ai', ${now}, ${c.id}, ${actor.id})`;
      await tx`UPDATE opportunities SET requirement_set_version = requirement_set_version + 1,
                 requirement_set_completeness = CASE WHEN requirement_set_completeness = 'unknown' THEN 'partial' ELSE requirement_set_completeness END,
                 updated_at = now() WHERE id = ${c.opportunity_id}`;
      if (prev) await tx`INSERT INTO opportunity_events (opportunity_id, event_type, dedupe_key, payload)
                         VALUES (${c.opportunity_id}, 'requirements_changed', ${`req:${c.opportunity_id}:${p.key}:v${max + 1}`}, ${tx.json({ key: p.key } as never)})
                         ON CONFLICT DO NOTHING`;
    } else {
      const field = p.field as string;
      const [o] = await tx<{ version: number; deadline_timezone: string }[]>`SELECT version, deadline_timezone FROM opportunities WHERE id = ${c.opportunity_id} FOR UPDATE`;
      await tx`INSERT INTO opportunity_versions (opportunity_id, version, snapshot, change_kind, change_summary, changed_by)
               SELECT id, ${o!.version}, to_jsonb(x.*) - 'version', 'admin_correction', 'before reviewed AI fact', ${actor.id}
               FROM opportunities x WHERE id = ${c.opportunity_id} ON CONFLICT DO NOTHING`;
      if (field === "deadline") {
        const d = normaliseDeadline(p.value, o!.deadline_timezone);
        if (!d.closes_at) return { ok: false, reason: "value_invalid" };
        await tx`UPDATE opportunities SET closes_at = ${d.closes_at}, deadline_state = 'known', deadline_kind = 'official', deadline_original_text = ${c.quote},
                   deadline_is_date_only = ${d.deadline_is_date_only}, version = version + 1, updated_at = now() WHERE id = ${c.opportunity_id}`;
      } else if (field === "funding_min" || field === "funding_max") {
        await tx`UPDATE opportunities SET ${tx({ [field]: Number(p.value) })}, funding_amount_state = 'known', version = version + 1, updated_at = now() WHERE id = ${c.opportunity_id}`;
      } else if (field === "funding_intensity_pct") {
        await tx`UPDATE opportunities SET funding_intensity_pct = ${Number(p.value)}, version = version + 1, updated_at = now() WHERE id = ${c.opportunity_id}`;
      } else if (field === "application_url") {
        await tx`UPDATE opportunities SET application_url = ${p.value}, version = version + 1, updated_at = now() WHERE id = ${c.opportunity_id}`;
      } else if (field === "opportunity_type") {
        const allowed = ["grant", "subsidy", "loan", "guarantee", "equity", "tax_incentive", "training", "employment_subsidy", "procurement", "prize", "mixed", "other"];
        if (!allowed.includes(p.value)) return { ok: false, reason: "value_invalid" };
        await tx`UPDATE opportunities SET opportunity_type = ${p.value}, version = version + 1, updated_at = now() WHERE id = ${c.opportunity_id}`;
      } else return { ok: false, reason: "unsupported_fact" };
      await tx`INSERT INTO opportunity_field_evidence (opportunity_id, field, value, evidence_text, source_url, document_id, page_ref, method, evidence_rank, confidence, review_status)
               VALUES (${c.opportunity_id}, ${field}, ${tx.json(p.value)}, ${c.quote}, ${evidence.source_url}, ${c.document_id}, ${p.location ?? null}, 'ai', ${opts.evidenceRank ?? 2}, 'high', 'approved')`;
    }
    await tx`UPDATE extraction_candidates SET status = 'approved', reviewer_id = ${actor.id}, reviewed_at = ${now}, review_note = ${opts.note ?? null} WHERE id = ${c.id}`;
    await tx`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
             VALUES (${actor.id}, 'ai_candidate_approved', 'opportunity', ${c.opportunity_id}, ${tx.json({ candidate: c.id, type: c.candidate_type } as never)})`;
    return { ok: true, opp: c.opportunity_id };
  });
  if (res.ok && res.opp) await recalcMatches(sql, { opportunityIds: [res.opp], now });
  return res.ok ? { ok: true } : res;
}

export async function rejectCandidate(sql: postgres.Sql, actor: SessionUser | null, candidateId: string, note: string): Promise<ReviewResult> {
  assertAdmin(actor);
  const rows = await sql`UPDATE extraction_candidates SET status = 'rejected', reviewer_id = ${actor.id}, reviewed_at = now(), review_note = ${note.slice(0, 2000)}
                         WHERE id = ${candidateId} AND status = 'pending' RETURNING opportunity_id`;
  if (!rows.length) return { ok: false, reason: "not_pending" };
  await sql`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
            VALUES (${actor.id}, 'ai_candidate_rejected', 'opportunity', ${rows[0]!.opportunity_id}, ${sql.json({ candidate: candidateId, note: note.slice(0, 200) })})`;
  return { ok: true };
}

/** A reviewer declares the requirement set complete (or not) after reading the whole official document. */
export async function setCompleteness(sql: postgres.Sql, actor: SessionUser | null, opportunityId: string, value: "partial" | "complete"): Promise<void> {
  assertAdmin(actor);
  await sql`UPDATE opportunities SET requirement_set_completeness = ${value}, updated_at = now() WHERE id = ${opportunityId}`;
  await sql`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
            VALUES (${actor.id}, 'requirement_set_completeness', 'opportunity', ${opportunityId}, ${sql.json({ value })})`;
  await recalcMatches(sql, { opportunityIds: [opportunityId] });
}

/**
 * Fetches an official document for an opportunity (only from its source's allow-listed hosts) and stores its text.
 * Returns the document id. Same content twice → same document (no duplicate extraction cost).
 */
export async function attachOfficialDocument(
  sql: postgres.Sql, actor: SessionUser | null, opportunityId: string, url: string, fetchImpl: typeof fetch = fetch,
): Promise<string> {
  assertAdmin(actor);
  const [o] = await sql<{ source_id: string | null; allowed_hosts: string[] | null }[]>`
    SELECT o.source_id, s.allowed_hosts FROM opportunities o LEFT JOIN sources s ON s.id = o.source_id WHERE o.id = ${opportunityId}`;
  if (!o?.source_id || !o.allowed_hosts) throw new Error("opportunity has no official source");
  const res = await safeFetch(url, { allowedHosts: o.allowed_hosts }, fetchImpl);
  const { text, kind, pages } = await documentToText(res.body, res.contentType);
  if (text.trim().length < 200) throw new Error("document has too little extractable text (scanned PDF?)");
  const canonical = canonicalizeUrl(res.url);
  const hash = contentFingerprint(text);
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO source_documents (source_id, url, canonical_url, content_hash, mime_type, http_status, title, text_content, classification)
    VALUES (${o.source_id}, ${url}, ${canonical}, ${hash}, ${kind === "pdf" ? "application/pdf" : res.contentType}, ${res.status},
            ${pages ? `${pages} pages` : null}, ${text}, 'opportunity')
    ON CONFLICT (source_id, canonical_url, content_hash) DO UPDATE SET fetched_at = now()
    RETURNING id`;
  await sql`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
            VALUES (${actor.id}, 'official_document_attached', 'opportunity', ${opportunityId}, ${sql.json({ url: canonical, document: row!.id })})`;
  return row!.id;
}
