# 11 — Backlog

Remaining work on 23 Oct 2026, grouped by who must act. Estimates are rough developer-weeks for a private beta and
must be re-estimated by the developer.

## Developer work

| Item | Estimate | Notes |
| --- | --- | --- |
| Hosting, production database, backups, secrets, monitoring | 1.5–2 | [10](10-deployment.md) |
| Security hardening (`SECURITY_REVIEW.md` 1–7) | 1–2 | [09](09-security-privacy.md) |
| Admin content workflow replacing dated seed SQL and the JSON overlay | 2–3 | One store for records, corrections, approvals and history ([03](03-database.md)) |
| Applicant-type classification of EU calls | 1–2 | From `topicConditions` and call documents, plus human review |
| Greek source connectors (Διαύγεια API first, then gov.gr) | 2–4 | Access permissions first; gov.gr watcher live test failing since 18 Oct |
| Email flows (confirmation, reset, alerts) | 1 | Consent and unsubscribe included |
| End-to-end tests of signed-in journeys | 1 | Playwright is already in CI |
| Phase 2A — categories, filters, profile questions | 2–3 | **Paused** by the owner; proposal document «Φάση 2Α» ready for review |
| Γνώση editorial workflow | 0.5–1 | Admin screens for verification, review and approval of entries |

## Content and owner work

- **Γνώση K1:** verify the 40 priority terms, then the rest. Each entry needs an official source with exact
  locator, EL/EN text, review and approval. 0 of 221 are approved.
- **Credibility backlog** from the 22–23 Oct reviews:
  - 5Β: the start of the 15-year period. Α.1192/2026 art. 4(3) and the ΚΦΕ text as republished disagree; check the
    ΦΕΚ / official codification.
  - 5Α: check article 4(6) of Α.1147/2026.
  - ΔΑΜ22: label «Προϋπολογισμός δράσης» (€40m) — keep it distinct from the per-project range.
  - ΔΑΜ24 and DiscoverEU stay «Υπό επιβεβαίωση» until the official pages confirm them.
  - Citizen eligibility rules that are paraphrased need comparing with the official wording.
- **Re-checks:** every hand-checked record has a check date. 5Β must be regenerated after 31/10/2026, when the 2026
  period ends.
- **Legal:** privacy notice, terms, DPIA-style review.

## Open owner approvals

| Item | Proposed |
| --- | --- |
| Merge `consolidation` into `main` | Before handover, or tell the developer to start from `consolidation` |
| Γνώση page texts (EL/EN) and topic descriptions | Review in the private preview |
| Where the programme guides (`/[aud]/odigoi`) live now that Γνώση replaced Οδηγοί in the menu | Keep them reachable from programme pages only |
| `jk_path` preference cookie | Approve as is |
| Who reviews and who approves Γνώση entries; where approvals are recorded | Owner approves; recorded in the register with name and date |
| Which K1 sheet is authoritative when sheets disagree | Stricter state kept meanwhile |
| Α–Ω / A–Z index on phones | Show the Latin row only when Latin terms exist |
| Older items in `docs/OPEN_DECISIONS.md` (17 Oct): record revisions, A21 proposals, document lists, Option C wording, taxonomy | Status to be confirmed by the owner |

## Done recently (for context)

- 22–23 Oct: Phase 1 and 1.1 corrections; 5Α/5Β deadlines by year of move, with no unconfirmed open period.
- 23 Oct: Γνώση built; the K1 register in the private preview as «Υπό επαλήθευση»; CI fails on any failed check;
  seed regression test.
