/** gov.gr new-service watcher: parsing, robots rules, diffing and the review list (no network). */
import { describe, expect, it } from "vitest";
import { benefitHints, diffSnapshots, parseSitemap, reviewList, robotsAllows, servicePage, snapshotOf } from "@/lib/sources/watchers/govgr-sitemap";

const XML = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://www.gov.gr/el</loc><changefreq>weekly</changefreq></url>
<url><loc>https://www.gov.gr/el/services/1002436/eniaia-aitese-eniskhuses-2026-myagro</loc></url>
<url><loc>https://www.gov.gr/en/services/1002436/eniaia-aitese-eniskhuses-2026-myagro</loc></url>
<url><loc>https://www.gov.gr/el/services/1002431/metroo-anaklemenon-dioiketikon-praxeon</loc></url>
<url><loc> <![CDATA[https://www.gov.gr/el/services/1002430/tourismos-gia-olous-2026-2027]]> </loc><lastmod>2026-10-10</lastmod></url>
</urlset>`;
const ROBOTS = `User-Agent: *\nAllow: /\nDisallow: /api/\nDisallow: /_next/\nDisallow: /el/user-area\nSitemap: https://www.gov.gr/sitemap.xml`;

describe("gov.gr watcher", () => {
  it("reads every url, including CDATA and lastmod", () => {
    const e = parseSitemap(XML);
    expect(e).toHaveLength(5);
    expect(e[4]).toEqual({ loc: "https://www.gov.gr/el/services/1002430/tourismos-gia-olous-2026-2027", lastmod: "2026-10-10" });
  });
  it("recognises service pages and keeps Greek ones, newest first", () => {
    expect(servicePage("https://www.gov.gr/el")).toBeNull();
    const s = snapshotOf(parseSitemap(XML), new Date("2026-10-18T08:00:00Z"));
    expect(s.services.map((x) => x.id)).toEqual([1002436, 1002431, 1002430]);
  });
  it("respects robots.txt", () => {
    expect(robotsAllows(ROBOTS, "/sitemap.xml")).toBe(true);
    expect(robotsAllows(ROBOTS, "/el/services/1002436/x")).toBe(true);
    expect(robotsAllows(ROBOTS, "/api/v1")).toBe(false);
    expect(robotsAllows(ROBOTS, "/el/user-area/x")).toBe(false);
  });
  it("first run reports nothing as new; later runs report added and removed pages", () => {
    const first = snapshotOf(parseSitemap(XML), new Date("2026-10-18T08:00:00Z"));
    expect(diffSnapshots(null, first)).toEqual({ added: [], removed: [], first_run: true });
    const xml2 = XML.replace("</urlset>", `<url><loc>https://www.gov.gr/el/services/1002441/neo-epidoma-paidiou</loc></url></urlset>`)
      .replace(/<url><loc>https:\/\/www\.gov\.gr\/el\/services\/1002431[^]*?<\/url>/, "");
    const second = snapshotOf(parseSitemap(xml2), new Date("2026-10-19T08:00:00Z"));
    const d = diffSnapshots(first, second);
    expect(d.added.map((x) => x.id)).toEqual([1002441]);
    expect(d.removed.map((x) => x.id)).toEqual([1002431]);
    expect(reviewList(second, d)[0]!.hints).toContain("επίδομα");
  });
  it("benefit hints only sort the list", () => {
    expect(benefitHints("eniaia-aitese-eniskhuses-2026-myagro")).toEqual(expect.arrayContaining(["ενίσχυση", "αίτηση"]));
    expect(benefitHints("metroo-anaklemenon-dioiketikon-praxeon")).toEqual([]);
  });
});
