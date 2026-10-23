/**
 * Phase 1.1 (owner approval, 23 Oct 2026 11:14; development and preview only) — regression tests for:
 *  1. ΔΑΜ22 / ΔΑΜ23 budgets labelled «επιλέξιμος» although the official calls say «επιχορηγούμενος» / «πράξης (έργου)»;
 *  2. Article 5Β summary «15 φορολογικά έτη από το έτος μετά την αίτηση» without official support;
 *  3. Articles 5Α / 5Β shown with ONE deadline for everyone instead of a deadline by year of move;
 *  4. the same data read from more than one place.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECKED_RECORDS } from "@/lib/site/checked-records";
import { verifiedFor } from "@/lib/site/verified";
import { moveYearRows, nextDeadline, type MoveYearRule } from "@/lib/site/move-year";
import { statusFromVerified } from "@/lib/site/guide-status";
import { PROGRAMME_GUIDES } from "@/lib/site/guides";
import { timeLeftOf } from "@/lib/site/brief";
import { withDeadlineRule, type OpportunityRow } from "@/lib/data/opportunities";
import { deadlineFactor } from "@/lib/domain/eligibility";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const fixes = JSON.parse(read("data/official-records-corrections-2026-10-22.json"));
const v2 = JSON.parse(read("data/official-records-2026-10-14.v2.json"));
const sql = read("db/seed/corrections-2026-10-23.sql");
const at = (iso: string) => new Date(iso);
const rec = (id: string) => (CHECKED_RECORDS.records as Array<Record<string, any>>).find((r) => r.id === id)!;
const rule = (id: string) => verifiedFor(`manual:${id}`)!.deadlineRule as MoveYearRule;

describe("1. ΔΑΜ22 and ΔΑΜ23 — the exact budget term of the official call", () => {
  const b = fixes.business_records;
  it("ΔΑΜ22: «επιχορηγούμενος προϋπολογισμός» €300.000–€12.000.000 (ΕΦΕΠΑΕ call page)", () => {
    expect(b["opske:23487"].official_wording).toContain("επιχορηγούμενος προϋπολογισμός: 300.000 ευρώ έως 12.000.000€");
    expect(b["opske:23487"].project_budget).toEqual({ min: 300000, max: 12000000, basis: "subsidised" });
    expect(b["opske:23487"].summary_plain).toContain("Επιχορηγούμενος προϋπολογισμός €300.000–€12.000.000");
  });
  it("ΔΑΜ23: «προϋπολογισμός πράξης (έργου)» €5.000.000–€40.000.000 (ΟΠΣΚΕ call page)", () => {
    expect(b["opske:23466"].official_wording).toContain("πράξης (έργου): Από 5.000.000€ έως 40.000.000€");
    expect(b["opske:23466"].project_budget).toEqual({ min: 5000000, max: 40000000, basis: "project" });
    expect(b["opske:23466"].summary_plain).toContain("Προϋπολογισμός πράξης (έργου) €5.000.000–€40.000.000");
  });
  it("neither summary calls the amount «επιλέξιμος», and no amount becomes an estimated grant", () => {
    for (const k of ["opske:23487", "opske:23466"]) {
      expect(b[k].summary_plain).not.toMatch(/[Εε]πιλέξιμ/);
      expect(Object.keys(b[k].project_budget).sort()).toEqual(["basis", "max", "min"]);
    }
  });
  it("the database seed carries the same amounts, basis and summaries", () => {
    for (const k of ["opske:23487", "opske:23466"]) {
      const block = sql.slice(sql.indexOf(`-- ${b[k].label}:`), sql.indexOf(`WHERE external_key = '${k}'`));
      expect(block).toContain(JSON.stringify(b[k].project_budget));
      expect(block).toContain(b[k].summary_plain.replace(/'/g, "''"));
    }
  });
});

describe("2. Article 5Β — the 15 years", () => {
  it("the summary no longer claims a start year; it says 15 tax years in total (A.1192/2026 art. 4(3))", () => {
    const s = rec("art5b").summary;
    expect(s.el).toContain("15 φορολογικά έτη συνολικά");
    expect(s.el).not.toMatch(/μετά την αίτηση/);
    expect(s.en).not.toMatch(/after the application/);
  });
  it("what stays unknown is recorded: the decision and the republished law text differ on the first year", () => {
    const c = rec("art5b").conflicts[0];
    expect(c.el).toContain("«για το φορολογικό έτος για το οποίο υποβάλλεται η αίτησή του και για δεκαπέντε (15) φορολογικά έτη συνολικά»");
    expect(c.el).toContain("«αρχίζει από το επόμενο φορολογικό έτος για το οποίο υποβάλλεται η αίτηση»");
    expect(rule("art5b").regime).toEqual({ years: 15, start: null });
  });
  it("the database summary says the same", () => {
    expect(sql).toContain(`summary_plain = '${rec("art5b").summary.el} Ποσό / όφελος: Φόρος 7% για 15 έτη'`);
    expect(sql).not.toMatch(/από το έτος μετά την αίτηση/);
  });
});

describe("3. Articles 5Α / 5Β — deadlines by year of move, never one date for everyone", () => {
  const now = at("2026-10-23T09:00:00Z");
  it("5Β on 23 Oct 2026: four rows, application and documents apart, 2025 windows under the previous rules", () => {
    const rows = moveYearRows(rule("art5b"), now);
    expect(rows.map((r) => `${r.moveYear}-${r.part}`)).toEqual(["2025-by_cutoff", "2025-after_cutoff", "2026-by_cutoff", "2026-after_cutoff"]);
    const w = (i: number) => rows[i]!.windows.map((x) => `${x.year}:${x.state}`);
    expect(w(0)).toEqual(["2025:previous_rules", "2026:open"]);
    expect(w(1)).toEqual(["2026:open"]);
    expect(w(2)).toEqual(["2026:open", "2027:open"]);
    expect(w(3)).toEqual(["2027:open"]);
    expect(rows[1]!.windows[0]!.applicationBy.toISOString()).toBe("2026-10-31T21:59:59.999Z");
    expect(rows[1]!.windows[0]!.documentsBy.toISOString()).toBe("2026-11-30T21:59:59.999Z");
  });
  it("5Α on 23 Oct 2026: the 2026 window has passed, 2027 is open; documents by 31 Oct of the year of application", () => {
    const rows = moveYearRows(rule("art5a"), now);
    expect(rows[1]!.windows.map((x) => x.state)).toEqual(["passed"]);
    expect(rows[2]!.windows.map((x) => `${x.year}:${x.state}`)).toEqual(["2026:passed", "2027:open"]);
    expect(rows[3]!.windows[0]!.applicationBy.toISOString()).toBe("2027-09-30T20:59:59.999Z");
    expect(rows[3]!.windows[0]!.documentsBy.toISOString()).toBe("2027-10-31T21:59:59.999Z"); // 25-hour day counted whole
    expect(nextDeadline(rule("art5a"), now)!.toISOString()).toBe("2027-09-30T20:59:59.999Z");
  });
  it("after 31 Oct 2026, 5Β is still open for people who moved later (it does not close for everyone)", () => {
    const later = at("2026-11-05T09:00:00Z");
    expect(nextDeadline(rule("art5b"), later)!.toISOString()).toBe("2027-10-31T21:59:59.999Z");
    expect(statusFromVerified("manual:art5b", later).display).toBe("open");
  });
  it("the period of application is kept apart: 15 tax years; 5Α from the tax year for which the application is filed", () => {
    expect(rule("art5a").regime.years).toBe(15);
    expect(rule("art5a").regime.start!.el).toBe("από το φορολογικό έτος για το οποίο υποβάλλεται η αίτηση");
  });
  it("no recorded wording names one date as if it applied to everyone", () => {
    for (const id of ["art5a", "art5b"]) {
      const w = rec(id).application_status.deadline_original_wording;
      expect(w.el).not.toMatch(/\d{1,2}\/\d{1,2}\/20\d\d/);
      expect(w.en).not.toMatch(/\d{1,2} (Sep|Oct|Nov) 20\d\d/);
      expect(rec(id).application_status.closes_at).toBeNull();
    }
  });
});

describe("4. one source for every page", () => {
  const base = { id: "x", external_key: "manual:art5b", closes_at: at("2026-10-31T21:59:59Z"), deadline_kind: "official", deadline_is_date_only: true, deadline_timezone: "Europe/Athens" } as unknown as OpportunityRow;
  it("database rows take the deadline from the rule (cards, details, listings, personalised results)", () => {
    const r = withDeadlineRule(base, at("2026-11-05T09:00:00Z"));
    expect(r.closes_at!.toISOString()).toBe("2027-10-31T21:59:59.999Z");
    expect(r.deadline_rule).toBe("move_year");
    const other = { ...base, external_key: "manual:a21" } as OpportunityRow;
    expect(withDeadlineRule(other)).toBe(other);
  });
  it("the database seed's next deadline is the rule's own, computed the same way", () => {
    const checked = at("2026-10-23T09:00:00Z");
    const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
    expect(sql).toContain(`closes_at = '${iso(nextDeadline(rule("art5b"), checked)!)}'`);
    expect(sql).toContain(`closes_at = '${iso(nextDeadline(rule("art5a"), checked)!)}'`);
    for (const id of ["art5a", "art5b"]) expect(sql).toContain(`deadline_original_text = '${rec(id).application_status.deadline_original_wording.el}'`);
  });
  it("personalised results: the deadline factor is an explicit unknown, never the next date shown as the user's", () => {
    const f = deadlineFactor({ id: "x", status: "open", opportunity_type: "tax_incentive", closes_at: at("2026-10-31T21:59:59Z"), deadline_kind: "official",
      deadline_depends_on_move_year: true, last_verified_at: null, requirement_set_completeness: "partial", requirements: [] }, at("2026-10-23T09:00:00Z"));
    expect(f).toEqual({ state: "unknown", fit: null, reason: "deadline_depends_on_move_year" });
    expect(read("src/lib/data/opportunities.ts")).toContain('deadline_depends_on_move_year: row.deadline_rule === "move_year"');
  });
  it("cards, the summary box and the side panel say «next» and «depends on the year you moved»", () => {
    const t = timeLeftOf({ record: { display: "open", application: "open" }, closesAt: at("2026-10-31T21:59:59Z"), opensAt: null, deadlineKind: "official", hasGuide: true, moveYear: true }, at("2026-10-23T09:00:00Z"));
    expect(t).toMatchObject({ kind: "days_left", next: true });
    expect(read("src/components/opportunity-card.tsx")).toContain('if (o.deadline_rule === "move_year") return <>{s.card.nextDeadline}');
    expect(read("src/components/opportunity-facts.tsx")).toContain('if (o.deadline_rule === "move_year")');
    expect(read("src/app/[aud]/eukairies/[id]/page.tsx")).toContain('moveYear: o.deadline_rule === "move_year"');
    expect(read("src/components/opportunity-card.tsx")).toContain('moveYear: o.deadline_rule === "move_year"');
  });
  it("the programme page and the guide show the same table from the same rule", () => {
    expect(read("src/components/opportunity-details.tsx")).toContain("{v?.deadlineRule && <MoveYearDeadlines rule={v.deadlineRule}");
    expect(read("src/app/[aud]/odigoi/[slug]/page.tsx")).toContain("verifiedFor(a.recordKey)?.deadlineRule");
    for (const id of ["art5a", "art5b"]) {
      const g = PROGRAMME_GUIDES.find((x) => x.recordKey === `manual:${id}`)!;
      expect(g.deadline).toEqual(rec(id).application_status.deadline_original_wording);
    }
  });
  it("eligibility rules unchanged; their evidence now points to the 2026 decisions, with verbatim quotes where we have them", () => {
    for (const id of ["art5a", "art5b"]) {
      const before = v2.records.find((r: any) => r.id === id).eligibility_rules;
      const after = rec(id).eligibility_rules;
      expect(after.map((e: any) => [e.label, e.db_category, e.db_kind, e.field, e.op, e.value])).toEqual(before.map((e: any) => [e.label, e.db_category, e.db_kind, e.field, e.op, e.value]));
      for (const e of after) expect(e.evidence.source_url).toMatch(/aade\.gr\/sites\/default\/files\/2026-0[89]\//);
    }
    expect(rec("art5a").eligibility_rules[0].official_quote).toBe("Δεν ήταν φορολογικός κάτοικος της Ελλάδος τα προηγούμενα επτά (7) από τα οκτώ (8) έτη");
    expect(sql).not.toMatch(/"excerpt": null/);
    expect(sql).not.toMatch(/opportunity_requirements SET (value|kind|category)/);
  });
  it("the seed is generated from the corrections file, never edited by hand", () => {
    expect(sql.split("\n")[0]).toContain("GENERATED by scripts/build_corrections_2026_10_23.py");
  });
});
