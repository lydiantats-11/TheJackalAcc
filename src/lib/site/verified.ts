/**
 * Verified facts of the hand-checked official records, in Greek and English, straight from
 * data/official-records-2026-10-14.v2.json (checked by hand on 14 Oct 2026; approved by the owner on 15 Oct 2026), with the
 * corrections of 22 Oct 2026 applied (checked-records.ts).
 * Nothing here is written by hand: amounts, periods, conditions and steps are the checked file's own values.
 * Display only — the eligibility engine reads the imported requirements, never this module.
 */
import { CHECKED_RECORDS as records } from "./checked-records";
import type { Locale } from "@/lib/i18n/dictionaries";

type L = Record<Locale, string>;
interface RawRecord {
  id: string; official_title: L; issuing_authority: L; summary: L;
  application_status: { value: string; verified_on?: string; opens_at?: string | null; closes_at?: string | null; timezone?: string | null; deadline_original_wording?: L | null };
  funding_or_benefit: { value: L | null; state: string };
  eligibility_rules: Array<{ label: L; official_quote?: string | null }>;
  application_steps: Record<Locale, string[]>;
  official_sources: Array<{ label: string; url: string; checked_on: string }>;
  official_application_url: string | null;
  conflicts?: L[];
}

export interface VerifiedFacts {
  key: string;
  title: L;
  authority: L;
  summary: L;
  checkedOn: string;
  benefit: L | null;
  /** "verified" | "partially_stated" | … as recorded by the checker. */
  benefitState: string;
  period: { opens: string | null; closes: string | null; timezone: string | null; wording: L | null };
  rules: Array<{ label: L; quote: string | null }>;
  steps: Record<Locale, string[]>;
  sources: Array<{ label: string; url: string; checkedOn: string }>;
  conflicts: L[];
}

const raw = records as unknown as { verification: { checked_on: string }; records: RawRecord[] };

const BY_KEY = new Map<string, VerifiedFacts>(raw.records.map((r) => [`manual:${r.id}`, {
  key: `manual:${r.id}`,
  title: r.official_title,
  authority: r.issuing_authority,
  summary: r.summary,
  checkedOn: r.application_status.verified_on ?? raw.verification.checked_on,
  benefit: r.funding_or_benefit.value,
  benefitState: r.funding_or_benefit.state,
  period: {
    opens: r.application_status.opens_at ?? null,
    closes: r.application_status.closes_at ?? null,
    timezone: r.application_status.timezone ?? null,
    wording: r.application_status.deadline_original_wording ?? null,
  },
  rules: r.eligibility_rules.map((x) => ({ label: x.label, quote: x.official_quote?.trim() ? x.official_quote.trim() : null })),
  steps: r.application_steps,
  sources: r.official_sources.map((x) => ({ label: x.label, url: x.url, checkedOn: x.checked_on })),
  conflicts: r.conflicts ?? [],
}]));

/** Verified facts for a record, by its external key ("manual:<id>"); null for everything else. */
export function verifiedFor(externalKey: string | null | undefined): VerifiedFacts | null {
  return externalKey ? BY_KEY.get(externalKey) ?? null : null;
}

/** Authority names the sources publish in one language, and how to name them in each (no new facts). */
const AUTHORITY_NAMES: Record<string, Record<Locale, string>> = {
  "European Commission (EU Funding & Tenders Portal)": { el: "Ευρωπαϊκή Επιτροπή", en: "European Commission" },
};

/** Authority to show: the verified translation, a known official name, or the source's own wording. */
export function displayAuthority(o: { external_key: string | null; publishing_authority: string | null }, locale: Locale): string | null {
  const v = verifiedFor(o.external_key);
  if (v) return v.authority[locale];
  if (!o.publishing_authority) return null;
  return AUTHORITY_NAMES[o.publishing_authority]?.[locale] ?? o.publishing_authority;
}

/** Title to show: the verified translation in the visitor's language when there is one, else the official title.
 *  When the official title is only a programme code (e.g. "SOCPL-2026-INFO-REPR") and the source publishes the call's
 *  descriptive name, that official name is shown instead (the code stays visible as the official identifier). */
export function displayTitle(
  o: { external_key: string | null; official_title: string; title_lang: string; official_details?: { call?: { title: string | null } | null } | null },
  locale: Locale,
): { text: string; lang: string; codeOnly?: boolean } {
  const v = verifiedFor(o.external_key);
  if (v) return { text: v.title[locale], lang: locale };
  const t = o.official_title.trim();
  if (/^[A-Z0-9][A-Z0-9_./-]{3,}$/.test(t)) {
    const call = o.official_details?.call?.title?.trim();
    return call ? { text: call, lang: o.title_lang } : { text: t, lang: o.title_lang, codeOnly: true };
  }
  return { text: o.official_title, lang: o.title_lang };
}
