/**
 * Opportunity discovery (Milestone 2, 17 Oct 2026): search text, applicant type on listings and a transparent default
 * order. Server-free so it can be tested. Ordering never changes eligibility and never hides a programme.
 *
 * Default order (shown to visitors in plain words on the page):
 *  1. current records first (open → upcoming → awaiting re-check → unconfirmed), expired and closed last;
 *  2. within each, programmes recorded as open to individuals, then unknown applicant type, then organisations only;
 *  3. Greek programmes before EU ones;
 *  4. nearest deadline, then title.
 */
import type { OpportunityRow } from "@/lib/data/opportunities";
import { categoryBySlug } from "./taxonomy";
import { verifiedFor } from "./verified";
import { applicantAudienceOf, type ApplicantAudience } from "./applicants";
import type { StatusGroup } from "./status-group";

type Row = Pick<OpportunityRow, "official_title" | "summary_plain" | "official_identifier" | "publishing_authority" | "external_key" | "official_details">;

/** Everything a visitor might type to find a record: official and translated titles, summaries, identifier,
 *  authority, call title and the category names in both languages. */
export function listingHaystack(row: Row, categories: string[]): string {
  const v = verifiedFor(row.external_key);
  const cats = categories.flatMap((c) => { const x = categoryBySlug(c); return x ? [x.name.el, x.name.en] : []; });
  return [
    row.official_title, row.summary_plain ?? "", row.official_identifier ?? "", row.publishing_authority ?? "",
    row.official_details?.call?.title ?? "", v?.title.el ?? "", v?.title.en ?? "", v?.summary.el ?? "", v?.summary.en ?? "", ...cats,
  ].join(" \n ");
}

/** Who may apply, for listings (no requirements loaded here: hand-checked records only, others unknown). */
export const listingApplicants = (row: Pick<OpportunityRow, "external_key">): ApplicantAudience => applicantAudienceOf(row);

const STATUS_RANK: Record<StatusGroup, number> = { open: 0, upcoming: 1, recheck: 2, other: 3, passed: 4, closed: 5 };
const APPLICANT_RANK: Record<ApplicantAudience, number> = { individuals: 0, both: 0, unknown: 1, organisations: 2 };

export interface Rankable {
  status: StatusGroup; applicant: ApplicantAudience; scope: "eu" | "gr";
  row: Pick<OpportunityRow, "closes_at" | "official_title">;
}

export function compareListed(a: Rankable, b: Rankable): number {
  return STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || APPLICANT_RANK[a.applicant] - APPLICANT_RANK[b.applicant]
    || (a.scope === "gr" ? 0 : 1) - (b.scope === "gr" ? 0 : 1)
    || (a.row.closes_at?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.row.closes_at?.getTime() ?? Number.MAX_SAFE_INTEGER)
    || a.row.official_title.localeCompare(b.row.official_title);
}

/** A title that is only a programme code (e.g. "SOCPL-2026-INFO-REPR"). */
export const isCodeOnly = (title: string) => /^[A-Z0-9][A-Z0-9_./-]{3,}$/.test(title.trim()) && !/\s/.test(title.trim());
