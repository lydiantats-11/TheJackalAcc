# Privacy data inventory (16 Oct 2026, Workstream E1)

Engineering inventory of the personal data the application can hold, read from the database migrations (0001–0010)
and the code. It is **not** a legal assessment and does not state that the application is GDPR-compliant. No real
personal data is held today: there is no live database, and testers on any future private preview must use made-up
profiles.

Legend — **Basis**: V = verified in code or tests · A = assumption to confirm · L = needs legal review.
**Necessity**: R = required for the account to work · O = optional, asked only to assess eligibility · N = not used yet.

## Account and session data

| Data | Table / place | Sensitivity | Necessity | Retention today | Basis |
|---|---|---|---|---|---|
| Email address | `users.email` | Personal (identifier) | R | Until the account is deleted | V |
| Password | `users.password_hash` (scrypt hash, never the password) | Secret | R | Until deletion | V (`auth-and-access.test.ts`) |
| Role, interface language, created/updated dates | `users` | Low | R | Until deletion | V |
| Session token | `sessions.token_hash` (SHA-256 only); cookie `fr_session`, httpOnly, SameSite=Lax, Secure when `COOKIE_SECURE=true` | Secret | R | 14 days; expired sessions purged by the worker | V |
| Login attempts | `login_attempts.key` (hash of email or IP), time, success | Pseudonymous | R (abuse protection) | 30 days, purged by the worker | V |
| Language preference | cookie `lang` | Low | O (functional) | Browser | V |

## Profile answers (all optional; «Δεν είμαι σίγουρος/η» and «Προτιμώ να μην απαντήσω» available)

| Group | Fields (`user_profiles`) | Sensitivity | Necessity | Basis |
|---|---|---|---|---|
| Who and where | personas, interests, industries, country of residence, application country, region (NUTS-2), municipality | Personal | O | V |
| Age | age range, birth year (asked only when an age limit falls inside the chosen range) | Personal | O | V |
| Work and education | employment status, ΔΥΠΑ registration, last job end, education level, qualifications, academic ID | Personal; unemployment status is sensitive in practice | O | V |
| Household | household size, dependent children, housing status, first-home purchase, property owned | Personal | O | V |
| Finances (ranges only) | household income range, own contribution, project budget, financing ability, planned investment | Financial — high sensitivity | O | V |
| Tax residence and citizenship | tax residence country, citizenship, moving plans, years of Greek tax residence (prev. 6/8), activity in Greece, intention to stay | High sensitivity (nationality, tax position) | O | V |
| Business | business stage, registration, legal form, registration date, region, employees and turnover ranges, sectors, prior state aid, de minimis received (3 years) | Business data; personal for sole proprietors | O | V |

No ΑΦΜ, ΑΜΚΑ, ID numbers, bank details, documents or health data are collected (V: no such columns; profile form).
Nationality and tax-residence answers are not "special category" data under GDPR Article 9, but they can reveal
sensitive circumstances; treat them as high sensitivity (L).

## Derived and activity data

| Data | Place | Sensitivity | Notes | Basis |
|---|---|---|---|---|
| Eligibility results per opportunity | `user_opportunity_matches` | Profiling (L) | Indicative only; never a decision with legal effect. Whether GDPR Article 22 applies needs legal review. | V / L |
| Saved opportunities and free-text notes | `saved_opportunities.notes` (≤ 5,000 characters) | Free text may contain anything | Users could type personal data; consider removing notes or warning users (A) | V |
| Notification preferences and consent time | `notification_preferences` | Personal | Email is opt-in; **no email is sent** today | V |
| Notification queue | `notifications`, `notification_attempts` | Personal | Unused until email is built | N |
| Admin reviews and audit log | `admin_reviews`, `audit_logs` | Pseudonymous (user ids) | Account deletion leaves one audit row with the deleted user's id | V |
| Organisations, application checklists | `organisations`, `application_checklists` | Personal / business | Tables exist but nothing writes to them yet | N |

## Analytics, telemetry and third parties

| Item | Today | Basis |
|---|---|---|
| Analytics, tracking pixels, third-party scripts | None. Content-Security-Policy allows same-origin scripts only. | V (`next.config.ts`) |
| Fonts | Served from the app itself (Next.js font optimisation), no request to Google at view time | A — confirm in the browser network panel once hosted |
| AI provider (Anthropic) | Switched off. If enabled, only official public documents are sent, never profile or account data. | V (`SECURITY_REVIEW.md`, AI section) |
| Hosting (Vercel) and database (Neon) | Prepared, **not created**. Both would be processors; both are US companies with EU regions (Frankfurt). | A / L (transfers, DPAs) |
| Email provider | None chosen; no email is sent | V |

## Data subject rights already built

- **Access / portability:** signed-in users can download their data as JSON (`/api/me/export`): account, profile,
  saved items, notification settings, notifications and eligibility results (V, `end-to-end-flow.test.ts`).
- **Erasure:** «Οριστική διαγραφή λογαριασμού» (typed confirmation) deletes the account; the database cascades to profile, sessions, saved items,
  matches and notifications (V, `auth-and-access.test.ts`).
- **Rectification:** every profile answer can be changed or cleared (V, `profile-update.test.ts`).
