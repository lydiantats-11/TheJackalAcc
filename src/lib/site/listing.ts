/**
 * Public listing for the redesigned pages: the approved records plus the browsing facets (category, audience,
 * source scope, support type, status group). Reads only; the eligibility engine is not involved here
 * (availability comes from the same availabilityOf() the engine uses).
 */
import "server-only";
import type postgres from "postgres";
import { listOpportunities, toMatchable, type OpportunityRow } from "@/lib/data/opportunities";
import { availabilityOf, type Availability } from "@/lib/domain/eligibility";
import type { PersonaId } from "@/lib/domain/personas";
import { audiencesOf, categoriesOf, scopeOf, supportTypeOf, type SupportType } from "./taxonomy";

export type StatusGroup = "open" | "upcoming" | "passed" | "closed" | "other";

export interface ListedOpportunity {
  row: OpportunityRow;
  availability: Availability;
  status: StatusGroup;
  categories: string[];
  audiences: PersonaId[];
  scope: "eu" | "gr";
  support: SupportType;
}

export function statusGroup(a: Availability): StatusGroup {
  if (a === "open") return "open";
  if (a === "upcoming") return "upcoming";
  if (a === "deadline_passed_unconfirmed") return "passed";
  if (a === "closed" || a === "closed_budget_exhausted") return "closed";
  return "other";
}

export interface ListingFilters {
  q?: string; cat?: string; type?: string; audience?: string; scope?: string; status?: string; industry?: string;
}

const RANK: Record<StatusGroup, number> = { open: 0, upcoming: 1, other: 2, passed: 3, closed: 4 };

export async function loadListing(sql: postgres.Sql, f: ListingFilters = {}, now = new Date()): Promise<ListedOpportunity[]> {
  const rows = await listOpportunities(sql, { q: f.q, industry: f.industry, limit: 5000 });
  const all = rows.map((row): ListedOpportunity => {
    const availability = availabilityOf(toMatchable(row, []), now);
    return {
      row, availability, status: statusGroup(availability), categories: categoriesOf(row), audiences: audiencesOf(row),
      scope: scopeOf(row), support: supportTypeOf(row.opportunity_type),
    };
  });
  return all
    .filter((x) => !f.cat || x.categories.includes(f.cat))
    .filter((x) => !f.type || x.support === f.type)
    .filter((x) => !f.audience || x.audiences.includes(f.audience as PersonaId))
    .filter((x) => !f.scope || x.scope === f.scope)
    .filter((x) => !f.status || x.status === f.status)
    .sort((a, b) => RANK[a.status] - RANK[b.status]
      || (a.row.closes_at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.row.closes_at?.getTime() ?? Number.MAX_SAFE_INTEGER)
      || a.row.official_title.localeCompare(b.row.official_title));
}

/** Open records with the nearest deadlines, hand-checked Greek records first (they carry plain-language summaries). */
export function featured(list: ListedOpportunity[], n = 6): ListedOpportunity[] {
  const open = list.filter((x) => x.status === "open" && !x.row.is_synthetic);
  const manual = open.filter((x) => x.row.external_key?.startsWith("manual:"));
  const rest = open.filter((x) => !x.row.external_key?.startsWith("manual:") && x.row.closes_at);
  return [...manual, ...rest].slice(0, n);
}

/** Per category: listings open or upcoming now, and all listings (incl. expired / unconfirmed). */
export function countByCategory(list: ListedOpportunity[]): Record<string, { open: number; total: number }> {
  const out: Record<string, { open: number; total: number }> = {};
  for (const x of list) for (const c of x.categories) {
    const e = (out[c] ??= { open: 0, total: 0 });
    e.total++;
    if (x.status === "open" || x.status === "upcoming") e.open++;
  }
  return out;
}
