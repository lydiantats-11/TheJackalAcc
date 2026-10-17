/**
 * Milestone 2 — opportunity discovery: accent-insensitive Greek/English search with reviewed synonyms, a transparent
 * default order, applicant type on listings and readable titles for code-only EU calls.
 */
import { describe, expect, it } from "vitest";
import { fold, matches, words } from "@/lib/text/search";
import { compareListed, isCodeOnly, listingApplicants, type Rankable } from "@/lib/site/discovery";
import { displayTitle } from "@/lib/site/verified";
import { SITE } from "@/lib/site/copy";

describe("search folding", () => {
  it("ignores case, accents and final sigma", () => {
    expect(fold("Επίδομα Ανεργίας")).toBe("επιδομα ανεργιασ");
    expect(matches("Επίδομα ανεργίας ΔΥΠΑ", "επιδομα ανεργιας")).toBe(true);
    expect(matches("Επίδομα ανεργίας ΔΥΠΑ", "ΕΠΊΔΟΜΑ")).toBe(true);
    expect(matches("Πρόγραμμα κατάρτισης", "Καταρτιση")).toBe(true);
  });
  it("every query word must match; short words and punctuation are ignored", () => {
    expect(words("Επίδομα, α' παιδιού!")).toEqual(["επιδομα", "παιδιου"]);
    expect(matches("Επίδομα παιδιού Α21", "επίδομα στέγασης")).toBe(false);
    expect(matches("anything", "   ")).toBe(true);
  });
});

describe("reviewed synonyms (Greek ↔ English)", () => {
  const unemployment = "Τακτική επιδότηση ανεργίας ΔΥΠΑ";
  it("finds Greek records from English words and the reverse", () => {
    expect(matches(unemployment, "unemployment")).toBe(true);
    expect(matches("Child benefit A21", "επίδομα παιδιού")).toBe(true);
    expect(matches("Σπίτι μου 2 — στεγαστικό δάνειο", "housing")).toBe(true);
    expect(matches("European Solidarity Corps", "ΕΣΠΑ")).toBe(false);
    expect(matches("Πρόγραμμα ΕΣΠΑ 2021-2027", "espa")).toBe(true);
  });
  it("synonyms do not widen meaning across groups", () => {
    expect(matches(unemployment, "housing")).toBe(false);
    expect(matches("Student housing allowance", "tax")).toBe(false);
  });
});

describe("default order", () => {
  const r = (status: Rankable["status"], applicant: Rankable["applicant"], scope: "eu" | "gr", title: string, closes?: string): Rankable =>
    ({ status, applicant, scope, row: { official_title: title, closes_at: closes ? new Date(closes) : null } });
  it("current before expired, individuals before unknown before organisations, Greek before EU, nearest deadline", () => {
    const list = [
      r("passed", "individuals", "gr", "Expired Greek"),
      r("open", "organisations", "gr", "Org only"),
      r("open", "unknown", "eu", "EU call"),
      r("open", "individuals", "eu", "EU individuals"),
      r("open", "individuals", "gr", "Greek later", "2026-12-01"),
      r("open", "individuals", "gr", "Greek sooner", "2026-11-01"),
      r("recheck", "individuals", "gr", "Needs re-check"),
      r("upcoming", "both", "gr", "Upcoming both"),
    ];
    expect([...list].sort(compareListed).map((x) => x.row.official_title)).toEqual([
      "Greek sooner", "Greek later", "EU individuals", "EU call", "Org only", "Upcoming both", "Needs re-check", "Expired Greek",
    ]);
  });
  it("ordering never removes a record", () => {
    const list = [r("closed", "unknown", "eu", "a"), r("open", "unknown", "eu", "b")];
    expect([...list].sort(compareListed)).toHaveLength(2);
  });
});

describe("applicant type on listings", () => {
  it("hand-checked records carry their recorded type; everything else is unknown", () => {
    expect(listingApplicants({ external_key: "manual:a21" })).toBe("individuals");
    expect(listingApplicants({ external_key: "manual:eic" })).toBe("both");
    expect(listingApplicants({ external_key: "eu-ft:SOCPL-2026-INFO-REPR" })).toBe("unknown");
    expect(listingApplicants({ external_key: null })).toBe("unknown");
  });
  it("every applicant value has labels in both languages", () => {
    for (const k of ["individuals", "both", "organisations", "unknown"] as const) {
      expect(SITE.el.card.applicant[k]).toBeTruthy();
      expect(SITE.en.card.applicant[k]).toBeTruthy();
    }
  });
});

describe("code-only titles", () => {
  it("recognises programme codes, not ordinary titles", () => {
    expect(isCodeOnly("SOCPL-2026-INFO-REPR")).toBe(true);
    expect(isCodeOnly("HORIZON-CL5-2026-D3-01")).toBe(true);
    expect(isCodeOnly("Child benefit A21")).toBe(false);
    expect(isCodeOnly("ESPA")).toBe(true);
  });
  it("falls back to the official call title, else marks the title as a code", () => {
    const base = { external_key: "eu-ft:x", official_title: "SOCPL-2026-INFO-REPR", title_lang: "en" };
    expect(displayTitle({ ...base, official_details: { call: { title: "Information measures for industrial relations" } } }, "el"))
      .toEqual({ text: "Information measures for industrial relations", lang: "en" });
    expect(displayTitle(base, "el")).toEqual({ text: "SOCPL-2026-INFO-REPR", lang: "en", codeOnly: true });
    expect(displayTitle({ ...base, official_title: "A readable title" }, "el")).toEqual({ text: "A readable title", lang: "en" });
  });
});

describe("discovery copy", () => {
  it("quick views, ranking note and no-results help exist in both languages", () => {
    for (const s of [SITE.el, SITE.en]) {
      for (const k of ["quick", "quickAll", "quickPeopleGr", "quickGr", "quickEu", "rankNote", "tryGuides", "tryAll", "tryClear", "applicant"] as const) expect(s.opps[k]).toBeTruthy();
      expect(s.opps.noResultsFor("x")).toContain("x");
    }
  });
});
