/**
 * The two paths (owner decision, 22 Oct 2026): one platform, two experiences with the same navigation.
 *  - «Πολίτες» (citizen) at /politis
 *  - «Επιχειρήσεις & Επαγγελματίες» (business) at /epixeiriseis
 * Every opportunity, news article and guide belongs to exactly one path; unclassified records belong to none (HOLD).
 * The path lives in the address, so it survives navigation and sharing without an account or a cookie.
 * Server-free so it can be tested and used by client components.
 */
export const AUDIENCES = ["citizen", "business"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_SLUG: Record<Audience, string> = { citizen: "politis", business: "epixeiriseis" };

export function audienceFromSlug(slug: string | undefined | null): Audience | null {
  if (slug === "politis") return "citizen";
  if (slug === "epixeiriseis") return "business";
  return null;
}

export const otherAudience = (a: Audience): Audience => (a === "citizen" ? "business" : "citizen");

/** Sections of a path; the same five in both (owner: same navigation and functionality, different content). */
export const SECTION_SLUG = { opportunities: "eukairies", news: "nea", guides: "odigoi", about: "jackal", account: "logariasmos" } as const;
export type Section = keyof typeof SECTION_SLUG;

/** The five navigation tabs (owner, 23 Oct 2026): «Γνώση» replaces «Οδηγοί» in the navigation and is universal. */
export type NavItem = "opportunities" | "news" | "knowledge" | "about" | "account";
/** Γνώση (Knowledge): one address for everyone, outside the two paths. */
export const KNOWLEDGE_PATH = "/gnosi";
/** First-party cookie remembering the last path chosen, so universal pages can link back to it (no personal data). */
export const PATH_COOKIE = "jk_path";

const base = (a: Audience) => `/${AUDIENCE_SLUG[a]}`;

export const paths = {
  home: (a: Audience) => base(a),
  opportunities: (a: Audience, query?: string) => `${base(a)}/${SECTION_SLUG.opportunities}${query ? `?${query}` : ""}`,
  opportunity: (a: Audience, id: string) => `${base(a)}/${SECTION_SLUG.opportunities}/${id}`,
  news: (a: Audience) => `${base(a)}/${SECTION_SLUG.news}`,
  guides: (a: Audience) => `${base(a)}/${SECTION_SLUG.guides}`,
  guide: (a: Audience, slug: string) => `${base(a)}/${SECTION_SLUG.guides}/${slug}`,
  about: (a: Audience) => `${base(a)}/${SECTION_SLUG.about}`,
  account: (a: Audience) => `${base(a)}/${SECTION_SLUG.account}`,
};

/** Address of a record's detail page, in the record's own path; null for unclassified (HOLD) records. */
export function opportunityHref(row: { id: string; audience: Audience | null }): string | null {
  return row.audience ? paths.opportunity(row.audience, row.id) : null;
}

/**
 * Where «Αλλαγή» leads from the current address: the same section in the other path, with no filters, search or record
 * carried over (filters of one path have no meaning in the other; a record never appears in both).
 */
export function switchHref(pathname: string): string | null {
  const [, slug, section] = pathname.split("/");
  const a = audienceFromSlug(slug);
  if (!a) return null;
  const other = base(otherAudience(a));
  const known = Object.values(SECTION_SLUG) as string[];
  return section && known.includes(section) ? `${other}/${section}` : `${other}/${SECTION_SLUG.opportunities}`;
}
