/**
 * Γνώση (Knowledge) — one shared content system for the four sections (owner, 23 Oct 2026, Phase K).
 *
 * Dictionary, Learn the Basics and FAQ are the three kinds of entry; Topics is a view over the same entries by their one
 * primary topic. Every entry has one id; sections never copy each other — they link by id.
 *
 * Content status is kept apart from the page: an entry reaches the public page ONLY when the publication gate below
 * passes. Nothing else (a source link, a draft, a register row) makes an entry public.
 */
import { fold } from "@/lib/text/search";

export type Locale = "el" | "en";
export type L = Record<Locale, string>;

export const KINDS = ["term", "article", "faq"] as const;
export type Kind = (typeof KINDS)[number];

/** The four sections; the first three are kinds, «Θέματα» is a view over all of them. */
/** Section order (owner, 23 Oct 2026 16:37): Θέματα · Λεξικό · Μάθε τα βασικά · Συχνές Ερωτήσεις. */
export const SECTIONS = [
  { id: "themata", kind: null, name: { el: "Θέματα", en: "Topics" }, lead: { el: "Όλο το περιεχόμενο της Γνώσης, οργανωμένο σε οκτώ θεματικές.", en: "All Knowledge content, organised into eight topics." } },
  { id: "lexiko", kind: "term", name: { el: "Λεξικό", en: "Dictionary" }, lead: { el: "Όροι από φορολογία, επιχειρήσεις, χρηματοδότηση και δημόσια διοίκηση, με την επίσημη πηγή τους.", en: "Terms from tax, business, funding and public administration, with their official source." } },
  { id: "vasika", kind: "article", name: { el: "Μάθε τα βασικά", en: "Learn the Basics" }, lead: { el: "Σύντομα κείμενα που εξηγούν βασικές έννοιες με απλά λόγια.", en: "Short pieces that explain key ideas in plain language." } },
  { id: "syxnes-erotiseis", kind: "faq", name: { el: "Συχνές Ερωτήσεις", en: "FAQ" }, lead: { el: "Σύντομες απαντήσεις σε πρακτικές ερωτήσεις, με επίσημες παραπομπές.", en: "Short answers to practical questions, with official references." } },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

/** The eight topics (owner, 23 Oct 2026). Each entry has exactly one primary topic. */
export const TOPICS = [
  { id: "forologia", name: { el: "Φορολογία", en: "Tax" }, scope: { el: "Φόροι, δηλώσεις, φορολογική κατοικία", en: "Taxes, returns, tax residence" } },
  { id: "epixeirimatikotita", name: { el: "Επιχειρηματικότητα", en: "Entrepreneurship" }, scope: { el: "Μορφές εταιρειών, έναρξη, ΚΑΔ, μέγεθος", en: "Company forms, starting up, activity codes, size" } },
  { id: "oikonomika", name: { el: "Οικονομικά & Χρηματοδότηση", en: "Finance & Funding" }, scope: { el: "Οικονομικοί δείκτες, τραπεζική, χρηματοδότηση", en: "Economic indicators, banking, funding" } },
  { id: "ergasia", name: { el: "Εργασία & Ασφάλιση", en: "Work & Social Insurance" }, scope: { el: "Εργασιακή σχέση, ανεργία, ασφάλιση", en: "Employment, unemployment, social insurance" } },
  { id: "epidotiseis", name: { el: "Επιδοτήσεις & Προγράμματα", en: "Grants & Programmes" }, scope: { el: "Κρατικές ενισχύσεις, ΕΣΠΑ, επιλεξιμότητα", en: "State aid, ESPA, eligibility" } },
  { id: "akinita", name: { el: "Ακίνητα & Στέγαση", en: "Property & Housing" }, scope: { el: "Ιδιοκτησία, μίσθωση, ενέργεια", en: "Ownership, renting, energy" } },
  { id: "koinonikes-paroxes", name: { el: "Κοινωνικές Παροχές", en: "Social Benefits" }, scope: { el: "Οικογένεια, εισοδηματική στήριξη", en: "Family, income support" } },
  { id: "nomothesia", name: { el: "Νομοθεσία & Δημόσιο", en: "Law & Public Administration" }, scope: { el: "Νόμοι, ΦΕΚ, διαδικασίες, δημόσιες συμβάσεις", en: "Laws, Government Gazette, procedures, public contracts" } },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];

export type VerificationStatus = "unverified" | "draft" | "source_located" | "verified";

export interface Source { label: string; url: string; /** Exact document part: article, paragraph, section. */ locator: string; checked_on: string }

export interface Entry {
  id: string;
  kind: Kind;
  topic: TopicId;
  title: { el: string | null; en: string | null };
  /** The text shown on the page. Plain text; [[ID]] or [[ID|label]] links another entry. */
  body: { el: string; en: string } | null;
  /** FAQ only: the short answer shown first. */
  sources: Source[];
  verification: { status: VerificationStatus | string; checked_on?: string | null } & Record<string, unknown>;
  editorial_review: { by: string; on: string } | null;
  publication: { approved: boolean; approved_by: string | null; approved_on: string | null };
  related: string[];
  /** Synthetic development fixture: never public, shown only in the preview with a banner. */
  synthetic?: boolean;
  /** A register entry shown in the private preview as a DRAFT (owner, 23 Oct 2026): never public, never approved. */
  draftPreview?: boolean;
  draft?: unknown;
}

/**
 * The publication gate (owner, 23 Oct 2026): verified official source with its exact document part, Greek and English
 * title and text, editorial review, explicit approval — all of them. A synthetic fixture never passes.
 */
export function publicationGate(e: Entry): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (e.synthetic) missing.push("synthetic");
  if (e.draftPreview) missing.push("draft_preview");
  if (e.verification.status !== "verified") missing.push("verified_source");
  if (!e.sources.length || e.sources.some((s) => !/^https:\/\//.test(s.url) || !s.locator?.trim() || !s.checked_on)) missing.push("exact_source");
  if (!e.title.el?.trim() || !e.title.en?.trim()) missing.push("title_el_en");
  if (!e.body?.el?.trim() || !e.body?.en?.trim()) missing.push("text_el_en");
  if (!e.editorial_review?.by || !e.editorial_review?.on) missing.push("editorial_review");
  if (e.publication.approved !== true || !e.publication.approved_by || !e.publication.approved_on) missing.push("publication_approval");
  return { ok: missing.length === 0, missing };
}

export const sectionOfKind = (k: Kind) => SECTIONS.find((s) => s.kind === k)!;
export const sectionById = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;
export const topicById = (id: string) => TOPICS.find((t) => t.id === id) ?? null;

/** Greek alphabet, then Latin, for the dictionary index. */
export const GREEK_LETTERS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ".split("");
export const LATIN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Index letter of a title: first letter, accents removed, upper case ("ΑΦΜ" → Α, "de minimis" → D); "#" otherwise. */
export function indexLetter(title: string): string {
  const c = fold(title.trim()).charAt(0).toUpperCase();
  if (GREEK_LETTERS.includes(c) || LATIN_LETTERS.includes(c)) return c;
  return "#";
}

/** Locale-aware alphabetical order (Greek collation, accents ignored). */
export function byTitle(locale: Locale) {
  const coll = new Intl.Collator(locale === "el" ? "el" : "en", { sensitivity: "base" });
  return (a: { title: { el: string | null; en: string | null } }, b: { title: { el: string | null; en: string | null } }) =>
    coll.compare(a.title[locale] ?? a.title.el ?? "", b.title[locale] ?? b.title.el ?? "");
}

/** Accent-insensitive match of every query word in the title or text, in either language. */
export function matches(e: Entry, q: string): boolean {
  const words = fold(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  if (!words.length) return true;
  const hay = fold([e.title.el, e.title.en, e.body?.el, e.body?.en].filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

/** Splits text into plain parts and [[ID]] / [[ID|label]] links. */
export function linkParts(text: string): Array<{ text: string } | { id: string; label: string | null }> {
  const out: Array<{ text: string } | { id: string; label: string | null }> = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([A-Z]{2,4}-\d{3,4})(?:\|([^\]]+))?\]\]/g)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ id: m[1]!, label: m[2] ?? null });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
