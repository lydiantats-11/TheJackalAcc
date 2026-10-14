import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { assess } from "@/lib/domain/eligibility";
import { EXAMPLE_PROFILE, type MatchProfile } from "@/lib/domain/profile";
import {
  INTEREST_IDS, PERSONA_IDS, isAnswered, legacyPersonas, personasOf, visibleFields, visibleSections,
} from "@/lib/domain/personas";
import { SYNTHETIC_OPPORTUNITIES } from "../db/seed/synthetic-opportunities";
import { legacyEnvelopesToRecords } from "@/lib/domain/engine/legacy";
import { NOW, opp, rec } from "./helpers";

const sections = (p: MatchProfile, ask: string[] = []) => [...visibleSections(p, ask)].sort();

describe("personas: data model", () => {
  it("maps the legacy single persona without guessing", () => {
    expect(legacyPersonas({ persona: "aspiring_entrepreneur" })).toEqual(["aspiring_entrepreneur"]);
    expect(legacyPersonas({ persona: "existing_business" })).toEqual(["business_org"]);
    expect(legacyPersonas({ persona: "tender_applicant" })).toEqual(["business_org"]);
    expect(legacyPersonas({ persona: "individual" })).toEqual([]); // could be young adult, jobseeker or household
    expect(legacyPersonas({ persona: "adviser" })).toEqual([]); // an account role, not a persona
  });

  it("an explicit selection wins over the legacy mapping, even when empty", () => {
    expect(personasOf({ persona: "existing_business", personas: ["household", "young_adult"] })).toEqual(["household", "young_adult"]);
    expect(personasOf({ persona: "existing_business", personas: [] })).toEqual([]);
    expect(personasOf({ persona: "existing_business" })).toEqual(["business_org"]);
  });

  it("an empty multi-select is not an answer", () => {
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(["*"])).toBe(true);
    expect(isAnswered("not_sure")).toBe(true); // an explicit "not sure" is an answer
    expect(isAnswered(null)).toBe(false);
  });
});

describe("personas: conditional questionnaire", () => {
  it("with nothing selected, only the general sections are asked", () => {
    expect(sections({})).toEqual(["applying_as", "location", "person"]);
  });

  it("each persona opens its own sections", () => {
    expect(sections({ personas: ["young_adult"] })).toContain("work");
    expect(sections({ personas: ["employee_jobseeker"] })).toContain("work");
    expect(sections({ personas: ["aspiring_entrepreneur"] })).toEqual(expect.arrayContaining(["work", "entrepreneurship"]));
    expect(sections({ personas: ["aspiring_entrepreneur"] })).not.toContain("business");
    expect(sections({ personas: ["household"] })).toContain("household");
    expect(sections({ personas: ["business_org"] })).toEqual(expect.arrayContaining(["entrepreneurship", "business"]));
  });

  it("personas combine: a young jobseeker who rents and plans a business sees all the relevant sections", () => {
    const s = sections({ personas: ["young_adult", "employee_jobseeker", "aspiring_entrepreneur", "household"] });
    expect(s).toEqual(expect.arrayContaining(["work", "entrepreneurship", "household"]));
  });

  it("interests open sections too (housing → household, tax residence → international)", () => {
    expect(sections({ personas: ["young_adult"], interests: ["housing"] })).toContain("household");
    expect(sections({ interests: ["tax_residency"] })).toContain("international");
    expect(sections({ interests: ["tenders"] })).toContain("business");
  });

  it("an opportunity that asks for an answer opens its section", () => {
    expect(sections({}, ["household_income_range"])).toContain("household");
    expect(sections({}, ["employees_range"])).toContain("business");
    expect(visibleFields({}, ["birth_year"])).toContain("birth_year");
  });

  it("answered questions never disappear when a persona is switched off", () => {
    const p: MatchProfile = { personas: [], housing_status: "renting", employees_range: "1_9" };
    expect(sections(p)).toEqual(expect.arrayContaining(["household", "business"]));
  });

  it("a registered business always sees the business questions", () => {
    expect(sections({ business_stage: "established" })).toContain("business");
  });

  it("DYPA registration is asked only when the person is or may be unemployed", () => {
    const base: MatchProfile = { personas: ["employee_jobseeker"] };
    expect(visibleFields({ ...base, employment_status: "unemployed" })).toContain("dypa_registered");
    expect(visibleFields({ ...base })).toContain("dypa_registered"); // unanswered: still ask
    expect(visibleFields({ ...base, employment_status: "not_sure" })).toContain("dypa_registered");
    expect(visibleFields({ ...base, employment_status: "employed" })).not.toContain("dypa_registered");
    expect(visibleFields({ ...base, employment_status: "employed", dypa_registered: "yes" })).toContain("dypa_registered");
  });

  it("homeowners are not asked about buying a first home", () => {
    expect(visibleFields({ personas: ["household"], housing_status: "renting" })).toContain("first_home_purchase");
    expect(visibleFields({ personas: ["household"], housing_status: "owner" })).not.toContain("first_home_purchase");
  });
});

describe("personas never decide eligibility (brief A2)", () => {
  const strip = (a: ReturnType<typeof assess>) => ({ e: a.eligibility, r: a.eligibility_rule, av: a.availability, s: a.relevance_score, q: a.questions });

  it("the same profile gets identical assessments whatever personas and interests are chosen", () => {
    const opportunities = [
      opp([rec("age", { max: 29 }), rec("business_stage", { stages: ["idea", "planning"] })]),
      opp([rec("employment", { statuses: ["unemployed"] }), rec("unemployment_registration", { required: true })]),
      opp([rec("applicant_type", { types: ["company"] }), rec("company_size", { max_employees: 49 })], { opportunity_type: "procurement" }),
      ...SYNTHETIC_OPPORTUNITIES.map((o) => {
        const { records, completeness } = legacyEnvelopesToRecords(o.requirements, { idPrefix: o.key, fallbackUrl: "https://test-data.example/call" });
        return opp(records, { requirement_set_completeness: completeness });
      }),
    ];
    fc.assert(fc.property(
      fc.subarray([...PERSONA_IDS]), fc.subarray([...INTEREST_IDS]),
      (personas, interests) => {
        for (const o of opportunities) {
          const base = strip(assess(o, EXAMPLE_PROFILE, { now: NOW }));
          const withPersonas = strip(assess(o, { ...EXAMPLE_PROFILE, personas, interests }, { now: NOW }));
          expect(withPersonas).toEqual(base);
        }
      },
    ), { numRuns: 60 });
  });
});
