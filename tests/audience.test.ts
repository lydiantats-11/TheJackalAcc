/**
 * Two paths, one platform (owner approval, 22 Oct 2026): «Πολίτες» (/politis) and «Επιχειρήσεις & Επαγγελματίες»
 * (/epixeiriseis). Every programme, news article and guide belongs to exactly one path; unclassified records to none.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AUDIENCES, AUDIENCE_SLUG, audienceFromSlug, opportunityHref, otherAudience, paths, switchHref } from "@/lib/site/audience";
import { NEWS_ARTICLES, NEWS_SOURCES, newsOf } from "@/lib/site/news";
import { ARTICLES, articleAudience, guidesOf, isPlatformGuide } from "@/lib/site/guide-catalog";
import { APPROVED_RECORDS } from "@/lib/site/guide-catalog";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const seedRaw = read("db/seed/audience-2026-10-22.sql");
/** The seed without SQL comments (comments may contain quotes and words like "deleted"). */
const seed = seedRaw.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
const business = JSON.parse(read("data/business-records-2026-10-20.json")).records as Array<Record<string, any>>;

/** Keys listed in one UPDATE … SET audience = '<a>' … IN (…) block of the seed. */
function keysFor(a: "citizen" | "business"): string[] {
  const block = seed.match(new RegExp(`SET audience = '${a}' WHERE external_key IN \\(([\\s\\S]*?)\\);`))?.[1] ?? "";
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}
const citizen = keysFor("citizen");
const biz = keysFor("business");

describe("paths and addresses", () => {
  it("has exactly two paths with Greek slugs", () => {
    expect(AUDIENCES).toEqual(["citizen", "business"]);
    expect(AUDIENCE_SLUG).toEqual({ citizen: "politis", business: "epixeiriseis" });
    expect(audienceFromSlug("politis")).toBe("citizen");
    expect(audienceFromSlug("epixeiriseis")).toBe("business");
    for (const x of ["", "opportunities", "Politis", "politis/", null, undefined]) expect(audienceFromSlug(x as never)).toBeNull();
    expect(otherAudience("citizen")).toBe("business");
  });
  it("the same five sections exist in both paths", () => {
    for (const a of AUDIENCES) {
      const base = `/${AUDIENCE_SLUG[a]}`;
      expect([paths.opportunities(a), paths.news(a), paths.guides(a), paths.about(a), paths.account(a)])
        .toEqual([`${base}/eukairies`, `${base}/nea`, `${base}/odigoi`, `${base}/jackal`, `${base}/logariasmos`]);
    }
  });
  it("«Αλλαγή» keeps the section and drops filters, search and the record", () => {
    expect(switchHref("/politis/eukairies")).toBe("/epixeiriseis/eukairies");
    expect(switchHref("/politis/eukairies/2b1c0b7e-1111-4222-8333-444455556666")).toBe("/epixeiriseis/eukairies");
    expect(switchHref("/epixeiriseis/odigoi/eic")).toBe("/politis/odigoi");
    expect(switchHref("/epixeiriseis/nea")).toBe("/politis/nea");
    expect(switchHref("/politis/logariasmos")).toBe("/epixeiriseis/logariasmos");
    expect(switchHref("/politis")).toBe("/epixeiriseis/eukairies");
    expect(switchHref("/")).toBeNull();
    expect(switchHref("/about")).toBeNull();
  });
  it("a record's address is in its own path; an unclassified record has none", () => {
    expect(opportunityHref({ id: "x", audience: "business" })).toBe("/epixeiriseis/eukairies/x");
    expect(opportunityHref({ id: "x", audience: null })).toBeNull();
  });
});

describe("classification of the approved records (seed of 22 Oct 2026)", () => {
  it("9 citizen and 10 business records, none in both", () => {
    expect(citizen).toHaveLength(9);
    expect(biz).toHaveLength(10);
    expect(new Set([...citizen, ...biz]).size).toBe(19);
    expect(citizen.filter((k) => biz.includes(k))).toEqual([]);
  });
  it("every approved hand-checked record is citizen", () => {
    for (const id of APPROVED_RECORDS) expect(citizen).toContain(`manual:${id}`);
  });
  it("each of the 11 business-batch calls is classified once, by who applies under the official call", () => {
    for (const r of business) expect([...citizen, ...biz].filter((k) => k === r.external_key)).toHaveLength(1);
    const keyOf = (id: string) => business.find((r) => r.id === id)!.external_key;
    expect(citizen).toContain(keyOf("epiro-nea-eykairia")); // natural persons starting an activity
    for (const id of ["dam21", "dam24", "crete-kainotomo"]) expect(biz).toContain(keyOf(id)); // owner decision
    // A call whose applicants are only natural persons is citizen; a call whose applicants include no natural person is business.
    for (const r of business) {
      const persons = r.applicants.every((t: string) => t === "natural_person" || t === "unregistered_entrepreneur");
      if (persons) expect(citizen).toContain(r.external_key);
      if (!r.applicants.includes("natural_person") && r.id !== "epiro-nea-eykairia") expect(biz).toContain(r.external_key);
    }
  });
  it("EU Funding & Tenders calls stay unclassified (HOLD): first everything is reset, nothing is deleted", () => {
    expect(seed).toContain("UPDATE opportunities SET audience = NULL;");
    expect(seed).not.toMatch(/eu-topic:/);
    expect(seed).not.toMatch(/\bDELETE\b/i);
  });
  it("the database allows only one of the two values, or none", () => {
    const m = read("db/migrations/0011_audience.sql");
    expect(m).toContain("audience text CHECK (audience IS NULL OR audience IN ('citizen', 'business'))");
  });
});

describe("filtering happens where the data is read", () => {
  const data = read("src/lib/data/opportunities.ts");
  const listing = read("src/lib/site/listing.ts");
  it("the public listing requires a path and applies it in the query", () => {
    expect(listing).toMatch(/export async function loadListing\(sql: postgres\.Sql, audience: Audience,/);
    expect(listing).toContain("audience })).filter((r) => r.audience === audience)");
    expect(data).toContain("AND o.audience = ${f.audience}");
  });
  it("a record with no path is never served, not even by direct address", () => {
    expect(data).toMatch(/getOpportunity[\s\S]*?AND o\.audience IS NOT NULL/);
  });
  it("every page under a path checks the path and a record of the other path redirects", () => {
    const dir = join(root, "src/app/[aud]");
    const pages: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === "page.tsx") pages.push(p); } };
    walk(dir);
    expect(pages.length).toBeGreaterThanOrEqual(7);
    for (const p of pages) expect(readFileSync(p, "utf8")).toContain("audienceParam(params)");
    const detail = read("src/app/[aud]/eukairies/[id]/page.tsx");
    expect(detail).toContain("if (o.audience !== aud) redirect(");
  });
  it("no public page or component links to the old mixed addresses", () => {
    const files = ["src/components/opportunity-card.tsx", "src/components/brief.tsx", "src/components/guide-ui.tsx", "src/app/page.tsx",
      "src/app/[aud]/eukairies/page.tsx", "src/app/[aud]/eukairies/[id]/page.tsx", "src/app/[aud]/odigoi/page.tsx",
      "src/app/[aud]/odigoi/[slug]/page.tsx", "src/app/[aud]/logariasmos/page.tsx", "src/app/[aud]/nea/page.tsx", "src/app/layout.tsx"];
    for (const f of files) expect(read(f), f).not.toMatch(/["`]\/(opportunities|guides|for-me|categories)(["`/?$])/);
  });
  it("the home page shows no opportunities, news or guides", () => {
    const home = read("src/app/page.tsx");
    expect(home).not.toMatch(/loadListing|OpportunityCard|FeedPanel|GUIDES|newsOf/);
    expect(home).toContain('paths.opportunities("citizen")');
    expect(home).toContain('paths.opportunities("business")');
  });
});

describe("news: one path per article, one shared official source record", () => {
  it("every article has one path and points to an existing source record", () => {
    for (const a of NEWS_ARTICLES) {
      expect(AUDIENCES).toContain(a.audience);
      expect(NEWS_SOURCES.some((s) => s.id === a.source)).toBe(true);
      // Official facts live on the source record only, never copied into the article.
      expect(Object.keys(a).sort()).toEqual(["audience", "id", "source", "summary", "tags", "title"]);
    }
    expect(new Set(NEWS_ARTICLES.map((a) => a.id)).size).toBe(NEWS_ARTICLES.length);
  });
  it("the same law explained to both audiences uses ONE source record and two articles", () => {
    const e2060 = NEWS_ARTICLES.filter((a) => a.source === "aade-e2060-2026");
    expect(e2060.map((a) => a.audience).sort()).toEqual(["business", "citizen"]);
    expect(NEWS_SOURCES.filter((s) => s.id === "aade-e2060-2026")).toHaveLength(1);
    expect(e2060[0]!.title.el).not.toBe(e2060[1]!.title.el);
  });
  it("only manually verified items with an official link are published; each source is used", () => {
    for (const s of NEWS_SOURCES) {
      expect(s.verification).toBe("manually_verified");
      expect(s.url).toMatch(/^https:\/\//);
      expect(NEWS_ARTICLES.some((a) => a.source === s.id)).toBe(true);
    }
  });
  it("a path's news never contains the other path's articles", () => {
    for (const a of AUDIENCES) expect(newsOf(a).every((x) => x.article.audience === a)).toBe(true);
  });
});

describe("guides: one path each", () => {
  it("every programme and procedure guide has exactly one path; platform explainers have none", () => {
    for (const a of ARTICLES) {
      if (isPlatformGuide(a)) expect(articleAudience(a)).toBeNull();
      else expect(AUDIENCES).toContain(articleAudience(a));
    }
  });
  it("no guide is listed in both paths", () => {
    const c = guidesOf("citizen").map((a) => a.slug);
    const b = guidesOf("business").map((a) => a.slug);
    expect(c.filter((x) => b.includes(x))).toEqual([]);
    expect(c.length).toBeGreaterThan(0);
  });
  it("a programme guide is in the same path as its programme", () => {
    for (const a of ARTICLES) {
      const id = a.recordKey?.replace(/^manual:/, "");
      if (!id || !APPROVED_RECORDS.has(id)) continue;
      expect(articleAudience(a)).toBe(citizen.includes(`manual:${id}`) ? "citizen" : "business");
    }
  });
});
