/**
 * Structured, versioned requirement records — the unit the eligibility engine evaluates.
 * Each record keeps the official wording (source language) next to the platform's normalised interpretation.
 */
import { z } from "zod";
import { BUSINESS_STAGES, EDUCATION_ORDER } from "../requirements";

export const REQUIREMENT_CATEGORIES = [
  "applicant_type", "geography", "business_location", "residence", "age", "education", "employment",
  "unemployment_registration", "business_stage", "business_age", "legal_form", "sector", "company_size",
  "turnover", "cofinancing", "no_expenditure_before_application", "de_minimis", "registration_timing", "sme_status",
  "consortium",
  // 0007: verified records (Greek tax regimes, benefits, EU youth programmes)
  "birth_date_range", "tax_residence_transfer", "prior_tax_residence", "moving_from", "activity_in_greece", "intent_to_stay",
  "investment_amount", "student_status", "dependent_children", "employment_end",
  "other",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export type RequirementKind = "mandatory" | "conditional" | "optional" | "informational";
export type RequirementFlag = "conflicting" | "needs_review" | "unsupported" | "ai_extracted";

export interface RequirementEvidence {
  source_url: string;
  excerpt?: string;
  location?: string; // page / section / paragraph
}

export interface RequirementRecord {
  id: string;
  key: string;
  version: number;
  category: RequirementCategory | string; // unknown strings are allowed in storage and evaluate to needs_review
  kind: RequirementKind;
  /** For conditional requirements: applicant types the requirement applies to. */
  applies_to?: string[] | null;
  value: unknown;
  original_text: string;
  original_lang: string;
  interpretation?: string | null;
  evidence: RequirementEvidence;
  evidence_rank: 1 | 2 | 3 | 4; // 1 official call document … 4 secondary source
  confidence: "low" | "medium" | "high";
  flags: RequirementFlag[];
  effective_from?: string | null;
  effective_to?: string | null;
  verified_at?: string | null;
}

// ── Normalised value schemas per category ─────────────────────────────────

const nuts = z.string().regex(/^(EU|[A-Z]{2}|[A-Z]{2}[0-9A-Z]{1,3})$/);
/**
 * When a rule is measured. Real calls differ (see INTERPRETATIONS.md §1):
 *   "application"       at submission (e.g. DYPA young self-employed: criteria apply "κατά την αίτηση")
 *   "call_publication"  at the call's issue date (e.g. ESPA new tourism SMEs: ≤12 months up to the call date)
 *   YYYY-MM-DD          a fixed cut-off stated in the call
 */
export const referenceDate = z.union([z.enum(["application", "call_publication"]), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]);
/** Areas excluded INSIDE an otherwise eligible region (e.g. specific regional units/islands). */
const excludedArea = z.object({
  parent: nuts,
  name: z.string().min(2),
  /** Municipalities inside the excluded area, when the call (or an official list) makes them explicit. */
  municipalities: z.array(z.string().min(2)).optional(),
});
/** Milestones by which something must happen. */
export const MILESTONES = ["application", "full_proposal", "approval", "grant_agreement", "first_payment"] as const;

export const VALUE_SCHEMAS: Record<RequirementCategory, z.ZodTypeAny | null> = {
  applicant_type: z.object({ types: z.array(z.string()).min(1) }),
  geography: z.object({ regions: z.array(nuts).min(1), exclude_areas: z.array(excludedArea).optional() }),
  business_location: z.object({ regions: z.array(nuts).min(1) }),
  /** basis: where the person lives, their tax residence, their citizenship, or either residence or citizenship. */
  residence: z.object({ countries: z.array(z.string().length(2)).min(1), basis: z.enum(["residence", "tax_residence", "citizenship", "residence_or_citizenship"]).default("residence") }),
  age: z.object({ min: z.number().int().optional(), max: z.number().int().optional(), reference_date: referenceDate.optional() })
    .refine((v) => v.min !== undefined || v.max !== undefined),
  education: z.object({ min_level: z.enum(EDUCATION_ORDER) }),
  employment: z.object({ statuses: z.array(z.enum(["employed", "self_employed", "unemployed", "student", "inactive"])).min(1) }),
  unemployment_registration: z.object({ required: z.literal(true) }),
  business_stage: z.object({ stages: z.array(z.enum(BUSINESS_STAGES)).min(1) }),
  business_age: z.object({ min_months: z.number().int().nonnegative().optional(), max_months: z.number().int().nonnegative().optional(), reference_date: referenceDate.optional(), allow_unregistered: z.boolean().optional() })
    .refine((v) => v.min_months !== undefined || v.max_months !== undefined),
  legal_form: z.object({ forms: z.array(z.string()).min(1) }),
  sector: z.object({ include: z.array(z.string().regex(/^[A-U]$/)).optional(), exclude: z.array(z.string().regex(/^[A-U]$/)).optional() }),
  company_size: z.object({ max_employees: z.number().int().optional(), min_employees: z.number().int().optional() })
    .refine((v) => v.max_employees !== undefined || v.min_employees !== undefined),
  turnover: z.object({ max_eur: z.number().optional(), min_eur: z.number().optional() })
    .refine((v) => v.max_eur !== undefined || v.min_eur !== undefined),
  cofinancing: z.object({
    own_contribution_pct: z.number().min(0).max(100).optional(),
    min_own_contribution_eur: z.number().nonnegative().optional(),
    /** e.g. ESPA tourism: proof of securing ≥60% of the private share must accompany the application. */
    proof_pct_of_private_share: z.number().min(0).max(100).optional(),
  }),
  no_expenditure_before_application: z.object({ required: z.literal(true), until: z.enum(["submission", "approval"]).default("submission") }),
  de_minimis: z.object({ ceiling_eur: z.number().positive(), period_years: z.number().int().positive(), rolling: z.boolean().default(true) }),
  /** Business must NOT exist before `not_before` and/or MUST exist by `by`, optionally within N days of approval. */
  registration_timing: z.object({
    not_before: referenceDate.optional(),
    by: z.enum(MILESTONES).optional(),
    within_days_of_approval: z.number().int().positive().optional(),
  }).refine((v) => v.not_before !== undefined || v.by !== undefined),
  /** EU SME definition (Recommendation 2003/361/EC): headcount AND (turnover OR balance sheet), incl. partner/linked data. */
  sme_status: z.object({ max_class: z.enum(["micro", "small", "medium"]) }),
  consortium: z.object({ min_entities: z.number().int().min(2), min_countries: z.number().int().min(1).optional() }),
  /** Born within [from, to] (inclusive), e.g. DiscoverEU: 2008-01-01 … 2008-12-31. */
  birth_date_range: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  /** The applicant is moving (or has moved) tax residence to Greece. */
  tax_residence_transfer: z.object({ required: z.literal(true) }),
  /** Greek tax resident in at most `max_resident_years` of the `window_years` before the move (5A: 1 of 8; 5B/5C: 1 of 6). */
  prior_tax_residence: z.object({ window_years: z.union([z.literal(6), z.literal(8)]), max_resident_years: z.number().int().min(0) }),
  moving_from: z.object({ groups: z.array(z.enum(["eu_eea", "agreement"])).min(1) }),
  activity_in_greece: z.object({ activities: z.array(z.enum(["employee_gr", "own_business", "remote_foreign", "pension"])).min(1) }),
  intent_to_stay: z.object({ min_years: z.number().int().positive() }),
  investment_amount: z.object({ min_eur: z.number().positive() }),
  student_status: z.object({ required: z.literal(true) }),
  dependent_children: z.object({ min: z.number().int().min(1) }),
  /** How the last salaried job ended, e.g. unemployment benefit: ended or terminated by the employer. */
  employment_end: z.object({ reasons: z.array(z.enum(["ended_by_employer", "contract_ended", "resigned"])).min(1) }),
  other: null, // free-text requirement: never machine-evaluated
};

export function isKnownCategory(c: string): c is RequirementCategory {
  return (REQUIREMENT_CATEGORIES as readonly string[]).includes(c);
}

/** Minimal schema for records coming from the database or an extractor. Unknown fields are preserved upstream. */
export const requirementRecordSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  version: z.number().int().positive(),
  category: z.string(),
  kind: z.enum(["mandatory", "conditional", "optional", "informational"]),
  applies_to: z.array(z.string()).nullable().optional(),
  value: z.unknown(),
  original_text: z.string().min(1),
  original_lang: z.string().min(2),
  interpretation: z.string().nullable().optional(),
  evidence: z.object({ source_url: z.string().url(), excerpt: z.string().optional(), location: z.string().optional() }),
  evidence_rank: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidence: z.enum(["low", "medium", "high"]),
  flags: z.array(z.enum(["conflicting", "needs_review", "unsupported", "ai_extracted"])),
  effective_from: z.string().nullable().optional(),
  effective_to: z.string().nullable().optional(),
  verified_at: z.string().nullable().optional(),
});
