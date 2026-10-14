/**
 * Eligibility engine v2 — deterministic aggregation of requirement results.
 *
 * Three SEPARATE outputs, never mixed:
 *   eligibility   what the verified rules say about this profile (precedence below)
 *   availability  whether the call can currently be applied to (status, deadline, freshness, conflicts)
 *   relevance     a prioritisation heuristic 0–100; NOT a probability of receiving funding
 *
 * Eligibility precedence (first matching rule wins):
 *   1. ineligible_verified   an applicable mandatory requirement is not_satisfied AND the requirement is
 *                            authoritative (official call document/portal, high confidence, no flags)
 *   2. unlikely_eligible     an applicable mandatory requirement is not_satisfied, evidence not conclusive
 *   3. under_review          an applicable mandatory requirement is conflicting or needs human review
 *   4. insufficient_information  no applicable mandatory requirement could be evaluated
 *                            (none known, or every one is unknown)
 *   5. potentially_eligible_verification_required  some mandatory requirement is unknown, or the
 *                            requirement set has not been verified as complete
 *   6. potentially_eligible  every applicable mandatory requirement is satisfied and the set is complete
 * Unknown never counts as a pass. Relevance never changes eligibility; ranking sorts by eligibility first.
 */
import { evaluateRequirement, type RequirementResult } from "./engine/evaluate";
import type { RequirementRecord } from "./engine/requirement";
import type { MatchProfile } from "./profile";

export const RULE_VERSION = "2026-10-13.2";

export type OpportunityStatus =
  | "discovered" | "under_review" | "upcoming" | "open" | "suspended" | "extended" | "closed" | "cancelled"
  | "archived" | "unverified";

export type EligibilityStatus =
  | "potentially_eligible" | "potentially_eligible_verification_required" | "unlikely_eligible"
  | "ineligible_verified" | "insufficient_information" | "under_review" | "not_assessed";

export type Availability =
  | "open" | "upcoming" | "suspended" | "closed" | "closed_budget_exhausted" | "deadline_passed_unconfirmed"
  | "unverified" | "stale" | "conflicting_information";

export interface OpportunityForMatching {
  id: string;
  version?: number;
  status: OpportunityStatus;
  opportunity_type: string;
  closes_at: Date | null;
  deadline_kind: "official" | "estimated" | "not_announced" | "rolling" | "not_applicable";
  last_verified_at: Date | null;
  stale_after_hours?: number;
  has_conflict?: boolean;
  budget_exhausted?: "unknown" | "confirmed" | "no";
  requirement_set_completeness: "unknown" | "partial" | "complete";
  funding_max_eur?: number | null;
  funding_intensity_pct?: number | null;
  /** Official issue date of the call, used by rules measured "at call publication". */
  published_on?: Date | null;
  requirements: RequirementRecord[];
}

export type Factor = "business_stage" | "geography" | "sector" | "capital" | "age" | "deadline" | "education";
export type Weights = Record<Factor, number>;

export const DEFAULT_WEIGHTS: Weights = { business_stage: 25, geography: 20, sector: 15, capital: 15, age: 10, deadline: 10, education: 5 };
export const WEIGHTS_BY_TYPE: Partial<Record<string, Partial<Weights>>> = {
  procurement: { age: 0, education: 0, business_stage: 15, sector: 30 },
  training: { capital: 0, business_stage: 10, education: 15 },
  employment_subsidy: { age: 15, capital: 5 },
};
export function weightsFor(type: string, overrides?: Partial<Weights>): Weights {
  return { ...DEFAULT_WEIGHTS, ...(WEIGHTS_BY_TYPE[type] ?? {}), ...(overrides ?? {}) };
}

const FACTOR_OF: Partial<Record<string, Factor>> = {
  applicant_type: "business_stage", business_stage: "business_stage", business_age: "business_stage", legal_form: "business_stage",
  registration_timing: "business_stage", sme_status: "business_stage",
  geography: "geography", business_location: "geography", sector: "sector", cofinancing: "capital", age: "age", education: "education",
  birth_date_range: "age",
};

export interface DeadlineFactor {
  state: "satisfied" | "not_satisfied" | "unknown" | "not_applicable";
  fit: number | null;
  days_left?: number;
  reason: string;
}

export interface Assessment {
  opportunity_id: string;
  opportunity_version: number | null;
  eligibility: EligibilityStatus;
  eligibility_rule: number; // which precedence rule decided (1–6)
  availability: Availability;
  relevance_score: number | null;
  evidence_coverage: number;
  unresolved_count: number;
  results: RequirementResult[];
  deadline: DeadlineFactor;
  questions: string[];
  /** Future duties collected from all requirements (e.g. register within 60 days of approval). */
  obligations: string[];
  hypothetical: boolean;
  rule_version: string;
  assessed_at: string;
}

const CLOSED: OpportunityStatus[] = ["closed", "cancelled", "archived"];
const UNVERIFIED: OpportunityStatus[] = ["discovered", "under_review", "unverified"];

export function availabilityOf(o: OpportunityForMatching, now: Date): Availability {
  if (CLOSED.includes(o.status)) return o.budget_exhausted === "confirmed" ? "closed_budget_exhausted" : "closed";
  if (o.has_conflict) return "conflicting_information";
  if (UNVERIFIED.includes(o.status)) return "unverified";
  const staleMs = (o.stale_after_hours ?? 72) * 3_600_000;
  if (!o.last_verified_at || now.getTime() - o.last_verified_at.getTime() > staleMs) return "stale";
  if (o.status === "suspended") return "suspended";
  if (o.deadline_kind === "official" && o.closes_at && o.closes_at < now) return "deadline_passed_unconfirmed";
  return o.status === "upcoming" ? "upcoming" : "open";
}

function deadlineFactor(o: OpportunityForMatching, now: Date): DeadlineFactor {
  if (o.deadline_kind === "rolling") return { state: "satisfied", fit: 0.8, reason: "deadline_rolling" };
  if (o.deadline_kind === "not_applicable") return { state: "not_applicable", fit: null, reason: "not_applicable" };
  // Estimated deadlines never contribute to readiness: they are not official.
  if (o.deadline_kind !== "official" || !o.closes_at) return { state: "unknown", fit: null, reason: "deadline_unknown" };
  const days = Math.floor((o.closes_at.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return { state: "not_satisfied", fit: 0, days_left: days, reason: "deadline_passed" };
  return { state: "satisfied", fit: days >= 21 ? 1 : days >= 7 ? 0.6 : 0.3, days_left: days, reason: "deadline_days" };
}

export function assess(
  o: OpportunityForMatching,
  profile: MatchProfile,
  opts: { now?: Date; weights?: Partial<Weights>; hypothetical?: boolean; applicationDate?: Date } = {},
): Assessment {
  const now = opts.now ?? new Date();
  const ctx = {
    now, funding_max_eur: o.funding_max_eur ?? null, funding_intensity_pct: o.funding_intensity_pct ?? null,
    call_published_on: o.published_on ?? null, application_date: opts.applicationDate ?? null,
  };
  const results = o.requirements.map((r) => evaluateRequirement(r, profile, ctx));

  // ── eligibility ──
  const binding = results.filter((r) => (r.kind === "mandatory" || r.kind === "conditional") && r.state !== "not_applicable");
  let eligibility: EligibilityStatus;
  let rule: number;
  const failing = binding.filter((r) => r.state === "not_satisfied");
  if (failing.some((r) => r.authoritative)) [eligibility, rule] = ["ineligible_verified", 1];
  else if (failing.length > 0) [eligibility, rule] = ["unlikely_eligible", 2];
  else if (binding.some((r) => r.state === "conflicting" || r.state === "needs_review")) [eligibility, rule] = ["under_review", 3];
  else if (binding.length === 0 ? o.requirement_set_completeness !== "complete" : binding.every((r) => r.state === "unknown"))
    [eligibility, rule] = ["insufficient_information", 4];
  else if (binding.some((r) => r.state === "unknown") || o.requirement_set_completeness !== "complete")
    [eligibility, rule] = ["potentially_eligible_verification_required", 5];
  else [eligibility, rule] = ["potentially_eligible", 6];

  // ── relevance (heuristic) ──
  const weights = weightsFor(o.opportunity_type, opts.weights);
  const byFactor = new Map<Factor, number[]>();
  const present = new Set<Factor>();
  for (const r of results) {
    const f = FACTOR_OF[r.category];
    if (!f || r.kind === "informational") continue;
    if (r.state !== "not_applicable") present.add(f);
    if (r.fit !== null && r.state !== "not_applicable") byFactor.set(f, [...(byFactor.get(f) ?? []), r.fit]);
  }
  const deadline = deadlineFactor(o, now);
  if (deadline.state !== "not_applicable") present.add("deadline");
  if (deadline.fit !== null) byFactor.set("deadline", [deadline.fit]);
  let scored = 0, points = 0, presentWeight = 0;
  for (const f of present) presentWeight += weights[f];
  for (const [f, fits] of byFactor) {
    if (weights[f] === 0) continue;
    scored += weights[f];
    points += weights[f] * Math.min(...fits); // the weakest requirement in a factor determines its fit
  }
  const relevance = scored > 0 ? Math.round((points / scored) * 1000) / 10 : null;
  const coverage = presentWeight > 0 ? Math.round((scored / presentWeight) * 1000) / 1000 : 0;

  const unresolved = results.filter((r) => ["unknown", "needs_review", "conflicting"].includes(r.state)).length + (deadline.state === "unknown" ? 1 : 0);
  const questions = [...new Set(results.map((r) => r.question).filter((q): q is string => Boolean(q)))];

  return {
    opportunity_id: o.id,
    opportunity_version: o.version ?? null,
    eligibility,
    eligibility_rule: rule,
    availability: availabilityOf(o, now),
    relevance_score: relevance,
    evidence_coverage: coverage,
    unresolved_count: unresolved,
    results,
    deadline,
    questions,
    obligations: [...new Set(results.flatMap((r) => r.obligations ?? []))],
    hypothetical: Boolean(opts.hypothetical),
    rule_version: RULE_VERSION,
    assessed_at: now.toISOString(),
  };
}

const ELIGIBILITY_RANK: Record<EligibilityStatus, number> = {
  potentially_eligible: 0,
  potentially_eligible_verification_required: 1,
  insufficient_information: 2,
  under_review: 3,
  not_assessed: 4,
  unlikely_eligible: 5,
  ineligible_verified: 6,
};
const CLOSED_AVAILABILITY: Availability[] = ["closed", "closed_budget_exhausted"];

/** Lower sorts first. Eligibility tier dominates; closed calls sink; relevance orders only within a tier. */
export function rankKey(a: Pick<Assessment, "eligibility" | "relevance_score" | "availability">): number {
  return (CLOSED_AVAILABILITY.includes(a.availability) ? 10_000 : 0) + ELIGIBILITY_RANK[a.eligibility] * 1000 + (100 - (a.relevance_score ?? 0));
}
