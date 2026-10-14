/**
 * Hypothetical "what if" scenarios. A scenario NEVER modifies the user's real profile: it works on a deep copy,
 * every result is marked hypothetical, and nothing here touches the database.
 *
 * Only lawful, forward-looking changes are offered. Retroactive changes (back-dated registration, a project
 * start date in the past) and changes that would misrepresent the applicant are rejected as not permissible.
 */
import { assess, type Assessment, type OpportunityForMatching } from "./eligibility";
import type { ContributionRange, LegalForm, MatchProfile } from "./profile";

export type Scenario =
  | { kind: "register_business"; legal_form: Exclude<LegalForm, "not_sure">; registration_date: string }
  | { kind: "establish_in_region"; region: string }
  | { kind: "increase_cofinancing"; range: Exclude<ContributionRange, "not_sure" | "prefer_not"> }
  | { kind: "change_project_start"; start_date: string }
  | { kind: "obtain_dypa_registration" };

export interface ScenarioChange { requirement_key: string; category: string; from: string; to: string; original_text: string }

export interface ScenarioResult {
  hypothetical: true;
  scenario: Scenario;
  permissible: "yes" | "no" | "depends";
  permissibility_reasons: string[];
  assumptions: string[];
  baseline: Assessment;
  outcome: Assessment;
  changes: ScenarioChange[];
  evidence_needed: string[];
  remaining_blockers: { requirement_key: string; state: string; original_text: string }[];
}

const isFuture = (iso: string, now: Date) => { const d = new Date(iso); return !Number.isNaN(d.getTime()) && d > now; };

function applyScenario(base: MatchProfile, s: Scenario, now: Date): { profile: MatchProfile; permissible: ScenarioResult["permissible"]; reasons: string[]; assumptions: string[]; evidence: string[] } {
  const p: MatchProfile = structuredClone(base);
  switch (s.kind) {
    case "register_business": {
      if (base.business_stage === "registered_new" || base.business_stage === "established")
        return { profile: p, permissible: "no", reasons: ["already_registered"], assumptions: [], evidence: [] };
      if (!isFuture(s.registration_date, now))
        return { profile: p, permissible: "no", reasons: ["retroactive_registration_not_allowed"], assumptions: [], evidence: [] };
      Object.assign(p, { business_stage: "registered_new", legal_form: s.legal_form, business_registration_date: s.registration_date, persona: "existing_business" });
      return { profile: p, permissible: "depends", reasons: ["call_may_require_registration_before_or_after_submission"],
        assumptions: [`registered_as:${s.legal_form}`, `registration_date:${s.registration_date}`], evidence: ["business_registration_certificate", "tax_registration"] };
    }
    case "establish_in_region":
      Object.assign(p, { region_codes: [s.region], business_region: s.region });
      return { profile: p, permissible: "depends", reasons: ["genuine_establishment_required"], assumptions: [`operating_region:${s.region}`],
        evidence: ["registered_seat_or_branch_in_region", "proof_of_actual_activity_in_region"] };
    case "increase_cofinancing":
      p.own_contribution_range = s.range;
      return { profile: p, permissible: "yes", reasons: [], assumptions: [`own_contribution:${s.range}`], evidence: ["proof_of_funds_or_financing_commitment"] };
    case "change_project_start":
      if (!isFuture(s.start_date, now))
        return { profile: p, permissible: "no", reasons: ["past_start_cannot_be_changed"], assumptions: [], evidence: [] };
      p.planned_project_start = s.start_date;
      return { profile: p, permissible: "yes", reasons: [], assumptions: [`project_start:${s.start_date}`], evidence: ["no_contracts_or_invoices_before_start"] };
    case "obtain_dypa_registration":
      if (base.employment_status === "employed" || base.employment_status === "self_employed")
        return { profile: p, permissible: "no", reasons: ["registration_requires_actual_unemployment"], assumptions: [], evidence: [] };
      p.dypa_registered = "yes";
      return { profile: p, permissible: "depends", reasons: ["registration_requires_actual_unemployment", "minimum_registration_period_may_apply"],
        assumptions: ["dypa_registered:yes"], evidence: ["dypa_registration_card"] };
  }
}

export function runScenario(o: OpportunityForMatching, realProfile: MatchProfile, s: Scenario, now = new Date(), opts: { applicationDate?: Date } = {}): ScenarioResult {
  const baseline = assess(o, realProfile, { now, applicationDate: opts.applicationDate });
  const applied = applyScenario(realProfile, s, now);
  const outcome = applied.permissible === "no" ? baseline : assess(o, applied.profile, { now, hypothetical: true, applicationDate: opts.applicationDate });
  const before = new Map(baseline.results.map((r) => [r.key, r.state]));
  const changes = outcome.results
    .filter((r) => before.get(r.key) !== r.state)
    .map((r) => ({ requirement_key: r.key, category: r.category, from: before.get(r.key) ?? "absent", to: r.state, original_text: r.original_text }));
  return {
    hypothetical: true,
    scenario: s,
    permissible: applied.permissible,
    permissibility_reasons: applied.reasons,
    assumptions: applied.assumptions,
    baseline,
    outcome: { ...outcome, hypothetical: true },
    changes,
    evidence_needed: applied.evidence,
    remaining_blockers: outcome.results
      .filter((r) => r.kind !== "informational" && r.kind !== "optional" && !["satisfied", "not_applicable"].includes(r.state))
      .map((r) => ({ requirement_key: r.key, state: r.state, original_text: r.original_text })),
  };
}
