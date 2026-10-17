/**
 * Who may apply to a programme (legal applicant type), kept apart from eligibility, relevance, verification and
 * application status (Milestone 1, 17 Oct 2026).
 *
 * Evidence, in order:
 *  1. Hand-checked records: the applicant type recorded from the official pages (data/official-records-2026-10-14.v2.json).
 *  2. A recorded `applicant_type` requirement on the record (official text, imported or reviewed).
 *  3. Otherwise UNKNOWN. The EU Funding & Tenders portal does not publish the applicant type as structured data, so its
 *     calls stay unknown until a reviewed requirement exists. Unknown is never treated as "individuals can apply".
 *
 * Used for DISCOVERY only (what the personal results list shows first); the eligibility engine is not touched and still
 * evaluates its own applicant_type requirements deterministically.
 */
import type { MatchProfile } from "@/lib/domain/profile";

export type ApplicantAudience = "individuals" | "organisations" | "both" | "unknown";

/** Hand-checked records (source: the eligibility rules of each record in the checked file). */
export const MANUAL_APPLICANTS: Record<string, ApplicantAudience> = {
  discovereu: "individuals",     // 18-year-olds apply themselves
  art5c: "individuals",          // natural persons moving tax residence
  art5b: "individuals",          // pensioners
  art5a: "individuals",          // natural persons investing
  spiti2: "individuals",         // young people / families buying a first home
  studenthousing: "individuals", // students' families
  a21: "individuals",            // households with children
  unemployment: "individuals",   // insured persons who lost salaried work
  eic: "both",                   // start-ups/SMEs, and natural persons intending to set up an SME (equity only)
  esc: "both",
};

const PERSON_TYPES = new Set(["natural_person", "unregistered_entrepreneur"]);

export function applicantAudienceOf(
  o: { external_key: string | null },
  requirements: Array<{ category: string; value: unknown }> = [],
): ApplicantAudience {
  const m = o.external_key?.match(/^manual:(.+)$/)?.[1];
  if (m && MANUAL_APPLICANTS[m]) return MANUAL_APPLICANTS[m];
  const req = requirements.find((r) => r.category === "applicant_type");
  const types = (req?.value as { types?: string[] } | undefined)?.types ?? [];
  if (types.length === 0) return "unknown";
  const persons = types.some((t) => PERSON_TYPES.has(t));
  const orgs = types.some((t) => !PERSON_TYPES.has(t));
  return persons && orgs ? "both" : persons ? "individuals" : "organisations";
}

/** Whether the person is looking as an individual (default) or on behalf of an organisation. */
export function personKind(profile: Pick<MatchProfile, "personas" | "business_stage">): "individual" | "organisation" {
  if ((profile.personas ?? []).includes("business_org")) return "organisation";
  if (profile.business_stage === "registered_new" || profile.business_stage === "established") return "organisation";
  return "individual";
}

/**
 * Splits current opportunities for the personal results page.
 * Individuals: «personal» = individuals or both; «unconfirmed» = applicant type not recorded (shown separately, never as
 * a personal match); «otherApplicants» = organisations only (counted, browsable in Opportunities).
 * Organisations: everything except individuals-only is personal.
 */
export function splitByApplicant<T>(items: T[], audienceOf: (x: T) => ApplicantAudience, kind: "individual" | "organisation") {
  const personal: T[] = []; const unconfirmed: T[] = []; const otherApplicants: T[] = [];
  for (const x of items) {
    const a = audienceOf(x);
    if (kind === "organisation") (a === "individuals" ? otherApplicants : personal).push(x);
    else if (a === "individuals" || a === "both") personal.push(x);
    else if (a === "unknown") unconfirmed.push(x);
    else otherApplicants.push(x);
  }
  return { personal, unconfirmed, otherApplicants };
}
