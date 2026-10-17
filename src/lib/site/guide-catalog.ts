/**
 * The Guides knowledge centre (Guides Phase 2, 16 Oct 2026).
 *
 * - The eight categories are the owner's approved list (guide brief, 16 Oct 2026), in the approved order and wording.
 * - Every guide — programme guides built from the hand-checked records, general explainers and step-by-step procedures —
 *   is turned into one `Article` shape and rendered by one template.
 * - Verification state is about the GUIDE'S CONTENT (checked against official sources?), never about whether applications
 *   are open; the programme's application status is computed separately in guide-status.ts.
 * - Nothing here is written from memory: programme facts come from data/official-records-2026-10-14.v2.json; procedure
 *   articles live in src/content/guides/ with their own official sources and check dates.
 */
import records from "../../../data/official-records-2026-10-14.v2.json";
import type { Locale } from "@/lib/i18n/dictionaries";
import { PROCEDURE_ARTICLES } from "@/content/guides";
import { GENERAL_GUIDES } from "./guides";
import { MANUAL_RECORDS } from "./taxonomy";
import { fold, matches } from "@/lib/text/search";

export type L = Record<Locale, string>;

// ── categories ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const GUIDE_CATEGORY_SLUGS = [
  "step-by-step", "benefits", "business-grants", "employment-education",
  "housing-energy", "eu-programmes", "faq-glossary", "news-updates",
] as const;
export type GuideCategory = (typeof GUIDE_CATEGORY_SLUGS)[number];

export const GUIDE_CATEGORIES: Array<{ slug: GuideCategory; icon: string; name: L; desc: L }> = [
  { slug: "step-by-step", icon: "clipboard", name: { el: "Οδηγοί Βήμα-Βήμα", en: "Step-by-Step Guides" },
    desc: { el: "Πώς χρησιμοποιείτε τις επίσημες πλατφόρμες αιτήσεων, με αριθμημένα βήματα.", en: "How to use official application platforms, in numbered steps." } },
  { slug: "benefits", icon: "coins", name: { el: "Επιδόματα & Παροχές", en: "Benefits & Allowances" },
    desc: { el: "Οικονομική στήριξη: ποιον αφορά, προϋποθέσεις και επίσημοι σύνδεσμοι.", en: "Financial support: who it is for, requirements and official links." } },
  { slug: "business-grants", icon: "rocket", name: { el: "Επιχειρηματικότητα & Επιδοτήσεις", en: "Business & Grants" },
    desc: { el: "ΕΣΠΑ, κίνητρα, επενδύσεις και οι όροι που τα συνοδεύουν.", en: "ESPA, incentives, investment and the terms that come with them." } },
  { slug: "employment-education", icon: "cap", name: { el: "Εργασία & Εκπαίδευση", en: "Employment & Education" },
    desc: { el: "Στήριξη εργαζομένων και ανέργων, κατάρτιση και ευκαιρίες για νέους.", en: "Support for workers and jobseekers, training and opportunities for young people." } },
  { slug: "housing-energy", icon: "home", name: { el: "Στέγαση & Ενέργεια", en: "Housing & Energy" },
    desc: { el: "Στεγαστική στήριξη, πρώτη κατοικία και ενεργειακά προγράμματα.", en: "Housing support, first homes and energy programmes." } },
  { slug: "eu-programmes", icon: "globe", name: { el: "Ευρωπαϊκά Προγράμματα", en: "European Programmes" },
    desc: { el: "Ευκαιρίες της ΕΕ και πώς διαβάζετε τις προσκλήσεις της.", en: "EU opportunities and how to read EU calls." } },
  { slug: "faq-glossary", icon: "book", name: { el: "Συχνές Ερωτήσεις & Όροι", en: "FAQs & Glossary" },
    desc: { el: "Απλές εξηγήσεις για όρους και για το πώς διαβάζετε τα αποτελέσματα.", en: "Plain explanations of terms and of how to read results." } },
  { slug: "news-updates", icon: "calendar", name: { el: "Νέα & Αλλαγές", en: "News & Updates" },
    desc: { el: "Νέες ανακοινώσεις, παρατάσεις και αλλαγές, με επίσημες παραπομπές.", en: "New announcements, extensions and changes, with official references." } },
];
export const guideCategory = (slug: string) => GUIDE_CATEGORIES.find((c) => c.slug === slug);

// ── article model (one template for every guide) ────────────────────────────────────────────────────────────────────
export type GuideKind = "programme" | "explainer" | "procedure";
export type VerificationState = "verified" | "needs_reverification" | "incomplete" | "conflicting" | "draft" | "educational";

export interface ArticleStep {
  text: L;
  /** false = the screen or button has not been observed on the official service yet ("awaiting interface confirmation"). */
  confirmed: boolean;
  /** Optional detail lines under the step. */
  details?: L[];
}

export interface Article {
  slug: string;
  kind: GuideKind;
  title: L;
  intro: L;
  categories: GuideCategory[];
  keywords: string[];
  audience: L[];
  provides: L | null;
  eligibility: L[];
  /** null = the documents list is not recorded (the official page sets it). */
  documents: L[] | null;
  steps: ArticleStep[];
  timing: L | null;
  applyUrl: string | null;
  afterSubmission: L[];
  mistakes: L[];
  faq: Array<{ q: L; a: L }>;
  /** Free sections, used by explainers. */
  sections: Array<{ h: L; items: L[] }>;
  sources: Array<{ label: string; url: string }>;
  /** Date the content was last checked against the official sources (YYYY-MM-DD); null for explainers. */
  checkedOn: string | null;
  /** Days after which the content must be checked again (review trigger, not proof that it is wrong). */
  reviewAfterDays: number;
  limitations: L[];
  /** External key of the matching opportunity record, when there is one. */
  recordKey: string | null;
  related: string[];
  flags: { draft: boolean; conflicting: boolean; incomplete: boolean; possiblyOutdated: boolean; educational: boolean };
}

// ── programme guides, from the hand-checked records ─────────────────────────────────────────────────────────────────
interface RawRecord {
  id: string; official_title: L; summary: L;
  application_status: { verified_on?: string; stale_after_days?: number; deadline_original_wording?: L | null };
  funding_or_benefit: { value: L | null; state: string };
  conflicts: L[] | null;
  eligibility_rules: Array<{ label: L }>;
  application_steps: Record<Locale, string[]>;
  official_sources: Array<{ label: string; url: string }>;
  official_application_url: string | null;
  uncertainties: string[];
}
/** Review trigger for guide content (owner decision, 16 Oct 2026): not proof that the content is wrong. */
export const GUIDE_REVIEW_DAYS = 30;

const RAW = records as unknown as { checked_on: string; records: RawRecord[] };

/** Records the owner approved on 15 Oct 2026 (db/seed/approvals-2026-10-15.sql). Others are drafts. */
export const APPROVED_RECORDS = new Set(["discovereu", "art5c", "art5b", "art5a", "spiti2", "studenthousing", "a21", "unemployment"]);

/** Guide categories for each record's programme guide (reversible assignment, listed in the Phase 2 report). */
const RECORD_GUIDE_CATEGORIES: Record<string, GuideCategory[]> = {
  discovereu: ["eu-programmes", "employment-education"],
  eic: ["eu-programmes", "business-grants"],
  art5c: ["employment-education"],
  art5b: ["benefits"],
  art5a: ["business-grants"],
  spiti2: ["housing-energy"],
  studenthousing: ["housing-energy", "benefits"],
  a21: ["benefits"],
  unemployment: ["benefits", "employment-education"],
};

const has = (r: RawRecord, re: RegExp) => r.uncertainties.some((u) => re.test(u));

function fromRecord(r: RawRecord): Article {
  const conflicts = r.conflicts ?? [];
  return {
    slug: MANUAL_RECORDS[r.id]!.guide!,
    kind: "programme",
    title: r.official_title,
    intro: r.summary,
    categories: RECORD_GUIDE_CATEGORIES[r.id] ?? [],
    keywords: [r.id],
    audience: [],
    provides: r.funding_or_benefit.value,
    eligibility: r.eligibility_rules.map((x) => x.label),
    documents: null,
    steps: r.application_steps.el.map((_, i) => ({ text: { el: r.application_steps.el[i]!, en: r.application_steps.en[i] ?? "" }, confirmed: true })),
    timing: r.application_status.deadline_original_wording ?? null,
    applyUrl: r.official_application_url,
    afterSubmission: [], mistakes: [], faq: [], sections: [],
    sources: r.official_sources.map(({ label, url }) => ({ label, url })),
    checkedOn: r.application_status.verified_on ?? RAW.checked_on,
    // Guide content is reviewed every 30 days (owner decision). The record's own stale_after_days is about the
    // application status, which guide-status.ts handles separately.
    reviewAfterDays: GUIDE_REVIEW_DAYS,
    limitations: conflicts,
    recordKey: `manual:${r.id}`,
    related: [],
    flags: {
      draft: !APPROVED_RECORDS.has(r.id),
      conflicting: conflicts.length > 0 || has(r, /^CONFLICT/i),
      incomplete: r.funding_or_benefit.state !== "verified" || has(r, /^(NOT STATED|UNVERIFIED|NOT MODELLED)/i),
      possiblyOutdated: has(r, /^POSSIBLY OUTDATED/i),
      educational: false,
    },
  };
}

const PROGRAMME_ARTICLES: Article[] = RAW.records.filter((r) => MANUAL_RECORDS[r.id]?.guide).map(fromRecord);

// ── explainers ──────────────────────────────────────────────────────────────────────────────────────────────────────
const EXPLAINER_CATEGORIES: Record<string, GuideCategory[]> = {
  "eligibility-labels": ["faq-glossary"],
  "applying-officially": ["step-by-step", "faq-glossary"],
};
const EXPLAINERS: Article[] = GENERAL_GUIDES.map((g) => ({
  slug: g.slug, kind: "explainer", title: g.title, intro: g.summary, categories: EXPLAINER_CATEGORIES[g.slug] ?? ["faq-glossary"],
  keywords: [], audience: [], provides: null, eligibility: [], documents: null, steps: [], timing: null, applyUrl: null,
  afterSubmission: [], mistakes: [], faq: [], sections: g.sections, sources: [], checkedOn: null, reviewAfterDays: 365,
  limitations: [], recordKey: null, related: [],
  flags: { draft: false, conflicting: false, incomplete: false, possiblyOutdated: false, educational: true },
}));

export const ARTICLES: Article[] = [...PROCEDURE_ARTICLES, ...PROGRAMME_ARTICLES, ...EXPLAINERS];
export const articleBySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);

// ── verification state ──────────────────────────────────────────────────────────────────────────────────────────────
const DAY = 86_400_000;

/** True when the content is older than its review interval (a trigger to check again, not proof that it is wrong). */
export function reviewDue(a: Article, now: Date): boolean {
  if (!a.checkedOn) return false;
  return now.getTime() - new Date(`${a.checkedOn}T00:00:00Z`).getTime() > a.reviewAfterDays * DAY;
}

/** The guide's verification state. Independent from the programme's application status. */
export function verificationOf(a: Article, now: Date): VerificationState {
  if (a.flags.draft) return "draft";
  if (a.flags.educational) return "educational";
  if (reviewDue(a, now) || a.flags.possiblyOutdated) return "needs_reverification";
  if (a.flags.conflicting) return "conflicting";
  if (a.flags.incomplete) return "incomplete";
  return "verified";
}

// ── search ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export { fold };

function haystack(a: Article): string {
  const cats = a.categories.flatMap((c) => { const x = guideCategory(c); return x ? [x.name.el, x.name.en] : []; });
  return fold([a.title.el, a.title.en, a.intro.el, a.intro.en, ...a.keywords, ...cats].join(" "));
}

/** Public guides (no drafts) matching every word of the query and the category, in display order. */
export function searchGuides(opts: { q?: string; cat?: string }, list: Article[] = ARTICLES): Article[] {
  return list
    .filter((a) => !a.flags.draft)
    .filter((a) => !opts.cat || a.categories.includes(opts.cat as GuideCategory))
    .filter((a) => !opts.q || matches(haystack(a), opts.q));
}

export function countByCategory(list: Article[] = ARTICLES): Record<GuideCategory, number> {
  const out = Object.fromEntries(GUIDE_CATEGORY_SLUGS.map((c) => [c, 0])) as Record<GuideCategory, number>;
  for (const a of list) if (!a.flags.draft) for (const c of a.categories) out[c] += 1;
  return out;
}
