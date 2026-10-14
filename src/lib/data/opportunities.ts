import type postgres from "postgres";
import { geographyValue, parseRequirement } from "@/lib/domain/requirements";
import type { OpportunityForMatching, OpportunityStatus } from "@/lib/domain/eligibility";
import { requirementRecordSchema, type RequirementRecord } from "@/lib/domain/engine/requirement";

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
}

export interface OpportunityFilters {
  q?: string;
  category?: string;
  status?: OpportunityStatus;
  type?: string;
}

const SELECT = (sql: postgres.Sql) => sql`
  SELECT o.*, s.name AS source_name, s.stale_after_hours AS source_stale_after_hours,
         coalesce(array_agg(l.category_code) FILTER (WHERE l.category_code IS NOT NULL), '{}') AS categories
  FROM opportunities o
  LEFT JOIN sources s ON s.id = o.source_id
  LEFT JOIN opportunity_category_links l ON l.opportunity_id = o.id`;

/** Public listing: only approved records (pending AI extractions never appear). */
export async function listOpportunities(sql: postgres.Sql, f: OpportunityFilters = {}): Promise<OpportunityRow[]> {
  const q = f.q?.trim().slice(0, 100);
  return sql<OpportunityRow[]>`
    ${SELECT(sql)}
    WHERE o.merged_into_id IS NULL AND o.review_status = 'approved'
      ${q ? sql`AND (o.official_title ILIKE ${"%" + q + "%"} OR o.summary_plain ILIKE ${"%" + q + "%"} OR o.official_identifier ILIKE ${"%" + q + "%"})` : sql``}
      ${f.status ? sql`AND o.status = ${f.status}` : sql``}
      ${f.type ? sql`AND o.opportunity_type = ${f.type}` : sql``}
      ${f.category ? sql`AND EXISTS (SELECT 1 FROM opportunity_category_links c WHERE c.opportunity_id = o.id AND c.category_code = ${f.category})` : sql``}
    GROUP BY o.id, s.name, s.stale_after_hours
    ORDER BY (o.status IN ('closed','cancelled','archived')), o.closes_at NULLS LAST, o.official_title
    LIMIT 500`;
}

export async function getOpportunity(sql: postgres.Sql, id: string): Promise<OpportunityRow | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [row] = await sql<OpportunityRow[]>`${SELECT(sql)} WHERE o.id = ${id} AND o.review_status = 'approved' GROUP BY o.id, s.name, s.stale_after_hours`;
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
