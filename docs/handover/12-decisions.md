# 12 — Decisions log

Owner decisions (Lydia, product owner) that shape the code, newest first. Each was given in a working session with
Claude; the column «Recorded in» points to where the decision is reflected in the repository. Entries marked
*to confirm* were reconstructed from session notes and should be confirmed by the owner before handover.

## Standing rules (apply to all work)

- No production deployment, paid service, scheduled job or new personal-data field without approval.
- Fictional profiles only. Nothing unverified is published.
- Eligibility stays deterministic; an unknown answer is never positive.
- The 1,009 EU calls stay unclassified until a reviewed classification exists; no bulk classification.
- Report inaccurate or contradictory information before changing it.
- No unnecessary features or new categories without approval.
- Debt guide on hold.

## Log

| Date | Decision | Recorded in |
| --- | --- | --- |
| 23 Oct 2026 18:07 | Final substantial UX revision of Γνώση before handover: Θέματα as the main entry, topic pages grouped into page sections, compact dictionary, a reusable comparison component (CMP-001 placeholder only), a missing-content state and audit; palette unchanged | `07-knowledge.md`, `src/components/knowledge*.tsx`, `data/knowledge/comparisons.json` |
| 23 Oct 2026 16:37 | Γνώση: real K1 content in a **private** preview only, labelled «Υπό επαλήθευση»; section order Θέματα · Λεξικό · Μάθε τα βασικά · Συχνές Ερωτήσεις; repository to be made private | `07-knowledge.md`, `src/lib/knowledge/schema.ts`, `src/lib/site/copy.ts` |
| 23 Oct 2026 16:31 | Handover to a developer on 31 Oct. Priorities: verified Γνώση content and complete documentation. No cosmetic changes until the owner reviews the design. Do not merge into `main` without approval. `ci-failcheck` stays until the owner deletes it | This folder |
| 23 Oct 2026 16:19 | All 221 K1 entries in the preview only, marked as not verified | `src/lib/knowledge/store.ts` (`JACKAL_KNOWLEDGE_DRAFTS`) |
| 23 Oct 2026 15:50 | Any failed test must fail the CI run | `.github/workflows/design-preview.yml` (last step) |
| 23 Oct 2026 14:32 | Phase 2A paused. P0: only confirmed 5Α/5Β periods may show as open; no general 31/10/2027 deadline for 5Β. Γνώση replaces Οδηγοί in the menu: four sections, eight topics, one content system, publication gate. The 221 entries must not be imported as public | `tests/corrections-2026-10-23.test.ts`, `07-knowledge.md` |
| 23 Oct 2026 13:45 | 5Α/5Β tax information not finalised; the disputed 5Β start stays visible; ΔΑΜ22 €40m kept distinct; Phase 2A as audit and proposal only | Record overlay (`data/official-records-corrections-2026-10-22.json`) |
| 23 Oct 2026 11:14 | Phase 1.1 approved: ΔΑΜ22/ΔΑΜ23 budget terms as in the calls; 5Β fifteen years without an unconfirmed start; 5Α/5Β deadlines by year of move | `db/seed/corrections-2026-10-23.sql` |
| 22 Oct 2026 15:52 | Phase 1 corrections of six records, each checked against its official source; ΔΑΜ24 and DiscoverEU «Υπό επιβεβαίωση»; apply button hidden when unconfirmed — preview only | `db/seed/corrections-2026-10-22.sql` |
| 22 Oct 2026 | Two paths, «Πολίτες» and «Επιχειρήσεις & Επαγγελματίες»; one path per programme (9 / 10); EU calls in neither until checked | `db/migrations/0011_audience.sql`, `db/seed/audience-2026-10-22.sql` |
| 20 Oct 2026 | One platform, one database, one engine for both audiences; business batch imported to the preview only | `docs/OPEN_DECISIONS.md`, `db/seed/approvals-2026-10-20.sql` |
| 17 Oct 2026 | Milestone 2 approved; palette (navy #102B49, blue #2563EB, ice #E9F1FC, off-white #F6F8FB, border #D6E2EE, no gold); source-connector order approved, nothing switched on | `docs/OPEN_DECISIONS.md`, `src/app/globals.css` |
| 16 Oct 2026 | Guides phase 2 approved; private hosting postponed; fictional test profiles only | `docs/OPEN_DECISIONS.md` |
| 15 Oct 2026 | First 8 hand-checked records approved | `db/seed/approvals-2026-10-15.sql` |
| 14 Oct 2026 | Industry categories for discovery only; never for eligibility | `db/migrations/0008_industries.sql` |

*To confirm:* the status of the 17 Oct «decisions needed» list in `docs/OPEN_DECISIONS.md` (record revisions, A21
proposals, document lists, Option C wording, taxonomy). Several were overtaken by the 22–23 Oct work.

## Reports kept outside the repository

Session reports and proposals were written as private documents in the owner's Claude account. The main ones:
- the Phase 1 report;
- the Phase 2A proposal (paused);
- the P0 and Γνώση report of 23 Oct;
- the 31 October readiness assessment.

The owner should export them to `docs/reports/` (or share them) so the developer has the full history.
