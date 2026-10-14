# Security & privacy gap assessment — Phase 2 (2026-10-13)

This is an engineering review, not a legal or GDPR compliance certification.

## Verified by automated tests (PostgreSQL 16)

| Control | Evidence |
|---|---|
| Passwords hashed (scrypt), never stored in plain text | `auth-and-access.test.ts` |
| Session tokens stored only as SHA-256; logout/expiry invalidate | `auth-and-access.test.ts` |
| Deleted account → its session token no longer works (#21) | `auth-and-access.test.ts` |
| Login rate limit per email (5 failures / 15 min) | `auth-and-access.test.ts` |
| Ordinary user blocked from admin functions (#15) | `auth-and-access.test.ts` + HTTP smoke test |
| Users see only their own profile, saved items, matches, export (#16, #20) | `auth-and-access.test.ts`, `end-to-end-flow.test.ts` |
| Supabase API roles (`anon`, `authenticated`) have **no privileges**, even when granted Supabase-style defaults before migration, and **future tables** are not exposed | `auth-and-access.test.ts` (simulated roles; permission-denied asserted) |
| Profile input validated (enums, dates, amounts); injection strings rejected | `auth-and-access.test.ts` |
| Outbound fetching: https only, per-source host allow-list, private/metadata IPs refused, redirects re-validated | `status-and-sources.test.ts` |
| Untrusted source text stored as data; cannot change requirements or eligibility | `ingestion.test.ts` (prompt-injection title) |
| One ingestion run per source (advisory lock); crashed runs recovered | `ingestion.test.ts` |

## Fixed in this phase
1. **RLS was not sufficient on its own** — grants on sequences, functions and *future* tables were still possible.
   Migration 0002 adds `lockdown_public_schema()` (revokes table/sequence/function grants and default privileges
   for `anon`/`authenticated`); every new migration calls it.
2. **Spoofable client IP** — `X-Forwarded-For` was trusted unconditionally. Now only with `TRUST_PROXY=true`.
3. **No Content-Security-Policy** — added (self-only, no third-party scripts, `frame-ancestors 'none'`); HSTS when `COOKIE_SECURE=true`.
4. **Expired sessions / old login attempts kept forever** — the worker now purges them (30-day retention for attempts).
5. **DNS failures crashed runs** — now a retryable, recorded failure.

## Open gaps (ordered by risk)
| # | Gap | Plan |
|---|---|---|
| 1 | The app connects to PostgreSQL as the table owner (locally a superuser). A dedicated least-privilege runtime role is not yet set up. | Phase 7: create `app_runtime` role with DML-only grants; migrations run as owner. |
| 2 | `'unsafe-inline'` scripts in the CSP (required by Next.js hydration without nonces). | Phase 7: nonce-based CSP via middleware. |
| 3 | SSRF check resolves DNS before `fetch` resolves again (DNS-rebinding window). Risk is low because hosts are a fixed allow-list of official domains. | Pin resolved IP via a custom agent if non-official hosts are ever allowed. |
| 4 | CSRF relies on Next.js server-action Origin checks; not covered by an automated test (no browser available in the workspace). | Add Playwright test where a browser is available. |
| 5 | No per-IP rate limit unless `TRUST_PROXY=true`; no rate limit on registration. | Phase 7 with the hosting choice. |
| 6 | Audit log records actor + entity ids; account deletion keeps an audit row with the (now unlinked) user id. | Document in privacy notice; review retention. |
| 7 | No backups/restore procedure documented or tested. | Phase 7 (depends on hosting / Supabase plan). |
| 8 | Privacy notice and terms are not written yet. Financial and age fields are optional, explained in the form, and never inferred. | Phase 7 drafts; DPIA-style review recommended before launch. |
| 9 | Email unsubscribe/consent flows not built (no emails are sent yet). | Phase 5. |

## AI extraction (added 2026-10-13)
- Only official public documents are sent to the AI provider; no user profile or account data is ever included.
- Document text is wrapped as untrusted data; injected instructions are detected and flagged; output is schema-validated.
- AI output cannot change eligibility without an admin approval; quotes must be verbatim in the stored document.
- The API key lives only in server environment variables; the provider is disabled unless explicitly enabled.
- Documents are fetched only from the opportunity's source allow-list (SSRF guard reused).

## Data-minimisation notes
- No identity numbers, tax IDs, bank details or documents are collected.
- Birth year is only requested when an age rule's boundary falls inside the user's age range.
- Every sensitive question offers "Not sure" / "Prefer not to answer"; declining never counts against eligibility.
