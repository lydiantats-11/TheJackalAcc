/**
 * Industry categories (owner request, 14 Oct 2026): user-friendly labels for discovery, kept SEPARATE from personas
 * and interests — e.g. a young adult (persona), working in tourism (industry), interested in entrepreneurship (interest).
 *
 * Industries never decide eligibility. They help search and ordering only. Eligibility for a sector-restricted call
 * follows the official ΚΑΔ / NACE codes the call lists, checked against the business's own activity (`sectors`).
 * Nothing in the eligibility engine reads `industries` (enforced by tests/industries.test.ts).
 *
 * Each industry maps INDICATIVELY to NACE Rev. 2.1 sections (A–V, Eurostat). `[]` = no single section (e.g. the social
 * economy is a legal form, not an activity).
 */
import type { MatchProfile } from "./profile";

export const NACE_REV21_SECTIONS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"] as const;
type NaceSection = (typeof NACE_REV21_SECTIONS)[number];

export const INDUSTRY_NACE = {
  agriculture: ["A"], food_beverage: ["C", "I"], tourism_hospitality: ["I", "O"], retail_ecommerce: ["G"], technology_it: ["J", "K"],
  manufacturing: ["C"], construction_real_estate: ["F", "M"], energy_environment: ["D", "E"], health_life_sciences: ["R", "C"],
  education_training: ["Q"], sports_recreation: ["S"], arts_culture_creative: ["S", "J"], media_marketing: ["J", "N"],
  transport_logistics: ["H"], maritime_blue_economy: ["A", "H", "C"], financial_professional: ["L", "N"], research_innovation: ["N"],
  social_economy_ngos: [], public_sector: ["P"], personal_other_services: ["T"], forestry: ["A"], mining: ["B"],
  telecommunications: ["K"], insurance: ["L"], wholesale: ["G"], water_waste: ["E"], aerospace_defence: ["C", "P"],
  legal_services: ["N"], fashion_textiles: ["C", "G"], automotive: ["C", "G"],
} as const satisfies Record<string, readonly NaceSection[]>;

export type IndustryId = keyof typeof INDUSTRY_NACE;
export const INDUSTRY_IDS = Object.keys(INDUSTRY_NACE) as IndustryId[];
/** Explicit answers, distinct from "not asked": interested in every industry / has not decided yet. */
export const INDUSTRY_SPECIAL = ["all", "undecided"] as const;
export type IndustryChoice = IndustryId | (typeof INDUSTRY_SPECIAL)[number];
export const INDUSTRY_CHOICES: readonly IndustryChoice[] = [...INDUSTRY_SPECIAL, ...INDUSTRY_IDS];

/**
 * "All industries" and "Not decided yet" are exclusive with specific industries. When the form sends a mix, the
 * specific industries win (they are the more informative answer); otherwise "all" beats "undecided".
 */
export function normaliseIndustries(list: readonly string[]): IndustryChoice[] {
  const valid = [...new Set(list)].filter((x): x is IndustryChoice => (INDUSTRY_CHOICES as readonly string[]).includes(x));
  const specific = valid.filter((x) => !(INDUSTRY_SPECIAL as readonly string[]).includes(x));
  if (specific.length) return specific;
  if (valid.includes("all")) return ["all"];
  return valid.includes("undecided") ? ["undecided"] : [];
}

/**
 * Discovery only: does a record tagged with `recordIndustries` (null/empty = not restricted to any industry) suit a
 * profile's industries? A profile with no answer, "all" or "undecided" matches everything.
 */
export function industryMatches(recordIndustries: readonly string[] | null | undefined, p: Pick<MatchProfile, "industries">): boolean {
  const mine = (p.industries ?? []).filter((x) => x !== "undecided");
  if (!mine.length || mine.includes("all")) return true;
  if (!recordIndustries || recordIndustries.length === 0) return true;
  return recordIndustries.some((x) => (mine as string[]).includes(x));
}
