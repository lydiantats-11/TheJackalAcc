# 03 — Database

PostgreSQL 15+, accessed with the `postgres` library (plain SQL, no ORM). Migrations are plain SQL files applied in
order by `scripts/migrate.ts`, each in its own transaction, recorded in `schema_migrations`.

## Migrations

| File | Adds |
| --- | --- |
| `0001_initial_schema.sql` | Users, sessions, login attempts, profiles, organisations, sources, ingestion runs, source documents, categories, **opportunities**, field evidence, versions, status history, matches, saved items, checklists, notifications, admin reviews, audit log, AI usage |
| `0002_phase2_ingestion_and_requirements.sql` | Source provenance, **opportunity_requirements** (structured eligibility rules with official wording and evidence), events, worker heartbeats, privilege hardening |
| `0003_profile_fields_v2.sql` | Adaptive profile answers; «not sure» and «prefer not to answer» kept distinct from «never asked» |
| `0004_interpretation_fields.sql` | Answers needed by the interpretation decisions (`INTERPRETATIONS.md`): SME status, exclusions, consortia |
| `0005_ai_extraction.sql` | Extraction runs and candidates — AI output is staged; nothing reaches requirements until a reviewer accepts it |
| `0006_personas_and_household.sql` | Five non-exclusive personas, interests, household fields (they choose questions, never eligibility) |
| `0007_records_and_residence.sql` | `public_benefit` type, verified-record support, residents-abroad answers |
| `0008_industries.sql` | Industry categories for discovery and ordering only |
| `0009_official_details.sql` | Official details for display (amounts, dates, funding, conditions) |
| `0010_official_details_changes.sql` | Change detection when a source changes published details |
| `0011_audience.sql` | One audience per programme: `citizen`, `business`, or NULL (outside both paths) |

## Constraints that encode product rules

Check constraints on `opportunities` (names as PostgreSQL generates them):

| Constraint | Rule |
| --- | --- |
| `opportunities_check` / `_check1` | A funding amount is «known» exactly when a minimum or maximum is set |
| `opportunities_check2` | Minimum ≤ maximum |
| `opportunities_check3` | `deadline_state = 'known'` requires `closes_at` |
| `opportunities_check4` | `closes_at` is allowed only when `deadline_state = 'known'` |
| `opportunities_canonical_url_check` | Canonical URL must be https |

On 23 Oct 2026 a seed set `closes_at = NULL` without changing `deadline_state` and failed on `opportunities_check3`;
the fix is in the generator and `tests/seed-corrections-db.test.ts` guards it. Never relax these constraints to make a
script pass.

## Seeds: how records got into the database

| File | Kind | What it does |
| --- | --- | --- |
| `scripts/seed.ts` (`npm run db:seed`) | Script | Categories, the source registry, six synthetic examples (always labelled; rejected in the preview) |
| `official-records-2026-10-14.sql` | Generated (`scripts/build_official_seed.py`) | Hand-checked citizen records from `data/official-records-2026-10-14.v2.json`, imported as `pending` |
| `approvals-2026-10-15.sql` | Hand-written | Owner approval of the first 8 records (15 Oct) |
| `business-records-2026-10-20.sql` | Generated (`scripts/build_business_seed.py`) | 11 business calls from `data/business-records-2026-10-20.json`, imported as `pending` |
| `approvals-2026-10-20.sql` | Hand-written | Owner approval of the business batch — preview only |
| `audience-2026-10-22.sql` | Hand-written | Path of each approved record: 9 citizen, 10 business; everything else NULL |
| `corrections-2026-10-22.sql` | Hand-written | Phase 1 corrections (owner approval 22 Oct 15:52) — preview only |
| `corrections-2026-10-23.sql` | Generated (`scripts/build_corrections_2026_10_23.py`) | Phase 1.1: ΔΑΜ22/ΔΑΜ23 budget terms, 5Α/5Β deadlines by year of move — preview only |

All seeds are idempotent (guarded updates; a rerun changes nothing) and keep the earlier state in
`opportunity_versions` and `audit_logs`. Generated files say «do not edit by hand» — change the JSON and regenerate.

**Before production:** the approvals and corrections were given for the preview. Re-approval in production, and a
real admin workflow to replace dated SQL files, are open items ([11](11-backlog.md)).

## The record overlay

Pages read the hand-checked records through `src/lib/site/verified.ts`, which uses `CHECKED_RECORDS` from
`src/lib/site/checked-records.ts`: the 14 Oct JSON with the corrections file applied on top (whole fields replaced,
never edited in place). This carries what the schema does not model: per-year deadline rules
(`src/lib/site/move-year.ts`), source conflicts, application steps, evidence excerpts. `withDeadlineRule` in
`src/lib/data/opportunities.ts` combines the database row with the rule at request time, so 5Β switches to
«Υπό επιβεβαίωση» on its own after 31/10/2026.

## Data in the preview database (CI, 23 Oct 2026)

| Group | Records | Shown |
| --- | --- | --- |
| Hand-checked, approved | 19 (9 citizen, 10 business) | In their path |
| EU Funding & Tenders | 1,009 | Nowhere until applicant types are classified (audience NULL) |
| Synthetic examples | 6 | Never (rejected) |

## Roles and privileges

Migrations revoke the Supabase-style default grants from `anon` and `authenticated` (tested). The app still connects
as the table owner; a least-privilege runtime role is an open security item ([09](09-security-privacy.md)).
