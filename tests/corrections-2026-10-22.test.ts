/**
 * Phase 1 of the credibility sprint (owner approval, 22 Oct 2026 15:52; development and preview only): six records
 * corrected, two «Υπό επιβεβαίωση». Each change is tied to the official text it was checked against; nothing outside
 * the eight records changes, nothing is deleted, no record changes path.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHECKED_RECORDS, CORRECTED_IDS } from "@/lib/site/checked-records";
import { PROGRAMME_GUIDES } from "@/lib/site/guides";
import { applicationCtaAllowed } from "@/lib/site/brief";
import { moneyOf } from "@/lib/site/money";
import { statusFromVerified } from "@/lib/site/guide-status";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const fixes = JSON.parse(read("data/official-records-corrections-2026-10-22.json"));
const sqlRaw = read("db/seed/corrections-2026-10-22.sql");
const sql = sqlRaw.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
const rec = (id: string) => (CHECKED_RECORDS.records as Array<Record<string, any>>).find((r) => r.id === id)!;

describe("the corrections file", () => {
  it("records the owner's approval and, for every record, why it changed and the official source checked on 22 Oct", () => {
    expect(fixes.approved).toContain("15:52");
    expect(fixes.approved).toContain("development and preview only");
    for (const [id, f] of Object.entries<any>(fixes.records)) {
      expect(f.why.el.length, id).toBeGreaterThan(20);
      expect(f.why.en.length, id).toBeGreaterThan(20);
      const sources = [...(f.official_sources ?? []), ...(f.official_sources_add ?? [])];
      expect(sources.some((s: any) => s.checked_on === "2026-10-22" && /^https:\/\//.test(s.url)), id).toBe(true);
    }
    expect([...CORRECTED_IDS].sort()).toEqual(["a21", "art5a", "art5b", "art5c", "discovereu"]);
  });

  it("the file checked on 14 Oct stays as it was; corrections are applied on top", () => {
    const v2 = JSON.parse(read("data/official-records-2026-10-14.v2.json"));
    expect(v2.records.find((r: any) => r.id === "art5b").application_status.deadline_original_wording.el).toBe("Έως 31 Μαρτίου του φορολογικού έτους");
  });
});

describe("Articles 5Β and 5Α — deadlines from the 2026 decisions", () => {
  it("5Β: application by 31 Oct (A.1192/2026 art. 4(1)), documents by 30 Nov; 31 March appears nowhere", () => {
    const r = rec("art5b");
    expect(r.application_status.closes_at).toBeNull(); // 23 Oct 2026: computed by year of move (move-year.ts), not one date
    expect(r.deadline_rule.application_by).toBe("10-31");
    expect(r.application_status.deadline_original_wording.el).toContain("31 Οκτωβρίου");
    expect(r.application_status.deadline_original_wording.el).toContain("30 Νοεμβρίου");
    expect(r.application_status.deadline_original_wording.el).toContain("Α.1192/2026");
    expect(JSON.stringify([r.application_status, r.application_steps])).not.toMatch(/31 Μαρτίου|31 March/);
  });
  it("5Α: application by 30 Sep (A.1147/2026 art. 4(1)), documents by 31 Oct", () => {
    const r = rec("art5a");
    expect(r.application_status.closes_at).toBeNull(); // 23 Oct 2026: computed by year of move (move-year.ts), not one date
    expect(r.deadline_rule.application_by).toBe("09-30");
    expect(r.application_status.deadline_original_wording.el).toContain("30 Σεπτεμβρίου");
    expect(r.application_status.deadline_original_wording.el).toContain("31 Οκτωβρίου");
    expect(JSON.stringify([r.application_status, r.application_steps])).not.toMatch(/31 Μαρτίου|31 March/);
  });
  it("the guides show the corrected deadline, steps and check date", () => {
    for (const id of ["art5a", "art5b"]) {
      const g = PROGRAMME_GUIDES.find((x) => x.recordKey === `manual:${id}`)!;
      expect(JSON.stringify([g.deadline, g.steps])).not.toMatch(/31 Μαρτίου|31 March/);
      expect(g.checkedOn >= "2026-10-22").toBe(true);
    }
  });
});

describe("«Υπό επιβεβαίωση»", () => {
  it("DiscoverEU shows no dates as fact and no application button", () => {
    const r = rec("discovereu");
    expect(r.application_status.value).toBe("unconfirmed");
    expect(r.application_status.opens_at).toBeNull();
    expect(r.application_status.closes_at).toBeNull();
    const s = statusFromVerified("manual:discovereu", new Date("2026-10-23T12:00:00Z"));
    expect(s.display).toBe("unverified");
    expect(applicationCtaAllowed(s.application, s.display)).toBe(false);
  });
  it("no application button for a status pending confirmation or contradicted; open programmes keep it", () => {
    expect(applicationCtaAllowed("open", "unverified")).toBe(false);
    expect(applicationCtaAllowed("open", "conflicting")).toBe(false);
    expect(applicationCtaAllowed("open", "open")).toBe(true);
    expect(applicationCtaAllowed("deadline_passed", "deadline_passed")).toBe(false);
  });
  it("the summary box at the top of the page follows the same rule (no «Επίσημη σελίδα αίτησης» button when not allowed)", () => {
    expect(read("src/components/brief.tsx")).toMatch(/\{canApply\s*\?\s*<a className="btn btn-primary btn-sm" href=\{applyUrl\}/);
    expect(read("src/app/[aud]/eukairies/[id]/page.tsx")).toContain("canApply={canApply}");
  });
  it("a programme pending confirmation never shows «no fixed deadline»", () => {
    expect(read("src/components/opportunity-details.tsx")).toContain('o.status === "unverified" ? <span className="tag gold" data-pending="period">');
  });
  it("a budget pending confirmation is never shown as a number (ΔΑΜ24)", () => {
    const m = moneyOf({ funding_amount_state: "unknown", funding_min: null, funding_max: null, funding_intensity_pct: null,
      official_details: { funding: { rate: { min: 50, max: 50 }, project_budget: null, grant: null, pending: ["project_budget"] } } as never });
    expect(m.projectBudgetPending).toBe(true);
    expect(m.projectBudget).toBeNull();
  });
});

describe("the preview database seed", () => {
  const keys = [...sql.matchAll(/^\s*\('([^']+)',/gm)].map((m) => m[1]);
  it("touches the eight checked records only, deletes nothing and changes no path", () => {
    expect(keys.sort()).toEqual(["manual:a21", "manual:art5a", "manual:art5b", "manual:art5c", "manual:discovereu", "opske:23467", "opske:23486", "opske:24506"].sort());
    for (const m of sql.matchAll(/UPDATE opportunities SET[\s\S]*?WHERE external_key = '([^']+)'/g)) expect(keys).toContain(m[1]);
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\baudience\b/);
    expect(sql).not.toMatch(/opportunity_requirements/);
  });
  it("keeps the earlier state of every corrected record and logs the approval", () => {
    expect(sql).toContain("INSERT INTO opportunity_versions");
    expect(sql).toContain("'admin_correction'");
    expect(sql).toContain("INSERT INTO audit_logs");
    expect(sqlRaw).toContain("15:52");
  });
  it("ΔΑΜ21 and Νότιο Αιγαίο: the budgets are the «επιχορηγούμενος» budget stated on the ΟΠΣΚΕ pages", () => {
    expect(sql).toMatch(/'\{funding,project_budget\}', '\{"min": 300000, "max": 12000000, "basis": "subsidised"\}'/);
    expect(sql).toMatch(/'\{funding,project_budget,basis\}', '"subsidised"'/);
  });
  it("ΔΑΜ24: the unconfirmed budget is removed from the summary too", () => {
    const block = sql.slice(sql.indexOf("'{funding,pending}'"), sql.indexOf("WHERE external_key = 'opske:23486'"));
    expect(block).toContain("summary_plain = ");
    expect(block).not.toMatch(/5\.000\.000|40\.000\.000/);
  });
  it("5Β and 5Α in the database carry the same deadlines as the checked file", () => {
    expect(sql).toMatch(/closes_at = '2026-10-31T21:59:59Z'[\s\S]*?WHERE external_key = 'manual:art5b'/);
    expect(sql).toMatch(/closes_at = '2027-09-30T20:59:59Z'[\s\S]*?WHERE external_key = 'manual:art5a'/);
  });
});
