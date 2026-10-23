# 09 — Security and privacy

Detailed reviews: `SECURITY_REVIEW.md` (code-level) and `docs/GDPR_READINESS_CHECKLIST.md`,
`docs/PRIVACY_DATA_INVENTORY.md` (data protection). This page is the summary a new developer needs.

## In place and tested

- Passwords hashed. Sessions stored hashed, with secure cookies (configurable for local http).
- Login rate limiting; user and admin roles; admin pages and actions checked on the server.
- Data export (`/api/me/export`) and account deletion.
- Supabase-style default grants to `anon` / `authenticated` revoked by the migrations, including for future tables.
- Official-source fetching through an SSRF-safe fetcher limited to allowed hosts, with timeouts and bounded retries.
- HTML from sources treated as untrusted and rendered as text only.
- Optional site-wide password (`SITE_PASSWORD`) for a private test deployment (`src/proxy.ts`).
- Profiles never infer financial, age or household data. Questions offer «not sure» and «prefer not to answer».

## Open gaps (from `SECURITY_REVIEW.md`, by risk)

| # | Gap | Needed |
| --- | --- | --- |
| 1 | The app connects as the table owner | A least-privilege runtime role (DML only); migrations run as owner |
| 2 | CSP allows `'unsafe-inline'` scripts | Nonce-based CSP in middleware |
| 3 | SSRF check resolves DNS before the fetch resolves again | Pin the resolved IP if non-official hosts are ever allowed (low risk today) |
| 4 | CSRF relies on Next.js server-action Origin checks, untested | A browser test |
| 5 | No per-IP rate limit without `TRUST_PROXY`; none on registration | With the hosting choice |
| 6 | Audit rows keep an unlinked user id after deletion | Document; review retention |
| 7 | No backups or restore procedure | With the hosting choice; test a restore |
| 8 | No privacy notice or terms | Legal drafting and review |
| 9 | No email consent or unsubscribe flows | When email is built |

## Before any real user (owner's standing rules)

- Legal review: controller identity, privacy notice, terms, international transfers, DPIA-style assessment.
- Fictional profiles only until then. No new personal-data fields without owner approval.
- AI extraction stays off until its cost is approved. When on, its output only enters a human review queue.

## Repository visibility

On 23 Oct 2026 the GitHub repository was public, and the owner decided to make it private. While public, the K1
Excel workbook, the Γνώση draft texts and the CI preview copies (on `live-test-results`) were readable by anyone.
They contain no personal data. Check visibility before adding anything sensitive.
