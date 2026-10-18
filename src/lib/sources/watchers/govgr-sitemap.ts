/**
 * gov.gr new-service watcher (18 Oct 2026) — built and tested, NOT switched on (no schedule).
 *
 * Permitted route: gov.gr's robots.txt allows crawling except /api/, /_next/, user-area and oauth2login, and lists
 * https://www.gov.gr/sitemap.xml (checked 18 Oct 2026). The sitemap is one <urlset>; service pages look like
 * /el/services/<numeric id>/<transliterated slug> and carry NO <lastmod>, so this watcher can detect NEW and REMOVED
 * service pages (by URL), not content changes inside a page.
 *
 * Output is a review list only. Nothing here creates or changes an opportunity: a person reads each candidate page and
 * decides whether it becomes a checked record.
 */

export interface SitemapEntry { loc: string; lastmod: string | null }
export interface ServicePage { id: number; slug: string; lang: "el" | "en"; url: string }

/** Every <url><loc> in a sitemap <urlset> (tolerant of whitespace and CDATA; ignores anything else). */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = m[1] ?? "";
    const loc = block.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1] ?? null;
    out.push({ loc: loc.replace(/&amp;/g, "&"), lastmod });
  }
  return out;
}

/** A gov.gr service page, or null for any other page. */
export function servicePage(loc: string): ServicePage | null {
  const m = loc.match(/^https:\/\/www\.gov\.gr\/(el|en)\/services\/(\d+)\/([a-z0-9-]+)\/?$/);
  return m ? { lang: m[1] as "el" | "en", id: Number(m[2]), slug: m[3]!, url: loc } : null;
}

/**
 * Words (as gov.gr transliterates Greek in slugs: η→e, χ→kh, φ→ph, υ→u) that suggest a benefit, grant or programme.
 * Used ONLY to sort the review list; a person decides. Never an eligibility or relevance statement.
 */
export const BENEFIT_HINTS: Array<[string, string]> = [
  ["epidom", "επίδομα"], ["eniskhus", "ενίσχυση"], ["epidotes", "επιδότηση"], ["programm", "πρόγραμμα"], ["aitese", "αίτηση"],
  ["upotroph", "υποτροφία"], ["stegas", "στέγαση"], ["anerg", "ανεργία"], ["oikogen", "οικογένεια"], ["paidi", "παιδί"],
  ["phoitet", "φοιτητές"], ["katartis", "κατάρτιση"], ["exoikonom", "εξοικονόμηση"], ["agrot", "αγρότες"], ["tourismos-gia-olous", "τουρισμός για όλους"],
  ["voucher", "voucher"], ["neous", "νέους"], ["neon", "νέων"], ["epikheirematik", "επιχειρηματικότητα"], ["apozemios", "αποζημίωση"],
];

export function benefitHints(slug: string): string[] {
  return BENEFIT_HINTS.filter(([k]) => slug.includes(k)).map(([, label]) => label);
}

export interface Snapshot { taken_at: string; services: ServicePage[] }

/** Greek service pages only (the English pages mirror them), newest id first. */
export function snapshotOf(entries: SitemapEntry[], takenAt: Date): Snapshot {
  const services = entries.map((e) => servicePage(e.loc)).filter((s): s is ServicePage => !!s && s.lang === "el");
  services.sort((a, b) => b.id - a.id);
  return { taken_at: takenAt.toISOString(), services };
}

export interface WatchDiff { added: ServicePage[]; removed: ServicePage[]; first_run: boolean }

export function diffSnapshots(prev: Snapshot | null, curr: Snapshot): WatchDiff {
  if (!prev) return { added: [], removed: [], first_run: true };
  const before = new Set(prev.services.map((s) => s.id));
  const now = new Set(curr.services.map((s) => s.id));
  return {
    added: curr.services.filter((s) => !before.has(s.id)),
    removed: prev.services.filter((s) => !now.has(s.id)),
    first_run: false,
  };
}

/** Review list: newest service pages that carry a benefit hint (first run), or all added pages (later runs). */
export function reviewList(curr: Snapshot, diff: WatchDiff, newestN = 60) {
  const pool = diff.first_run ? curr.services.slice(0, newestN) : diff.added;
  return pool.map((s) => ({ ...s, hints: benefitHints(s.slug) })).sort((a, b) => (b.hints.length > 0 ? 1 : 0) - (a.hints.length > 0 ? 1 : 0) || b.id - a.id);
}

/** robots.txt check for the paths this watcher reads (User-Agent: * group only, longest-match Allow/Disallow). */
export function robotsAllows(robots: string, path: string): boolean {
  let inStar = false; const rules: Array<{ allow: boolean; p: string }> = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const [k, v] = [m[1]!.toLowerCase(), m[2]!.trim()];
    if (k === "user-agent") inStar = v === "*";
    else if (inStar && (k === "allow" || k === "disallow") && v) rules.push({ allow: k === "allow", p: v });
  }
  const hits = rules.filter((r) => path.startsWith(r.p)).sort((a, b) => b.p.length - a.p.length);
  return hits.length === 0 ? true : hits[0]!.allow;
}
