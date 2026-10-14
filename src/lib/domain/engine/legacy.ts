/**
 * Converts Phase 1 "requirement envelopes" (one JSONB per dimension) into Phase 2 requirement records.
 * Used for seed data and for opportunities created before migration 0002.
 *   required          → one mandatory record per rule
 *   confirmed_absent  → no record (the dimension is verified to have no rule)
 *   not_applicable    → no record
 *   unknown           → no record AND the requirement set cannot be "complete"
 */
import type { OpportunityRequirements, Requirement } from "../requirements";
import type { RequirementRecord } from "./requirement";

export function legacyEnvelopesToRecords(
  env: OpportunityRequirements,
  opts: { idPrefix: string; fallbackUrl: string; lang?: string; origin?: "synthetic" | "admin" },
): { records: RequirementRecord[]; completeness: "complete" | "partial" } {
  const records: RequirementRecord[] = [];
  let anyUnknown = false;
  const add = (key: string, category: string, req: Requirement<unknown> | undefined, value: (v: any) => unknown, text: (v: any) => string) => {
    if (!req || req.state === "unknown") { anyUnknown = true; return; }
    if (req.state !== "required") return;
    const v = req.value;
    records.push({
      id: `${opts.idPrefix}:${key}`, key, version: 1, category, kind: req.mandatory === false ? "optional" : "mandatory",
      value: value(v), original_text: text(v), original_lang: opts.lang ?? "en",
      interpretation: null,
      evidence: { source_url: req.evidence?.source_url ?? opts.fallbackUrl, excerpt: req.evidence?.excerpt },
      evidence_rank: 1, confidence: "high", flags: [],
    });
  };
  add("applicant_type", "applicant_type", env.applicant_types as never, (v) => v, (v) => `Eligible applicants: ${v.types.join(", ")}`);
  add("geography", "geography", env.geographic_scope as never, (v) => v, (v) => `Location: ${v.regions.join(", ")}`);
  add("age", "age", env.age_requirement as never, (v) => v, (v) => `Age ${v.min ?? "–"} to ${v.max ?? "–"}`);
  add("education", "education", env.education_requirement as never, (v) => v, (v) => `Minimum education: ${v.min_level}`);
  const emp = env.employment_requirement as Requirement<{ statuses?: string[]; dypa_registration_required?: boolean }> | undefined;
  if (emp?.state === "required") {
    if (emp.value.statuses) add("employment", "employment", { ...emp, value: { statuses: emp.value.statuses } } as never, (v) => v, (v) => `Employment status: ${v.statuses.join(", ")}`);
    if (emp.value.dypa_registration_required) add("dypa", "unemployment_registration", { ...emp, value: { required: true } } as never, () => ({ required: true }), () => "Registered with the public employment service (DYPA)");
  } else add("employment", "employment", emp as never, (v) => v, () => "");
  add("business_stage", "business_stage", env.business_stage_requirement as never, (v) => v, (v) => `Business stage: ${v.stages.join(", ")}`);
  add("sector", "sector", env.sector_requirement as never, (v) => v, (v) => `Sectors (NACE) included: ${(v.include ?? []).join(", ") || "all"}; excluded: ${(v.exclude ?? []).join(", ") || "none"}`);
  add("cofinancing", "cofinancing", env.cofinancing_requirement as never, (v) => v, (v) => `Own contribution: ${v.own_contribution_pct ?? "–"}% / min €${v.min_own_contribution_eur ?? "–"}`);
  return { records, completeness: anyUnknown ? "partial" : "complete" };
}
