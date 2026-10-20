/**
 * Credibility rules for wording and money (owner decision, 21 Oct 2026). Pure functions, no I/O, so they can be tested.
 *
 * 1. «Επίσημη διατύπωση» is reserved for an exact quotation: the requirement text counts as official wording only when the
 *    recorded source excerpt contains it word for word. Anything else is a platform summary («Σύνοψη προϋποθέσεων»).
 * 2. Four money figures are never confused:
 *      rate            — subsidy rate (%) of the budget, a range when it depends on size or cost type;
 *      projectBudget   — eligible (or subsidised) expenditure of ONE application, as the call states it;
 *      grant           — the amount ONE applicant can receive, only when the call states it;
 *      programmeBudget — public money for ALL projects together. Never shown as what an applicant gets, never on cards.
 */
import type { OfficialDetails } from "@/lib/sources/types";

const norm = (s: string) => s.normalize("NFC").replace(/[«»“”"'‘’]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function isOfficialQuote(r: { original_text: string; evidence?: { excerpt?: string | null } | null }): boolean {
  const ex = r.evidence?.excerpt;
  if (!ex || !r.original_text) return false;
  const a = norm(r.original_text), b = norm(ex);
  return a.length > 0 && b.includes(a);
}

export type Range = { min: number | null; max: number | null };
export interface Money {
  rate: (Range & { note?: string }) | null;
  projectBudget: (Range & { basis: "eligible" | "subsidised" | "project"; note?: string }) | null;
  grant: Range | null;
  programmeBudget: number | null;
}

type Row = { funding_amount_state: string; funding_min: number | string | null; funding_max: number | string | null; funding_intensity_pct: number | string | null; official_details: OfficialDetails | null };
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

/** The four figures of a record, each only when recorded. */
export function moneyOf(o: Row): Money {
  const d = o.official_details;
  const f = d?.funding;
  const rate = f?.rate ?? (num(o.funding_intensity_pct) !== null ? { min: num(o.funding_intensity_pct), max: num(o.funding_intensity_pct) } : null);
  const projectBudget = f?.project_budget ?? null;
  let grant: Range | null = f?.grant ?? null;
  if (!grant && o.funding_amount_state === "known") grant = { min: num(o.funding_min), max: num(o.funding_max) };
  if (!grant && d?.budget && (d.budget.min_grant_eur || d.budget.max_grant_eur)) grant = { min: d.budget.min_grant_eur, max: d.budget.max_grant_eur };
  const programmeBudget = d?.budget && d.budget.total_eur > 0 ? d.budget.total_eur : null;
  return { rate, projectBudget, grant, programmeBudget };
}

/** True when the record states at least one figure about what an applicant gets (rate, project budget or grant). */
export const hasApplicantMoney = (m: Money) => !!(m.rate || m.projectBudget || m.grant);

export const pctText = (r: Range) =>
  r.min !== null && r.max !== null && r.min !== r.max ? `${r.min}–${r.max}%` : `${r.max ?? r.min}%`;
