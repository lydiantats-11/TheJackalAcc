/**
 * SYNTHETIC DEMO DATA — fictional opportunities for development and tests.
 * Every record has is_synthetic = true, a "[ΔΟΚΙΜΑΣΤΙΚΟ]" title prefix and a URL on the reserved
 * ".example" domain. None of these programmes exist. They are never shown as real.
 */
import type { OpportunityRequirements } from "@/lib/domain/requirements";

export interface SyntheticOpportunity {
  key: string;
  official_title: string;
  summary_plain: string;
  opportunity_type: string;
  publishing_authority: string;
  status: "upcoming" | "open" | "closed" | "unverified";
  days_until_close: number | null; // null = unknown deadline
  funding: { min: number | null; max: number | null } | null; // null = unknown amount
  intensity_pct: number | null;
  categories: string[];
  requirements: OpportunityRequirements;
}

const SRC = (k: string) => ({ source_url: `https://test-data.example/opportunity/${k}`, excerpt: "Synthetic excerpt (test data)." });
const U = { state: "unknown" } as const;

export const SYNTHETIC_OPPORTUNITIES: SyntheticOpportunity[] = [
  {
    key: "young-founders",
    official_title: "[ΔΟΚΙΜΑΣΤΙΚΟ] Πρόγραμμα ενίσχυσης νέων επιχειρηματιών 18–29",
    summary_plain: "Fictional grant for people aged 18–29 planning a new business anywhere in Greece. Requires 25% own contribution.",
    opportunity_type: "grant",
    publishing_authority: "Fictional Ministry (test data)",
    status: "open",
    days_until_close: 40,
    funding: { min: 10_000, max: 40_000 },
    intensity_pct: 75,
    categories: ["startup_grants", "youth"],
    requirements: {
      applicant_types: { state: "required", value: { types: ["natural_person", "unregistered_entrepreneur"] }, mandatory: true, evidence: SRC("young-founders") },
      geographic_scope: { state: "required", value: { regions: ["GR"] }, mandatory: true, evidence: SRC("young-founders") },
      age_requirement: { state: "required", value: { min: 18, max: 29 }, mandatory: true, evidence: SRC("young-founders") },
      education_requirement: { state: "confirmed_absent", evidence: SRC("young-founders") },
      employment_requirement: U,
      business_stage_requirement: { state: "required", value: { stages: ["idea", "planning"] }, mandatory: true, evidence: SRC("young-founders") },
      sector_requirement: { state: "required", value: { exclude: ["K", "L"] }, mandatory: true, evidence: SRC("young-founders") },
      cofinancing_requirement: { state: "required", value: { own_contribution_pct: 25, min_own_contribution_eur: 2_500 }, mandatory: true, evidence: SRC("young-founders") },
    },
  },
  {
    key: "unemployed-self-employment",
    official_title: "[ΔΟΚΙΜΑΣΤΙΚΟ] Επιχορήγηση αυτοαπασχόλησης ανέργων",
    summary_plain: "Fictional programme for unemployed people registered with the public employment service.",
    opportunity_type: "subsidy",
    publishing_authority: "Fictional Employment Agency (test data)",
    status: "open",
    days_until_close: 12,
    funding: null,
    intensity_pct: null,
    categories: ["self_employment", "employment"],
    requirements: {
      applicant_types: { state: "required", value: { types: ["natural_person"] }, mandatory: true, evidence: SRC("unemployed") },
      geographic_scope: { state: "required", value: { regions: ["GR"] }, mandatory: true, evidence: SRC("unemployed") },
      age_requirement: U,
      education_requirement: U,
      employment_requirement: { state: "required", value: { statuses: ["unemployed"], dypa_registration_required: true }, mandatory: true, evidence: SRC("unemployed") },
      business_stage_requirement: { state: "required", value: { stages: ["idea", "planning"] }, mandatory: true, evidence: SRC("unemployed") },
      sector_requirement: U,
      cofinancing_requirement: U,
    },
  },
  {
    key: "crete-tourism",
    official_title: "[ΔΟΚΙΜΑΣΤΙΚΟ] Κίνητρα τουριστικών επενδύσεων — Κρήτη",
    summary_plain: "Fictional regional incentive for tourism investments in Crete only (NUTS-2 EL43).",
    opportunity_type: "grant",
    publishing_authority: "Fictional Region of Crete (test data)",
    status: "upcoming",
    days_until_close: 75,
    funding: { min: null, max: 200_000 },
    intensity_pct: 50,
    categories: ["regional_investment", "sectoral"],
    requirements: {
      applicant_types: { state: "required", value: { types: ["sole_proprietor", "company", "unregistered_entrepreneur"] }, mandatory: true, evidence: SRC("crete") },
      geographic_scope: { state: "required", value: { regions: ["EL43"] }, mandatory: true, evidence: SRC("crete") },
      age_requirement: { state: "not_applicable" },
      education_requirement: { state: "not_applicable" },
      employment_requirement: { state: "not_applicable" },
      business_stage_requirement: U,
      sector_requirement: { state: "required", value: { include: ["I"] }, mandatory: true, evidence: SRC("crete") },
      cofinancing_requirement: { state: "required", value: { own_contribution_pct: 50 }, mandatory: true, evidence: SRC("crete") },
    },
  },
  {
    key: "sme-digital",
    official_title: "[ΔΟΚΙΜΑΣΤΙΚΟ] Ψηφιακός μετασχηματισμός υφιστάμενων ΜμΕ",
    summary_plain: "Fictional digitalisation grant for SMEs that have been operating for at least two years.",
    opportunity_type: "grant",
    publishing_authority: "Fictional Digital Agency (test data)",
    status: "open",
    days_until_close: 5,
    funding: { min: 5_000, max: 50_000 },
    intensity_pct: 60,
    categories: ["sme_funding", "research_innovation"],
    requirements: {
      applicant_types: { state: "required", value: { types: ["sole_proprietor", "company"] }, mandatory: true, evidence: SRC("sme") },
      geographic_scope: { state: "required", value: { regions: ["GR"] }, mandatory: true, evidence: SRC("sme") },
      age_requirement: { state: "not_applicable" },
      education_requirement: { state: "not_applicable" },
      employment_requirement: { state: "not_applicable" },
      business_stage_requirement: { state: "required", value: { stages: ["established"] }, mandatory: true, evidence: SRC("sme") },
      sector_requirement: { state: "confirmed_absent", evidence: SRC("sme") },
      cofinancing_requirement: { state: "required", value: { own_contribution_pct: 40 }, mandatory: true, evidence: SRC("sme") },
    },
  },
  {
    key: "eu-research",
    official_title: "[TEST DATA] Fictional EU call for collaborative research",
    summary_plain: "Fictional EU-wide call. Details (deadline, budget, eligibility) not yet extracted.",
    opportunity_type: "grant",
    publishing_authority: "Fictional EU Agency (test data)",
    status: "unverified",
    days_until_close: null,
    funding: null,
    intensity_pct: null,
    categories: ["eu_calls", "research_innovation", "organisations"],
    requirements: {
      applicant_types: U, geographic_scope: { state: "required", value: { regions: ["EU"] }, mandatory: true, evidence: SRC("eu") },
      age_requirement: U, education_requirement: U, employment_requirement: U,
      business_stage_requirement: U, sector_requirement: U, cofinancing_requirement: U,
    },
  },
  {
    key: "closed-call",
    official_title: "[ΔΟΚΙΜΑΣΤΙΚΟ] Κλειστή πρόσκληση νεοφυούς επιχειρηματικότητας",
    summary_plain: "Fictional call that has closed. Kept to demonstrate closed-status handling.",
    opportunity_type: "loan",
    publishing_authority: "Fictional Development Bank (test data)",
    status: "closed",
    days_until_close: -10,
    funding: { min: 25_000, max: 100_000 },
    intensity_pct: null,
    categories: ["startup_grants"],
    requirements: {
      applicant_types: { state: "required", value: { types: ["unregistered_entrepreneur", "company"] }, mandatory: true, evidence: SRC("closed") },
      geographic_scope: { state: "required", value: { regions: ["GR"] }, mandatory: true, evidence: SRC("closed") },
      age_requirement: { state: "confirmed_absent", evidence: SRC("closed") }, education_requirement: { state: "confirmed_absent", evidence: SRC("closed") },
      employment_requirement: { state: "confirmed_absent", evidence: SRC("closed") },
      business_stage_requirement: { state: "required", value: { stages: ["planning", "registered_new"] }, mandatory: true, evidence: SRC("closed") },
      sector_requirement: U, cofinancing_requirement: U,
    },
  },
];
