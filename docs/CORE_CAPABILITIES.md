# Jackal Accountant — core capabilities (governing reference)

Set by the owner on 15 Oct 2026. This is what the project is **for**; every change is judged against it.

> **A European public-funding intelligence and eligibility-verification infrastructure.**
> That requires genuine technology development beyond aggregating opportunities:
>
> 1. A multilingual engine that interprets complex funding conditions from official European and national publications.
> 2. An evidence-linked, auditable rules engine that distinguishes confirmed eligibility, ineligibility and unknown information.
> 3. Automated detection of regulatory changes, conflicting requirements and outdated opportunities.
> 4. Secure, privacy-preserving personalisation across different countries and administrative systems.
> 5. Independently validated improvements in accuracy, coverage and processing efficiency over existing solutions.

## Rules that follow from it (apply to every change)

- **Official sources only.** Every fact shown or used traces to an official publication, with its URL and the date it was checked. Nothing is estimated, invented or filled in; missing stays visibly missing.
- **The deterministic engine decides.** Eligibility comes only from structured requirements evaluated by `src/lib/domain/eligibility.ts`. AI may help *read* official text (pillar 1), always reviewed, never as the decision-maker.
- **Three answers are kept apart:** confirmed / not met / unknown — plus "needs human review" when the official rule is ambiguous or conflicting. Unknown never counts against a person.
- **Application status is separate from eligibility.** Open/closed says nothing about who qualifies.
- **Every decision is reproducible.** Same rule version + same requirements + same answers → same result, with a reference that proves it.
- **Ask only what a rule needs.** No identity numbers, credentials or documents at the discovery stage; sensitive answers optional and restricted.
- **Claims about quality are measured, not asserted.** No accuracy, coverage or "always up to date" claim without a reproducible measurement behind it.
- **Never promise funding.** The platform helps people find, understand and correctly apply; the authority decides.

## Where each capability stands (15 Oct 2026)

| # | Capability | In place | Missing |
| --- | --- | --- | --- |
| 1 | Multilingual interpretation | Requirements keep the official wording and its language (`original_text`, `original_lang`) next to the structured rule; Greek and EU sources; bilingual interface; AI extraction pipeline built with human review, **switched off** (cost not approved). EU topic conditions and scope text read from the portal's structured fields. | Turning EU call documents and Greek ΦΕΚ/ΚΥΑ texts into structured rules at scale (needs AI extraction approval, then review); languages beyond EL/EN; a terminology glossary across administrations. |
| 2 | Evidence-linked, auditable rules engine | Versioned engine (`RULE_VERSION`); each requirement carries source URL, excerpt, evidence rank, confidence, verification date; outcomes: potentially eligible / needs verification / unlikely / ineligible (authoritative) / information needed / under review. **New: decision record per assessment** — official wording, source, verification date, rule type, the profile answers the rule actually read, outcome, and a reproducible decision reference (on the detail page and as JSON). | Requirement sets are complete for few records; alternative pathways and exceptions modelled case by case; no external audit yet. |
| 3 | Change, conflict and staleness detection | Versioned records with snapshots; status/deadline amendments, extensions and next cut-offs; cross-source conflict detection; stale detection per record; deadline sweep. **New: changes in official budget, conditions, submission and documents are detected and logged; each record shows its change history.** | Scheduled runs are off (hosting approval); legal-text change detection for Greek sources (ΦΕΚ/Διαύγεια) not built; notifications not sent. |
| 4 | Privacy-preserving personalisation | Accounts optional for browsing; "Not sure" / "Prefer not to say" never count against anyone; profile fields are explicit and minimal; password gate for the private preview. **New: missing questions are ranked by how many opportunities they unblock, so people answer only what matters.** | Privacy/GDPR review and DPIA before real users; per-answer metadata (when updated, source, verified); restricted handling of sensitive fields; country-specific administrative models beyond Greece. |
| 5 | Independently validated improvements | Automated tests on engine, ingestion, connector and UI behaviour. **New: a gold-standard set of eligibility cases written from the official rules of the hand-checked records, and a reproducible quality report (coverage, freshness, conflicts, processing time) — the baseline any improvement is measured against.** | Independent validation (a third party re-checking the gold set and results); comparison with existing services; larger gold set across more programmes and countries. |

## How to read "New" above

Each "New" item is built and tested in the repository (see `BUILD_PLAN.md`, entry of 15 Oct 2026). None of them changes
who is eligible for what: they make the existing decisions inspectable, keep track of what changed in official
sources, reduce what people are asked, and measure quality.

## Baseline measured on 15 Oct 2026 (scripts/quality-report.ts, preview database, engine 2026-10-13.2)

| Measure | Value | Reading |
| --- | --- | --- |
| Gold cases passed | 19 / 19 | The gold set was written by the same team that built the rules, from the same 8 hand-checked records. A full score shows the engine applies those rules as written — it is **not** an independent accuracy result. Next: a third party writes and checks cases. |
| Records with amount information | 40.9 % of 1,011 | Verified benefit, per-applicant amount or the official call budget. |
| Records with a per-project amount | 35.7 % | Only where the source publishes it. |
| Records with structured conditions | 80.6 % | Mostly programme-level defaults for EU calls; few call-specific rules. |
| Records with a complete set of conditions | 0 % | No record yet has every official condition recorded — the main gap for capability 1. |
| Records with official condition text | 41.6 % | EU condition headings + hand-checked rules. |
| Bilingual records | 0.8 % | The 8 hand-checked records. |
| Deadline passed but still listed open by the source | 58.7 % | Shown as "awaiting confirmation", never as open. |
| Ingestion speed (EU portal) | 1,003 items in 22.5 s (≈ 22 ms per item) | One run on GitHub's machines. |

Rule: these figures are a starting point to improve against, not claims. Nothing here is published until independently re-checked.
