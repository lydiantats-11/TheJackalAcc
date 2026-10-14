/**
 * Matching-relevant applicant profile.
 *
 * Every field is optional. `undefined`/`null` = never asked. The sentinel answers are explicit, distinct states:
 *   "not_sure"   the user does not know            → requirement stays unknown
 *   "prefer_not" the user declined to answer       → requirement stays unknown (never held against them)
 *   "not_applicable" the question does not apply   → only satisfies a requirement if the rule explicitly allows it
 */
import type { InterestId, PersonaId } from "./personas";

export type Answer ="yes" | "no" | "not_sure" | "prefer_not";
export type Sentinel = "not_sure" | "prefer_not" | "not_applicable";

export type AgeRange =
  | "under_18" | "18_24" | "25_29" | "30_34" | "35_39" | "40_44" | "45_54" | "55_64" | "65_plus" | "prefer_not";

export type ProfileEducation =
  | "none" | "secondary" | "post_secondary" | "bachelor" | "master" | "doctorate" | "master_or_doctorate"
  | "not_sure" | "prefer_not";

export type ProfileEmployment =
  | "employed" | "self_employed" | "unemployed" | "student" | "inactive" | "not_sure" | "prefer_not";

export type ContributionRange = "none" | "under_5k" | "5k_20k" | "20k_50k" | "over_50k" | "not_sure" | "prefer_not";
export type EmployeesRange = "0" | "1_9" | "10_49" | "50_249" | "250_plus" | "not_sure" | "prefer_not";
export type TurnoverRange = "under_100k" | "100k_2m" | "2m_10m" | "10m_50m" | "over_50m" | "not_sure" | "prefer_not";
export type LegalForm = "sole_proprietor" | "company" | "partnership" | "cooperative" | "nonprofit" | "not_sure";

export type HousingStatus = "renting" | "with_family" | "owner" | "other" | "not_sure" | "prefer_not";
export type HouseholdIncomeRange = "under_10k" | "10k_20k" | "20k_35k" | "35k_60k" | "over_60k" | "not_sure" | "prefer_not";

export interface MatchProfile {
  /** Applicant type ("Applying as"). The only persona-like field the engine reads, and only for applicant type. */
  persona?: "individual" | "aspiring_entrepreneur" | "existing_business" | "tender_applicant" | "adviser" | null;
  /** The five non-exclusive personas. They choose which questions are shown; they never decide eligibility. */
  personas?: PersonaId[] | null;
  interests?: InterestId[] | null;
  // ── household (Persona 4) — stored for future household requirements; not yet evaluated by the engine ──
  housing_status?: HousingStatus | null;
  first_home_purchase?: "yes" | "no" | "not_sure" | null;
  household_size?: "1" | "2" | "3" | "4" | "5_plus" | "prefer_not" | null;
  dependent_children?: "0" | "1" | "2" | "3_plus" | "prefer_not" | null;
  household_income_range?: HouseholdIncomeRange | null;
  property_owned?: "yes" | "no" | "not_sure" | "prefer_not" | null;
  // ── where ──
  country_of_residence?: string | null;
  tax_residence_country?: string | null; // only asked when a call requires it
  application_country?: string | null;
  /** NUTS-2 codes the user would operate in, or ["GR"] = "anywhere in Greece / not decided". */
  region_codes?: string[] | null;
  willing_to_relocate?: "yes" | "no" | "not_sure" | null;
  // ── person ──
  age_range?: AgeRange | null;
  /** Only collected when an age rule's boundary falls inside the user's range. */
  birth_year?: number | null;
  employment_status?: ProfileEmployment | null;
  dypa_registered?: Answer | null;
  education_level?: ProfileEducation | null;
  // ── business ──
  business_stage?: "idea" | "planning" | "registered_new" | "established" | "not_sure" | null;
  legal_form?: LegalForm | null;
  business_registration_country?: string | null;
  business_registration_date?: string | "not_sure" | null; // ISO date
  business_region?: string | "not_sure" | null; // NUTS-2 of registered seat / operating site
  employees_range?: EmployeesRange | null;
  turnover_range?: TurnoverRange | null;
  balance_sheet_range?: TurnoverRange | null;
  /** EU SME definition: independent, or partner (25–50%) / linked (>50%) to other enterprises. */
  enterprise_relationship?: "autonomous" | "partner_or_linked" | "not_sure" | null;
  /** Public bodies jointly control ≥25% of capital or votes → not an SME. */
  public_ownership_25?: "yes" | "no" | "not_sure" | null;
  municipality?: string | "not_sure" | null;
  has_consortium_partners?: "yes" | "no" | "not_sure" | null;
  /** NACE section letters, or ["*"] for "any sector". */
  sectors?: string[] | null;
  // ── money and project ──
  own_contribution_range?: ContributionRange | null;
  project_budget_eur?: number | "not_sure" | "prefer_not" | null;
  planned_project_start?: string | "not_sure" | null; // ISO date
  de_minimis_received_3y_eur?: number | "not_sure" | "prefer_not" | null;
}

export const AGE_RANGE_BOUNDS: Record<Exclude<AgeRange, "prefer_not">, [number, number]> = {
  under_18: [0, 17],
  "18_24": [18, 24],
  "25_29": [25, 29],
  "30_34": [30, 34],
  "35_39": [35, 39],
  "40_44": [40, 44],
  "45_54": [45, 54],
  "55_64": [55, 64],
  "65_plus": [65, 120],
};

/** [lower, upper] in EUR; null upper = unbounded. */
export const CONTRIBUTION_BOUNDS: Record<"none" | "under_5k" | "5k_20k" | "20k_50k" | "over_50k", [number, number | null]> = {
  none: [0, 0],
  under_5k: [0, 5_000],
  "5k_20k": [5_000, 20_000],
  "20k_50k": [20_000, 50_000],
  over_50k: [50_000, null],
};

export const EMPLOYEE_BOUNDS: Record<Exclude<EmployeesRange, "not_sure" | "prefer_not">, [number, number | null]> = {
  "0": [0, 0], "1_9": [1, 9], "10_49": [10, 49], "50_249": [50, 249], "250_plus": [250, null],
};
/** SME ceilings (User Guide to the SME Definition, 2020): staff < N, and turnover ≤ T OR balance sheet ≤ B. */
export const SME_CEILINGS = {
  micro: { staff: 10, turnover: 2_000_000, balance: 2_000_000 },
  small: { staff: 50, turnover: 10_000_000, balance: 10_000_000 },
  medium: { staff: 250, turnover: 50_000_000, balance: 43_000_000 },
} as const;

export const TURNOVER_BOUNDS: Record<Exclude<TurnoverRange, "not_sure" | "prefer_not">, [number, number | null]> = {
  under_100k: [0, 100_000], "100k_2m": [100_000, 2_000_000], "2m_10m": [2_000_000, 10_000_000],
  "10m_50m": [10_000_000, 50_000_000], over_50m: [50_000_000, null],
};

/**
 * The example profile from the product brief, used in seed data and tests.
 * Deliberately NOT assumed: unemployment, DYPA registration, tax residency, incorporation, municipality,
 * or that all available capital will be committed to the project.
 */
export const EXAMPLE_PROFILE: MatchProfile = Object.freeze({
  persona: "aspiring_entrepreneur",
  application_country: "GR",
  region_codes: ["GR"],
  age_range: "25_29",
  education_level: "master_or_doctorate",
  sectors: ["*"],
  business_stage: "planning",
  own_contribution_range: "over_50k",
}) as MatchProfile;

export function isSentinel(v: unknown): v is Sentinel {
  return v === "not_sure" || v === "prefer_not" || v === "not_applicable";
}
