# 01 — Getting started

## Requirements

- Node.js 22 (CI uses 22; `package.json` has no engines field yet).
- PostgreSQL 15 or 16 (CI uses the `postgres:16` image).
- For browser checks and the preview copy: Playwright with Chromium.

## Clone and run

```bash
git clone https://github.com/lydiantats-11/TheJackalAcc.git
cd TheJackalAcc
git checkout consolidation            # the work is here; main has only the initial commit
npm install
cp .env.example .env.local            # set DATABASE_URL; never commit .env.local
```

Local database with Docker:

```bash
docker run -d --name jackal-pg -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=jackal -p 5432:5432 postgres:16
# DATABASE_URL=postgres://app:app@127.0.0.1:5432/jackal
```

## Load the same data as the preview

This is exactly what CI does in «Database with real data» (`.github/workflows/design-preview.yml`). The order matters:
later files correct earlier ones.

```bash
npm run db:migrate                                   # 11 migrations, safe to re-run
npm run db:seed                                      # categories, source registry, labelled synthetic examples
for f in official-records-2026-10-14 approvals-2026-10-15 business-records-2026-10-20 approvals-2026-10-20 audience-2026-10-22; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/seed/$f.sql
done
psql "$DATABASE_URL" -c "UPDATE opportunities SET review_status = 'rejected' WHERE is_synthetic"   # hide the synthetic examples
npm run worker -- --test eu-funding-tenders          # live import of EU calls (needs internet; ~1,000 calls)
for f in audience-2026-10-22 corrections-2026-10-22 corrections-2026-10-23; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/seed/$f.sql
done
```

The approvals and corrections are the owner's approvals **for the preview only**. Before production, see
[03 — Database](03-database.md) and [11 — Backlog](11-backlog.md).

## Run

```bash
npm run dev                                  # http://localhost:3000
npm run build && npm start                   # production build
JACKAL_KNOWLEDGE_DRAFTS=1 npm start          # also show the Γνώση register as drafts (private review only)
npm run worker -- --once                     # one worker pass; see 04 — Imports
npm run admin:promote -- you@example.com     # make a registered user an admin
```

## Test

```bash
npm run typecheck
npm test                                     # unit tests; database tests are skipped without TEST_DATABASE_URL
TEST_DATABASE_URL=postgres://app:app@127.0.0.1:5432/funding_test npm test   # include database tests (separate, empty database)
```

`TEST_DATABASE_URL` must point to a throwaway database: the database tests drop and recreate its `public` schema.

## Environment variables (`.env.example` lists the first eight; the last two are preview switches)

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Everything | PostgreSQL connection string |
| `APP_BASE_URL` | Links, cookies | e.g. `http://localhost:3000` |
| `COOKIE_SECURE` | Sessions | `false` only for local http |
| `TRUST_PROXY` | Rate limiting by IP | `true` only behind a trusted proxy |
| `SITE_PASSWORD` | Optional site-wide password | For a private test deployment |
| `MONITOR_CONTACT_EMAIL` | Source connectors | Sent in the User-Agent to official sites |
| `AI_EXTRACTION_ENABLED`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MONTHLY_BUDGET_USD` | AI extraction | Off; the owner has not approved the cost |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email | No email flow is built yet |
| `JACKAL_KNOWLEDGE_DRAFTS` | Γνώση preview | `1` shows the K1 register marked «Υπό επαλήθευση»; never in production |
| `JACKAL_KNOWLEDGE_FIXTURES` | Development | `1` shows 19 synthetic test entries; no workflow sets it |

## Known local issue

In the build workspace used until October, `npm install` failed for unrelated environment reasons, so all
verification ran in GitHub Actions. On a normal machine the commands above are the same ones CI runs.
