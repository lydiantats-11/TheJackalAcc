/**
 * Evaluates ONE requirement record against a profile. Pure and deterministic; no AI.
 *
 * States:
 *   satisfied        requirement interpretable and the profile meets it
 *   not_satisfied    requirement interpretable and the profile contradicts it
 *   unknown          the profile lacks the answer (incl. "not sure" / "prefer not") — never a pass, never a fail
 *   not_applicable   a conditional requirement that does not apply to this applicant type
 *   conflicting      official sources disagree about this requirement
 *   needs_review     the requirement cannot be safely machine-interpreted (unsupported, low confidence, AI-only, malformed)
 */
import { EDUCATION_ORDER, type EducationLevel } from "../requirements";
import {
  AGE_RANGE_BOUNDS, CONTRIBUTION_BOUNDS, EMPLOYEE_BOUNDS, SME_CEILINGS, TURNOVER_BOUNDS, isSentinel, type MatchProfile,
} from "../profile";
import { isKnownCategory, VALUE_SCHEMAS, type RequirementRecord } from "./requirement";

export type RequirementState = "satisfied" | "not_satisfied" | "unknown" | "not_applicable" | "conflicting" | "needs_review";

export interface RequirementResult {
  requirement_id: string;
  key: string;
  category: string;
  kind: RequirementRecord["kind"];
  state: RequirementState;
  /** Machine-readable reason; rendered in Greek/English by the UI. */
  reason: string;
  params?: Record<string, string | number | string[]>;
  /** Profile field whose answer would resolve an `unknown` state. */
  question?: string;
  /** 0..1 contribution to relevance, or null when the result must not influence the score. */
  fit: number | null;
  original_text: string;
  original_lang: string;
  evidence: RequirementRecord["evidence"];
  authoritative: boolean;
  /** Future duties the applicant takes on if they proceed (e.g. "register within 60 days of approval"). */
  obligations?: string[];
}

export interface EvalContext {
  now: Date;
  funding_max_eur?: number | null;
  /** Expected submission date; defaults to `now`. */
  application_date?: Date | null;
  /** The call's official issue date, when known. */
  call_published_on?: Date | null;
  funding_intensity_pct?: number | null;
}

type Partial = Pick<RequirementResult, "state" | "reason" | "params" | "question" | "fit" | "obligations">;
const sat = (reason: string, params?: Partial["params"], fit = 1): Partial => ({ state: "satisfied", reason, params, fit });
const fail = (reason: string, params?: Partial["params"]): Partial => ({ state: "not_satisfied", reason, params, fit: 0 });
const unk = (reason: string, question?: string, params?: Partial["params"]): Partial => ({ state: "unknown", reason, question, params, fit: null });

/** The applicant types this profile can be, and whether that set is certain. */
export function applicantTypesOf(p: MatchProfile): { types: string[]; certain: boolean; alternatives: boolean } {
  const s = p.business_stage;
  if (s === "idea" || s === "planning") return { types: ["natural_person", "unregistered_entrepreneur"], certain: true, alternatives: false };
  if (s === "registered_new" || s === "established") {
    if (p.legal_form && p.legal_form !== "not_sure") return { types: [p.legal_form], certain: true, alternatives: false };
    return { types: ["sole_proprietor", "company", "partnership", "cooperative", "nonprofit"], certain: false, alternatives: true };
  }
  if (p.persona === "individual") return { types: ["natural_person"], certain: true, alternatives: false };
  return { types: [], certain: false, alternatives: false };
}

/** Resolves a rule's reference moment. null = the call's date is not known → the rule cannot be checked. */
export function resolveReference(ref: string | undefined, ctx: EvalContext): Date | null {
  if (!ref || ref === "application") return ctx.application_date ?? ctx.now;
  if (ref === "call_publication") return ctx.call_published_on ?? null;
  const d = new Date(`${ref}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(fromIso: string, to: Date): number | null {
  const d = new Date(fromIso);
  if (Number.isNaN(d.getTime())) return null;
  return (to.getUTCFullYear() - d.getUTCFullYear()) * 12 + (to.getUTCMonth() - d.getUTCMonth()) - (to.getUTCDate() < d.getUTCDate() ? 1 : 0);
}

function inRegions(code: string, regions: string[]): boolean {
  // A NUTS code is inside a region if it equals it or extends it (EL30 ⊂ EL3 ⊂ EL); "EU" covers every member state.
  // NUTS uses "EL" for Greece while ISO uses "GR" — treat them as the same country.
  const norm = (c: string) => (c.startsWith("GR") ? "EL" + c.slice(2) : c);
  const c = norm(code);
  return regions.some((r) => r === "EU" || c.startsWith(norm(r)));
}

function geographyCore(v: { regions: string[] }, p: MatchProfile): Partial {

    const params = { regions: v.regions };
    if (v.regions.includes("EU")) return sat("geo_eu", params);
    const country = p.application_country;
    const wanted = p.region_codes ?? [];
    if (!country && wanted.length === 0) return unk("geo_unanswered", "region_codes", params);
    const national = v.regions.filter((r) => r.length === 2);
    const regional = v.regions.filter((r) => r.length > 2);
    if (country && national.some((n) => inRegions(country, [n]))) return sat("geo_national", params);
    if (regional.length === 0) return country ? fail("geo_fail", params) : unk("geo_unanswered", "application_country", params);
    const specific = wanted.filter((r) => r.length > 2);
    if (specific.length > 0 && specific.every((r) => inRegions(r, regional))) return sat("geo_region", params);
    if (p.willing_to_relocate === "yes") return sat("geo_relocate", params, 0.7);
    const flexible = specific.length === 0 || specific.some((r) => inRegions(r, regional));
    if (!flexible && p.willing_to_relocate === "no") return fail("geo_fail", params);
    // "Anywhere in Greece" is not the same as "in this region": ask instead of assuming.
    return unk("geo_confirm_region", "willing_to_relocate", params);
}

/**
 * Applies sub-regional exclusions (e.g. "except the Mykonos and Thira regional units") after the main geography test.
 * We only decide automatically when the excluded municipalities are listed; otherwise the user must check the
 * official wording — we never guess which municipalities belong to an excluded area.
 */
function applyExclusions(base: Partial, v: { exclude_areas?: { parent: string; name: string; municipalities?: string[] }[] }, p: MatchProfile, operatingRegions: string[]): Partial {
  const ex = v.exclude_areas ?? [];
  if (base.state !== "satisfied" || ex.length === 0) return base;
  const affected = ex.filter((e) => operatingRegions.some((r) => inRegions(r, [e.parent]) || inRegions(e.parent, [r])));
  if (affected.length === 0) return base;
  const names = affected.map((e) => e.name);
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (affected.some((e) => !e.municipalities)) return unk("geo_exclusion_check_manual", undefined, { excluded: names });
  const m = p.municipality;
  if (!m || m === "not_sure") return unk("geo_exclusion_check", "municipality", { excluded: names });
  return affected.some((e) => e.municipalities!.some((x) => norm(x) === norm(m))) ? fail("geo_excluded_area", { excluded: names }) : base;
}

const CHECKS: Record<string, (v: any, p: MatchProfile, ctx: EvalContext) => Partial> = {
  applicant_type(v: { types: string[] }, p) {
    const a = applicantTypesOf(p);
    const params = { types: v.types };
    if (a.types.length === 0) return unk("applicant_unanswered", "business_stage", params);
    const overlap = a.types.filter((t) => v.types.includes(t));
    if (a.certain) return overlap.length > 0 ? sat("applicant_pass", params) : fail("applicant_fail", params);
    if (overlap.length === 0) return fail("applicant_fail", params);
    if (overlap.length === a.types.length) return sat("applicant_pass", params);
    return unk("applicant_legal_form", "legal_form", params);
  },

  geography(v: { regions: string[]; exclude_areas?: { parent: string; name: string }[] }, p) {
    const base = geographyCore(v, p);
    const operating = [p.business_region && p.business_region !== "not_sure" ? p.business_region : null, ...(p.region_codes ?? [])].filter((x): x is string => !!x && x !== "GR");
    // If the user is "anywhere in Greece" but satisfied via relocation/region choice, exclusions still need checking.
    return applyExclusions(base, v, p, operating.length ? operating : v.regions.filter((r) => r.length > 2));
  },
  business_location(v: { regions: string[] }, p, ctx) {
    const params = { regions: v.regions };
    const s = p.business_stage;
    if (s === "idea" || s === "planning") return CHECKS.geography!(v, p, ctx); // future location
    const r = p.business_region;
    if (!r || r === "not_sure") return unk("bizloc_unanswered", "business_region", params);
    return inRegions(r, v.regions) ? sat("bizloc_pass", params) : fail("bizloc_fail", params);
  },

  residence(v: { countries: string[]; basis: "residence" | "tax_residence" }, p) {
    const c = v.basis === "tax_residence" ? p.tax_residence_country : p.country_of_residence;
    const q = v.basis === "tax_residence" ? "tax_residence_country" : "country_of_residence";
    if (!c || isSentinel(c)) return unk("residence_unanswered", q, { countries: v.countries });
    return v.countries.includes(c) ? sat("residence_pass", { countries: v.countries }) : fail("residence_fail", { countries: v.countries });
  },

  age(v: { min?: number; max?: number; reference_date?: string }, p, ctx) {
    // Age ranges are only usable when the whole range sits on one side of the limit AT the reference date.
    // A range is a statement about today; if the reference date is far from today we fall back to birth year.
    const params = { min: v.min ?? "-", max: v.max ?? "-", reference: v.reference_date ?? "application" };
    const ref = resolveReference(v.reference_date, ctx);
    if (!ref) return unk("reference_date_unknown", undefined, params);
    let lo: number, hi: number;
    if (p.birth_year) {
      lo = ref.getUTCFullYear() - p.birth_year - 1;
      hi = ref.getUTCFullYear() - p.birth_year;
    } else if (p.age_range && p.age_range !== "prefer_not") {
      [lo, hi] = AGE_RANGE_BOUNDS[p.age_range];
    } else return unk("age_unanswered", "age_range", params);
    const min = v.min ?? 0, max = v.max ?? 150;
    if (lo >= min && hi <= max) return sat("age_pass", params);
    if (hi < min || lo > max) return fail("age_fail", params);
    return unk("age_boundary", "birth_year", params);
  },

  education(v: { min_level: EducationLevel }, p) {
    const params = { level: v.min_level };
    const l = p.education_level;
    if (!l || l === "not_sure" || l === "prefer_not") return unk("education_unanswered", "education_level", params);
    const rank = (x: EducationLevel) => EDUCATION_ORDER.indexOf(x);
    const [lo, hi] = l === "master_or_doctorate" ? [rank("master"), rank("doctorate")] : [rank(l), rank(l)];
    if (lo >= rank(v.min_level)) return sat("education_pass", params);
    if (hi < rank(v.min_level)) return fail("education_fail", params);
    return unk("education_boundary", "education_level", params);
  },

  employment(v: { statuses: string[] }, p) {
    const s = p.employment_status;
    if (!s || s === "not_sure" || s === "prefer_not") return unk("employment_unanswered", "employment_status", { statuses: v.statuses });
    return v.statuses.includes(s) ? sat("employment_pass", { statuses: v.statuses }) : fail("employment_fail", { statuses: v.statuses });
  },

  unemployment_registration(_v, p) {
    if (p.dypa_registered === "yes") return sat("dypa_pass");
    if (p.dypa_registered === "no") return fail("dypa_fail");
    return unk("dypa_unanswered", "dypa_registered");
  },

  business_stage(v: { stages: string[] }, p) {
    const s = p.business_stage;
    if (!s || s === "not_sure") return unk("stage_unanswered", "business_stage", { stages: v.stages });
    // "planning" is never treated as an existing company.
    return v.stages.includes(s) ? sat("stage_pass", { stages: v.stages }) : fail("stage_fail", { stages: v.stages });
  },

  business_age(v: { min_months?: number; max_months?: number; reference_date?: string; allow_unregistered?: boolean }, p, ctx) {
    const params = { min_months: v.min_months ?? "-", max_months: v.max_months ?? "-" };
    const s = p.business_stage;
    if (s === "idea" || s === "planning") {
      if ((v.min_months ?? 0) > 0) return fail("bizage_not_registered", params);
      return v.allow_unregistered ? sat("bizage_unregistered_allowed", params) : unk("bizage_unregistered_unclear", undefined, params);
    }
    if (!s || s === "not_sure") return unk("stage_unanswered", "business_stage", params);
    const d = p.business_registration_date;
    if (!d || d === "not_sure") return unk("bizage_unanswered", "business_registration_date", params);
    const ref = resolveReference(v.reference_date, ctx);
    if (!ref) return unk("reference_date_unknown", undefined, params);
    const m = monthsBetween(d, ref);
    if (m === null) return unk("bizage_unanswered", "business_registration_date", params);
    if (v.min_months !== undefined && m < v.min_months) return fail("bizage_too_young", { ...params, months: m });
    if (v.max_months !== undefined && m > v.max_months) return fail("bizage_too_old", { ...params, months: m });
    return sat("bizage_pass", { ...params, months: m });
  },

  legal_form(v: { forms: string[] }, p) {
    const f = p.legal_form;
    if (!f || f === "not_sure") return unk("legalform_unanswered", "legal_form", { forms: v.forms });
    return v.forms.includes(f) ? sat("legalform_pass", { forms: v.forms }) : fail("legalform_fail", { forms: v.forms });
  },

  sector(v: { include?: string[]; exclude?: string[] }, p) {
    const include = v.include ?? [], exclude = v.exclude ?? [];
    const params = { include, exclude };
    const s = p.sectors ?? [];
    if (s.length === 0) return unk("sector_unanswered", "sectors", params);
    if (s.includes("*")) return sat("sector_open", params, 0.8);
    const ok = s.filter((x) => !exclude.includes(x) && (include.length === 0 || include.includes(x)));
    if (ok.length === s.length) return sat("sector_pass", params);
    if (ok.length > 0) return sat("sector_partial", params, 0.6);
    return fail("sector_fail", params);
  },

  company_size(v: { max_employees?: number; min_employees?: number }, p) {
    const params = { max: v.max_employees ?? "-", min: v.min_employees ?? "-" };
    const r = p.employees_range;
    if (!r || r === "not_sure" || r === "prefer_not") return unk("size_unanswered", "employees_range", params);
    const [lo, hi] = EMPLOYEE_BOUNDS[r];
    const max = v.max_employees ?? Infinity, min = v.min_employees ?? 0;
    if (lo >= min && (hi ?? Infinity) <= max) return sat("size_pass", params);
    if ((hi ?? Infinity) < min || lo > max) return fail("size_fail", params);
    return unk("size_boundary", "employees_range", params);
  },

  turnover(v: { max_eur?: number; min_eur?: number }, p) {
    const params = { max: v.max_eur ?? "-", min: v.min_eur ?? "-" };
    const r = p.turnover_range;
    if (!r || r === "not_sure" || r === "prefer_not") return unk("turnover_unanswered", "turnover_range", params);
    const [lo, hi] = TURNOVER_BOUNDS[r];
    const max = v.max_eur ?? Infinity, min = v.min_eur ?? 0;
    if (lo >= min && (hi ?? Infinity) <= max) return sat("turnover_pass", params);
    if ((hi ?? Infinity) < min || lo > max) return fail("turnover_fail", params);
    return unk("turnover_boundary", "turnover_range", params);
  },

  cofinancing(v: { own_contribution_pct?: number; min_own_contribution_eur?: number; proof_pct_of_private_share?: number }, p, ctx) {
    const r = p.own_contribution_range;
    let need = v.min_own_contribution_eur;
    const budget = p.project_budget_eur;
    // Private share = budget − grant. If the call states the private % use it; otherwise derive it from the aid intensity.
    const privatePct = v.own_contribution_pct ?? (ctx.funding_intensity_pct != null ? 100 - ctx.funding_intensity_pct : undefined);
    if (need === undefined && privatePct !== undefined && typeof budget === "number") {
      need = Math.ceil((budget * privatePct) / 100);
      // What must be PROVEN at application can be less than the full private share (e.g. 60% of it).
      if (v.proof_pct_of_private_share !== undefined) need = Math.ceil((need * v.proof_pct_of_private_share) / 100);
    }
    const params = { pct: v.own_contribution_pct ?? "-", eur: need ?? "-" };
    if (!r || r === "not_sure" || r === "prefer_not") return unk("capital_unanswered", "own_contribution_range", params);
    if (r === "none" && (need ?? 1) > 0) return fail("capital_none", params);
    if (need === undefined) return { ...unk("capital_pct_only", "project_budget_eur", params), fit: 0.5 };
    const [lo, hi] = CONTRIBUTION_BOUNDS[r];
    // Assumes the user can commit this amount to the project — surfaced as a "please confirm" note in the UI.
    if (lo >= need) return sat("capital_pass", params);
    if (hi !== null && hi < need) return fail("capital_fail", params);
    return unk("capital_boundary", "own_contribution_range", params);
  },

  no_expenditure_before_application(v: { required: true; until?: "submission" | "approval" }, p, ctx) {
    const start = p.planned_project_start;
    if (!start || start === "not_sure") return unk("prestart_unanswered", "planned_project_start");
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return unk("prestart_unanswered", "planned_project_start");
    if (d <= ctx.now) return fail("prestart_already_started", { start });
    // Starting after the *approval* date cannot be checked until approval timing is known.
    if (v.until === "approval") return unk("prestart_after_approval", undefined, { start });
    return sat("prestart_pass", { start });
  },

  de_minimis(v: { ceiling_eur: number; period_years: number }, p, ctx) {
    const params = { ceiling: v.ceiling_eur, years: v.period_years };
    // The ceiling applies per "single undertaking": linked enterprises' aid counts too.
    if (p.enterprise_relationship === "partner_or_linked" || p.enterprise_relationship === "not_sure")
      return unk("deminimis_single_undertaking", "de_minimis_received_3y_eur", params);
    const got = p.de_minimis_received_3y_eur;
    if (got === undefined || got === null || typeof got !== "number") return unk("deminimis_unanswered", "de_minimis_received_3y_eur", params);
    if (got >= v.ceiling_eur) return fail("deminimis_exhausted", params);
    if (ctx.funding_max_eur != null && got + ctx.funding_max_eur <= v.ceiling_eur) return sat("deminimis_pass", params);
    return unk("deminimis_headroom", undefined, { ...params, headroom: v.ceiling_eur - got });
  },

  registration_timing(v: { not_before?: string; by?: string; within_days_of_approval?: number }, p, ctx) {
    const s = p.business_stage;
    const obligations: string[] = [];
    if (v.by) obligations.push(v.within_days_of_approval ? `register_within_${v.within_days_of_approval}_days_of_approval` : `register_by_${v.by}`);
    const params = { not_before: v.not_before ?? "-", by: v.by ?? "-" };
    if (s === "idea" || s === "planning") {
      // A not-yet-registered applicant meets "must not exist before X" and must register later: an obligation, not a pass/fail today.
      if (v.by === "application") return fail("regtiming_must_exist_at_application", params);
      return { ...sat("regtiming_future_registration", params), obligations };
    }
    if (!s || s === "not_sure") return unk("stage_unanswered", "business_stage", params);
    if (!v.not_before) return { ...sat("regtiming_already_registered", params), obligations: [] };
    const ref = resolveReference(v.not_before, ctx);
    if (!ref) return unk("reference_date_unknown", undefined, params);
    const d = p.business_registration_date;
    if (!d || d === "not_sure") return unk("bizage_unanswered", "business_registration_date", params);
    return new Date(d) >= ref ? sat("regtiming_registered_after_reference", params) : fail("regtiming_registered_too_early", { ...params, registered: d });
  },

  sme_status(v: { max_class: "micro" | "small" | "medium" }, p) {
    const c = SME_CEILINGS[v.max_class];
    const params = { class: v.max_class, staff_below: c.staff, turnover_max: c.turnover, balance_max: c.balance };
    if (p.public_ownership_25 === "yes") return fail("sme_public_ownership", params);
    const s = p.business_stage;
    if (s === "idea" || s === "planning") return unk("sme_planned_estimate", "employees_range", params); // new firms use a good-faith estimate
    const staff = p.employees_range;
    if (!staff || staff === "not_sure" || staff === "prefer_not") return unk("size_unanswered", "employees_range", params);
    const [sLo, sHi] = EMPLOYEE_BOUNDS[staff];
    if (sLo >= c.staff) return fail("sme_staff_exceeds", params); // own figures already too high: partner data can only add
    if (p.enterprise_relationship !== "autonomous")
      return unk(p.enterprise_relationship ? "sme_aggregation_needed" : "sme_relationship_unanswered", "enterprise_relationship", params);
    if (p.public_ownership_25 !== "no") return unk("sme_public_ownership_unanswered", "public_ownership_25", params);
    if ((sHi ?? Infinity) >= c.staff) return unk("size_boundary", "employees_range", params);
    const within = (r: typeof p.turnover_range, max: number): boolean | null => {
      if (!r || r === "not_sure" || r === "prefer_not") return null;
      const [lo, hi] = TURNOVER_BOUNDS[r];
      if ((hi ?? Infinity) <= max) return true;
      if (lo > max) return false;
      return null;
    };
    const t = within(p.turnover_range, c.turnover), b = within(p.balance_sheet_range, c.balance);
    if (t === true || b === true) return sat("sme_pass", params); // headcount AND (turnover OR balance sheet)
    if (t === false && b === false) return fail("sme_financial_exceeds", params);
    return unk("sme_financials_unanswered", t === null ? "turnover_range" : "balance_sheet_range", params);
  },

  consortium(v: { min_entities: number; min_countries?: number }, p) {
    const params = { min_entities: v.min_entities, min_countries: v.min_countries ?? "-" };
    if (p.has_consortium_partners === "yes") return { ...sat("consortium_partners_declared", params), obligations: ["confirm_partner_eligibility"] };
    if (p.has_consortium_partners === "no") return fail("consortium_required", params);
    return unk("consortium_unanswered", "has_consortium_partners", params);
  },
};

export function evaluateRequirement(r: RequirementRecord, p: MatchProfile, ctx: EvalContext): RequirementResult {
  const base = {
    requirement_id: r.id, key: r.key, category: r.category, kind: r.kind, original_text: r.original_text,
    original_lang: r.original_lang, evidence: r.evidence,
    // An AI-extracted rule becomes authoritative only after a human reviewed it (verified_at) against a verbatim quote.
    authoritative: r.evidence_rank <= 2 && r.confidence === "high" && r.flags.every((f) => f === "ai_extracted" && Boolean(r.verified_at)),
  };
  // Order matters: conflicts and review flags beat any machine interpretation.
  if (r.flags.includes("conflicting")) return { ...base, state: "conflicting", reason: "sources_conflict", fit: null };
  if (r.flags.includes("needs_review") || r.flags.includes("unsupported"))
    return { ...base, state: "needs_review", reason: "flagged_for_review", fit: null };
  if (!isKnownCategory(r.category) || r.category === "other")
    return { ...base, state: "needs_review", reason: "unsupported_category", fit: null };
  // AI-only extractions with less than high confidence are never machine-decided.
  if (r.flags.includes("ai_extracted") && r.confidence !== "high")
    return { ...base, state: "needs_review", reason: "ai_low_confidence", fit: null };
  const schema = VALUE_SCHEMAS[r.category]!;
  const parsed = schema.safeParse(r.value);
  if (!parsed.success) return { ...base, state: "needs_review", reason: "uninterpretable_value", fit: null };

  if (r.kind === "conditional") {
    const applies = r.applies_to ?? [];
    const a = applicantTypesOf(p);
    if (applies.length > 0) {
      const overlap = a.types.filter((t) => applies.includes(t));
      if (a.types.length === 0 || (!a.certain && overlap.length > 0 && overlap.length < a.types.length))
        return { ...base, state: "unknown", reason: "condition_applicability_unknown", question: a.types.length === 0 ? "business_stage" : "legal_form", fit: null };
      if (overlap.length === 0) return { ...base, state: "not_applicable", reason: "condition_not_applicable", fit: null };
    }
  }
  const check = CHECKS[r.category]!;
  return { ...base, ...check(parsed.data, p, ctx) };
}
