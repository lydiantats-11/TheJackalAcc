# 04 — Imports and sources

## What is automated

| Source | Code | Status (23 Oct 2026) |
| --- | --- | --- |
| EU Funding & Tenders Portal — grant topics | `src/lib/sources/adapters/eu-funding-tenders.ts`, `eu-ft-details.ts` | Live-tested; runs in CI on every preview (1,009 calls on 23 Oct). **No schedule** in production |
| gov.gr sitemap — new and removed service pages | `src/lib/sources/watchers/govgr-sitemap.ts` | Built and unit-tested; produces a review list only. Its last live CI test (18 Oct) failed and was not investigated |

Everything else — Greek benefits, ΕΣΠΑ calls, tax incentives, DiscoverEU — is **hand-checked** against official
documents and enters through JSON files and generated seeds (see [03](03-database.md)). `docs/SOURCE_COVERAGE.md`
lists each candidate source and what blocks it: ΕΣΠΑ, ΔΥΠΑ and ΓΓΕΚ refused automated reading; Διαύγεια has an
official API that has not been tried; TED is documented but not built.

## EU Funding & Tenders connector

- The portal's search endpoint has no official documentation. Its shape was taken from open-source clients and
  confirmed live on 14 Oct 2026 (`scripts/eu-ft-paging-probe.ts`; results on the `live-test-results` branch).
- The parser is defensive. A field it cannot read stays unknown, and unknown status codes become «unverified». Items
  without an official URL are skipped, and an unrecognisable response raises `SchemaDriftError`, so nothing is
  ingested.
- Details come from the API's own structured fields: budget, action types, deadline model, call id, conditions.
  A value the portal leaves at 0 means «not published», not zero.
- Calls arrive with `audience = NULL`, so they appear in **neither path**. Who may apply (individuals, companies,
  universities, consortia) must be classified from `topicConditions` and the call documents before any call is
  shown. That classification is not built; it is the main import task left ([11](11-backlog.md)).

## Ingestion pipeline (`src/lib/ingestion`)

Guarantees, each covered by `tests/ingestion.test.ts`:

- The same item imported twice gives one opportunity, one document and no second event.
- An item already known from another source creates no duplicate. Differing deadlines become a conflict, never an
  overwrite.
- Changed facts snapshot the previous state into `opportunity_versions`.
- Stale items are ignored, and a closed call is never «reopened» without newer evidence.
- Only one run per source at a time (advisory lock). A failed run changes no opportunity, because an outage is not a
  closure. Each item runs in its own transaction, and interrupted runs are detected on the next start.
- Network access goes through an SSRF-safe fetcher limited to allowed official hosts, with bounded retries.

## Worker (`worker/index.ts`)

```bash
npm run worker                         # loop every 60 s: due sources, deadline sweep, retention, heartbeat
npm run worker -- --once               # one pass
npm run worker -- --test <slug>        # run one source now, even if disabled (CI uses eu-funding-tenders)
npm run worker -- --recalc             # recompute stored matches
npm run worker -- --extract <opportunity-id> <document-url> <admin-email>   # AI extraction → review queue (off)
```

## Switching on automatic updates

Prepared, not done: `docs/AUTOMATIC_UPDATES.md` describes GitHub Actions plus a free EU-region Postgres (Neon). The
workflows `scheduled-updater.yml` and `setup-live-database.yml` exist on `consolidation` but GitHub can only start
workflows that exist on the default branch, so they cannot run until `main` is updated. The owner has not approved
hosting or schedules.

## Generators and importers (`scripts/`)

| Script | Input → output |
| --- | --- |
| `build_official_seed.py` | `data/official-records-2026-10-14.v2.json` → `db/seed/official-records-2026-10-14.sql` |
| `build_business_seed.py` | `data/business-records-2026-10-20.json` → `db/seed/business-records-2026-10-20.sql` |
| `build_corrections_2026_10_23.py` | `data/official-records-corrections-2026-10-22.json` → `db/seed/corrections-2026-10-23.sql` |
| `import_knowledge_register.py` | K1 Excel workbook → `data/knowledge/register.json` (refuses rows marked approved without review) |
