/**
 * Decision record (core capability 2: evidence-linked, auditable rules engine).
 *
 * Turns an engine assessment into a record a person or an auditor can check line by line:
 *  - the outcome in four classes (potentially eligible / ineligible / information needed / manual review),
 *    plus the engine's exact status and the precedence rule that decided it;
 *  - for every requirement: the official wording and its language, the source URL and excerpt, the evidence rank,
 *    the date it was verified, the rule type, the profile answers the rule ACTUALLY read, and its outcome;
 *  - a decision reference: a hash of the engine version, the opportunity version, the requirement versions and the
 *    answers read and the evaluation date (ages and deadlines depend on it). Same inputs → same reference, so a result can be reproduced and disputes can be traced.
 *
 * "Answers read" are observed, not declared: each requirement is re-evaluated against a profile that records which
 * fields the engine touched. The record cannot drift from the engine's real behaviour.
 * Display and audit only — this module never changes an outcome.
 */
import { createHash } from "node:crypto";
import { assess, RULE_VERSION, type Assessment, type EligibilityStatus, type OpportunityForMatching } from "./eligibility";
import { evaluateRequirement, type RequirementState } from "./engine/evaluate";
import type { RequirementRecord } from "./engine/requirement";
import type { MatchProfile } from "./profile";

export type OutcomeClass = "potentially_eligible" | "ineligible" | "information_needed" | "manual_review" | "not_assessed";

export const OUTCOME_CLASS: Record<EligibilityStatus, OutcomeClass> = {
  potentially_eligible: "potentially_eligible",
  potentially_eligible_verification_required: "potentially_eligible",
  ineligible_verified: "ineligible",
  unlikely_eligible: "ineligible",
  insufficient_information: "information_needed",
  under_review: "manual_review",
  not_assessed: "not_assessed",
};

/** Whether the outcome rests on authoritative evidence (verified official rule) or needs confirmation. */
export const OUTCOME_CERTAINTY: Record<EligibilityStatus, "confirmed_by_rules" | "needs_confirmation" | "open"> = {
  potentially_eligible: "confirmed_by_rules",
  potentially_eligible_verification_required: "needs_confirmation",
  ineligible_verified: "confirmed_by_rules",
  unlikely_eligible: "needs_confirmation",
  insufficient_information: "open",
  under_review: "open",
  not_assessed: "open",
};

export interface DecisionLine {
  requirement_id: string;
  requirement_key: string;
  requirement_version: number;
  category: string;
  rule_type: RequirementRecord["kind"];
  official_text: string;
  official_lang: string;
  interpretation: string | null;
  source_url: string;
  source_excerpt: string | null;
  evidence_rank: number;
  confidence: string;
  verified_at: string | null;
  flags: string[];
  /** Profile fields the engine read to decide this line (observed). */
  profile_fields: string[];
  /** The answers to those fields, as used (the person's own data — shown only to them). */
  answers_used: Record<string, unknown>;
  outcome: RequirementState;
  reason: string;
  /** Profile field whose answer would resolve an unknown outcome. */
  question: string | null;
  authoritative: boolean;
}

export interface DecisionRecord {
  reference: string;
  engine_version: string;
  opportunity_id: string;
  opportunity_version: number | null;
  assessed_at: string;
  outcome_class: OutcomeClass;
  outcome_status: EligibilityStatus;
  outcome_certainty: (typeof OUTCOME_CERTAINTY)[EligibilityStatus];
  decided_by_rule: number;
  requirement_set_completeness: OpportunityForMatching["requirement_set_completeness"];
  /** Application status is reported separately from eligibility, never mixed into it. */
  availability: Assessment["availability"];
  lines: DecisionLine[];
  missing_answers: string[];
}

/** Evaluates one requirement with a profile that records every field the engine reads. */
export function fieldsRead(r: RequirementRecord, profile: MatchProfile, ctx: Parameters<typeof evaluateRequirement>[2]): string[] {
  const seen = new Set<string>();
  const watched = new Proxy(profile as Record<string, unknown>, {
    get(target, prop, receiver) { if (typeof prop === "string") seen.add(prop); return Reflect.get(target, prop, receiver); },
    has(target, prop) { if (typeof prop === "string") seen.add(prop); return Reflect.has(target, prop); },
  });
  evaluateRequirement(r, watched as MatchProfile, ctx);
  return [...seen].filter((k) => k !== "then" && k !== "toJSON").sort();
}

/** Stable JSON (sorted keys) so the reference does not depend on property order. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function buildDecisionRecord(o: OpportunityForMatching, profile: MatchProfile, opts: { now?: Date } = {}): DecisionRecord {
  const now = opts.now ?? new Date();
  const a = assess(o, profile, { now });
  const ctx = { now, funding_max_eur: o.funding_max_eur ?? null, funding_intensity_pct: o.funding_intensity_pct ?? null, call_published_on: o.published_on ?? null, application_date: null };
  const byId = new Map(o.requirements.map((r) => [r.id, r]));
  const lines: DecisionLine[] = a.results.map((res) => {
    const r = byId.get(res.requirement_id)!;
    const fields = fieldsRead(r, profile, ctx);
    const answers: Record<string, unknown> = {};
    for (const f of fields) answers[f] = (profile as Record<string, unknown>)[f] ?? null;
    return {
      requirement_id: r.id, requirement_key: r.key, requirement_version: r.version, category: r.category, rule_type: r.kind,
      official_text: r.original_text, official_lang: r.original_lang, interpretation: r.interpretation ?? null,
      source_url: r.evidence.source_url, source_excerpt: r.evidence.excerpt ?? null, evidence_rank: r.evidence_rank, confidence: r.confidence,
      verified_at: r.verified_at ?? null, flags: [...r.flags],
      profile_fields: fields, answers_used: answers,
      outcome: res.state, reason: res.reason, question: res.question ?? null, authoritative: res.authoritative,
    };
  });
  const reference = createHash("sha256").update(stable({
    engine: RULE_VERSION, on: now.toISOString().slice(0, 10), opportunity: o.id, version: o.version ?? null, completeness: o.requirement_set_completeness,
    requirements: lines.map((l) => [l.requirement_id, l.requirement_version]).sort(),
    answers: Object.assign({}, ...lines.map((l) => l.answers_used)),
  })).digest("hex").slice(0, 16);
  return {
    reference: `JA-${RULE_VERSION}-${reference}`,
    engine_version: RULE_VERSION,
    opportunity_id: o.id,
    opportunity_version: o.version ?? null,
    assessed_at: a.assessed_at,
    outcome_class: OUTCOME_CLASS[a.eligibility],
    outcome_status: a.eligibility,
    outcome_certainty: OUTCOME_CERTAINTY[a.eligibility],
    decided_by_rule: a.eligibility_rule,
    requirement_set_completeness: o.requirement_set_completeness,
    availability: a.availability,
    lines,
    missing_answers: a.questions,
  };
}
