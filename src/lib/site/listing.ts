/**
 * Public listing for the redesigned pages: the approved records plus the browsing facets (category, audience,
 * source scope, support type, status group). Reads only; the eligibility engine is not involved here
 * (availability comes from the same availabilityOf() the engine uses).
 */
import "server-only";
import type postgres from "postgres";
import { listOpportunities, loadRequirements, toMatchable, type OpportunityRow } from "@/lib/data/opportunities";
import { availabilityOf, type Availability } from "@/lib/domain/eligibility";
import { isCurrent, recordStatus, type RecordStatus } from "@/lib/domain/record-status";
import type { PersonaId } from "@/lib/domain/personas";
import { audiencesOf, categoriesOf, scopeOf, supportTypeOf, type SupportType } from "./taxonomy";
import { matches } from "@/lib/text/search";
import { compareListed, listingApplicants, listingHaystack } from "./discovery";
import { applicantAudienceOf, type ApplicantAudience } from "./applicants";
import { isHandChecked } from "./provenance";

import { statusGroup, type StatusGroup } from "./status-group";
export { statusGroup, type StatusGroup };

export interface ListedOpportunity {
  row: OpportunityRow;
  availability: Availability;
  /** Canonical display status (record-status.ts) — what every page shows. */
  record: RecordStatus;
  status: StatusGroup;
  categories: string[];
  audiences: PersonaId[];
  scope: "eu" | "gr";
  support: SupportType;
  /** Who may apply, where recorded (hand-checked records); otherwise "unknown". */
  applicant: ApplicantAudience;
}


export interface ListingFilters {
  q?: string; cat?: string; type?: string; audience?: string; scope?: string; status?: string; industry?: string; applicant?: string;
}


export async function loadListing(sql: postgres.Sql, f: ListingFilters = {}, now = new Date()): Promise<ListedOpportunity[]> {
  // Search runs here, not in SQL, so Greek accents, case and final sigma are folded the same way as in Guides.
  const rows = await listOpportunities(sql, { industry: f.industry, limit: 5000 });
  // Records imported from a manual review carry their applicant type as a reviewed requirement (not a hard-coded map).
  const reviewedIds = rows.filter((r) => r.publication_basis === "manual_review" && !r.external_key?.startsWith("manual:")).map((r) => r.id);
  const reviewedReqs = reviewedIds.length ? await loadRequirements(sql, reviewedIds) : new Map();
  const all = rows.map((row): ListedOpportunity => {
    const m = toMatchable(row, []);
    const availability = availabilityOf(m, now);
    const record = recordStatus(m, now);
    return {
      row, availability, record, status: statusGroup(record), categories: categoriesOf(row), audiences: audiencesOf(row),
      scope: scopeOf(row), support: supportTypeOf(row.opportunity_type),
      applicant: reviewedReqs.has(row.id) ? applicantAudienceOf(row, reviewedReqs.get(row.id)!) : listingApplicants(row),
    };
  });
  return all
    .filter((x) => !f.q || matches(listingHaystack(x.row, x.categories), f.q))
    .filter((x) => !f.cat || x.categories.includes(f.cat))
    .filter((x) => !f.applicant || (f.applicant === "individuals" ? x.applicant === "individuals" || x.applicant === "both" : x.applicant === f.applicant))
    .filter((x) => !f.type || x.support === f.type)
    .filter((x) => !f.audience || x.audiences.includes(f.audience as PersonaId))
    .filter((x) => !f.scope || x.scope === f.scope)
    .filter((x) => !f.status || f.status === "all" || (f.status === "current" ? isCurrent(x.record) : x.status === f.status))
    .sort(compareListed);
}

/** Open records with the nearest deadlines, hand-checked Greek records first (they carry plain-language summaries). */
export function featured(list: ListedOpportunity[], n = 6): ListedOpportunity[] {
  const open = list.filter((x) => x.status === "open" && !x.row.is_synthetic);
  const manual = open.filter((x) => isHandChecked(x.row));
  const rest = open.filter((x) => !isHandChecked(x.row) && x.row.closes_at);
  // One card per category, so the homepage shows the range of what exists.
  const seen = new Set<string>(); const out: ListedOpportunity[] = [];
  for (const x of [...manual, ...rest]) {
    const key = x.categories[0] ?? x.row.id;
    if (seen.has(key)) continue;
    seen.add(key); out.push(x);
    if (out.length === n) break;
  }
  return out;
}

/**
 * Homepage «selected checked opportunities»: ONLY hand-checked records (manual:* or manual_review) that are open now, one per category.
 * Records imported automatically are never presented as checked.
 */
export function featuredChecked(list: ListedOpportunity[], n = 3): ListedOpportunity[] {
  return featured(list.filter((x) => isHandChecked(x.row)), n);
}

/** Per category: listings open or upcoming now, and all listings (incl. expired / unconfirmed). */
export function countByCategory(list: ListedOpportunity[]): Record<string, { open: number; total: number; recheck: number }> {
  const out: Record<string, { open: number; total: number; recheck: number }> = {};
  for (const x of list) for (const c of x.categories) {
    const e = (out[c] ??= { open: 0, total: 0, recheck: 0 });
    e.total++;
    if (x.status === "open" || x.status === "upcoming") e.open++;
    else if (isCurrent(x.record)) e.recheck++; // awaiting re-check (or unverified/conflicting) — never counted as open
  }
  return out;
}
