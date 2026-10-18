# Source coverage — why the Greek catalogue is small (17 Oct 2026)

Milestone 2 report. Figures come from the latest preview quality report (`previews/latest/quality-report.json`,
17 Oct 2026, 09:39 UTC) and the source registry (`db/seed/sources.ts`). Nothing below is an estimate.

## What the catalogue holds today

| Origin | Records | How they arrive | Greek text |
| --- | --- | --- | --- |
| EU Funding & Tenders Portal (API) | 1,000 (one import run, 17 Oct preview) | Official search API, tested connector; **updater off** | No — official titles are English |
| Hand-checked official records | 12 (7 Greek: άρθρα 5Γ, 5Β, 5Α ΚΦΕ, «Σπίτι μου ΙΙ», φοιτητικό στεγαστικό, Α21, επίδομα ανεργίας; 4 EU: DiscoverEU, ESC, EIC, TED; 1 Spanish comparison: «Beckham Law») | Read by hand from official pages on 14 Oct, approved 15 Oct | Yes, EL and EN |
| Synthetic examples | 6 (preview database only) | Seed script, always labelled «Δοκιμαστικό» | Yes |

Consequences visible on the site: only 0.8% of records are bilingual; 58.5% of records are «unverified» in the freshness
sense (imported once, not re-checked since); applicant type is recorded only for the 12 hand-checked records, so EU calls
show «Δεν έχει καταγραφεί ποιος κάνει αίτηση».

## Why there are so few Greek records

Every Greek source in the registry is still `adapter: manual`. None has a tested connector:

| Source | Access route | Status on 13 Oct 2026 | What is needed |
| --- | --- | --- | --- |
| gov.gr (sitemap) | Sitemap change detection | robots.txt allows general crawling and lists /sitemap.xml | Build and test a sitemap connector that flags changed benefit pages for human review |
| gov.gr — Επιδοτήσεις πολιτών | One category page | Allowed path per robots.txt | Same connector; each page needs classification (mostly citizen benefits) |
| ΕΣΠΑ (espa.gr) | — | robots rules refused our research tool | Owner to inspect robots.txt and terms in a browser; alternative is Diavgeia |
| Διαύγεια | Official open-data API | Site in emergency maintenance; API documentation not yet retrieved | Retrieve the API documentation, then test search by issuing body for ΕΣΠΑ calls |
| ΔΥΠΑ | — | robots rules refused our research tool | Owner inspection first; programmes stay hand-checked meanwhile |
| ΓΓΕΚ (gsri.gov.gr) | — | robots rules refused our research tool | Owner inspection first |
| Elevate Greece | — | robots.txt could not be retrieved | Retry and research |
| TED (EU tenders) | Official Search API v3, no key | Documented; connector not built | Lower priority: public tenders rarely concern individuals |

## Recommended order (needs owner approval; nothing is switched on)

1. **gov.gr sitemap connector** — permitted route, covers most citizen benefits. Detect changes only; every new or changed
   page goes to the review queue, never straight to the public list.
2. **Διαύγεια API** for ΕΣΠΑ calls, once the API documentation is retrieved and tested.
3. **Owner check of robots.txt and terms** for espa.gr, dypa.gov.gr and gsri.gov.gr (from a normal browser), recorded in
   the registry before any automated reading.
4. **Applicant type for EU calls**: add a reviewed `applicant_type` requirement per call, starting with calls open to
   individuals (DiscoverEU-like mobility, ESC), so they can appear in personal results.

Until a live connector has been tested, the site must not claim automatic updates (owner rule).

## What Milestone 2 changed on the discovery side

- Search folds case, Greek accents and final sigma, and uses a short reviewed list of Greek↔English synonyms
  (`src/lib/text/search.ts`). Opportunities and Guides share it.
- New filter «Ποιος κάνει αίτηση» and quick views (Όλες · Για ιδιώτες στην Ελλάδα · Ελλάδα · ΕΕ).
- Default order, explained on the page: current first; open to individuals, then not recorded, then organisations only;
  Greek before EU; nearest deadline. Ordering never removes a record and never changes eligibility.
- Code-only EU titles (e.g. "SOCPL-2026-INFO-REPR") show the official call title when the portal provides one; otherwise
  the card says the title is the programme code.
- English-only records carry a «Στα αγγλικά» tag on Greek pages.

## Update 18 Oct 2026 — gov.gr watcher built, live test refused

- Built: `src/lib/sources/watchers/govgr-sitemap.ts` + `scripts/govgr-watch.ts` + manual-only workflow
  `.github/workflows/govgr-watch-test.yml` (no schedule). It reads robots.txt and the sitemap, lists NEW and REMOVED
  service pages (`/el/services/<id>/<slug>`; the sitemap has no `<lastmod>`, so content changes inside a page are not
  visible this way) and writes a review list. It creates no opportunity. 5 tests on a fixture sitemap pass.
- Robots.txt (read with our research tool, 18 Oct): allows everything except /api/, /_next/, user-area and oauth2login;
  lists https://www.gov.gr/sitemap.xml. The sitemap is one urlset; service ids rise over time (newest seen: 1002440).
- **Live test, 18 Oct: gov.gr answered HTTP 403 to the automated test machine (GitHub Actions), already for
  robots.txt.** We did not try to get around this (no browser disguise, no other routes). Until gov.gr allows it, the
  watcher cannot run unattended.
- Options for the owner: (1) ask gov.gr / ΓΓΠΣ for permission or an official feed for new services; (2) check whether
  data.gov.gr publishes the services catalogue as open data; (3) run the watcher by hand from an allowed network.
