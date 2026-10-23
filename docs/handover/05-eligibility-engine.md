# 05 — Eligibility engine

Pure TypeScript in `src/lib/domain`. No AI, no database access, no randomness: the same profile and the same rules
always give the same answer. Rule version: `RULE_VERSION` in `src/lib/domain/eligibility.ts`.

## Three outputs that are never mixed

| Output | Question it answers | Where |
| --- | --- | --- |
| Eligibility | What do the verified rules say about this profile? | `eligibility.ts` |
| Availability | Can the call be applied to now (status, deadline, freshness, conflicts)? | `eligibility.ts`, `status.ts`, `deadline.ts` |
| Relevance | How high to rank it (0–100); **not** a probability of funding | `eligibility.ts` |

## One requirement (`engine/evaluate.ts`)

Each structured requirement (`opportunity_requirements`) evaluates to one of:
`satisfied`, `not_satisfied`, `unknown` (no answer, «not sure» or «prefer not» — never a pass and never a fail),
`not_applicable`, `conflicting` (official sources disagree), or `needs_review` (cannot be safely machine-interpreted).

## Aggregation — first matching rule wins

1. `ineligible_verified` — an applicable mandatory requirement is not satisfied **and** the requirement is
   authoritative (official document, high confidence, no flags).
2. `unlikely_eligible` — a mandatory requirement is not satisfied, evidence not conclusive.
3. `under_review` — a mandatory requirement is conflicting or needs review.
4. `insufficient_information` — no mandatory requirement could be evaluated.
5. `potentially_eligible_verification_required` — some mandatory requirement is unknown, or the requirement set is
   not verified as complete.
6. `potentially_eligible` — every applicable mandatory requirement is satisfied and the set is complete.

There is deliberately no «eligible» outcome: the competent authority decides. Ranking sorts by eligibility first;
relevance only orders within the same outcome.

## Interpretations

Nine hard questions were decided against real calls and are documented in `INTERPRETATIONS.md`. Examples are the
date at which age is measured, own contribution versus available capital, the EU SME definition with linked
enterprises, de minimis, and date-only deadlines. Change an interpretation only with the owner and with a test.

## Deadlines that depend on the applicant (5Α / 5Β)

For the tax regimes of articles 5Α and 5Β ΚΦΕ the deadline depends on the year the person moved their tax
residence. `src/lib/site/move-year.ts` turns the rule (from the record overlay) into per-year windows: `open`,
`passed`, `conditional` (a later year under the current rule, not confirmed) or `previous_rules`. Only a confirmed
window may be called open. The engine receives an explicit «deadline depends on move year» factor, so an unknown
year stays unknown.

## Profile (`profile.ts`, `personas.ts`, `question-impact.ts`)

The profile asks only what matters for the calls in view: questions appear when a call needs them or the user asks.
Personas, interests and industries choose questions and ordering, never eligibility. «What if» scenarios
(`scenarios.ts`) are hypothetical and never saved.

## Tests

`engine.test.ts`, `real-calls.test.ts` (rules from real calls), `question-impact.test.ts`, `scenarios-and-money.test.ts`,
`personas.test.ts`, `residence-and-records.test.ts`, and the database flow in `end-to-end-flow.test.ts`.
