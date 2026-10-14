# BUILD_PLAN — Funding Radar (working name)

Greek-first (EL/EN) platform matching official Greek and EU funding opportunities to applicants, with every
material claim traceable to an official source.

Legend: ✅ done & verified locally · 🌐 externally verified (real source) · 🟡 partial · ⬜ pending · ⛔ blocked

## Status at a glance (2026-10-13, end of Phase 2 session)

| Phase | Status |
|---|---|
| 1 Foundation | ✅ |
| 2 Source monitoring | 🟡 connector + worker built and tested locally; ⛔ **live source test blocked by workspace network** |
| 3 Opportunity intelligence (AI extraction) | 🟡 built and tested with a scripted provider; **switched off** until the owner approves the cost (estimate below) |
| 4 Profiles & matching | 🟡 engine v2, adaptive profile, scenarios done; **five personas + conditional questionnaire done (2026-10-14, tests not yet run — see build log)**; onboarding wizard pending |
| 5 Notifications | 🟡 notification-ready events + match change tracking; no sending yet |
| 6 Dashboard & admin | 🟡 dashboard, source health, test-now; review/correction UI pending |
| 7 Hardening & deployment | ⬜ (see SECURITY_REVIEW.md open gaps) |

**Interpretations:** the nine open questions were researched against real calls and resolved — see INTERPRETATIONS.md.

**Nothing has been externally verified against a real official source yet.** The EU connector's first live run
must be executed from the owner's machine (instructions below).

## Architecture (as implemented)

```
 official source ──► adapter (per source) ──► SSRF-safe fetcher (allow-list, retries, backoff)
                                │
                                ▼
                     ingestion pipeline (per-item transaction)
        source_documents (hash) · opportunities (+ versions, status history, field evidence)
        cross-source identity · stale-data guard · conflict flagging · opportunity_events
                                │
                                ▼
          opportunity_requirements (structured, versioned, official wording + evidence)
                                │
     user_profiles ────────────►│ eligibility engine v2 (pure, deterministic, no AI)
                                ▼
       eligibility · availability · relevance  ──►  user_opportunity_matches (+ previous status)
                                │
                                ▼
                   UI (EL/EN) · scenarios (hypothetical, never saved) · funding estimate
```

Worker (`npm run worker`): every 60 s → heartbeat, recover interrupted runs, run due sources (advisory lock per
source), sweep passed deadlines to *unverified*, recalc matches, purge expired sessions/login attempts.

### Key decisions (Phase 2)

| # | Decision | Why |
|---|---|---|
| D11 | Eligibility v2 with six outcomes and a fixed precedence (see `src/lib/domain/eligibility.ts` header) | Matches the brief; every rule is testable and explained; unknown never passes |
| D12 | Eligibility, **availability** (open/stale/conflict…) and relevance are three separate outputs | A closed or stale call is not an eligibility question; relevance is never a probability |
| D13 | Requirements are records with official wording, source language, evidence rank, confidence, flags, version | Auditable; AI-extracted or unclear rules route to human review instead of being guessed |
| D14 | "Potentially eligible" requires the requirement set to be marked *complete* by a reviewer | Absence of a recorded rule is not evidence that no rule exists |
| D15 | Absence from a listing and passed deadlines → *unverified*, never *closed* | Outages, index lag and stale caches must not close calls |
| D16 | A closed call can only reopen on **newer** source evidence; otherwise flagged as conflict | Protects against stale data reopening calls (#24) |
| D17 | Cross-source identity (`external_key`); differing deadlines are flagged, not overwritten | No silent winner between official sources (#17, #18) |
| D18 | Date-only deadlines stored as the start of that day in the **source's** timezone, flagged, original wording kept | Never tells someone they have more time than they might |
| D19 | Scenarios run on a deep copy, are labelled hypothetical, never persist, and reject retroactive/misrepresenting changes | Brief §2B; tested (#22) |
| D20 | EU F&T connector never constructs URLs and does not read eligibility from the API's HTML | Avoids invented links and unreviewed interpretations |

## Milestones (Phase 2)

| Milestone | Status | Evidence |
|---|---|---|
| A Audit | ✅ | Findings below; fixes in SECURITY_REVIEW.md |
| B Source research | ✅ (desk research) | SOURCES.md |
| C EU F&T connector | ✅ locally / ⛔ live | `tests/ingestion.test.ts` (synthetic fixtures); live attempt failed with `ENOTFOUND` (workspace DNS) |
| D Background worker | ✅ | locking, retries, degrade/recover, interruption recovery, idempotency tests |
| E Eligibility integration | ✅ | `tests/engine.test.ts` incl. property-based tests |
| F End-to-end validation | ✅ locally | `tests/end-to-end-flow.test.ts`; HTTP smoke test of the built app |

### Audit findings (Milestone A)
1. Phase 1 engine used the wall clock inside age checks → v2 takes `now` explicitly.
2. Phase 1 eligibility statuses differed from the Phase 2 brief → replaced (migration 0002 clears stored matches; worker recomputes).
3. Requirements had no official wording, evidence per rule, kind, or version → `opportunity_requirements`.
4. RLS relied on a one-time REVOKE; future tables, sequences and functions were not covered → fixed.
5. Client IP trusted from spoofable headers → `TRUST_PROXY`.
6. No CSP; expired sessions never purged → fixed.
7. Deadlines lost their original wording/timezone; no cross-source dedupe; no stale-data guard → fixed.
8. Unused `eligibility_rules` table → dropped.
9. The "Spanish tax application" referenced in the brief is **not present in the workspace or project**. Its
   concepts (adaptive questions, scenarios, transparent calculations) were implemented from the brief's description only.

## Test results (actual, 2026-10-13)

Latest: `npm run test:db` → **112 passed, 0 failed** (9 files). Phase 2 snapshot: **77 passed, 0 failed** (6 files): engine 27 (incl. 3 property-based, ~1,100 generated cases),
ingestion 16, security/auth 11, sources/fetcher 12, scenarios/money/deadlines 8, end-to-end 3.
`npm run typecheck` passes. `next build` passes. HTTP smoke test of the production build passed.

Brief test list coverage: 1 ✅ 2 ✅ 3 ✅ 4 ✅ 5 ✅ 6 ✅ 7 ✅ 8 ✅ 9 ✅ 10 ✅ 11 ✅ 12 ✅ 13 ✅ 14 ✅ (extension; suspension
mapping exists but the EU API has no suspension code) 15 ✅ 16 ✅ 17 ✅ 18 ✅ 19 ✅ 20 ✅ 21 ✅ 22 ✅ 23 ✅ 24 ✅ 25 ✅
— all against synthetic data, none against a live source.

## Interpretations (resolved 2026-10-13)
All nine questions were tested against real calls (DYPA young self-employed, ESPA new tourism SMEs, EIC Accelerator 2026,
Horizon Europe General Annexes, de minimis Reg. 2023/2831, SME User Guide). Decisions, evidence and tests are in
**INTERPRETATIONS.md** (`tests/real-calls.test.ts`, 22 tests). New engine capabilities: rule reference dates,
sub-regional exclusions, registration-timing obligations, proof-of-funds arithmetic, EU SME status, consortium rules,
programme-default rules shown as information.

Still open: "start of works" includes binding orders (question to add); "up to the year the applicant turns X"
age rules (add when a call needs it); replace the third-party copy of the Horizon General Annexes with the official one.

## AI-assisted extraction (built, OFF)
- Flow: official document (fetched only from the source's own hosts; HTML/PDF → text with page markers) →
  Claude structured output (JSON schema) → deterministic checks (quote must appear **verbatim** in the document; value must
  fit the engine format; injected instructions flagged) → **pending candidates** → admin approves/rejects on
  *Admin → AI review* → approved rules become versioned requirements; matches are recalculated.
- Safety: nothing AI-proposed affects eligibility before approval; unverifiable quotes cannot be approved; provider
  outages and malformed output change nothing; only official public documents are sent to the AI — **no user data**.
- Cost controls: off by default (`AI_EXTRACTION_ENABLED=false`), monthly USD cap checked before every call using a
  worst-case estimate, the same document is never extracted twice, every call logged in `ai_usage`.

### Cost estimate for approval (prices read 2026-10-13 from Anthropic's pricing page; USD)
| | Claude Sonnet 5.5 (recommended for legal Greek) | Claude Haiku 5.5 |
|---|---|---|
| Price per million tokens (in / out) | $2 / $10 | $0.10 / $0.50 (prompts ≤100K) |
| One call guide (assume 20k–90k tokens in, 2k–5k out) | ≈ $0.06 – $0.23 | ≈ $0.003 – $0.03 |
| 100 documents / month | ≈ $6 – $23 | ≈ $0.30 – $3 |
| 300 documents / month (initial backlog) | ≈ $18 – $69 | ≈ $1 – $9 |

Assumptions to confirm in a pilot: Greek text may use more tokens per character than English; amendments are usually
short; EU topic condition pages are short. **Proposal:** approve a pilot with Sonnet 5.5 and a **$10 cap** on ~20
real documents, measure accuracy against your manual reading and actual token counts (`ai_usage`), then decide the
monthly cap. Email notifications stay out of scope until their cost and privacy implications are approved.

## What the product owner needs to do
| When | Action |
|---|---|
| **Now** | From your computer: install, set `DATABASE_URL`, `npm run db:migrate && npm run db:seed`, then `npm run worker -- --test eu-funding-tenders` and send me the printed JSON. This is the first real verification. |
| Now (15 min) | Open the robots.txt of espa.gr, dypa.gov.gr, gsri.gov.gr, elevategreece.gov.gr in a browser and send me the text (SOURCES.md checklist). |
| Now | Set `MONITOR_CONTACT_EMAIL` (identifies our monitor to site operators). |
| To start the AI pilot | Approve the pilot ($10 cap). Then, in `.env.local` (never in Git): `ANTHROPIC_API_KEY=…`, `AI_EXTRACTION_ENABLED=true`, `AI_MONTHLY_BUDGET_USD=10`. Also set a spend limit in the Anthropic console. |
| Phase 5 (approval) | Resend (or alternative) account + sending domain. |
| Phase 7 (approval) | Hosting for web app + worker; no paid resources without your OK. |

## Remaining work (estimate, engineering sessions of this size)
- Phase 2 completion after live test: fix whatever the live EU response reveals (0.5), TED connector (1), gov.gr sitemap connector (1), Diavgeia investigation + connector (1–2).
- Phase 3: document parsing (PDF/HTML), AI extraction to requirement records with evidence, review queue UI (3–4).
- Phase 4: onboarding wizard, per-question "why", adviser multi-client accounts (2).
- Phase 5: email sending, digests, unsubscribe, delivery logging (2).
- Phase 6: admin review/correction, merge duplicates, checklists (2–3).
- Phase 7: least-privilege DB role, nonce CSP, backups, privacy notice/terms drafts, deployment, go-live checklist (2–3).

## Running-cost model (assumptions; verify on providers' pricing pages before approval)
| Item | Basis | Expectation |
|---|---|---|
| Database | Managed PostgreSQL free tier while < a few hundred MB and low traffic | €0 at MVP scale; free tiers have limits and can pause idle projects — not guaranteed |
| Web app hosting | Hobby/free tier of a Next.js host | €0–20/month; commercial use may require a paid plan |
| Worker | Always-on small instance or scheduled job | ~€5–10/month on a small VPS/container; free schedulers may not allow long runs |
| AI extraction (Phase 3) | Only new/changed documents; deterministic parsing first; hard monthly cap (`AI_MONTHLY_BUDGET_EUR`, default 20) | Bounded by the cap; to be estimated from current API prices at Phase 3 |
| Email (Phase 5) | Transactional provider free tier | €0 at low volume; paid above provider limits |

## Build log
- 2026-10-14 (Consolidation branch `consolidation`, on the 112-test code) — Migration 0007 (public_benefit type,
  record_kind, per-record stale window, uncertainties, manual_review origin, residents-abroad profile answers);
  ten new deterministic requirement categories + residence by citizenship / residence-or-citizenship; profile section
  for living abroad / moving to Greece; the 12 hand-checked official records (data/…v2.json) → generated seed
  `db/seed/official-records-2026-10-14.sql` (9 imported as review_status = pending; TED, Spain, EIC skipped).
  **Executed here:** migrations 0001–0007 + seed applied twice on PostgreSQL 16 (idempotent); all 27 stored
  requirements pass the engine schema; 9 database→engine cases (tests/manual/db-records-check.ts) as expected;
  pure test files 97/97 (engine 27, real-calls 22, scenarios 8, sources 12, personas 13, residence 15) run with a
  local vitest/fast-check stand-in and zod v4 from the zod 3.25 package — the stand-in reproduced the baseline
  counts exactly. **Not run:** the 6 PostgreSQL test files (no postgres driver package), the real typecheck and
  `next build` (registry blocked). Run `npm run test:db && npm run typecheck && npm run build` locally.
- 2026-10-14 (Merge, provisional) — Persona changeset merged into this 112-test codebase (tag `fr112-personas-merged`);
  the unmerged branch `personas-changeset` is kept. **This is not the canonical Jackal Accountant version** — the
  131-test version must still be recovered and the merge repeated there. Profile saving is now a patch update: only
  fields the form sent are written (`__present` markers for checkbox groups), so hidden sections, switched-off
  personas and fields the form does not ask are never erased. New `tests/profile-update.test.ts` (5 DB tests).
  **Not yet run:** `npm run test:db`, `npm run typecheck`, `next build` (npm registry blocked in the workspace).
  Executed: strict tsc on the domain files; persona visibility checks 20/20; migrations 0001–0006 on PostgreSQL 16.
- 2026-10-14 (Personas) — Five non-exclusive personas (young adults, aspiring entrepreneurs, employees & jobseekers,
  households & property, businesses & organisations) and 11 interests, chosen as chips on the profile page. They open
  only the relevant profile sections (`src/lib/domain/personas.ts`); answered sections never hide; hidden sections stay in
  the form so switching a persona off never erases answers. New household fields (housing status, first home, household
  size, children, income range, property) — stored, not yet evaluated by the engine. The old single `persona` stays as
  the applicant type ("Applying as"). Migration 0006 (backfills personas from the old field without guessing).
  Also fixed: saving the profile wiped `tax_residence_country` because the form never sent it.
  **Verification so far:** migrations 0001–0006 applied on PostgreSQL 16 (backfill, CHECK rejection, anon lockdown);
  persona visibility logic 20/20 checks; strict `tsc` on the new domain files. **Not yet run:** `npm run test:db`
  (new `tests/personas.test.ts`, incl. a property test that personas/interests never change any assessment),
  `npm run typecheck`, `next build` — the workspace could not install npm packages. Run them on your machine.
- 2026-10-13 (Interpretations + AI extraction) — 9 questions resolved against real calls; migrations 0004/0005;
  engine rules for reference dates, exclusions, registration timing, SME, consortium; extraction pipeline + review
  queue + admin UI; 112/112 tests; build passes. No paid API calls made.
- 2026-10-13 (Phase 1) — Foundation; 36/36 tests.
- 2026-10-13 (Phase 2) — Audit; source research; migrations 0002/0003; engine v2 + scenarios + funding/deadline
  modules; EU F&T connector; ingestion pipeline; worker; UI for availability, official wording, scenarios, source
  health with test-now; security fixes. 77/77 tests. Live EU run attempted from workspace: failed (`ENOTFOUND`),
  recorded as a failed run, no data changed.

### 2026-10-14 — First live connector test (EU Funding & Tenders), on GitHub Actions
Run on `lydiantats-11/TheJackalAcc`, branch `live-test`; reports and screenshots on branch `live-test-results`.
- Run 1 (connector 0.1.0): all 7 checks passed, but the counts revealed a defect: without a sort the API pages in an
  unstable order (913 / 931 / 814 distinct topics of 1,001 rows), and topics missed by a run were wrongly marked
  `unverified` (69, then 186). Paging probe: only `sort: identifier ASC` returned a complete, identical list twice.
- Connector 0.2.0: sorts by identifier; a listing with fewer rows than `totalResults` or with an identifier repeating on
  non-adjacent rows is incomplete → run `partial`, nothing marked unverified.
- Deadline probe: the API labels local times as +0000 (T17:00 = 17:00 Brussels closing time; T00:00 = date only).
  Literal reading showed deadlines 1–2 h late. Now read as Brussels wall-clock; original wording unchanged.
- 592 of 1,001 topics the portal labels open/forthcoming have only passed deadlines; the listing put them first and
  (LIMIT 500) hid current calls. Listing now shows still-available records first.
- Final run (commit 56eff0f): typecheck 0 errors, 154/154 tests (incl. 6 DB files), build OK, 7/7 live checks;
  runs 1–3: 1,001 rows / 1,001 total each, 1,000 topics, 0 wrongly unverified; simulated amendment → exactly 1 change.
- NOT yet done: automatic scheduled updates (worker loop not deployed); a human spot-check of 2 deadlines against the
  portal pages in a browser; eligibility conditions are not read from this API (Phase 3).

### 2026-10-14 (afternoon, unattended) — flip-flop and multi-cut-off fixes; updater prepared, OFF
- Import now applies the deadline-sweep rule: a call the source lists as open/upcoming after its LAST deadline is
  stored 'unverified' (reason `deadline_passed_source_still_lists_open`). Before, sweep and import flipped 592 records
  open ⇄ unverified every cycle, each time with a new version and a status alert.
- Multi-cut-off calls: the next cut-off still ahead is the current deadline (was: the first, often passed); a cut-off
  passing moves on quietly — status_reason `next_cutoff`, no "extended", no deadline-change alert.
- Live run (commit a8cdb6b): 156/156 tests, typecheck 0, build OK, 7/7 checks; 409 current + 591 expired-unverified.
- `.github/workflows/scheduled-updater.yml` + `docs/AUTOMATIC_UPDATES.md`: manual trigger only, needs a DATABASE_URL
  secret, and the worker runs only sources an admin enabled. Not switched on: hosting not yet approved.
