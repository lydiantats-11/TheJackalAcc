import { describe, expect, it } from "vitest";
import { assess } from "@/lib/domain/eligibility";
import type { MatchProfile } from "@/lib/domain/profile";
import { NOW, opp, rec } from "./helpers";

/** Rules transcribed from the verified records of 14 Oct 2026 (see official-records-2026-10-14.v2.json). */
const ART_5C = () => opp([
  rec("tax_residence_transfer", { required: true }, { key: "move" }),
  rec("prior_tax_residence", { window_years: 6, max_resident_years: 1 }, { key: "prior" }),
  rec("moving_from", { groups: ["eu_eea", "agreement"] }, { key: "from" }),
  rec("activity_in_greece", { activities: ["employee_gr", "own_business"] }, { key: "work" }),
  rec("intent_to_stay", { min_years: 2 }, { key: "stay" }),
], { opportunity_type: "tax_incentive" });
const DISCOVER_EU = () => opp([
  rec("birth_date_range", { from: "2008-01-01", to: "2008-12-31" }, { key: "born" }),
  rec("residence", { countries: ["GR", "DE", "FR", "IS", "LI", "MK", "NO", "RS", "TR"], basis: "residence_or_citizenship" }, { key: "res" }),
]);
const state = (a: ReturnType<typeof assess>, key: string) => a.results.find((r) => r.key === key)?.state;

describe("Article 5C (moving tax residence to Greece)", () => {
  const returnee: MatchProfile = {
    country_of_residence: "DE", citizenship_country: "GR", tax_residence_country: "DE", tax_residence_move: "planning",
    gr_tax_resident_prev6: "0", moving_from: "eu_eea", activity_in_greece: "employee_gr", intends_to_stay_2y: "yes",
  };
  it("a qualifying returnee is potentially eligible", () => {
    expect(assess(ART_5C(), returnee, { now: NOW }).eligibility).toBe("potentially_eligible");
  });
  it("Greek tax residence in 2+ of the previous 6 years fails the rule", () => {
    const a = assess(ART_5C(), { ...returnee, gr_tax_resident_prev6: "2plus" }, { now: NOW });
    expect(state(a, "prior")).toBe("not_satisfied");
    expect(a.eligibility).toBe("ineligible_verified");
  });
  it("remote work for a foreign employer does not qualify", () => {
    expect(state(assess(ART_5C(), { ...returnee, activity_in_greece: "remote_foreign" }, { now: NOW }), "work")).toBe("not_satisfied");
  });
  it("citizenship alone never implies Greek tax residence or eligibility", () => {
    const a = assess(ART_5C(), { citizenship_country: "GR", country_of_residence: "DE" }, { now: NOW });
    expect(a.results.every((r) => r.state === "unknown")).toBe(true);
    expect(a.eligibility).toBe("insufficient_information");
  });
  it("'prefer not to answer' stays unknown and never counts against the user", () => {
    const a = assess(ART_5C(), { ...returnee, gr_tax_resident_prev6: "prefer_not" }, { now: NOW });
    expect(state(a, "prior")).toBe("unknown");
    expect(a.eligibility).toBe("potentially_eligible_verification_required");
  });
});

describe("DiscoverEU birth-date and residence-or-citizenship rules", () => {
  it("born in 2008 and living in Greece → potentially eligible", () => {
    expect(assess(DISCOVER_EU(), { birth_year: 2008, country_of_residence: "GR" }, { now: NOW }).eligibility).toBe("potentially_eligible");
  });
  it("born in 2007 → not eligible", () => {
    expect(state(assess(DISCOVER_EU(), { birth_year: 2007, country_of_residence: "GR" }, { now: NOW }), "born")).toBe("not_satisfied");
  });
  it("citizenship can satisfy the rule when residence does not", () => {
    expect(state(assess(DISCOVER_EU(), { birth_year: 2008, country_of_residence: "US", citizenship_country: "GR" }, { now: NOW }), "res")).toBe("satisfied");
  });
  it("fails only when both residence and citizenship are answered and outside the list", () => {
    expect(state(assess(DISCOVER_EU(), { birth_year: 2008, country_of_residence: "US" }, { now: NOW }), "res")).toBe("unknown");
    expect(state(assess(DISCOVER_EU(), { birth_year: 2008, country_of_residence: "US", citizenship_country: "US" }, { now: NOW }), "res")).toBe("not_satisfied");
  });
  it("missing birth year asks for it", () => {
    const a = assess(DISCOVER_EU(), { country_of_residence: "GR" }, { now: NOW });
    expect(a.questions).toContain("birth_year");
  });
});

describe("benefit and investment rules", () => {
  it("unemployment benefit: job ended by employer passes, resignation fails", () => {
    const o = opp([rec("employment_end", { reasons: ["ended_by_employer", "contract_ended"] }, { key: "end" })], { opportunity_type: "public_benefit" });
    expect(state(assess(o, { last_job_end: "ended_by_employer" }, { now: NOW }), "end")).toBe("satisfied");
    expect(state(assess(o, { last_job_end: "resigned" }, { now: NOW }), "end")).toBe("not_satisfied");
  });
  it("A21: needs at least one dependent child", () => {
    const o = opp([rec("dependent_children", { min: 1 }, { key: "kids" })], { opportunity_type: "public_benefit" });
    expect(state(assess(o, { dependent_children: "0" }, { now: NOW }), "kids")).toBe("not_satisfied");
    expect(state(assess(o, { dependent_children: "2" }, { now: NOW }), "kids")).toBe("satisfied");
    expect(state(assess(o, { dependent_children: "prefer_not" }, { now: NOW }), "kids")).toBe("unknown");
  });
  it("student housing: academic ID required", () => {
    const o = opp([rec("student_status", { required: true }, { key: "s" })]);
    expect(state(assess(o, { has_academic_id: "no" }, { now: NOW }), "s")).toBe("not_satisfied");
    expect(state(assess(o, {}, { now: NOW }), "s")).toBe("unknown");
  });
  it("Article 5A: investment of at least €500,000", () => {
    const o = opp([rec("investment_amount", { min_eur: 500_000 }, { key: "inv" })]);
    expect(state(assess(o, { planned_investment_range: "500k_plus" }, { now: NOW }), "inv")).toBe("satisfied");
    expect(state(assess(o, { planned_investment_range: "100k_500k" }, { now: NOW }), "inv")).toBe("unknown"); // range touches the limit
    expect(state(assess(o, { planned_investment_range: "under_100k" }, { now: NOW }), "inv")).toBe("not_satisfied");
  });
  it("tax residence by basis: citizenship and tax residence are separate answers", () => {
    const o = opp([rec("residence", { countries: ["GR"], basis: "tax_residence" }, { key: "t" })]);
    expect(state(assess(o, { citizenship_country: "GR", tax_residence_country: "ES" }, { now: NOW }), "t")).toBe("not_satisfied");
  });
});
