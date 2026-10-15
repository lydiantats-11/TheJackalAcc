/**
 * Browsing taxonomy for the public site (design sprint, 15 Oct 2026).
 *
 * Three SEPARATE classifications, never mixed:
 *   1. Category (θεματική κατηγορία) — what the opportunity is about: employment, housing, research…   → CATEGORIES
 *   2. Type of support (είδος στήριξης) — grant, loan, benefit, tax incentive…                        → SUPPORT_TYPES
 *   3. Audience (για ποιον) — the five personas                                                       → AUDIENCES
 *   (+ Industry — the 30 sectors in domain/industries.ts, a profile answer and a filter.)
 *
 * Category membership is the PLATFORM'S classification for browsing, derived from the record's official identifier,
 * type and source. It is indicative, never an eligibility statement, and an uncategorised record still appears in
 * "All opportunities". Nothing here is read by the eligibility engine.
 */
import type { OpportunityRow } from "@/lib/data/opportunities";
import type { PersonaId } from "@/lib/domain/personas";
import type { Locale } from "@/lib/i18n/dictionaries";

type L = Record<Locale, string>;

export interface Category {
  slug: string;
  icon: string;
  name: L;
  description: L;
  audiences: PersonaId[];
  subcategories: L[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "employment", icon: "briefcase",
    name: { el: "Εργασία & Ανεργία", en: "Work & Unemployment" },
    description: { el: "Επιδόματα ανεργίας, προγράμματα απασχόλησης και στήριξη για όσους αναζητούν εργασία.", en: "Unemployment benefits, employment programmes and support for people looking for work." },
    audiences: ["employee_jobseeker", "young_adult"],
    subcategories: [{ el: "Επιδόματα ανεργίας", en: "Unemployment benefits" }, { el: "Προγράμματα απασχόλησης", en: "Employment programmes" }, { el: "Επιδοτήσεις προσλήψεων", en: "Hiring subsidies" }],
  },
  {
    slug: "entrepreneurship", icon: "rocket",
    name: { el: "Επιχειρηματικότητα & Startups", en: "Entrepreneurship & Start-ups" },
    description: { el: "Στήριξη για όσους ξεκινούν επιχείρηση ή αναπτύσσουν μια νεοφυή ιδέα.", en: "Support for people starting a business or growing a start-up idea." },
    audiences: ["aspiring_entrepreneur", "young_adult"],
    subcategories: [{ el: "Νέες επιχειρήσεις", en: "New businesses" }, { el: "Νεοφυείς επιχειρήσεις", en: "Start-ups" }, { el: "Αυτοαπασχόληση", en: "Self-employment" }],
  },
  {
    slug: "business", icon: "store",
    name: { el: "Μικρές & Μεσαίες Επιχειρήσεις", en: "Small & Medium Businesses" },
    description: { el: "Επενδυτικά κίνητρα, χρηματοδότηση και ευρωπαϊκά προγράμματα για υπάρχουσες επιχειρήσεις.", en: "Investment incentives, financing and EU programmes for existing businesses." },
    audiences: ["business_org"],
    subcategories: [{ el: "Επενδυτικά κίνητρα", en: "Investment incentives" }, { el: "Δάνεια & εγγυήσεις", en: "Loans & guarantees" }, { el: "Εξωστρέφεια", en: "Going international" }],
  },
  {
    slug: "agriculture", icon: "wheat",
    name: { el: "Γεωργία & Αλιεία", en: "Agriculture & Fisheries" },
    description: { el: "Ενισχύσεις για αγρότες, κτηνοτρόφους, αλιεία και υδατοκαλλιέργεια.", en: "Support for farmers, livestock breeders, fisheries and aquaculture." },
    audiences: ["business_org", "aspiring_entrepreneur"],
    subcategories: [{ el: "Αγροτικές ενισχύσεις", en: "Farm support" }, { el: "Νέοι αγρότες", en: "Young farmers" }, { el: "Αλιεία & υδατοκαλλιέργεια", en: "Fisheries & aquaculture" }],
  },
  {
    slug: "education", icon: "cap",
    name: { el: "Εκπαίδευση, Κατάρτιση & Κινητικότητα", en: "Education, Training & Mobility" },
    description: { el: "Υποτροφίες, κατάρτιση, φοιτητικά επιδόματα και ευκαιρίες μετακίνησης στην Ευρώπη.", en: "Scholarships, training, student benefits and chances to travel or study in Europe." },
    audiences: ["young_adult", "employee_jobseeker"],
    subcategories: [{ el: "Κατάρτιση & δεξιότητες", en: "Training & skills" }, { el: "Φοιτητές", en: "Students" }, { el: "Κινητικότητα στην ΕΕ", en: "Mobility in the EU" }],
  },
  {
    slug: "housing-energy", icon: "home",
    name: { el: "Στέγαση & Ενέργεια", en: "Housing & Energy" },
    description: { el: "Στεγαστικά προγράμματα και επιδόματα, και στήριξη για το ενεργειακό κόστος του νοικοκυριού.", en: "Housing programmes and allowances, and help with household energy costs." },
    audiences: ["household", "young_adult"],
    subcategories: [{ el: "Πρώτη κατοικία", en: "First home" }, { el: "Στεγαστικά επιδόματα", en: "Housing allowances" }, { el: "Ενέργεια νοικοκυριού", en: "Household energy" }],
  },
  {
    slug: "family", icon: "family",
    name: { el: "Οικογένεια & Κοινωνική Στήριξη", en: "Family & Social Support" },
    description: { el: "Επιδόματα για παιδιά και οικογένειες, και στήριξη για ευάλωτα νοικοκυριά.", en: "Benefits for children and families, and support for vulnerable households." },
    audiences: ["household"],
    subcategories: [{ el: "Επιδόματα παιδιών", en: "Child benefits" }, { el: "Ευάλωτα νοικοκυριά", en: "Vulnerable households" }],
  },
  {
    slug: "innovation", icon: "flask",
    name: { el: "Έρευνα, Καινοτομία & Ψηφιακός Μετασχηματισμός", en: "Research, Innovation & Digital" },
    description: { el: "Ευρωπαϊκές προσκλήσεις για έρευνα, καινοτομία και ψηφιακές τεχνολογίες.", en: "European calls for research, innovation and digital technology." },
    audiences: ["business_org", "aspiring_entrepreneur"],
    subcategories: [{ el: "Έρευνα (Horizon Europe)", en: "Research (Horizon Europe)" }, { el: "Καινοτομία", en: "Innovation" }, { el: "Ψηφιακός μετασχηματισμός", en: "Digital transformation" }],
  },
  {
    slug: "environment", icon: "leaf",
    name: { el: "Περιβάλλον & Βιωσιμότητα", en: "Environment & Sustainability" },
    description: { el: "Πράσινη μετάβαση, καθαρή ενέργεια και κλίμα — κυρίως για επιχειρήσεις και φορείς.", en: "Green transition, clean energy and climate — mainly for businesses and organisations." },
    audiences: ["business_org"],
    subcategories: [{ el: "Κλίμα & φύση (LIFE)", en: "Climate & nature (LIFE)" }, { el: "Καθαρή ενέργεια & υποδομές", en: "Clean energy & infrastructure" }],
  },
  {
    slug: "tenders", icon: "clipboard",
    name: { el: "Δημόσιοι Διαγωνισμοί", en: "Public Tenders" },
    description: { el: "Διαγωνισμοί του δημοσίου όπου επιχειρήσεις μπορούν να υποβάλουν προσφορά.", en: "Public contracts that businesses can bid for." },
    audiences: ["business_org"],
    subcategories: [{ el: "Ελληνικοί διαγωνισμοί", en: "Greek tenders" }, { el: "Ευρωπαϊκοί διαγωνισμοί", en: "European tenders" }],
  },
  {
    slug: "tax", icon: "percent",
    name: { el: "Φορολογικά Κίνητρα & Επιστροφή στην Ελλάδα", en: "Tax Incentives & Moving to Greece" },
    description: { el: "Φορολογικά καθεστώτα για όσους μεταφέρουν τη φορολογική τους κατοικία στην Ελλάδα.", en: "Tax regimes for people moving their tax residence to Greece." },
    audiences: ["employee_jobseeker", "business_org"],
    subcategories: [{ el: "Εργαζόμενοι που επιστρέφουν", en: "Returning workers" }, { el: "Συνταξιούχοι", en: "Pensioners" }, { el: "Επενδυτές", en: "Investors" }],
  },
];

/** Which categories each profile interest points to — for ordering and selecting "For Me" results only. */
export const INTEREST_CATEGORIES: Record<string, string[]> = {
  housing: ["housing-energy"], education: ["education"], employment: ["employment"], entrepreneurship: ["entrepreneurship", "business"],
  mobility: ["education", "tax"], financial_support: ["family", "employment"], energy: ["housing-energy", "environment"], family: ["family"],
  tax_residency: ["tax"], tenders: ["tenders"], eu_programmes: ["innovation", "environment", "business"],
};

export const categoryBySlug = (slug: string | undefined) => CATEGORIES.find((c) => c.slug === slug);

/** Hand-checked records (external_key "manual:<id>"): their category, audience and guide are known. */
export const MANUAL_RECORDS: Record<string, { categories: string[]; audiences: PersonaId[]; guide?: string }> = {
  discovereu: { categories: ["education"], audiences: ["young_adult"], guide: "discovereu" },
  eic: { categories: ["entrepreneurship", "innovation"], audiences: ["aspiring_entrepreneur", "business_org"], guide: "eic" },
  art5c: { categories: ["tax"], audiences: ["employee_jobseeker", "aspiring_entrepreneur"], guide: "art5c" },
  art5b: { categories: ["tax"], audiences: [], guide: "art5b" },
  art5a: { categories: ["tax"], audiences: ["business_org"], guide: "art5a" },
  spiti2: { categories: ["housing-energy"], audiences: ["household", "young_adult"], guide: "spiti2" },
  studenthousing: { categories: ["housing-energy", "education"], audiences: ["young_adult", "household"], guide: "studenthousing" },
  a21: { categories: ["family"], audiences: ["household"], guide: "a21" },
  unemployment: { categories: ["employment"], audiences: ["employee_jobseeker"], guide: "unemployment" },
};

/** EU Funding & Tenders topic codes → category, by the programme prefix of the official identifier. */
const EU_PREFIX: Array<[RegExp, string[]]> = [
  [/^(HORIZON|ERC|MSCA|EURATOM|RFCS|EIT)/, ["innovation"]],
  [/^EIC/, ["innovation", "entrepreneurship"]],
  [/^(DIGITAL|CEF-DIG)/, ["innovation"]],
  [/^(LIFE|INNOVFUND|CEF)/, ["environment"]],
  [/^(ERASMUS|EAC|ESC)/, ["education"]],
  [/^(SMP|COSME|EISMEA|I3|EUBA)/, ["business"]],
  [/^(AGRI|EMFAF|EMFF)/, ["agriculture"]],
  [/^(ESF|SOCPL|EaSI)/, ["employment"]],
];

const manualId = (o: Pick<OpportunityRow, "external_key">) => (o.external_key?.startsWith("manual:") ? o.external_key.slice(7) : null);

export function categoriesOf(o: Pick<OpportunityRow, "external_key" | "official_identifier" | "opportunity_type">): string[] {
  const m = manualId(o);
  if (m && MANUAL_RECORDS[m]) return MANUAL_RECORDS[m].categories;
  const out = new Set<string>();
  const id = (o.official_identifier ?? "").toUpperCase();
  for (const [re, cats] of EU_PREFIX) if (re.test(id)) { cats.forEach((c) => out.add(c)); break; }
  if (o.opportunity_type === "procurement") out.add("tenders");
  if (o.opportunity_type === "tax_incentive") out.add("tax");
  if (o.opportunity_type === "training") out.add("education");
  if (o.opportunity_type === "employment_subsidy") out.add("employment");
  return [...out];
}

/** Indicative audiences: hand-checked records carry their own; EU topics are applied for by organisations. */
export function audiencesOf(o: Pick<OpportunityRow, "external_key" | "official_identifier" | "opportunity_type">): PersonaId[] {
  const m = manualId(o);
  if (m && MANUAL_RECORDS[m]) return MANUAL_RECORDS[m].audiences;
  const set = new Set<PersonaId>();
  for (const c of categoriesOf(o)) for (const a of categoryBySlug(c)?.audiences ?? []) set.add(a);
  if (o.external_key?.startsWith("eu-topic:")) set.add("business_org");
  return [...set];
}

export const guideOf = (o: Pick<OpportunityRow, "external_key">) => { const m = manualId(o); return m ? MANUAL_RECORDS[m]?.guide : undefined; };

/** Where the official source is: European Union or Greece (by the official page's domain). */
export const scopeOf = (o: Pick<OpportunityRow, "canonical_url">): "eu" | "gr" => (/europa\.eu/.test(o.canonical_url) ? "eu" : "gr");

/** Type of support, grouped into the few kinds a non-specialist recognises. */
export const SUPPORT_TYPES = ["grant", "loan", "benefit", "tax", "training", "tender", "unconfirmed"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];
export function supportTypeOf(t: string): SupportType {
  if (["grant", "subsidy", "prize", "employment_subsidy"].includes(t)) return "grant";
  if (["loan", "guarantee", "equity"].includes(t)) return "loan";
  if (t === "public_benefit") return "benefit";
  if (t === "tax_incentive") return "tax";
  if (t === "training") return "training";
  if (t === "procurement") return "tender";
  return "unconfirmed";
}
export const SUPPORT_TYPE_DB: Record<SupportType, string[]> = {
  grant: ["grant", "subsidy", "prize", "employment_subsidy"], loan: ["loan", "guarantee", "equity"], benefit: ["public_benefit"],
  tax: ["tax_incentive"], training: ["training"], tender: ["procurement"], unconfirmed: ["unknown", "other", "mixed"],
};
