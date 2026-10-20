import type postgres from "postgres";
import { geographyValue, parseRequirement } from "@/lib/domain/requirements";
import type { OpportunityForMatching, OpportunityStatus } from "@/lib/domain/eligibility";
import { requirementRecordSchema, type RequirementRecord } from "@/lib/domain/engine/requirement";
import type { OfficialDetails } from "@/lib/sources/types";

export interface OpportunityRow {
  id: string;
  is_synthetic: boolean;
  official_title: string;
  title_lang: string;
  summary_plain: string | null;
  summary_origin: "ai" | "admin" | "official" | null;
  opportunity_type: string;
  publishing_authority: string | null;
  programme: string | null;
  canonical_url: string;
  application_url: string | null;
  official_identifier: string | null;
  /** Stable key from the source or "manual:<id>" for hand-checked records (selected by o.*). */
  external_key: string | null;
  status: OpportunityStatus;
  status_reason: string | null;
  status_confidence: string;
  closes_at: Date | null;
  opens_at: Date | null;
  published_on: Date | null;
  deadline_kind: OpportunityForMatching["deadline_kind"];
  deadline_original_text: string | null;
  deadline_is_date_only: boolean;
  deadline_timezone: string;
  last_verified_at: Date | null;
  last_retrieved_at: Date | null;
  funding_amount_state: "known" | "unknown" | "not_applicable";
  funding_min: string | null;
  funding_max: string | null;
  currency: string | null;
  funding_intensity_pct: string | null;
  budget_exhausted: "unknown" | "confirmed" | "no";
  has_conflict: boolean;
  publication_basis: string;
  review_status: string;
  requirement_set_completeness: "unknown" | "partial" | "complete";
  version: number;
  categories: string[];
  geographic_scope: unknown;
  source_name: string | null;
  source_stale_after_hours: number | null;
  /** 0007: per-record re-check window for manually reviewed records (e.g. 3 days for an open benefit window). */
  stale_after_days: number | null;
  record_kind: "call" | "application_round" | "standing_procedure" | "programme" | "tax_regime";
  uncertainties: string[];
  /** 0008: industries a record is restricted to; null = not restricted (discovery only, never eligibility). */
  industries: string[] | null;
  /** 0009: what the source publishes in structured form (budget, action type, conditions…); display only. */
  official_details: OfficialDetails | null;
  /** 0002: other official cut-off dates, as published. */
  additional_deadlines: unknown;
}

export interface OpportunityFilters {
  q?: string;
  category?: string;
  status?: OpportunityStatus;
  type?: string;
  /** An industry id: keeps records restricted to it AND records not restricted to any industry. */
  industry?: string;
  /** Maximum rows (default 500, at most 5000). The public listing pages and filters by category in memory. */
  limit?: number;
}

const SELECT = (sql: postgres.Sql) => sql`
  SELECT o.*, s.name AS source_name, s.stale_after_hours AS source_stale_after_hours,
         coalesce(array_agg(l.category_code) FILTER (WHERE l.category_code IS NOT NULL), '{}') AS categories
  FROM opportunities o
  LEFT JOIN sources s ON s.id = o.source_id
  LEFT JOIN opportunity_category_links l ON l.opportunity_id = o.id`;

/**
 * Test records (is_synthetic) never reach user-facing pages (owner, 20 Oct 2026). They stay usable in an isolated
 * test environment that sets JACKAL_SHOW_TEST_RECORDS=true.
 */
const showTestRecords = () => process.env.JACKAL_SHOW_TEST_RECORDS === "true";

/** Public listing: only approved records (pending AI extractions never appear), never test records. */
export async function listOpportunities(sql: postgres.Sql, f: OpportunityFilters = {}): Promise<OpportunityRow[]> {
  const q = f.q?.trim().slice(0, 100);
  return sql<OpportunityRow[]>`
    ${SELECT(sql)}
    WHERE o.merged_into_id IS NULL AND o.review_status = 'approved'
      ${showTestRecords() ? sql`` : sql`AND NOT o.is_synthetic`}
      ${q ? sql`AND (o.official_title ILIKE ${"%" + q + "%"} OR o.summary_plain ILIKE ${"%" + q + "%"} OR o.official_identifier ILIKE ${"%" + q + "%"})` : sql``}
      ${f.status ? sql`AND o.status = ${f.status}` : sql``}
      ${f.type ? sql`AND o.opportunity_type = ${f.type}` : sql``}
      ${f.industry ? sql`AND (o.industries IS NULL OR ${f.industry} = ANY(o.industries))` : sql``}
      ${f.category ? sql`AND EXISTS (SELECT 1 FROM opportunity_category_links c WHERE c.opportunity_id = o.id AND c.category_code = ${f.category})` : sql``}
    GROUP BY o.id, s.name, s.stale_after_hours
    -- Still-available first: closed records last, and records whose deadline has passed after those still open
    -- (the EU portal keeps hundreds of expired topics labelled "open"; listing them first hid the current ones).
    ORDER BY (o.status IN ('closed','cancelled','archived')), (o.closes_at IS NOT NULL AND o.closes_at < now()), o.closes_at NULLS LAST, o.official_title
    LIMIT ${Math.min(Math.max(f.limit ?? 500, 1), 5000)}`;
}

export async function getOpportunity(sql: postgres.Sql, id: string): Promise<OpportunityRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [row] = await sql<OpportunityRow[]>`${SELECT(sql)} WHERE o.id = ${id} AND o.review_status = 'approved' ${showTestRecords() ? sql`` : sql`AND NOT o.is_synthetic`} GROUP BY o.id, s.name, s.stale_after_hours`;
  return row ?? null;
}

interface RequirementRow {
  id: string; opportunity_id: string; requirement_key: string; version: number; category: string; kind: string;
  applies_to: string[] | null; value: unknown; original_text: string; original_lang: string; translation_text: string | null;
  interpretation: string | null; evidence: unknown; evidence_rank: number; confidence: string; flags: string[];
  effective_from: string | null; effective_to: string | null; verified_at: Date | null;
}

/** Current (non-superseded) requirement records, validated. A malformed row becomes a needs_review record, never a pass. */
export async function loadRequirements(sql: postgres.Sql, opportunityIds: string[]): Promise<Map<string, RequirementRecord[]>> {
  const out = new Map<string, RequirementRecord[]>();
  if (opportunityIds.length === 0) return out;
  const rows = await sql<RequirementRow[]>`
    SELECT * FROM opportunity_requirements WHERE opportunity_id = ANY(${opportunityIds}::uuid[]) AND superseded_at IS NULL
    ORDER BY opportunity_id, requirement_key`;
  for (const r of rows) {
    const candidate = {
      id: r.id, key: r.requirement_key, version: r.version, category: r.category, kind: r.kind, applies_to: r.applies_to,
      value: r.value, original_text: r.original_text, original_lang: r.original_lang, interpretation: r.interpretation,
      evidence: r.evidence, evidence_rank: r.evidence_rank, confidence: r.confidence, flags: r.flags,
      effective_from: r.effective_from, effective_to: r.effective_to, verified_at: r.verified_at?.toISOString() ?? null,
    };
    const parsed = requirementRecordSchema.safeParse(candidate);
    const rec: RequirementRecord = parsed.success
      ? (parsed.data as RequirementRecord)
      : { ...(candidate as unknown as RequirementRecord), kind: "mandatory", evidence_rank: 4, confidence: "low", flags: ["needs_review"],
          evidence: { source_url: "https://invalid.example/" } };
    out.set(r.opportunity_id, [...(out.get(r.opportunity_id) ?? []), rec]);
  }
  return out;
}

export function toMatchable(row: OpportunityRow, requirements: RequirementRecord[]): OpportunityForMatching {
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    opportunity_type: row.opportunity_type,
    closes_at: row.closes_at,
    deadline_kind: row.deadline_kind,
    last_verified_at: row.last_verified_at,
    stale_after_hours: row.is_synthetic ? 24 * 365 * 10 : row.stale_after_days ? row.stale_after_days * 24 : row.source_stale_after_hours ?? 72,
    has_conflict: row.has_conflict,
    budget_exhausted: row.budget_exhausted,
    requirement_set_completeness: row.requirement_set_completeness,
    funding_max_eur: row.funding_max !== null && row.currency === "EUR" ? Number(row.funding_max) : null,
    funding_intensity_pct: row.funding_intensity_pct !== null ? Number(row.funding_intensity_pct) : null,
    published_on: row.published_on ?? null,
    requirements,
  };
}

export function geographyOf(row: OpportunityRow) {
  return parseRequirement(geographyValue, row.geographic_scope);
}

export async function listCategories(sql: postgres.Sql) {
  return sql<{ code: string; name_el: string; name_en: string }[]>`SELECT code, name_el, name_en FROM opportunity_categories ORDER BY sort`;
}

export interface HistoryEntry { at: Date; kind: string; summary: string | null; fields?: string[]; budget_before?: number | null; budget_after?: number | null }

/**
 * Change history of one record (core capability 3): versions (created, amendments, extensions, status changes) and
 * logged events (official details changed, sources disagree, deadline passed awaiting confirmation), newest first.
 */
export async function loadHistory(sql: postgres.Sql, id: string, limit = 20): Promise<HistoryEntry[]> {
  const versions = await sql<{ at: Date; kind: string; summary: string | null }[]>`
    SELECT created_at AS at, change_kind AS kind, change_summary AS summary FROM opportunity_versions
    WHERE opportunity_id = ${id} AND change_summary IS DISTINCT FROM 'state before update' ORDER BY created_at DESC LIMIT ${limit}`;
  const events = await sql<{ at: Date; kind: string; payload: { fields?: string[]; budget_before?: number | null; budget_after?: number | null } }[]>`
    SELECT created_at AS at, event_type AS kind, payload FROM opportunity_events
    WHERE opportunity_id = ${id} AND event_type IN ('official_details_changed', 'conflict_detected', 'status_unverified')
    ORDER BY created_at DESC LIMIT ${limit}`;
  return [
    ...versions.map((v) => ({ at: v.at, kind: v.kind, summary: v.summary })),
    ...events.map((e) => ({ at: e.at, kind: e.kind, summary: null, fields: e.payload?.fields, budget_before: e.payload?.budget_before ?? null, budget_after: e.payload?.budget_after ?? null })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

/** Recorded changes across all records in the last `days` days (for «Νέα για εσάς»; first imports are excluded). */
export async function loadRecentChanges(sql: postgres.Sql, days = 14): Promise<Array<{ opportunity_id: string; at: Date; kind: string }>> {
  const versions = await sql<{ opportunity_id: string; at: Date; kind: string }[]>`
    SELECT opportunity_id, created_at AS at, change_kind AS kind FROM opportunity_versions
    WHERE created_at > now() - make_interval(days => ${days}) AND change_kind <> 'created'
      AND change_summary IS DISTINCT FROM 'state before update'`;
  const events = await sql<{ opportunity_id: string; at: Date; kind: string }[]>`
    SELECT opportunity_id, created_at AS at, event_type AS kind FROM opportunity_events
    WHERE created_at > now() - make_interval(days => ${days}) AND event_type = 'official_details_changed'`;
  return [...versions, ...events];
}
