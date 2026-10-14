# Official source registry — research findings

Last researched: **2026-10-13**. Method: web research tools (search + page fetch). The build workspace itself
cannot open connections to these sites (network allowlist), so **no source has been live-tested by the platform yet**.

Legend for *Access*: **verified** = a real platform run succeeded · **untested** · **undocumented** = reachable
in principle but no official documentation · **blocked (robots)** = automated fetch refused by robots rules ·
**inaccessible** = attempted and failed.

## Summary

| Source | Access method | Auth | Access status | Connector | Next step |
|---|---|---|---|---|---|
| EU Funding & Tenders Portal | Search endpoint (POST, JSON) | none (public key `SEDIA`) | **undocumented**; live attempt from workspace failed (DNS) | ✅ built, tested on synthetic fixtures | Owner runs `npm run worker -- --test eu-funding-tenders` |
| TED (EU procurement) | Official Search API v3 | none for published notices | untested | ⬜ next | Build connector (documented API) |
| gov.gr | Sitemap + pages | none | untested; robots allows (except `/api/`) | ⬜ | Sitemap change-detection connector |
| gov.gr — Επιδοτήσεις πολιτών | HTML category page | none | untested; allowed path | ⬜ | Mostly citizen benefits; needs classification |
| ΕΣΠΑ (espa.gr) | HTML | — | **blocked (robots)** for research tool | ✖ none | Owner checks robots.txt/terms; use Diavgeia instead |
| ΔΥΠΑ (dypa.gov.gr) | HTML | — | **blocked (robots)** | ✖ none | Owner checks robots.txt/terms |
| ΓΓΕΚ (gsri.gov.gr) | HTML | — | **blocked (robots)** | ✖ none | Owner checks robots.txt/terms |
| Elevate Greece | HTML | unknown | untested (robots.txt request errored) | ✖ none | Re-check |
| Διαύγεια (diavgeia.gov.gr) | Open-data API (to confirm) | unknown | untested — site in emergency maintenance on 2026-10-13 | ⬜ candidate | Retrieve API docs; filter decisions that are calls (προσκλήσεις) |

## Details

### EU Funding & Tenders Portal
- **Endpoint:** `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=***&pageSize=N&pageNumber=P`
  with multipart parts `query` and `languages`, each sent as a file part with `Content-Type: application/json`.
  Query grammar accepts `bool`/`must`/`terms` only.
- **Codes:** `type` 1 = grant topics, 2 = tenders. `status` 31094501 Forthcoming, 31094502 Open, 31094503 Closed.
- **Response:** `results[]`, each with `metadata` whose values are single-element arrays; some fields are JSON
  encoded as strings (`budgetOverview`, `actions`); condition texts are raw HTML.
- **Documentation:** none official. Shape known from independent open-source clients
  ([AarhusAI/eu-funding-tenders-portal-agent](https://github.com/AarhusAI/eu-funding-tenders-portal-agent),
  [pipeworx-io/mcp-eu-funding-tenders](https://github.com/pipeworx-io/mcp-eu-funding-tenders)); one of them states
  nothing about the endpoint is guaranteed. [EMDESK's overview](https://www.emdesk.com/horizon-2020-horizon-europe-basics-guide/eu-funding-tenders-portal-api-guide)
  says published opportunity data can be read anonymously and that quotas exist but are not published.
- **Our safeguards:** 6-hour interval, ≤20 pages × 100 per run, bounded retries; schema-drift detection fails the
  run without ingesting; items without an official URL are skipped (we never construct links); unknown status
  codes stored as "unverified"; eligibility conditions are **not** taken from this API (unstructured HTML) — they
  will be extracted and reviewed in Phase 3.
- **Licence:** Commission content is generally reusable (Decision 2011/833/EU) — applicability to this endpoint
  still to be confirmed.

### TED
- Official documentation: [TED API](https://docs.ted.europa.eu/api/latest/index.html) — all APIs on
  `api.ted.europa.eu`; [Search API](https://docs.ted.europa.eu/api/latest/search.html) is `POST /v3/notices/search`
  and needs no API key for published notices. Expert queries from the TED website can be reused. Rate limits are not
  stated on those pages. Legal notice: <https://ted.europa.eu/en/legal-notice>.

### gov.gr
- robots.txt (read 2026-10-13): general crawling allowed; `/api/`, Next.js assets and login/user areas disallowed;
  sitemap at `/sitemap.xml`. The permitted route is sitemap-based change detection of public pages.

### espa.gr, dypa.gov.gr, gsri.gov.gr
- Our research tool's request for `/robots.txt` was **refused by the site's robots rules**. We could not read the
  file's contents, so we cannot say what is allowed for other agents. **No scraper will be built** until the owner
  opens each `https://<site>/robots.txt` and terms-of-use page in a browser and records the result.
- Permitted alternative to investigate: Greek public bodies publish calls as decisions on **Διαύγεια**
  (official open-data transparency portal).

## Owner checklist (needs a normal browser, ~15 minutes)
1. Open `https://www.espa.gr/robots.txt`, `https://www.dypa.gov.gr/robots.txt`, `https://gsri.gov.gr/robots.txt`,
   `https://elevategreece.gov.gr/robots.txt`; copy the text into an issue/doc for me.
2. From your own computer: `npm run worker -- --test eu-funding-tenders` (see README). Send me the JSON it prints.
