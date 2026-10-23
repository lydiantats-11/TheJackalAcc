> **Developer handover (23 Oct 2026): start with [`docs/handover/`](docs/handover/README.md).** This README describes the
> project as of 13 Oct 2026 («Funding Radar» was the working name of Jackal Accountant); the handover pack is current.

# Funding Radar (working name)

Greek-first platform that finds official Greek and EU funding opportunities and explains, honestly, whether they
might fit you — what appears satisfied, what is still unknown, and what rules you out.

> **Status: Phase 2 built and tested locally — not production-ready.** The first real connector (EU Funding &
> Tenders Portal) and the background worker exist and pass tests against synthetic data, but **no official source
> has been live-tested yet**: the build workspace cannot reach official sites. The opportunities shown are fictional
> test data, labelled as such. See `BUILD_PLAN.md`, `SOURCES.md`, `SECURITY_REVIEW.md`.

## What works today (verified locally, 2026-10-13)

- Next.js 16 + TypeScript app, Greek by default with an EL/EN switch.
- PostgreSQL schema with 3 migrations; Supabase API roles locked out (tested, incl. future tables).
- Accounts, hashed sessions, login rate limiting, user/admin roles, data export and account deletion.
- **Eligibility engine v2:** structured requirements with official wording and evidence; six outcomes with a fixed
  precedence; unknown never passes; separate *availability* (open / stale / conflicting / closed) and *relevance*.
- **Adaptive profile** with business/financial questions shown only when relevant or requested by a call, each with
  "Not sure" / "Prefer not to answer".
- **"What if" scenarios** (hypothetical, never saved) and a transparent funding estimate.
- **EU Funding & Tenders connector** + **ingestion pipeline** (idempotent, versioned, conflict-aware) + **worker**
  (scheduling, locking, retries, degrade/recover, crash recovery, deadline sweep, data retention).
- Admin source-health page with access/robots status, last content, last run and a **Test now** button.

- **Interpretations** of nine hard eligibility questions, tested against real calls (INTERPRETATIONS.md).
- **AI-assisted extraction** with a mandatory human review queue (*Admin → AI review*) — built, tested with a scripted
  provider, and **switched off** until its cost is approved.

Test results: `npm run test:db` → **112 passed / 0 failed**; typecheck and production build pass.

## Run it locally

Requirements: Node.js 22+, and PostgreSQL 15+ (local, Docker, or a free Supabase project).

```bash
npm install
cp .env.example .env.local          # then edit DATABASE_URL in .env.local
npm run db:migrate                  # creates tables (safe to re-run)
npm run db:seed                     # categories, source registry, labelled test opportunities
npm run dev                         # http://localhost:3000
```

Quick local database with Docker:

```bash
docker run -d --name funding-pg -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=funding -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:devpass@localhost:5432/funding
```

Using Supabase: create a project → *Project Settings → Database → Connection string* → copy the **Session pooler**
URI into `DATABASE_URL` in `.env.local`. Never commit `.env.local` (it is git-ignored).

Run the background worker (separate terminal):

```bash
npm run worker                               # loop every 60 s
npm run worker -- --once                     # single pass
npm run worker -- --test eu-funding-tenders  # live test of one source (needs internet access to the EU portal)
npm run worker -- --recalc                   # recompute all matches
```

A source is only checked automatically after a successful `--test` run **and** an admin enabling it on
*Admin → Sources*. Set `MONITOR_CONTACT_EMAIL` so site operators can identify our monitor.

Make yourself an administrator (after registering in the app):

```bash
npm run admin:promote -- you@example.com
```

## Tests

```bash
npm test          # unit tests (database tests are skipped)
npm run test:db   # unit + database tests; uses TEST_DATABASE_URL (default: local test DB on port 54329)
```

`TEST_DATABASE_URL` is **wiped** on every run — never point it at a real database.

All 25 scenarios in the Phase 2 brief and the 20 acceptance criteria of the master brief that apply so far are
covered by tests against **synthetic** data (see BUILD_PLAN.md for the mapping). Fixtures are labelled test data.

## Project structure

```
db/migrations/        SQL migrations (applied in order, tracked in schema_migrations)
db/seed/              Source registry + clearly labelled synthetic opportunities
scripts/              migrate, seed, promote-admin
src/app/              Pages (landing, auth, opportunities, dashboard, profile, admin) and API routes
src/components/       UI components
src/lib/domain/       Requirement model, eligibility engine, status transitions (pure, no I/O)
src/lib/sources/      Source adapter interface, SSRF-safe fetcher with retry/backoff, adapter registry
src/lib/auth/         Password hashing, sessions, roles
src/lib/data/         Database access; user data is always scoped to the logged-in user
src/lib/i18n/         Greek and English text
tests/                Vitest unit + PostgreSQL integration tests
```

## How the important rules are enforced

- **Unknown is never "no restriction".** Every requirement is `unknown`, `not_applicable`, `confirmed_absent` or
  `required`. Malformed data degrades to `unknown`. The database also forbids a "known" amount or deadline without a value.
- **Eligibility is rules, not AI.** `src/lib/domain/eligibility.ts`. Outcomes: potentially eligible; potentially
  eligible — verification required; unlikely eligible; ineligible under the verified rules; insufficient
  information; under review. Ranking sorts by eligibility first, so relevance cannot lift an ineligible match.
- **Relevance weights** (25/20/15/15/10/10/5) are configurable and vary by opportunity type. Unknown or
  confirmed-absent requirements are neutral; evidence coverage and unresolved items are shown.
- **Sources are not "monitored" just by being listed.** Lifecycle `configured → tested → active → degraded → inactive`;
  the database forbids enabling a `configured` source.
- **Outbound fetching** is HTTPS-only, restricted to each source's allow-listed hosts, refuses private IPs, and
  re-checks every redirect.
- **Outages never close calls.** After a deadline passes and the source can't be checked, the status becomes
  *unverified*, not *closed*.

## Security notes

- Passwords: scrypt. Session cookie: random 256-bit token, httpOnly, SameSite=Lax; only its SHA-256 is stored.
- Set `COOKIE_SECURE=true` in production (HTTPS).
- Server actions are protected against cross-site requests by Next.js's origin check.
- The app connects as the database owner; RLS with no policies blocks Supabase's `anon`/`authenticated` roles.
- Security headers set in `next.config.ts`. A Content-Security-Policy is planned for Phase 7.

## What the product owner will need to provide

| When | What | Where to put it |
|---|---|---|
| Now (to run outside this workspace) | PostgreSQL connection string | `DATABASE_URL` in `.env.local` / host's secret settings |
| Phase 3 | Anthropic API key, with a spend limit set in the Anthropic console | `ANTHROPIC_API_KEY` |
| Phase 5 | Resend account + verified sending domain | `RESEND_API_KEY`, `EMAIL_FROM` |
| Phase 7 | Hosting choice for web app + background worker (approval before any paid resource) | — |

## Disclaimer

Independent platform, not a government service. Final eligibility and award decisions are made solely by the
responsible funding authority.
