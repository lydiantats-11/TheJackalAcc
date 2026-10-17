/**
 * Search text helpers shared by Opportunities and Guides (Milestone 2, 17 Oct 2026).
 * Case-insensitive, accent-insensitive Greek and English, final sigma folded; a small, reviewed list of synonyms.
 * No fuzzy matching: every query word (or one of its listed synonyms) must appear in the text.
 */

/** Lower case, no accents, final sigma folded: «Επίδομα» and "επιδομα" match. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
}

/** Query words (folded), ignoring one-letter words and punctuation. */
export function words(q: string): string[] {
  return fold(q).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
}

/**
 * Reviewed synonym groups (folded stems). A query word matching a stem in a group also matches the group's other stems.
 * Only everyday equivalents between Greek and English or common Greek variants — nothing that widens meaning.
 */
const SYNONYMS: string[][] = [
  ["επιδομ", "παροχ", "benefit", "allowance"],
  ["ανεργ", "unemploy", "jobseek"],
  ["στεγασ", "στεγαστικ", "housing", "κατοικι", "home"],
  ["επιδοτησ", "επιχορηγησ", "grant", "subsid"],
  ["εσπα", "espa"],
  ["παιδι", "child", "οικογενει", "family"],
  ["φοιτητ", "student"],
  ["καταρτισ", "training"],
  ["φορολογ", "tax"],
  ["νεοι", "νεων", "youth", "young"],
  ["επιχειρηματ", "entrepreneur", "startup", "business"],
];

/** Alternatives for one query word: itself plus the stems of any synonym group it belongs to. */
export function alternatives(word: string): string[] {
  const group = SYNONYMS.find((g) => g.some((stem) => word.startsWith(stem) || (stem.length >= 4 && stem.startsWith(word) && word.length >= 4)));
  return group ? [word, ...group] : [word];
}

/** True when every query word (or a synonym) appears in the folded haystack. */
export function matches(haystack: string, q: string): boolean {
  const ws = words(q);
  if (ws.length === 0) return true;
  const h = fold(haystack);
  return ws.every((w) => alternatives(w).some((a) => h.includes(a)));
}
