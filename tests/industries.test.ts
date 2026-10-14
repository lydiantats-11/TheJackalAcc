import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { assess } from "@/lib/domain/eligibility";
import { EXAMPLE_PROFILE } from "@/lib/domain/profile";
import {
  INDUSTRY_CHOICES, INDUSTRY_IDS, INDUSTRY_NACE, NACE_REV21_SECTIONS, industryMatches, normaliseIndustries,
} from "@/lib/domain/industries";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { SYNTHETIC_OPPORTUNITIES } from "../db/seed/synthetic-opportunities";
import { legacyEnvelopesToRecords } from "@/lib/domain/engine/legacy";
import { NOW, opp, rec } from "./helpers";

describe("industry categories (owner request, 14 Oct 2026)", () => {
  it("has the 30 requested industries, each mapped only to real NACE Rev. 2.1 sections", () => {
    expect(INDUSTRY_IDS).toHaveLength(30);
    for (const id of INDUSTRY_IDS) for (const s of INDUSTRY_NACE[id]) expect((NACE_REV21_SECTIONS as readonly string[]).includes(s)).toBe(true);
    expect(NACE_REV21_SECTIONS).toHaveLength(22);
  });

  it("every choice, including 'All industries' and 'Not decided yet', has a Greek and an English label", () => {
    for (const lang of ["el", "en"] as const) {
      const labels = dictionaries[lang].opt.industries as Record<string, string>;
      for (const c of INDUSTRY_CHOICES) expect(typeof labels[c] === "string" && labels[c].length > 0).toBe(true);
    }
  });

  it("'all' / 'undecided' are exclusive with specific industries; unknown values are dropped", () => {
    expect(normaliseIndustries(["tourism_hospitality", "technology_it"])).toEqual(["tourism_hospitality", "technology_it"]);
    expect(normaliseIndustries(["all", "tourism_hospitality"])).toEqual(["tourism_hospitality"]);
    expect(normaliseIndustries(["undecided", "all"])).toEqual(["all"]);
    expect(normaliseIndustries(["undecided"])).toEqual(["undecided"]);
    expect(normaliseIndustries(["wizard"])).toEqual([]);
    expect(normaliseIndustries([])).toEqual([]);
  });

  it("discovery: unrestricted records suit everyone; restricted ones suit matching industries", () => {
    expect(industryMatches(null, { industries: ["tourism_hospitality"] })).toBe(true);
    expect(industryMatches(["tourism_hospitality"], { industries: ["tourism_hospitality", "technology_it"] })).toBe(true);
    expect(industryMatches(["agriculture"], { industries: ["technology_it"] })).toBe(false);
    expect(industryMatches(["agriculture"], { industries: ["all"] })).toBe(true);
    expect(industryMatches(["agriculture"], { industries: ["undecided"] })).toBe(true);
    expect(industryMatches(["agriculture"], {})).toBe(true);
  });
});

describe("industries never decide eligibility", () => {
  const strip = (a: ReturnType<typeof assess>) => ({ e: a.eligibility, r: a.eligibility_rule, av: a.availability, s: a.relevance_score, q: a.questions });

  it("the same profile gets identical assessments whatever industries are chosen — including sector-restricted calls", () => {
    const opportunities = [
      opp([rec("sector", { include: ["I"] })]),
      opp([rec("age", { max: 29 }), rec("business_stage", { stages: ["idea", "planning"] })]),
      ...SYNTHETIC_OPPORTUNITIES.map((o) => {
        const { records, completeness } = legacyEnvelopesToRecords(o.requirements, { idPrefix: o.key, fallbackUrl: "https://test-data.example/call" });
        return opp(records, { requirement_set_completeness: completeness });
      }),
    ];
    fc.assert(fc.property(fc.subarray([...INDUSTRY_CHOICES]), (industries) => {
      for (const o of opportunities) {
        const base = strip(assess(o, EXAMPLE_PROFILE, { now: NOW }));
        expect(strip(assess(o, { ...EXAMPLE_PROFILE, industries: normaliseIndustries(industries) }, { now: NOW }))).toEqual(base);
      }
    }), { numRuns: 60 });
  });
});
