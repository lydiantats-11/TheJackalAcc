import { describe, expect, it } from "vitest";
import { CATEGORIES, INTEREST_CATEGORIES, MANUAL_RECORDS, audiencesOf, categoriesOf, scopeOf, supportTypeOf } from "@/lib/site/taxonomy";
import { GENERAL_GUIDES, PROGRAMME_GUIDES } from "@/lib/site/guides";
import { INTEREST_IDS } from "@/lib/domain/personas";

const row = (o: { external_key?: string | null; official_identifier?: string | null; opportunity_type?: string }) =>
  ({ external_key: null, official_identifier: null, opportunity_type: "unknown", ...o }) as never;

describe("browsing taxonomy (design sprint 15 Oct 2026)", () => {
  const slugs = CATEGORIES.map((c) => c.slug);

  it("11 categories, unique slugs, Greek and English names and descriptions", () => {
    expect(CATEGORIES).toHaveLength(11);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CATEGORIES) for (const l of ["el", "en"] as const) { expect(c.name[l].length > 0).toBe(true); expect(c.description[l].length > 0).toBe(true); }
  });

  it("every mapping points at a real category", () => {
    for (const m of Object.values(MANUAL_RECORDS)) for (const c of m.categories) expect(slugs.includes(c)).toBe(true);
    for (const [i, cats] of Object.entries(INTEREST_CATEGORIES)) {
      expect((INTEREST_IDS as readonly string[]).includes(i)).toBe(true);
      for (const c of cats) expect(slugs.includes(c)).toBe(true);
    }
  });

  it("classifies hand-checked records, EU topics by programme, and leaves unknown ones uncategorised", () => {
    expect(categoriesOf(row({ external_key: "manual:a21" }))).toEqual(["family"]);
    expect(categoriesOf(row({ external_key: "eu-topic:HORIZON-CL4-2027-01", official_identifier: "HORIZON-CL4-2027-01" }))).toEqual(["innovation"]);
    expect(categoriesOf(row({ official_identifier: "LIFE-2026-SAP-ENV" }))).toEqual(["environment"]);
    expect(categoriesOf(row({ official_identifier: "JUST-2027-JACC" }))).toEqual([]);
    expect(categoriesOf(row({ opportunity_type: "procurement" }))).toEqual(["tenders"]);
    expect(audiencesOf(row({ external_key: "eu-topic:X", official_identifier: "X" }))).toEqual(["business_org"]);
  });

  it("scope comes from the official page's domain; support types are grouped", () => {
    expect(scopeOf({ canonical_url: "https://ec.europa.eu/info/x" } as never)).toBe("eu");
    expect(scopeOf({ canonical_url: "https://opeka.gov.gr/x" } as never)).toBe("gr");
    expect(supportTypeOf("public_benefit")).toBe("benefit");
    expect(supportTypeOf("unknown")).toBe("unconfirmed");
  });

  it("guides come only from verified records (no volunteering), plus two general guides", () => {
    expect(PROGRAMME_GUIDES.map((g) => g.slug).sort()).toEqual(Object.values(MANUAL_RECORDS).map((m) => m.guide).filter(Boolean).sort());
    expect(PROGRAMME_GUIDES.some((g) => g.slug === "esc")).toBe(false);
    for (const g of PROGRAMME_GUIDES) expect(g.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
    expect(GENERAL_GUIDES).toHaveLength(2);
  });
});
