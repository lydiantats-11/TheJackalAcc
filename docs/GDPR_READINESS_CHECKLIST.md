# GDPR readiness checklist (16 Oct 2026, Workstream E3)

A preparation checklist, not a compliance statement. Jackal Accountant is **not** ready for real users or real
personal data. Items marked **Legal** need a qualified data-protection lawyer; this file only prepares the questions.

Status: ☐ open · ◐ partly done · ☑ done (engineering side)

## Roles
| | Item | Status | Notes |
|---|---|---|---|
| 1 | Controller identified | ☐ **Legal** | The owner, or the company that will operate Jackal Accountant. Needs a legal entity, name and contact address for the privacy notice. |
| 2 | Processors listed | ◐ | Hosting (Vercel), database (Neon), later an email provider; the AI provider only if switched on (public documents only). None created yet. |
| 3 | Processor agreements (DPAs) | ☐ **Legal** | Accept each provider's DPA when the account is created; keep copies. |

## Purposes and lawful bases (do not assume consent for everything)
| Processing | Purpose | Likely lawful basis (to confirm, **Legal**) |
|---|---|---|
| Account (email, password hash, sessions) | Provide the service the user signed up for | Contract (Art. 6(1)(b)) |
| Profile answers and eligibility results | Show which opportunities may fit, at the user's request | Contract (6(1)(b)); consider explicit, separate consent for the most sensitive answers (finances, tax residence, citizenship) |
| Login-attempt records | Protect accounts against password guessing | Legitimate interest (6(1)(f)) — document the balancing test |
| Email alerts (not built) | Notify about new matches and deadlines | Consent (6(1)(a)), opt-in already built; unsubscribe still to build |
| Audit log | Accountability for admin actions and deletions | Legitimate interest / legal obligation — confirm |

## Principles and rights
| | Item | Status | Notes |
|---|---|---|---|
| 4 | Data minimisation | ◐ | Every profile question is optional, with «Δεν είμαι σίγουρος/η» / «Προτιμώ να μην απαντήσω»; ranges instead of exact amounts; no ΑΦΜ, ΑΜΚΑ, IDs, bank details or documents. Review whether every question is still needed (e.g. birth year, free-text notes). |
| 5 | Privacy notice (Greek and English) | ☐ | Draft once roles and processors are fixed. Must explain profiling and that results are indicative only. |
| 6 | Cookies | ◐ | Only a session cookie and a language cookie; no analytics. Strictly necessary / functional — likely no consent banner needed (**Legal** to confirm). |
| 7 | Access and portability | ☑ | JSON export of all account data. |
| 8 | Rectification | ☑ | Every answer can be edited or cleared. |
| 9 | Erasure | ◐ | Account deletion cascades; one pseudonymous audit row remains (document it); backups will need a deletion policy. |
| 10 | Objection / restriction | ☐ | No process yet; a contact address in the privacy notice is the minimum. |
| 11 | Automated decision-making (Art. 22) | ☐ **Legal** | Results are indicative and never decide anything, but the profiling should be described; confirm Art. 22 does not apply. |
| 12 | Retention periods | ◐ | Sessions 14 days, login attempts 30 days (automatic). Still to set: inactive accounts, audit log, notifications, backups. |
| 13 | International transfers | ☐ **Legal** | EU regions (Frankfurt) chosen for hosting and database; the providers are US companies — check their transfer mechanism (EU-US Data Privacy Framework or SCCs). |
| 14 | Security of processing (Art. 32) | ◐ | See `SECURITY_REVIEW.md`; open gaps 1, 2, 5, 7, 10–12. |
| 15 | Incident response | ☐ | Write a one-page plan: who decides, 72-hour notification to the Hellenic DPA (ΑΠΔΠΧ), how users are told. |
| 16 | Records of processing (Art. 30) | ◐ | `docs/PRIVACY_DATA_INVENTORY.md` is the starting point. |
| 17 | DPIA | ☐ **Legal** | Likely advisable: profiling with financial, tax-residence and household data, possibly at scale. Decide before launch. |
| 18 | Professional legal review | ☐ | Recommended before any real account: items 1, 3, 5, 11, 13, 17. |

## Prioritised remediation (before real users)
1. **Legal entity, controller and privacy notice** (items 1, 5) — blocks everything else.
2. **Least-privilege database role** for the running app (security gap 1).
3. **Retention and backup policy** including deleted accounts (items 9, 12; gap 7).
4. **Hosting checks**: `COOKIE_SECURE=true`, `TRUST_PROXY=true`, registration rate limit, Dependabot alerts (gaps 5, 10).
5. **DPIA decision and legal review** (items 11, 13, 17, 18).
6. **Neutral registration message and notes hint** (gaps 11, 12).
7. **Nonce-based CSP** (gap 2).
