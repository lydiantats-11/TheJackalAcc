/**
 * REAL CALLS — requirements transcribed on 2026-10-13 from official or official-intermediary pages, used ONLY to test
 * how the engine interprets real rules. These records do NOT assert that any call is currently open and are never
 * seeded into the public database.
 *
 * original_text: short verbatim phrases where we captured them; otherwise "[Παράφραση]/[Paraphrase]" — such records
 * carry confidence "medium" so they can never produce "ineligible under the verified rules".
 */
import type { OpportunityForMatching } from "@/lib/domain/eligibility";
import type { RequirementRecord } from "@/lib/domain/engine/requirement";

const DYPA_URL = "https://www1.dypa.gov.gr/storage/apaskholisi/nee-18-29-o2ne-pshfiakh-ikonomia/enhmerotiko-nee-18-29.pdf";
const ESPA_TOURISM_URL = "https://efepae.gr/drasi/%CE%B5%CE%BD%CE%AF%CF%83%CF%87%CF%85%CF%83%CE%B7-%CF%84%CE%B7%CF%82-%CE%AF%CE%B4%CF%81%CF%85%CF%83%CE%B7%CF%82-%CE%BA%CE%B1%CE%B9-%CE%BB%CE%B5%CE%B9%CF%84%CE%BF%CF%85%CF%81%CE%B3%CE%AF%CE%B1%CF%82/";
const EIC_FAQ_URL = "https://eic.ec.europa.eu/eic-frequently-asked-questions/faqs-eic-accelerator_en";
const HORIZON_ANNEX_URL = "https://sciencebusiness.net/sites/default/files/inline-files/HORIZON-General-annexes-2026-2027_05_18_2026.pdf";

let n = 0;
function r(key: string, category: string, value: unknown, original: string, lang: string, url: string, o: Partial<RequirementRecord> = {}): RequirementRecord {
  return {
    id: `real-${++n}`, key, version: 1, category, kind: "mandatory", value, original_text: original, original_lang: lang,
    evidence: { source_url: url }, evidence_rank: 1, confidence: original.startsWith("[") ? "medium" : "high", flags: [],
    verified_at: "2026-10-13", ...o,
  };
}
const base = (id: string, requirements: RequirementRecord[], o: Partial<OpportunityForMatching> = {}): OpportunityForMatching => ({
  id, version: 1, status: "unverified", opportunity_type: "grant", closes_at: null, deadline_kind: "not_announced",
  last_verified_at: null, requirement_set_completeness: "partial", requirements, ...o,
});

/** DYPA — grant for new self-employed aged up to 29 (information leaflet; no publication date on the page). */
export const DYPA_NEE_18_29 = base("real:dypa-nee-18-29", [
  r("age", "age", { max: 29, reference_date: "application" }, "έως 29 ετών … κατά την αίτηση χρηματοδότησης", "el", DYPA_URL),
  r("unemployed", "employment", { statuses: ["unemployed"] }, "[Παράφραση] Άνεργοι εγγεγραμμένοι στο μητρώο της ΔΥΠΑ", "el", DYPA_URL),
  r("dypa", "unemployment_registration", { required: true }, "[Παράφραση] Εγγεγραμμένοι στο μητρώο ανέργων της ΔΥΠΑ", "el", DYPA_URL),
  r("start", "registration_timing", { not_before: "application", by: "approval", within_days_of_approval: 60 },
    "[Παράφραση] Έναρξη στη ΔΟΥ μετά την ημερομηνία αίτησης και το αργότερο εντός 60 ημερών από την ενημέρωση για θετική αξιολόγηση", "el", DYPA_URL),
], { opportunity_type: "subsidy" });

/** ESPA 2021–27 — new tourism SMEs (call issued 18/12/2023; amendments up to 06/03/2026). */
export const ESPA_NEW_TOURISM_SMES = base("real:espa-new-tourism-smes", [
  r("under_establishment", "registration_timing", { by: "first_payment" },
    "[Παράφραση] Υπό ίδρυση: σύσταση μετά την έκδοση της πρόσκλησης και πριν την πρώτη καταβολή", "el", ESPA_TOURISM_URL,
    { kind: "conditional", applies_to: ["natural_person", "unregistered_entrepreneur"] }),
  r("newly_established", "business_age", { max_months: 12, reference_date: "call_publication" },
    "[Παράφραση] Νεοσύστατες: έως 12 μήνες λειτουργίας από την έναρξη στην ΑΑΔΕ έως την έκδοση της πρόσκλησης", "el", ESPA_TOURISM_URL,
    { kind: "conditional", applies_to: ["sole_proprietor", "company", "partnership", "cooperative"] }),
  r("location", "geography", { regions: ["GR"], exclude_areas: [{ parent: "EL42", name: "Π.Ε. Μυκόνου" }, { parent: "EL42", name: "Π.Ε. Θήρας (εκτός Κοινότητας Θηρασίας)" }] },
    "[Παράφραση] Εξαιρούνται επενδύσεις στις Π.Ε. Μυκόνου και Θήρας, εκτός της Κοινότητας Θηρασίας", "el", ESPA_TOURISM_URL),
  r("private_share_proof", "cofinancing", { proof_pct_of_private_share: 60 },
    "[Παράφραση] Τεκμηρίωση εξασφάλισης τουλάχιστον 60% της ιδιωτικής συμμετοχής", "el", ESPA_TOURISM_URL),
  r("sme", "sme_status", { max_class: "medium" }, "[Παράφραση] Πολύ μικρές, μικρές και μεσαίες επιχειρήσεις", "el", ESPA_TOURISM_URL),
  r("de_minimis", "de_minimis", { ceiling_eur: 300_000, period_years: 3, rolling: true }, "Κανονισμός (ΕΕ) 2831/2023", "el", ESPA_TOURISM_URL),
  r("tourism_kad", "sector", { include: ["I"] }, "[Παράφραση] Επιλέξιμοι ΚΑΔ τουρισμού (παράρτημα της πρόσκλησης)", "el", ESPA_TOURISM_URL,
    { interpretation: "Approximated as NACE section I; the official eligible KAD list is in the call annex." }),
], { published_on: new Date("2023-12-18T00:00:00Z"), funding_intensity_pct: 45 });

/** EIC Accelerator 2026 (official FAQ). Natural-person eligibility is NOT addressed by the FAQ. */
export const EIC_ACCELERATOR_2026 = base("real:eic-accelerator-2026", [
  r("countries", "geography", { regions: ["EU"] }, "[Paraphrase] Established in a Member State or a country associated to Horizon Europe", "en", EIC_FAQ_URL),
  r("size", "company_size", { max_employees: 499 }, "[Paraphrase] SMEs, and small mid-caps defined as having up to 499 employees", "en", EIC_FAQ_URL),
  r("natural_persons", "other", null, "[Paraphrase] The FAQ does not say whether natural persons may apply", "en", EIC_FAQ_URL),
]);

/** Horizon Europe General Annexes 2026–2027 — default rules that apply UNLESS a topic says otherwise. */
export const HORIZON_DEFAULTS: RequirementRecord[] = [
  r("default_consortium", "consortium", { min_entities: 3, min_countries: 3 },
    "[Paraphrase] Unless the topic states otherwise: at least three independent legal entities, each in a different country, at least one in a Member State",
    "en", HORIZON_ANNEX_URL, { kind: "informational" }),
];
