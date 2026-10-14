import { z } from "zod";

/**
 * Requirement envelope — the single most important data rule in the platform.
 *
 *   unknown           we have not established what the official source says. NEVER treat as "no restriction".
 *   not_applicable    the dimension does not apply to this kind of opportunity (e.g. age rule for a company tender).
 *   confirmed_absent  an official source was checked and explicitly sets no restriction on this dimension.
 *   required          an official restriction exists; `value` describes it.
 */
export const evidenceSchema = z.object({
  source_url: z.string().url(),
  excerpt: z.string().max(2000).optional(),
  page_ref: z.string().max(100).optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export function requirementSchema<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion("state", [
    z.object({ state: z.literal("unknown") }),
    z.object({ state: z.literal("not_applicable") }),
    z.object({ state: z.literal("confirmed_absent"), evidence: evidenceSchema.optional() }),
    z.object({
      state: z.literal("required"),
      value,
      mandatory: z.boolean().default(true),
      evidence: evidenceSchema.optional(),
    }),
  ]);
}

export type Requirement<T> =
  | { state: "unknown" }
  | { state: "not_applicable" }
  | { state: "confirmed_absent"; evidence?: Evidence }
  | { state: "required"; value: T; mandatory?: boolean; evidence?: Evidence };

export const UNKNOWN = { state: "unknown" } as const;

// ── Value shapes per dimension ──────────────────────────────────────────────

export const EDUCATION_ORDER = ["none", "secondary", "post_secondary", "bachelor", "master", "doctorate"] as const;
export type EducationLevel = (typeof EDUCATION_ORDER)[number];

export const BUSINESS_STAGES = ["idea", "planning", "registered_new", "established"] as const;
export type BusinessStage = (typeof BUSINESS_STAGES)[number];

export const APPLICANT_TYPES = [
  "natural_person",
  "unregistered_entrepreneur",
  "sole_proprietor",
  "company",
  "nonprofit",
  "university",
  "research_body",
  "public_body",
] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const ageValue = z
  .object({ min: z.number().int().min(0).max(120).optional(), max: z.number().int().min(0).max(120).optional() })
  .refine((v) => v.min !== undefined || v.max !== undefined, "age requirement needs min or max");
export const educationValue = z.object({ min_level: z.enum(EDUCATION_ORDER) });
export const employmentValue = z.object({
  statuses: z.array(z.enum(["employed", "self_employed", "unemployed", "student", "inactive"])).min(1).optional(),
  dypa_registration_required: z.boolean().optional(),
});
export const businessStageValue = z.object({ stages: z.array(z.enum(BUSINESS_STAGES)).min(1) });
/** Region codes: "EU" (EU-wide), ISO country ("GR" = nationwide Greece), or NUTS-2 (e.g. "EL30" Attica). */
export const geographyValue = z.object({ regions: z.array(z.string().min(2).max(6)).min(1) });
/** NACE Rev.2 section letters (A–U). */
export const sectorValue = z.object({
  include: z.array(z.string().regex(/^[A-U]$/)).optional(),
  exclude: z.array(z.string().regex(/^[A-U]$/)).optional(),
});
export const cofinancingValue = z.object({
  own_contribution_pct: z.number().min(0).max(100).optional(),
  min_own_contribution_eur: z.number().nonnegative().optional(),
});
export const applicantTypesValue = z.object({ types: z.array(z.enum(APPLICANT_TYPES)).min(1) });

export type AgeValue = z.infer<typeof ageValue>;
export type EducationValue = z.infer<typeof educationValue>;
export type EmploymentValue = z.infer<typeof employmentValue>;
export type BusinessStageValue = z.infer<typeof businessStageValue>;
export type GeographyValue = z.infer<typeof geographyValue>;
export type SectorValue = z.infer<typeof sectorValue>;
export type CofinancingValue = z.infer<typeof cofinancingValue>;
export type ApplicantTypesValue = z.infer<typeof applicantTypesValue>;

export const opportunityRequirementsSchema = z.object({
  applicant_types: requirementSchema(applicantTypesValue),
  geographic_scope: requirementSchema(geographyValue),
  age_requirement: requirementSchema(ageValue),
  education_requirement: requirementSchema(educationValue),
  employment_requirement: requirementSchema(employmentValue),
  business_stage_requirement: requirementSchema(businessStageValue),
  sector_requirement: requirementSchema(sectorValue),
  cofinancing_requirement: requirementSchema(cofinancingValue),
});
export type OpportunityRequirements = z.input<typeof opportunityRequirementsSchema>;

/** Parses a JSONB column defensively: anything malformed degrades to "unknown", never to "no restriction". */
export function parseRequirement<T extends z.ZodTypeAny>(value: T, raw: unknown): Requirement<z.infer<T>> {
  const parsed = requirementSchema(value).safeParse(raw);
  return parsed.success ? (parsed.data as Requirement<z.infer<T>>) : UNKNOWN;
}

/** Human-facing geography label. A regional call is never described as nationwide. */
export function geographyKind(req: Requirement<GeographyValue>): "eu" | "national" | "regional" | "unknown" | "none" {
  if (req.state === "unknown") return "unknown";
  if (req.state !== "required") return "none";
  const r = req.value.regions;
  if (r.includes("EU")) return "eu";
  if (r.every((code) => code.length === 2)) return "national";
  return "regional";
}
