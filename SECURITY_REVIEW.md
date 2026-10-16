# Security & privacy gap assessment

First written 2026-10-13 (Phase 2); reviewed and extended 2026-10-16 (Workstream E2) — see the section at the end.
Related: `docs/PRIVACY_DATA_INVENTORY.md`, `docs/GDPR_READINESS_CHECKLIST.md`.

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

## Review of 16 Oct 2026 (Workstream E2)

Method: read of the code, migrations and configuration on commit `a466de9`, plus the automated tests listed above (they
run on every push). Nothing was tested against a hosted system, because none exists. **Verified** = seen in code and
covered by a test; **Seen in code** = read, not tested; **Assumption** = needs checking once hosted.

| Area | Finding | Status |
|---|---|---|
| Authentication | scrypt password hashes; minimum 10 characters; login limited per email (5 failures / 15 min) and per IP (20, only with `TRUST_PROXY=true`); sessions 14 days, token stored as SHA-256 | Verified |
| Session cookie | httpOnly, SameSite=Lax, Secure only when `COOKIE_SECURE=true` | Seen in code — **must be `true` on any host** (in the setup guide) |
| Authorization | Users reach only their own profile, saved items, matches and export; admin actions require the admin role | Verified (#15, #16, #20) |
| Database permissions | Supabase-style API roles have no privileges; the app still connects as the table owner | Verified / **open gap 1** |
| Secrets | Only in environment variables / GitHub secrets; none in the repository (searched: no keys, passwords or connection strings committed) | Seen in code |
| Input validation | zod schemas and database CHECK constraints on every profile field; guide search query trimmed to 100 characters and rendered as text | Verified (profile) / Seen in code (search) |
| Injection | All app SQL through the `postgres` tagged-template client (parameterised); the only raw SQL is the migration runner executing the repository's own migration files | Seen in code |
| XSS | React escapes output; no `dangerouslySetInnerHTML` with user data; CSP same-origin, but `'unsafe-inline'` scripts | Seen in code / **open gap 2** |
| File uploads | None for users (only admins trigger fetches of official documents, from an allow-list) | Verified |
| Error logging | No request or profile data is written to logs by the app; hosting logs not yet chosen | Seen in code / Assumption |
| Backups and deletion | Account deletion cascades (verified); backups not set up, so deleted data cannot linger in backups yet | Verified / **open gap 7** |
| Dependencies | Locked in `package-lock.json`; no automated vulnerability scan configured | **New gap 10** |
| Private preview gate | HTTP Basic password on every page when `SITE_PASSWORD` is set, constant-time comparison, noindex | Verified (`proxy.test.ts`) |
| Account enumeration | Registration says when an email is already registered | **New gap 11** (low) |
| Free-text notes | Saved-item notes accept 5,000 characters of free text, which could hold personal data | **New gap 12** (low) |

### New gaps added 16 Oct 2026
| # | Gap | Plan |
|---|---|---|
| 10 | No automated dependency vulnerability scanning. | Enable GitHub Dependabot alerts (free) — owner action in repository settings. |
| 11 | Registration reveals whether an email is already registered. | Accept for the private preview; before public launch, switch to an email-confirmation flow with a neutral message. |
| 12 | Saved-item notes are free text. | Add a short "do not enter personal data" hint, or drop notes, before real users. |

No defect found today needed an immediate code fix; none of the gaps is exploitable on the private preview with
made-up profiles. Priority order for remediation is in `docs/GDPR_READINESS_CHECKLIST.md`.
