/**
 * Manual end-to-end check: rows exported from PostgreSQL after applying db/seed/official-records-2026-10-14.sql
 * → the same validation/mapping as src/lib/data/opportunities.ts (loadRequirements + toMatchable) → the engine.
 * Usage: psql "$DATABASE_URL" -Atc "SELECT json_build_object('opps',(SELECT json_agg(o) FROM opportunities o),'reqs',(SELECT json_agg(r) FROM opportunity_requirements r))" > dump.json
 *        npx tsx tests/manual/db-records-check.ts dump.json
 */
import { readFileSync } from "node:fs";
import { assess, type OpportunityForMatching } from "../../src/lib/domain/eligibility";
import { requirementRecordSchema, type RequirementRecord } from "../../src/lib/domain/engine/requirement";
import type { MatchProfile } from "../../src/lib/domain/profile";

const dump = JSON.parse(readFileSync(process.argv[2]!, "utf8"));
const NOW = new Date("2026-10-14T12:00:00Z");
const byOpp = new Map<string, RequirementRecord[]>();
let invalid = 0;
for (const r of dump.reqs) {
  const candidate = { id: r.id, key: r.requirement_key, version: r.version, category: r.category, kind: r.kind, applies_to: r.applies_to,
    value: r.value, original_text: r.original_text, original_lang: r.original_lang, interpretation: r.interpretation, evidence: r.evidence,
    evidence_rank: r.evidence_rank, confidence: r.confidence, flags: r.flags, effective_from: r.effective_from, effective_to: r.effective_to,
    verified_at: r.verified_at ? new Date(r.verified_at).toISOString() : null };
  const parsed = requirementRecordSchema.safeParse(candidate);
  if (!parsed.success) { invalid++; console.log("INVALID requirement", r.requirement_key, JSON.stringify(parsed.error.issues[0])); continue; }
  byOpp.set(r.opportunity_id, [...(byOpp.get(r.opportunity_id) ?? []), parsed.data as RequirementRecord]);
}
const opps = new Map<string, OpportunityForMatching>();
for (const o of dump.opps) opps.set(o.external_key, {
  id: o.id, version: o.version, status: o.status, opportunity_type: o.opportunity_type, closes_at: o.closes_at ? new Date(o.closes_at) : null,
  deadline_kind: o.deadline_kind, last_verified_at: new Date(o.last_verified_at), stale_after_hours: (o.stale_after_days ?? 3) * 24,
  has_conflict: o.has_conflict, budget_exhausted: o.budget_exhausted, requirement_set_completeness: o.requirement_set_completeness,
  requirements: byOpp.get(o.id) ?? [] });

const cases: [string, string, MatchProfile, string][] = [
  ["returnee (Germany → Greece, employee)", "manual:art5c", { country_of_residence: "DE", citizenship_country: "GR", tax_residence_move: "planning", gr_tax_resident_prev6: "0", moving_from: "eu_eea", activity_in_greece: "employee_gr", intends_to_stay_2y: "yes" }, "potentially_eligible_verification_required"],
  ["returnee who lived in Greece 2+ of last 6 years", "manual:art5c", { tax_residence_move: "planning", gr_tax_resident_prev6: "2plus", moving_from: "eu_eea", activity_in_greece: "employee_gr", intends_to_stay_2y: "yes" }, "ineligible_verified"],
  ["foreign pensioner moving from the EU", "manual:art5b", { tax_residence_move: "planning", gr_tax_resident_prev6: "0", moving_from: "eu_eea", activity_in_greece: "pension" }, "potentially_eligible_verification_required"],
  ["18-year-old living in Greece", "manual:discovereu", { birth_year: 2008, country_of_residence: "GR" }, "potentially_eligible_verification_required"],
  ["26-year-old", "manual:discovereu", { birth_year: 2000, country_of_residence: "GR" }, "ineligible_verified"],
  ["dismissed worker with unemployment card", "manual:unemployment", { employment_status: "unemployed", last_job_end: "ended_by_employer", dypa_registered: "yes" }, "potentially_eligible_verification_required"],
  ["resigned worker", "manual:unemployment", { employment_status: "unemployed", last_job_end: "resigned", dypa_registered: "yes" }, "unlikely_eligible"],
  ["parent of two in Greece", "manual:a21", { dependent_children: "2", country_of_residence: "GR" }, "potentially_eligible_verification_required"],
  ["no answers", "manual:a21", {}, "insufficient_information"],
];
let failed = 0;
for (const [label, key, profile, expected] of cases) {
  const o = opps.get(key)!;
  const a = assess(o, profile, { now: NOW });
  const ok = a.eligibility === expected;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${key} · ${label}: ${a.eligibility} (availability ${a.availability})${ok ? "" : ` — expected ${expected}`}`);
}
console.log(JSON.stringify({ opportunities: opps.size, requirements: dump.reqs.length, invalid_requirements: invalid, cases: cases.length, failed }));
if (failed || invalid) process.exitCode = 1;
