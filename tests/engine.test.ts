import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { assess, rankKey } from "@/lib/domain/eligibility";
import { EXAMPLE_PROFILE, type MatchProfile } from "@/lib/domain/profile";
import { legacyEnvelopesToRecords } from "@/lib/domain/engine/legacy";
import { SYNTHETIC_OPPORTUNITIES } from "../db/seed/synthetic-opportunities";
import { NOW, opp, rec } from "./helpers";

const state = (a: ReturnType<typeof assess>, key: string) => a.results.find((r) => r.key === key)?.state;

describe("eligibility precedence (brief §3 + test list)", () => {
  it("#1 an unknown mandatory requirement is never a pass", () => {
    const a = assess(opp([rec("employment", { statuses: ["unemployed"] }, { key: "emp" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(a, "emp")).toBe("unknown");
    expect(a.eligibility).toBe("insufficient_information");
    const b = assess(opp([rec("employment", { statuses: ["unemployed"] }, { key: "emp" }), rec("age", { max: 29 }, { key: "age" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(b.eligibility).toBe("potentially_eligible_verification_required");
  });

  it("#2 a confirmed mandatory exclusion with authoritative evidence → ineligible_verified", () => {
    const a = assess(opp([rec("age", { max: 24 }, { key: "age" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(a.eligibility).toBe("ineligible_verified");
    expect(a.eligibility_rule).toBe(1);
  });

  it("a failed requirement from weaker evidence → unlikely_eligible, not ineligible", () => {
    const a = assess(opp([rec("age", { max: 24 }, { key: "age", evidence_rank: 3 })]), EXAMPLE_PROFILE, { now: NOW });
    expect(a.eligibility).toBe("unlikely_eligible");
  });

  it("#3 contradictory official evidence → under_review", () => {
    const a = assess(opp([rec("age", { max: 35 }, { key: "age", flags: ["conflicting"] }), rec("business_stage", { stages: ["planning"] })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(a, "age")).toBe("conflicting");
    expect(a.eligibility).toBe("under_review");
  });

  it("#4/#5 an individual with no registered business: planner passes 'planning' stage, fails 'established'", () => {
    const planning = assess(opp([rec("business_stage", { stages: ["idea", "planning"] }, { key: "s" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(planning.eligibility).toBe("potentially_eligible");
    const established = assess(opp([rec("business_stage", { stages: ["established"] }, { key: "s" }), rec("applicant_type", { types: ["company", "sole_proprietor"] }, { key: "t" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(established, "s")).toBe("not_satisfied");
    expect(state(established, "t")).toBe("not_satisfied");
  });

  it("#6 an existing business with an unknown registration date stays unknown", () => {
    const p: MatchProfile = { business_stage: "established", legal_form: "company", business_registration_date: "not_sure" };
    const a = assess(opp([rec("business_age", { min_months: 24 }, { key: "age" })]), p, { now: NOW });
    expect(state(a, "age")).toBe("unknown");
    expect(a.questions).toContain("business_registration_date");
    const known = assess(opp([rec("business_age", { min_months: 24 }, { key: "age" })]), { ...p, business_registration_date: "2025-01-10" }, { now: NOW });
    expect(state(known, "age")).toBe("not_satisfied");
  });

  it("#7 a business registered outside the eligible region is not satisfied", () => {
    const p: MatchProfile = { business_stage: "established", legal_form: "company", business_region: "EL30" };
    expect(state(assess(opp([rec("business_location", { regions: ["EL43"] }, { key: "loc" })]), p, { now: NOW }), "loc")).toBe("not_satisfied");
    expect(state(assess(opp([rec("business_location", { regions: ["EL4"] }, { key: "loc" })]), { ...p, business_region: "EL43" }, { now: NOW }), "loc")).toBe("satisfied");
  });

  it("#8 a company with missing turnover or employee data stays unknown", () => {
    const p: MatchProfile = { business_stage: "established", legal_form: "company" };
    const a = assess(opp([rec("company_size", { max_employees: 49 }, { key: "size" }), rec("turnover", { max_eur: 10_000_000 }, { key: "to" })]), p, { now: NOW });
    expect([state(a, "size"), state(a, "to")]).toEqual(["unknown", "unknown"]);
    expect(a.questions).toEqual(expect.arrayContaining(["employees_range", "turnover_range"]));
  });

  it("#9 an applicant who is not registered with DYPA fails a DYPA requirement; unanswered stays unknown", () => {
    const r = rec("unemployment_registration", { required: true }, { key: "dypa" });
    expect(state(assess(opp([r]), { ...EXAMPLE_PROFILE, dypa_registered: "no" }, { now: NOW }), "dypa")).toBe("not_satisfied");
    expect(state(assess(opp([r]), EXAMPLE_PROFILE, { now: NOW }), "dypa")).toBe("unknown");
  });

  it("#10 declining an optional financial detail never counts against the user", () => {
    const reqs = [rec("business_stage", { stages: ["planning"] }), rec("turnover", { max_eur: 1_000_000 }, { key: "to", kind: "optional" })];
    const a = assess(opp(reqs), { ...EXAMPLE_PROFILE, turnover_range: "prefer_not" }, { now: NOW });
    expect(state(a, "to")).toBe("unknown");
    expect(a.eligibility).toBe("potentially_eligible");
  });

  it("#11 matching co-financing: computed from budget × % and compared with available contribution", () => {
    const r = rec("cofinancing", { own_contribution_pct: 50 }, { key: "cof" });
    expect(state(assess(opp([r]), EXAMPLE_PROFILE, { now: NOW }), "cof")).toBe("unknown"); // budget unknown: do not assume
    expect(state(assess(opp([r]), { ...EXAMPLE_PROFILE, project_budget_eur: 80_000 }, { now: NOW }), "cof")).toBe("satisfied");
    expect(state(assess(opp([r]), { ...EXAMPLE_PROFILE, own_contribution_range: "5k_20k", project_budget_eur: 80_000 }, { now: NOW }), "cof")).toBe("not_satisfied");
  });

  it("#12 a call requiring no expenditure before application", () => {
    const r = rec("no_expenditure_before_application", { required: true }, { key: "pre" });
    expect(state(assess(opp([r]), { ...EXAMPLE_PROFILE, planned_project_start: "2026-09-01" }, { now: NOW }), "pre")).toBe("not_satisfied");
    expect(state(assess(opp([r]), { ...EXAMPLE_PROFILE, planned_project_start: "2027-01-15" }, { now: NOW }), "pre")).toBe("satisfied");
    expect(state(assess(opp([r]), EXAMPLE_PROFILE, { now: NOW }), "pre")).toBe("unknown");
    const approval = rec("no_expenditure_before_application", { required: true, until: "approval" }, { key: "pre" });
    expect(state(assess(opp([approval]), { ...EXAMPLE_PROFILE, planned_project_start: "2027-01-15" }, { now: NOW }), "pre")).toBe("unknown");
  });

  it("#19 an unsupported or low-confidence AI requirement goes to human review, never to a pass", () => {
    const a = assess(opp([rec("other", null, { key: "x", original_text: "Applicants must be of good repute" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(a, "x")).toBe("needs_review");
    expect(a.eligibility).toBe("under_review");
    const ai = assess(opp([rec("age", { max: 40 }, { key: "ai", flags: ["ai_extracted"], confidence: "medium" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(ai, "ai")).toBe("needs_review");
    const malformed = assess(opp([rec("age", { maximum: "forty" }, { key: "bad" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(malformed, "bad")).toBe("needs_review");
  });

  it("#23 a high relevance score cannot override ineligibility", () => {
    const strong = assess(opp([
      rec("age", { max: 24 }), rec("geography", { regions: ["GR"] }), rec("business_stage", { stages: ["planning"] }),
      rec("education", { min_level: "bachelor" }), rec("sector", { exclude: ["K"] }),
    ]), EXAMPLE_PROFILE, { now: NOW });
    const weak = assess(opp([rec("geography", { regions: ["GR"] })], { closes_at: new Date(NOW.getTime() + 2 * 86_400_000) }), EXAMPLE_PROFILE, { now: NOW });
    expect(strong.eligibility).toBe("ineligible_verified");
    expect(strong.relevance_score!).toBeGreaterThan(weak.relevance_score!);
    expect(rankKey(weak)).toBeLessThan(rankKey(strong));
  });

  it("a requirement set not verified complete never yields plain 'potentially eligible'", () => {
    const a = assess(opp([rec("business_stage", { stages: ["planning"] })], { requirement_set_completeness: "partial" }), EXAMPLE_PROFILE, { now: NOW });
    expect(a.eligibility).toBe("potentially_eligible_verification_required");
  });

  it("conditional requirements apply only to the listed applicant types", () => {
    const r = rec("company_size", { max_employees: 49 }, { key: "size", kind: "conditional", applies_to: ["company"] });
    expect(state(assess(opp([r]), EXAMPLE_PROFILE, { now: NOW }), "size")).toBe("not_applicable");
    expect(state(assess(opp([r]), { business_stage: "established" }, { now: NOW }), "size")).toBe("unknown"); // legal form unknown
  });

  it("a regional call is not assumed to suit an 'anywhere in Greece' user", () => {
    const a = assess(opp([rec("geography", { regions: ["EL43"] }, { key: "g" })]), EXAMPLE_PROFILE, { now: NOW });
    expect(state(a, "g")).toBe("unknown");
    expect(a.questions).toContain("willing_to_relocate");
  });
});

describe("availability is separate from eligibility", () => {
  it("#25 a call whose status cannot be verified is reported as such", () => {
    expect(assess(opp([], { status: "unverified" }), EXAMPLE_PROFILE, { now: NOW }).availability).toBe("unverified");
  });
  it("#16 a stale source → availability 'stale', regardless of a future deadline", () => {
    const a = assess(opp([], { last_verified_at: new Date(NOW.getTime() - 5 * 86_400_000), stale_after_hours: 72 }), EXAMPLE_PROFILE, { now: NOW });
    expect(a.availability).toBe("stale");
  });
  it("a passed deadline is 'deadline passed, unconfirmed' until the source confirms closure", () => {
    const a = assess(opp([], { closes_at: new Date(NOW.getTime() - 3_600_000) }), EXAMPLE_PROFILE, { now: NOW });
    expect(a.availability).toBe("deadline_passed_unconfirmed");
  });
  it("budget exhaustion is only reported when confirmed", () => {
    expect(assess(opp([], { status: "closed", budget_exhausted: "confirmed" }), {}, { now: NOW }).availability).toBe("closed_budget_exhausted");
    expect(assess(opp([], { status: "closed" }), {}, { now: NOW }).availability).toBe("closed");
  });
  it("estimated deadlines never count as official readiness", () => {
    expect(assess(opp([], { deadline_kind: "estimated" }), {}, { now: NOW }).deadline.state).toBe("unknown");
  });
});

describe("relevance rules", () => {
  it("unknown requirements earn no bonus; absent requirements are neutral", () => {
    const base = [rec("geography", { regions: ["GR"] })];
    const withUnknownAge = assess(opp([...base, rec("age", { max: 30 }, { key: "a" })]), { ...EXAMPLE_PROFILE, age_range: undefined }, { now: NOW });
    const without = assess(opp(base), EXAMPLE_PROFILE, { now: NOW });
    expect(withUnknownAge.relevance_score).toBe(without.relevance_score);
    expect(withUnknownAge.evidence_coverage).toBeLessThan(without.evidence_coverage);
  });
});

describe("seed data converts without inventing requirements", () => {
  it("unknown envelope dimensions make the set 'partial'", () => {
    const eu = SYNTHETIC_OPPORTUNITIES.find((o) => o.key === "eu-research")!;
    const { records, completeness } = legacyEnvelopesToRecords(eu.requirements, { idPrefix: "x", fallbackUrl: "https://test-data.example/x" });
    expect(completeness).toBe("partial");
    expect(records.map((r) => r.category)).toEqual(["geography"]);
  });
});

// ── Property-based tests ───────────────────────────────────────────────────
const categories = ["age", "education", "employment", "unemployment_registration", "business_stage", "sector", "cofinancing", "company_size", "turnover", "geography", "other"];
const arbRecord = fc.record({
  category: fc.constantFrom(...categories),
  kind: fc.constantFrom("mandatory", "optional", "conditional", "informational") as fc.Arbitrary<"mandatory">,
  value: fc.oneof(
    fc.constant({ max: 29 }), fc.constant({ min_level: "doctorate" }), fc.constant({ statuses: ["unemployed"] }), fc.constant({ required: true }),
    fc.constant({ stages: ["planning"] }), fc.constant({ exclude: ["K"] }), fc.constant({ own_contribution_pct: 40 }),
    fc.constant({ max_employees: 9 }), fc.constant({ max_eur: 2_000_000 }), fc.constant({ regions: ["EL43"] }), fc.constant(null), fc.anything(),
  ),
  flags: fc.subarray(["conflicting", "needs_review", "unsupported", "ai_extracted"] as const),
  evidence_rank: fc.constantFrom(1, 2, 3, 4) as fc.Arbitrary<1>,
  confidence: fc.constantFrom("low", "medium", "high") as fc.Arbitrary<"high">,
});
const arbProfile: fc.Arbitrary<MatchProfile> = fc.record({
  age_range: fc.option(fc.constantFrom("18_24", "25_29", "30_34", "prefer_not"), { nil: undefined }),
  education_level: fc.option(fc.constantFrom("bachelor", "master_or_doctorate", "not_sure"), { nil: undefined }),
  employment_status: fc.option(fc.constantFrom("employed", "unemployed", "prefer_not"), { nil: undefined }),
  dypa_registered: fc.option(fc.constantFrom("yes", "no", "not_sure"), { nil: undefined }),
  business_stage: fc.option(fc.constantFrom("planning", "established", "not_sure"), { nil: undefined }),
  sectors: fc.option(fc.constantFrom(["*"], ["K"], ["J"]), { nil: undefined }),
  own_contribution_range: fc.option(fc.constantFrom("none", "over_50k", "prefer_not"), { nil: undefined }),
}, { requiredKeys: [] }) as fc.Arbitrary<MatchProfile>;

describe("property-based guarantees", () => {
  it("if any binding requirement is unknown, the result is never plain 'potentially_eligible'", () => {
    fc.assert(fc.property(fc.array(arbRecord, { minLength: 1, maxLength: 8 }), arbProfile, fc.constantFrom("complete", "partial", "unknown"), (rs, p, completeness) => {
      const a = assess(opp(rs.map((r) => rec(r.category, r.value, r)), { requirement_set_completeness: completeness as "complete" }), p, { now: NOW });
      const bindingUnknown = a.results.some((r) => (r.kind === "mandatory" || r.kind === "conditional") && ["unknown", "needs_review", "conflicting"].includes(r.state));
      if (bindingUnknown || completeness !== "complete") expect(a.eligibility).not.toBe("potentially_eligible");
    }), { numRuns: 400 });
  });

  it("a binding not_satisfied requirement always yields unlikely/ineligible, whatever the relevance", () => {
    fc.assert(fc.property(fc.array(arbRecord, { maxLength: 6 }), arbProfile, (rs, p) => {
      const a = assess(opp([...rs.map((r) => rec(r.category, r.value, r)), rec("age", { max: 10 })]), { ...p, age_range: "25_29" }, { now: NOW });
      expect(["unlikely_eligible", "ineligible_verified"]).toContain(a.eligibility);
    }), { numRuns: 300 });
  });

  it("flagged or unsupported requirements are never 'satisfied'", () => {
    fc.assert(fc.property(arbRecord, arbProfile, (r, p) => {
      const result = assess(opp([rec(r.category, r.value, r)]), p, { now: NOW }).results[0]!;
      if (r.flags.includes("conflicting") || r.flags.includes("needs_review") || r.flags.includes("unsupported") || r.category === "other")
        expect(result.state).not.toBe("satisfied");
    }), { numRuns: 400 });
  });
});
