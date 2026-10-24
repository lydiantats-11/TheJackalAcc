# Jackal Accountant — developer handover

Start here. This folder is the handover pack for the developer taking over on 31 October 2026. It explains how to run
the project, how it is built, why it is built that way, and what is left. Older documents in the repository root and in
`docs/` are kept as history; where they disagree with this folder, this folder wins.

> **Read first**
> - The work is on the **`consolidation`** branch. `main` holds only the initial commit (14 Oct 2026). Do not start
>   from `main`; do not merge into it without the owner's approval.
> - There is **no production deployment and no production database**. Everything runs in CI on throwaway machines.
> - The hand-checked programme records exist in **two places** (database seeds and a JSON overlay read by the app).
>   See [03 — Database](03-database.md) before changing any record.
> - Nothing unverified may be shown to the public. Knowledge entries pass a publication gate; programme records carry
>   their source, check date and uncertainties. "Unknown" never counts as a pass.

## Contents

| # | Document | What it answers |
| --- | --- | --- |
| 01 | [Getting started](01-getting-started.md) | Clone, install, run the app, the worker and the tests |
| 02 | [Architecture](02-architecture.md) | The parts and how data flows between them |
| 03 | [Database](03-database.md) | Tables, migrations, constraints, seeds, the record overlay |
| 04 | [Imports and sources](04-imports.md) | EU Funding & Tenders connector, worker, gov.gr watcher, what is not automated |
| 05 | [Eligibility engine](05-eligibility-engine.md) | How a profile is matched; the rules that must not change |
| 06 | [Website structure](06-website.md) | Routes, the two paths, navigation, language, copy |
| 07 | [Γνώση (Knowledge)](07-knowledge.md) | The K1 register, the publication gate, the preview modes |
| 08 | [Testing and CI](08-testing-ci.md) | Test suites, CI workflows, the failure gate, previews |
| 09 | [Security and privacy](09-security-privacy.md) | Known gaps and what must happen before real users |
| 10 | [Deployment requirements](10-deployment.md) | What a production setup needs |
| 11 | [Backlog](11-backlog.md) | Remaining work, open approvals, paused work |
| 12 | [Decisions log](12-decisions.md) | Owner decisions with dates, and where each is recorded |
| 13 | [K1 source evidence](13-source-evidence.md) | Where the 40 priority Γνώση terms stand against official sources |

## The product in one paragraph

Jackal Accountant is a Greek-first (EL/EN) information platform about public funding, benefits and tax incentives in
Greece and the EU. Visitors choose one of two paths — «Πολίτες» (citizens) or «Επιχειρήσεις & Επαγγελματίες»
(businesses and professionals) — and see only that path's programmes, news and account. A deterministic engine
explains, for a saved profile, what appears satisfied, what is unknown and what rules a programme out; it never
claims someone is eligible on missing information. «Γνώση» is a separate, universal glossary and explainer section.
Jackal is not a government service and never applies on anyone's behalf.

## Status on 23 October 2026

- CI on `consolidation`: 424 tests in 37 files, 0 TypeScript errors, production build, database seeds with real
  data, quality report and browser checks — all passing; any failure turns the run red.
- 19 hand-checked programmes are approved for the preview (9 citizen, 10 business). 1,009 EU calls are imported and
  held back from both paths until their applicant types are classified.
- Γνώση: 221 planned entries (166 terms, 28 basics, 27 FAQ), 0 approved; 40 have a draft EL/EN text. On 24 Oct, 21
  of the 40 priority terms had an official source confirmed, 9 partly, 10 not ([13](13-source-evidence.md)).
- Readiness assessment and remaining effort: see the owner's «31 October readiness assessment» document and
  [11 — Backlog](11-backlog.md).
