import { describe, expect, it } from "vitest";
import { runScenario } from "@/lib/domain/scenarios";
import { estimateAward } from "@/lib/domain/funding";
import { normaliseDeadline } from "@/lib/domain/deadline";
import { EXAMPLE_PROFILE, type MatchProfile } from "@/lib/domain/profile";
import { NOW, opp, rec } from "./helpers";

describe("hypothetical scenarios", () => {
  const call = opp([
    rec("business_stage", { stages: ["registered_new"] }, { key: "stage" }),
    rec("geography", { regions: ["EL43"] }, { key: "geo" }),
    rec("cofinancing", { min_own_contribution_eur: 60_000 }, { key: "cof" }),
  ]);

  it("#22 a scenario never modifies the real profile and is labelled hypothetical", () => {
    const real: MatchProfile = structuredClone(EXAMPLE_PROFILE);
    const snapshot = JSON.stringify(real);
    const r = runScenario(call, real, { kind: "register_business", legal_form: "sole_proprietor", registration_date: "2026-12-01" }, NOW);
    expect(JSON.stringify(real)).toBe(snapshot);
    expect(r.hypothetical).toBe(true);
    expect(r.outcome.hypothetical).toBe(true);
    expect(r.baseline.hypothetical).toBe(false);
    expect(r.changes).toContainEqual(expect.objectContaining({ requirement_key: "stage", from: "not_satisfied", to: "satisfied" }));
    expect(r.remaining_blockers.map((b) => b.requirement_key)).toEqual(expect.arrayContaining(["geo", "cof"]));
  });

  it("retroactive changes are not permissible and change nothing", () => {
    const r = runScenario(call, EXAMPLE_PROFILE, { kind: "register_business", legal_form: "company", registration_date: "2026-01-01" }, NOW);
    expect(r.permissible).toBe("no");
    expect(r.permissibility_reasons).toContain("retroactive_registration_not_allowed");
    expect(r.changes).toEqual([]);
    expect(runScenario(call, EXAMPLE_PROFILE, { kind: "change_project_start", start_date: "2025-05-01" }, NOW).permissible).toBe("no");
  });

  it("DYPA registration is not offered to someone who is employed", () => {
    const r = runScenario(call, { ...EXAMPLE_PROFILE, employment_status: "employed" }, { kind: "obtain_dypa_registration" }, NOW);
    expect(r.permissible).toBe("no");
  });

  it("moving to the eligible region resolves the geography requirement and lists the evidence needed", () => {
    const r = runScenario(call, EXAMPLE_PROFILE, { kind: "establish_in_region", region: "EL43" }, NOW);
    expect(r.changes).toContainEqual(expect.objectContaining({ requirement_key: "geo", from: "unknown", to: "satisfied" }));
    expect(r.evidence_needed.length).toBeGreaterThan(0);
    expect(r.permissible).toBe("depends");
  });
});

describe("funding arithmetic", () => {
  it("shows formula and caps at the published maximum; never computes with missing inputs", () => {
    const e = estimateAward({ eligible_expenditure: 100_000, intensity_pct: 60, min_award: 5_000, max_award: 50_000, currency: "EUR" });
    expect(e.estimated_award).toBe(50_000);
    expect(e.own_contribution).toBe(50_000);
    expect(e.steps.join(" ")).toMatch(/capped/);
    expect(e.caveats).toContain("estimate_not_guarantee");
    const missing = estimateAward({ eligible_expenditure: 100_000, intensity_pct: null, min_award: null, max_award: null, currency: "EUR" });
    expect(missing.computable).toBe(false);
    expect(missing.estimated_award).toBeNull();
  });
  it("rounds down to the cent and warns below the minimum award", () => {
    const e = estimateAward({ eligible_expenditure: 3_333.33, intensity_pct: 50, min_award: 5_000, max_award: null, currency: "EUR" });
    expect(e.estimated_award).toBe(1_666.66);
    expect(e.caveats).toContain("below_minimum_award");
  });
});

describe("deadline normalisation", () => {
  it("keeps exact instants, interprets local times in the SOURCE timezone, and flags date-only deadlines", () => {
    expect(normaliseDeadline("2026-11-20T17:00:00+01:00", "Europe/Brussels").closes_at?.toISOString()).toBe("2026-11-20T16:00:00.000Z");
    expect(normaliseDeadline("2026-11-20 15:00", "Europe/Athens").closes_at?.toISOString()).toBe("2026-11-20T13:00:00.000Z");
    const d = normaliseDeadline("2026-11-20", "Europe/Athens");
    expect(d.deadline_is_date_only).toBe(true);
    expect(d.closes_at?.toISOString()).toBe("2026-11-19T22:00:00.000Z"); // start of 20 Nov in Athens — the conservative reading
    expect(d.deadline_original_text).toBe("2026-11-20");
  });
  it("#6-style: an unparseable or missing deadline stays not announced", () => {
    expect(normaliseDeadline("έως εξαντλήσεως του προϋπολογισμού", "Europe/Athens")).toMatchObject({ closes_at: null, deadline_kind: "not_announced" });
    expect(normaliseDeadline(null, "Europe/Athens").closes_at).toBeNull();
  });
});
