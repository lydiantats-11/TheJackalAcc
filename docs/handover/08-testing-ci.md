# 08 — Testing and CI

## Test suites

- `npm test` runs vitest over `tests/**/*.test.ts`: 37 files, 424 tests on 23 Oct 2026.
- Tests that need PostgreSQL use `tests/db-helper.ts`. They run only when `TEST_DATABASE_URL` is set, rebuild a fresh
  schema per file, and run serially.

| Area | Main files |
| --- | --- |
| Engine and profile | `engine`, `real-calls`, `question-impact`, `scenarios-and-money`, `personas`, `industries`, `residence-and-records` |
| Records and credibility | `credibility`, `credibility-money`, `corrections-2026-10-22`, `corrections-2026-10-23`, `record-audit`, `record-status`, `official-details`, `business-records`, `apply-cta`, `guide-status`, `guides-catalog`, `document-lists` |
| Database and imports | `ingestion`, `end-to-end-flow`, `auth-and-access`, `profile-update`, `extraction`, `seed-corrections-db`, `change-detection`, `discovery`, `govgr-watch` |
| Site | `audience`, `i18n`, `taxonomy`, `brief-feed`, `proxy`, `knowledge`, `daily-report`, `status-and-sources`, `decision-record` |

`tests/manual/` holds manual test notes; `tests/fixtures/` holds recorded API responses.

## CI workflows (`.github/workflows/`)

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `design-preview.yml` | Push to `preview`, or manual | The main check. Typecheck, tests (with PostgreSQL), database with real data (all seeds + live EU import), quality report, build, browser screenshots and checks. **Any failure fails the run**; logs and screenshots are saved to the `live-test-results` branch (`previews/latest/`) |
| `static-snapshot.yml` | Push to `snapshot`, or manual | Builds the private static preview copy (`snapshot/latest/`) |
| `live-connector-test.yml` | Push to `live-test`, or manual | Live test of the EU connector |
| `govgr-watch-test.yml` | Push to `govgr-test`, or manual | Live test of the gov.gr watcher (last run 18 Oct failed) |
| `eu-ft-paging-probe.yml` | Push to `probe`, or manual | Measures the EU API's paging |
| `scheduled-updater.yml` | Manual only (schedule commented out) | Production updater — needs a database secret; see [04](04-imports.md) |
| `setup-live-database.yml` | Manual only | Creates a production database from scratch — never run |

Workflow habit used so far:

```bash
git push origin HEAD:consolidation HEAD:preview   # every change
git push origin HEAD:snapshot                     # when the owner should see a new preview copy
```

## The failure gate

The test and check steps keep going after a failure so that every log is saved. The last step, «Fail the run if any
check failed», turns the run red if any of these failed:

- typecheck, tests or the quality report;
- any browser check: records, audience separation, Γνώση.

Proven on 23 Oct with a deliberately failing test (run 39956490515, branch `ci-failcheck`, which the owner will
delete).

## Browser checks (`scripts/*.mjs`, Playwright)

| Script | Checks |
| --- | --- |
| `audience-check.mjs` | No programme, news item or guide appears in the wrong path |
| `record-shots.mjs` | The 10 key records: apply button, deadline lines, pending labels, 5Α/5Β tables, before/after screenshots |
| `knowledge-shots.mjs` | Γνώση on desktop and phone, EL and EN, for two servers. With drafts: banner, 166 terms each once, «content in preparation» on the 126 terms without text, home page lists nothing until a search, the owner's search examples, section order, all 8 topic pages with their sections (221 entries, each once), the comparison placeholder with no values. Production-like: no draft, no test entry, unapproved IDs give «not found» |

## Quality report

`scripts/quality-report.ts` covers the gold set, coverage, freshness and efficiency. It writes `quality-report.json`
(23 Oct: 1,028 records, no failures).

## Rules when changing code

- Every owner-approved correction gets a regression test naming the decision and its date (see
  `corrections-2026-10-23.test.ts`).
- Never weaken a database constraint or a test to make CI pass; find the cause.
