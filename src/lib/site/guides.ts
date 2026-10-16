/**
 * Guides. Programme guides are generated ONLY from the hand-checked official records
 * (data/official-records-2026-10-14.v2.json, checked on 14 Oct 2026) — no programme facts are written here by hand.
 * The two general guides explain how the platform and official applications work, without programme-specific claims.
 */
import records from "../../../data/official-records-2026-10-14.v2.json";
import type { Locale } from "@/lib/i18n/dictionaries";
import { MANUAL_RECORDS } from "./taxonomy";

type L = Record<Locale, string>;
interface RawRecord {
  id: string; official_title: L; issuing_authority: L; summary: L;
  application_status: { value: string; deadline_original_wording?: L | null };
  funding_or_benefit: { value: L | null };
  eligibility_rules: Array<{ label: L }>;
  application_steps: Record<Locale, string[]>;
  official_sources: Array<{ label: string; url: string; checked_on: string }>;
  official_application_url: string | null;
  conflicts: L[];
}

export interface ProgrammeGuide {
  kind: "programme"; slug: string; title: L; authority: L; summary: L; status: string; deadline: L | null; amount: L | null;
  who: L[]; steps: Record<Locale, string[]>; sources: Array<{ label: string; url: string }>; applyUrl: string | null;
  warnings: L[]; checkedOn: string; recordKey: string; categories: string[];
}
export interface GeneralGuide { kind: "general"; slug: string; title: L; summary: L; sections: Array<{ h: L; items: L[] }> }
export type Guide = ProgrammeGuide | GeneralGuide;

const CHECKED_ON = (records as { verification: { checked_on: string } }).verification.checked_on;

export const PROGRAMME_GUIDES: ProgrammeGuide[] = (records as { records: RawRecord[] }).records
  .filter((r) => MANUAL_RECORDS[r.id]?.guide)
  .map((r) => ({
    kind: "programme", slug: MANUAL_RECORDS[r.id]!.guide!, title: r.official_title, authority: r.issuing_authority, summary: r.summary,
    status: r.application_status.value, deadline: r.application_status.deadline_original_wording ?? null, amount: r.funding_or_benefit.value,
    who: r.eligibility_rules.map((x) => x.label), steps: r.application_steps, sources: r.official_sources.map(({ label, url }) => ({ label, url })),
    applyUrl: r.official_application_url, warnings: r.conflicts ?? [], checkedOn: CHECKED_ON, recordKey: `manual:${r.id}`,
    categories: MANUAL_RECORDS[r.id]!.categories,
  }));

export const GENERAL_GUIDES: GeneralGuide[] = [
  {
    kind: "general", slug: "eligibility-labels",
    title: { el: "Τι σημαίνουν οι ενδείξεις επιλεξιμότητας", en: "What the eligibility labels mean" },
    summary: { el: "Πώς να διαβάζετε τα αποτελέσματα στο «Για Εμένα» και γιατί δεν αποτελούν ποτέ οριστική απάντηση.", en: "How to read the results in \"For Me\", and why they are never a final answer." },
    sections: [
      { h: { el: "Οι ενδείξεις", en: "The labels" }, items: [
        { el: "«Πιθανώς επιλέξιμος/η»: όλες οι προϋποθέσεις που έχουμε καταγράψει φαίνεται να ικανοποιούνται με τις απαντήσεις σας.", en: "\"Potentially eligible\": every requirement we have recorded appears to be met by your answers." },
        { el: "«Πιθανώς — χρειάζεται επιβεβαίωση»: φαίνεται να ταιριάζει, αλλά ο φορέας θα ελέγξει κάποια στοιχεία με έγγραφα.", en: "\"Potentially — needs confirmation\": it appears to fit, but the authority will check some details with documents." },
        { el: "«Χρειάζονται περισσότερα στοιχεία»: λείπει μια απάντηση ή οι προϋποθέσεις δεν έχουν καταγραφεί πλήρως.", en: "\"More information needed\": an answer is missing or the requirements are not fully recorded." },
        { el: "«Μάλλον μη επιλέξιμος/η»: μια προϋπόθεση δεν φαίνεται να ικανοποιείται.", en: "\"Probably not eligible\": a requirement does not appear to be met." },
      ] },
      { h: { el: "Καλό να γνωρίζετε", en: "Good to know" }, items: [
        { el: "Οι απαντήσεις «Δεν είμαι σίγουρος/η» και «Προτιμώ να μην απαντήσω» δεν μετρούν ποτέ εναντίον σας.", en: "\"Not sure\" and \"Prefer not to answer\" never count against you." },
        { el: "Οι κατηγορίες, τα ενδιαφέροντα και οι κλάδοι βοηθούν μόνο στην αναζήτηση· δεν αλλάζουν την επιλεξιμότητα.", en: "Categories, interests and industries only help you find opportunities; they never change eligibility." },
        { el: "Την τελική απόφαση την παίρνει πάντα ο αρμόδιος φορέας.", en: "The responsible authority always makes the final decision." },
      ] },
    ],
  },
  {
    kind: "general", slug: "applying-officially",
    title: { el: "Πώς γίνεται μια αίτηση σε επίσημη πλατφόρμα", en: "How to apply on an official platform" },
    summary: { el: "Τα γενικά βήματα πριν και μετά την υποβολή. Για κάθε πρόγραμμα ισχύουν οι οδηγίες της επίσημης σελίδας του.", en: "The general steps before and after you submit. Each programme's official page sets its own rules." },
    sections: [
      { h: { el: "Πριν την αίτηση", en: "Before applying" }, items: [
        { el: "Ανοίξτε την επίσημη σελίδα από την καταχώριση και ελέγξτε την προθεσμία, τις προϋποθέσεις και τα δικαιολογητικά.", en: "Open the official page from the listing and check the deadline, requirements and documents." },
        { el: "Πολλές ελληνικές ηλεκτρονικές υπηρεσίες ζητούν σύνδεση με κωδικούς TAXISnet· η σελίδα κάθε υπηρεσίας το αναφέρει.", en: "Many Greek online services ask you to log in with TAXISnet credentials; each service's page says so." },
        { el: "Ετοιμάστε τα έγγραφα που ζητά η επίσημη σελίδα και όχι λίστες από άλλες πηγές.", en: "Prepare the documents the official page asks for, not lists from other sources." },
      ] },
      { h: { el: "Μετά την υποβολή", en: "After submitting" }, items: [
        { el: "Βεβαιωθείτε ότι η αίτηση υποβλήθηκε οριστικά και κρατήστε τον αριθμό ή το αποδεικτικό της.", en: "Make sure the application was finally submitted and keep its number or receipt." },
        { el: "Παρακολουθήστε τα αποτελέσματα και τις ανακοινώσεις στην επίσημη σελίδα του φορέα.", en: "Follow results and announcements on the authority's official page." },
      ] },
      { h: { el: "Προσοχή", en: "Please note" }, items: [
        { el: "Το Jackal Accountant δεν υποβάλλει αιτήσεις και δεν ζητά ποτέ κωδικούς ή πληρωμή.", en: "Jackal Accountant never submits applications and never asks for passwords or payment." },
        { el: "Αν μια σελίδα που δεν ανήκει σε δημόσιο φορέα ζητά κωδικούς ή χρήματα για μια αίτηση, μην προχωρήσετε.", en: "If a page that doesn't belong to a public authority asks for passwords or money for an application, don't proceed." },
      ] },
    ],
  },
];

export const ALL_GUIDES: Guide[] = [...GENERAL_GUIDES, ...PROGRAMME_GUIDES];
export const guideBySlug = (slug: string) => ALL_GUIDES.find((g) => g.slug === slug);
