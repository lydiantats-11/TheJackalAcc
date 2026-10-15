import { describe, expect, it } from "vitest";
import { buildDecisionRecord, fieldsRead, OUTCOME_CLASS } from "@/lib/domain/decision-record";
import { assess, RULE_VERSION } from "@/lib/domain/eligibility";
import { NOW, opp, rec } from "./helpers";

describe("decision record (core capability 2: auditable decisions)", () => {
  const geo = rec("geography", { regions: ["GR"] }, { verified_at: "2026-10-14" });

  it("records the answers the engine actually read — observed, not declared", () => {
    const fields = fieldsRead(geo, { application_country: "GR" }, { now: NOW });
    expect(fields).toContain("application_country");
    expect(fields).not.toContain("household_income_range");
  });

  it("carries the official wording, source, verification date, rule type and outcome for every line", () => {
    const r = buildDecisionRecord(opp([geo]), { application_country: "GR", household_income_range: "under_10k" }, { now: NOW });
    expect(r.outcome_status).toBe("potentially_eligible");
    expect(r.outcome_class).toBe("potentially_eligible");
    expect(r.outcome_certainty).toBe("confirmed_by_rules");
    const line = r.lines[0]!;
    expect(line).toMatchObject({ official_text: geo.original_text, source_url: geo.evidence.source_url, verified_at: "2026-10-14", rule_type: "mandatory", outcome: "satisfied" });
    expect(line.answers_used).toEqual(expect.objectContaining({ application_country: "GR" }));
    expect(Object.keys(line.answers_used)).not.toContain("household_income_range"); // unread answers never enter the record
    expect(r.engine_version).toBe(RULE_VERSION);
  });

  it("never changes the engine's outcome", () => {
    for (const p of [{}, { application_country: "GR" }, { application_country: "DE" }]) {
      expect(buildDecisionRecord(opp([geo]), p, { now: NOW }).outcome_status).toBe(assess(opp([geo]), p, { now: NOW }).eligibility);
    }
  });

  it("maps outcomes to the four classes: unknown → information needed, failing → ineligible", () => {
    expect(buildDecisionRecord(opp([geo]), {}, { now: NOW }).outcome_class).toBe("information_needed");
    expect(buildDecisionRecord(opp([geo]), { application_country: "DE" }, { now: NOW }).outcome_class).toBe("ineligible");
    expect(OUTCOME_CLASS.under_review).toBe("manual_review");
  });

  it("gives a reproducible reference: same inputs → same reference; any input change → a different one", () => {
    const a = buildDecisionRecord(opp([geo]), { application_country: "GR" }, { now: NOW });
    const b = buildDecisionRecord(opp([geo]), { application_country: "GR", household_income_range: "under_10k" }, { now: NOW });
    const c = buildDecisionRecord(opp([geo]), { application_country: "DE" }, { now: NOW });
    const d = buildDecisionRecord(opp([geo], { version: 2 }), { application_country: "GR" }, { now: NOW });
    expect(a.reference).toMatch(/^JA-.+-[0-9a-f]{16}$/);
    expect(b.reference).toBe(a.reference); // an answer the rules did not read does not change the decision
    expect(c.reference).not.toBe(a.reference);
    expect(d.reference).not.toBe(a.reference); // a new version of the call is a new decision
  });
});
