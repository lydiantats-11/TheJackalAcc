/**
 * The nine open interpretation questions, tested against requirements transcribed from real official calls.
 * See INTERPRETATIONS.md for the evidence and the decision taken for each question.
 */
import { describe, expect, it } from "vitest";
import { assess } from "@/lib/domain/eligibility";
import { EXAMPLE_PROFILE, type MatchProfile } from "@/lib/domain/profile";
import { normaliseDeadline } from "@/lib/domain/deadline";
import { runScenario } from "@/lib/domain/scenarios";
import { DYPA_NEE_18_29, EIC_ACCELERATOR_2026, ESPA_NEW_TOURISM_SMES, HORIZON_DEFAULTS } from "./fixtures/real-calls";
import { opp } from "./helpers";

const NOW = new Date("2026-10-13T09:00:00Z");
const res = (a: ReturnType<typeof assess>, key: string) => a.results.find((r) => r.key === key)!;

describe("Q1 — the date at which age is measured", () => {
  it("DYPA measures age at application: a 25–29 range is fully inside 'up to 29' today", () => {
    expect(res(assess(DYPA_NEE_18_29, EXAMPLE_PROFILE, { now: NOW }), "age").state).toBe("satisfied");
  });
  it("…but someone born in 1996 may be 29 or 30 when they apply → ask, don't guess", () => {
    const a = assess(DYPA_NEE_18_29, { ...EXAMPLE_PROFILE, birth_year: 1996 }, { now: NOW });
    expect(res(a, "age").state).toBe("unknown");
  });
  it("a later planned application date can turn a pass into a fail", () => {
    const later = assess(DYPA_NEE_18_29, { ...EXAMPLE_PROFILE, birth_year: 1996 }, { now: NOW, applicationDate: new Date("2027-06-01T00:00:00Z") });
    expect(res(later, "age").state).toBe("not_satisfied");
  });
  it("a verbatim-quoted age rule is authoritative → 30–34 is 'ineligible under the verified rules'", () => {
    expect(assess(DYPA_NEE_18_29, { ...EXAMPLE_PROFILE, age_range: "30_34" }, { now: NOW }).eligibility).toBe("ineligible_verified");
  });
  it("ESPA measures business age at the CALL's issue date, not today", () => {
    const shop: MatchProfile = { business_stage: "registered_new", legal_form: "company", business_registration_date: "2023-03-01", application_country: "GR", region_codes: ["EL30"] };
    expect(res(assess(ESPA_NEW_TOURISM_SMES, shop, { now: NOW }), "newly_established").state).toBe("satisfied"); // 9 months at 18/12/2023
    expect(res(assess({ ...ESPA_NEW_TOURISM_SMES, published_on: null }, shop, { now: NOW }), "newly_established").reason).toBe("reference_date_unknown");
  });
});

describe("Q2 — 'anywhere in Greece' vs regional calls and sub-regional exclusions", () => {
  it("a nationwide call with excluded islands asks South Aegean applicants to check the official wording", () => {
    const p: MatchProfile = { ...EXAMPLE_PROFILE, region_codes: ["EL42"] };
    const r = res(assess(ESPA_NEW_TOURISM_SMES, p, { now: NOW }), "location");
    expect(r.state).toBe("unknown");
    expect(r.reason).toBe("geo_exclusion_check_manual"); // we never guess which municipalities belong to a regional unit
  });
  it("applicants elsewhere are unaffected by the exclusion", () => {
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...EXAMPLE_PROFILE, region_codes: ["EL30"] }, { now: NOW }), "location").state).toBe("satisfied");
  });
  it("when the excluded municipalities are listed, the check becomes automatic", () => {
    const call = opp([{ ...ESPA_NEW_TOURISM_SMES.requirements.find((x) => x.key === "location")!,
      value: { regions: ["GR"], exclude_areas: [{ parent: "EL42", name: "Test area", municipalities: ["Μύκονος"] }] } }]);
    const p = { ...EXAMPLE_PROFILE, region_codes: ["EL42"] };
    expect(assess(call, { ...p, municipality: "Μυκονος" }, { now: NOW }).results[0]!.state).toBe("not_satisfied");
    expect(assess(call, { ...p, municipality: "Νάξος" }, { now: NOW }).results[0]!.state).toBe("satisfied");
  });
});

describe("Q3 — available capital vs what must be proven", () => {
  it("ESPA: proof of 60% of the private share; 45% grant → 55% private", () => {
    const small = assess(ESPA_NEW_TOURISM_SMES, { ...EXAMPLE_PROFILE, project_budget_eur: 100_000 }, { now: NOW });
    expect(res(small, "private_share_proof")).toMatchObject({ state: "satisfied", params: expect.objectContaining({ eur: 33_000 }) });
    const big = assess(ESPA_NEW_TOURISM_SMES, { ...EXAMPLE_PROFILE, project_budget_eur: 200_000 }, { now: NOW });
    expect(res(big, "private_share_proof")).toMatchObject({ state: "unknown", params: expect.objectContaining({ eur: 66_000 }) }); // ">€50k" can't prove €66k
    expect(res(assess(ESPA_NEW_TOURISM_SMES, EXAMPLE_PROFILE, { now: NOW }), "private_share_proof").state).toBe("unknown"); // no budget → no assumption
  });
});

describe("Q4 — when the business must be registered", () => {
  it("DYPA: a planner meets the rule today and receives the obligation to register within 60 days of approval", () => {
    const a = assess(DYPA_NEE_18_29, EXAMPLE_PROFILE, { now: NOW });
    expect(res(a, "start").state).toBe("satisfied");
    expect(a.obligations).toContain("register_within_60_days_of_approval");
  });
  it("DYPA: a business registered before applying does not meet it (paraphrased evidence → 'unlikely', not 'ineligible')", () => {
    const a = assess(DYPA_NEE_18_29, { ...EXAMPLE_PROFILE, business_stage: "established", legal_form: "sole_proprietor", business_registration_date: "2025-02-01" }, { now: NOW });
    expect(res(a, "start").state).toBe("not_satisfied");
    expect(a.eligibility).toBe("unlikely_eligible");
  });
  it("ESPA: the 'under establishment' route applies only to unregistered applicants, the 'newly established' route only to firms", () => {
    const planner = assess(ESPA_NEW_TOURISM_SMES, EXAMPLE_PROFILE, { now: NOW });
    expect(res(planner, "under_establishment").state).toBe("satisfied");
    expect(res(planner, "newly_established").state).toBe("not_applicable");
    expect(planner.obligations).toContain("register_by_first_payment");
  });
  it("scenario: registering BEFORE the planned application date breaks the DYPA rule; registering after does not", () => {
    const before = runScenario(DYPA_NEE_18_29, EXAMPLE_PROFILE, { kind: "register_business", legal_form: "sole_proprietor", registration_date: "2026-11-01" }, NOW,
      { applicationDate: new Date("2026-12-01T00:00:00Z") });
    expect(before.permissible).toBe("depends");
    expect(before.changes).toContainEqual(expect.objectContaining({ requirement_key: "start", from: "satisfied", to: "not_satisfied" }));
    const after = runScenario(DYPA_NEE_18_29, EXAMPLE_PROFILE, { kind: "register_business", legal_form: "sole_proprietor", registration_date: "2026-11-01" }, NOW);
    expect(after.changes.find((c) => c.requirement_key === "start")).toBeUndefined();
  });
});

describe("Q6 — EU SME definition", () => {
  const firm: MatchProfile = { business_stage: "established", legal_form: "company", employees_range: "10_49", turnover_range: "2m_10m", application_country: "GR", region_codes: ["EL30"] };
  it("own figures are not enough until the user confirms the firm is autonomous", () => {
    expect(res(assess(ESPA_NEW_TOURISM_SMES, firm, { now: NOW }), "sme").question).toBe("enterprise_relationship");
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...firm, enterprise_relationship: "partner_or_linked" }, { now: NOW }), "sme").reason).toBe("sme_aggregation_needed");
  });
  it("headcount AND (turnover OR balance sheet): exceeding turnover alone does not disqualify", () => {
    const p = { ...firm, enterprise_relationship: "autonomous" as const, public_ownership_25: "no" as const, turnover_range: "over_50m" as const, balance_sheet_range: "10m_50m" as const };
    expect(res(assess(ESPA_NEW_TOURISM_SMES, p, { now: NOW }), "sme").state).toBe("unknown"); // balance sheet 10–50m straddles €43m
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...p, balance_sheet_range: "2m_10m" }, { now: NOW }), "sme").state).toBe("satisfied");
  });
  it("≥25% public ownership disqualifies", () => {
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...firm, public_ownership_25: "yes" }, { now: NOW }), "sme").state).toBe("not_satisfied");
  });
});

describe("Q7 — de minimis (Reg. 2023/2831: €300,000, rolling 3 years, per single undertaking)", () => {
  const firm: MatchProfile = { business_stage: "established", legal_form: "company", application_country: "GR", region_codes: ["EL30"] };
  it("linked enterprises must be counted, so the answer is unknown until the relationship is known", () => {
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...firm, de_minimis_received_3y_eur: 0 }, { now: NOW }), "de_minimis").state).toBe("unknown");
  });
  it("an exhausted ceiling is not satisfied; remaining headroom is reported, not assumed sufficient", () => {
    const auto = { ...firm, enterprise_relationship: "autonomous" as const };
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...auto, de_minimis_received_3y_eur: 300_000 }, { now: NOW }), "de_minimis").state).toBe("not_satisfied");
    expect(res(assess(ESPA_NEW_TOURISM_SMES, { ...auto, de_minimis_received_3y_eur: 250_000 }, { now: NOW }), "de_minimis").params).toMatchObject({ headroom: 50_000 });
  });
});

describe("Q8 — EU programme eligibility for Greek applicants", () => {
  it("EIC: Greece qualifies as a Member State, but natural-person eligibility is unresolved → under review", () => {
    const a = assess(EIC_ACCELERATOR_2026, EXAMPLE_PROFILE, { now: NOW });
    expect(res(a, "countries").state).toBe("satisfied");
    expect(res(a, "natural_persons").state).toBe("needs_review");
    expect(a.eligibility).toBe("under_review");
  });
  it("Horizon default consortium rule is shown as information and asked about, without deciding eligibility", () => {
    const a = assess(opp(HORIZON_DEFAULTS), EXAMPLE_PROFILE, { now: NOW });
    expect(res(a, "default_consortium").state).toBe("unknown");
    expect(a.questions).toContain("has_consortium_partners");
    expect(a.eligibility).toBe("potentially_eligible"); // informational records never decide eligibility
  });
});

describe("Q5/Q9 — deadlines and timing in real calls", () => {
  it("ESPA states a time in Athens; EIC states 17:00 Brussels time — both kept exact", () => {
    expect(normaliseDeadline("2024-03-27 15:00:00", "Europe/Athens").closes_at?.toISOString()).toBe("2024-03-27T13:00:00.000Z");
    expect(normaliseDeadline("2026-11-04 17:00", "Europe/Brussels").closes_at?.toISOString()).toBe("2026-11-04T16:00:00.000Z");
  });
  it("Q5: a project already started fails a 'no expenditure before application' rule", () => {
    const call = opp([{ ...DYPA_NEE_18_29.requirements[0]!, key: "prestart", category: "no_expenditure_before_application", value: { required: true } }]);
    expect(assess(call, { ...EXAMPLE_PROFILE, planned_project_start: "2026-09-01" }, { now: NOW }).results[0]!.state).toBe("not_satisfied");
  });
});
