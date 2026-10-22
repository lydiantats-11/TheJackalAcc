/**
 * Regression tests for the owner's credibility decisions of 21 Oct 2026:
 *  1. paraphrased text is never labelled as an official quotation;
 *  2. a programme budget is never confused with what one applicant gets;
 *  3. verified values are never marked unknown;
 *  4. expired deadlines never appear as current in personalised results;
 *  5. missing or conflicting official evidence is never shown as open.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasApplicantMoney, isOfficialQuote, moneyOf, pctText } from "@/lib/site/money";
import { unknownsOf } from "@/lib/site/unknowns";
import { availabilityOf } from "@/lib/domain/eligibility";
import { isConfirmedOpen, isCurrent, recordStatus } from "@/lib/domain/record-status";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const business = JSON.parse(read("data/business-records-2026-10-20.json")).records as Array<Record<string, any>>;
const manual = JSON.parse(read("data/official-records-2026-10-14.v2.json")).records as Array<Record<string, any>>;
const row = (funding: unknown, total: number | null, extra: Record<string, unknown> = {}) => ({
  funding_amount_state: "unknown", funding_min: null, funding_max: null, funding_intensity_pct: null,
  official_details: { source: "manual-review", funding, ...(total ? { budget: { total_eur: total, by_year: {}, expected_grants: null, min_grant_eur: null, max_grant_eur: null } } : {}) },
  ...extra,
}) as Parameters<typeof moneyOf>[0];

describe("1 · paraphrase is never an official quotation", () => {
  it("text is a quote only when the recorded source excerpt contains it word for word", () => {
    expect(isOfficialQuote({ original_text: "ηλικίας από 25 έως 50 ετών", evidence: { excerpt: "ηλικίας από 25 έως 50 ετών" } })).toBe(true);
    expect(isOfficialQuote({ original_text: "από 25 έως 50", evidence: { excerpt: "«ηλικίας από 25 έως 50 ετών»" } })).toBe(true);
    expect(isOfficialQuote({ original_text: "Νέοι 25–50 ετών", evidence: {} })).toBe(false);
    expect(isOfficialQuote({ original_text: "Νέοι 25–50 ετών", evidence: { excerpt: "ηλικίας από 25 έως 50 ετών" } })).toBe(false);
  });
  it("the business batch stores its applicant summaries without an excerpt, so none can be shown as official wording", () => {
    const seed = read("db/seed/business-records-2026-10-20.sql");
    expect(seed).not.toMatch(/"excerpt"/);
    for (const r of business) expect(isOfficialQuote({ original_text: r.applicant_text, evidence: { source_url: r.documents[0][1] } as never })).toBe(false);
  });
  it("hand-checked rules of 14 Oct: quoted only where an official quote was recorded", () => {
    for (const rec of manual) for (const rule of rec.eligibility_rules) {
      const text = rule.official_quote ?? rule.label.el;
      expect(isOfficialQuote({ original_text: text, evidence: rule.evidence })).toBe(!!rule.official_quote);
    }
  });
  it("the requirements table puts quotation marks and «Επίσημη διατύπωση» only on the quote branch", () => {
    const src = read("src/components/requirements-table.tsx");
    const summary = src.slice(src.indexOf('data-text-kind="summary"'));
    expect(src).toContain("isOfficialQuote(r) ?");
    expect(summary.slice(0, summary.indexOf("</details>"))).not.toMatch(/«\{r\.original_text\}»|“\{r\.original_text\}”/);
    expect(read("src/lib/site/copy.ts")).toContain("Ποιοι μπορούν να υποβάλουν αίτηση — σύνοψη προϋποθέσεων");
  });
});

describe("2 · programme budget is never applicant funding", () => {
  it("a record with only a programme budget has no applicant money", () => {
    const m = moneyOf(row(undefined, 40_000_000));
    expect(m.programmeBudget).toBe(40_000_000);
    expect(m.grant).toBeNull();
    expect(hasApplicantMoney(m)).toBe(false);
  });
  it("rate, project budget, grant and programme budget stay separate", () => {
    const dam22 = business.find((r) => r.id === "dam22")!;
    const m = moneyOf(row(dam22.funding, dam22.total_budget));
    expect(pctText(m.rate!)).toBe("60–70%");
    expect(m.projectBudget).toMatchObject({ min: 300_000, max: 12_000_000, basis: "eligible" });
    expect(m.grant).toBeNull();
    expect(m.programmeBudget).toBe(40_000_000);
    expect(m.projectBudget!.max).not.toBe(m.programmeBudget);
  });
  it("no business record states a per-applicant grant it does not have", () => {
    for (const r of business) expect(r.funding.grant).toBeNull();
  });
  it("cards and the «Τι παίρνετε» box never read the programme budget", () => {
    const src = read("src/components/opportunity-details.tsx");
    for (const fn of ["export function cardAmount", "export function briefWhat"]) {
      const body = src.slice(src.indexOf(fn), src.indexOf("\n}\n", src.indexOf(fn)));
      expect(body).not.toMatch(/programmeBudget|total_eur|s\.card\.budget/);
    }
  });
});

describe("3 · verified values are never marked unknown", () => {
  const base = { record: { display: "open" as const, freshness: "current" as const }, hasConflict: false, completeness: "partial", deadlineKind: "official", hasDeadline: true, applicant: "organisations" as const, documentsApproved: false };
  it("a recorded rate, project budget or verified benefit removes «amount unknown»", () => {
    expect(unknownsOf({ ...base, amountState: "unknown", amountRecorded: true })).not.toContain("amountUnknown");
    expect(unknownsOf({ ...base, amountState: "unknown", amountRecorded: false })).toContain("amountUnknown");
  });
  it("every business record states applicant money", () => {
    for (const r of business) expect(hasApplicantMoney(moneyOf(row(r.funding, r.total_budget)))).toBe(true);
  });
  it("the detail page passes the recorded money to «Τι δεν γνωρίζουμε ακόμη»", () => {
    expect(read("src/app/[aud]/eukairies/[id]/page.tsx")).toContain("amountRecorded:");
  });
});

describe("4 · expired deadlines in personalised results", () => {
  const NOW = new Date("2026-10-21T13:00:00Z");
  const opp = { status: "open", closes_at: new Date("2026-10-21T12:00:00Z"), deadline_kind: "official", last_verified_at: new Date("2026-10-01T00:00:00Z"),
    stale_after_hours: 168, has_conflict: false, budget_exhausted: "unknown" } as never;
  it("passed + stale is «deadline passed», not «needs re-check»", () => {
    expect(availabilityOf(opp, NOW)).toBe("deadline_passed_unconfirmed");
    expect(recordStatus(opp, NOW).display).toBe("deadline_passed");
  });
  it("passed + conflicting or unverified is still «deadline passed»", () => {
    expect(availabilityOf({ ...(opp as object), has_conflict: true } as never, NOW)).toBe("deadline_passed_unconfirmed");
    expect(availabilityOf({ ...(opp as object), status: "unverified" } as never, NOW)).toBe("deadline_passed_unconfirmed");
  });
  it("an expired record is not current, so «Για Εμένα» leaves it out", () => {
    expect(isCurrent(recordStatus(opp, NOW))).toBe(false);
    expect(read("src/app/[aud]/logariasmos/page.tsx")).toContain("isCurrent(x.record)");
  });
  it("«Νέα Ευκαιρία» stops being current at 15:00 Greek time on 21 Oct", () => {
    const r = business.find((x) => x.id === "epiro-nea-eykairia")!;
    const o = { status: "open", closes_at: new Date(r.closes_at), deadline_kind: "official", last_verified_at: new Date(data20), stale_after_hours: 168, has_conflict: false, budget_exhausted: "unknown" } as never;
    expect(isCurrent(recordStatus(o, new Date("2026-10-21T11:59:00Z")))).toBe(true);
    expect(isCurrent(recordStatus(o, new Date("2026-10-21T12:01:00Z")))).toBe(false);
  });
});
const data20 = "2026-10-20T15:30:00Z";

describe("5 · missing or conflicting official evidence", () => {
  const NOW = new Date("2026-10-21T00:00:00Z");
  const base = { status: "open", closes_at: new Date("2026-11-16T12:00:00Z"), deadline_kind: "official", last_verified_at: new Date("2026-10-20T15:30:00Z"), stale_after_hours: 168, has_conflict: false, budget_exhausted: "unknown" };
  it("conflicting or unverified evidence is never shown as confirmed open", () => {
    expect(isConfirmedOpen(recordStatus({ ...base, has_conflict: true } as never, NOW))).toBe(false);
    expect(recordStatus({ ...base, last_verified_at: null } as never, NOW).display).toBe("unverified");
    expect(recordStatus({ ...base, status: "unverified" } as never, NOW).display).toBe("unverified");
  });
  it("every business record carries its governing document, official links and a check time", () => {
    for (const r of business) {
      expect(r.governing_document).toBeTruthy();
      expect(r.documents.length).toBeGreaterThan(0);
      expect(r.deadline_verbatim).toBeTruthy();
    }
    expect(read("scripts/build_business_seed.py")).toContain('"last_verified_at": at');
  });
  it("the deadline line never assumes an extension", () => {
    const copy = read("src/lib/site/copy.ts");
    expect(copy).toContain("Δεν γνωρίζουμε αν δόθηκε παράταση");
    expect(copy).not.toMatch(/παράταση δόθηκε|έχει παραταθεί/);
  });
});
