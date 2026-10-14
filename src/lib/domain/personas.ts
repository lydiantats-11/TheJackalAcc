/**
 * The five non-exclusive personas (Business plan §2, Phase 2 brief A2) and the conditional questionnaire.
 *
 * Personas and interests decide WHICH QUESTIONS are shown. They never decide eligibility: nothing in the
 * eligibility engine reads `personas` or `interests` (enforced by tests/personas.test.ts).
 * Applicant type is a separate, explicit answer (`persona`, shown as "Applying as").
 *
 * Visibility rules for a section, in order:
 *   1. "always" sections are always shown;
 *   2. a selected persona or interest that opens the section;
 *   3. an opportunity asked for one of its fields (?ask=field,...);
 *   4. one of its fields already has an answer — answered data is never hidden.
 */
import type { MatchProfile } from "./profile";

export const PERSONA_IDS = ["young_adult", "aspiring_entrepreneur", "employee_jobseeker", "household", "business_org"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const INTEREST_IDS = [
  "housing", "education", "employment", "entrepreneurship", "mobility", "financial_support", "energy", "family",
  "tax_residency", "tenders", "eu_programmes",
] as const;
export type InterestId = (typeof INTEREST_IDS)[number];

export const SECTIONS = ["applying_as", "location", "person", "work", "entrepreneurship", "business", "household", "international", "project"] as const;
export type Section = (typeof SECTIONS)[number];
type Field = keyof MatchProfile;

export const SECTION_FIELDS: Record<Section, Field[]> = {
  applying_as: ["persona"],
  location: ["region_codes", "municipality", "willing_to_relocate"],
  person: ["age_range", "birth_year"],
  work: ["education_level", "employment_status", "dypa_registered"],
  entrepreneurship: ["business_stage", "own_contribution_range", "sectors"],
  business: [
    "legal_form", "business_registration_date", "business_region", "employees_range", "turnover_range", "balance_sheet_range",
    "enterprise_relationship", "public_ownership_25", "has_consortium_partners",
  ],
  household: ["housing_status", "first_home_purchase", "household_size", "dependent_children", "household_income_range", "property_owned"],
  international: ["tax_residence_country"],
  project: ["project_budget_eur", "planned_project_start", "de_minimis_received_3y_eur"],
};

/** Which personas / interests open each section. `"always"` = shown to everyone. */
const OPENED_BY: Record<Section, "always" | { personas: PersonaId[]; interests: InterestId[] }> = {
  applying_as: "always",
  location: "always",
  person: "always",
  work: { personas: ["young_adult", "employee_jobseeker", "aspiring_entrepreneur"], interests: ["employment", "education"] },
  entrepreneurship: { personas: ["aspiring_entrepreneur", "business_org"], interests: ["entrepreneurship"] },
  business: { personas: ["business_org"], interests: ["tenders"] },
  household: { personas: ["household"], interests: ["housing", "family", "energy"] },
  international: { personas: [], interests: ["tax_residency", "mobility"] },
  project: { personas: [], interests: [] }, // only when asked or answered (unchanged behaviour)
};

/** Fields inside a visible section that still need a condition before they are asked. */
const FIELD_CONDITIONS: Partial<Record<Field, (p: MatchProfile) => boolean>> = {
  // Only ask about DYPA registration when the person is (or may be) unemployed.
  dypa_registered: (p) => !["employed", "self_employed", "student", "inactive"].includes(String(p.employment_status ?? "")),
  // Homeowners are not first-time buyers.
  first_home_purchase: (p) => p.housing_status !== "owner",
  // Only asked when an opportunity needs them (unchanged behaviour).
  birth_year: () => false,
  municipality: () => false,
  has_consortium_partners: () => false,
};

/** The legacy single `persona` (applicant type) mapped to personas, without guessing. */
export function legacyPersonas(p: MatchProfile): PersonaId[] {
  switch (p.persona) {
    case "aspiring_entrepreneur": return ["aspiring_entrepreneur"];
    case "existing_business":
    case "tender_applicant": return ["business_org"];
    default: return []; // "individual" could be any of three personas; "adviser" is an account role
  }
}

export function personasOf(p: MatchProfile): PersonaId[] {
  // An explicit (even empty) selection wins; the legacy mapping applies only to profiles never asked.
  return p.personas != null ? [...p.personas] : legacyPersonas(p);
}

export function interestsOf(p: MatchProfile): InterestId[] {
  return p.interests ? [...p.interests] : [];
}

export function isAnswered(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function visibleSections(p: MatchProfile, ask: string[] = []): Set<Section> {
  const personas = personasOf(p);
  const interests = interestsOf(p);
  const out = new Set<Section>();
  for (const s of SECTIONS) {
    const rule = OPENED_BY[s];
    const fields = SECTION_FIELDS[s] as string[];
    if (
      rule === "always" ||
      rule.personas.some((x) => personas.includes(x)) ||
      rule.interests.some((x) => interests.includes(x)) ||
      fields.some((f) => ask.includes(f)) ||
      fields.some((f) => isAnswered(p[f as Field]))
    ) out.add(s);
  }
  // A registered business always sees the business questions (unchanged behaviour).
  if (p.business_stage === "registered_new" || p.business_stage === "established") out.add("business");
  return out;
}

/** Every field the questionnaire asks right now, in section order. */
export function visibleFields(p: MatchProfile, ask: string[] = []): Field[] {
  const sections = visibleSections(p, ask);
  const out: Field[] = [];
  for (const s of SECTIONS) {
    if (!sections.has(s)) continue;
    for (const f of SECTION_FIELDS[s]) {
      const cond = FIELD_CONDITIONS[f];
      if (!cond || cond(p) || ask.includes(f) || isAnswered(p[f])) out.push(f);
    }
  }
  return out;
}

