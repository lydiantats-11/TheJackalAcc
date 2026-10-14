# Eligibility interpretations — tested against real calls

Researched 2026-10-13. Each question below lists the official evidence, the decision taken, how the engine now
behaves, and the test that proves it (`tests/real-calls.test.ts`, 22 tests).

The real-call requirements are transcribed into `tests/fixtures/real-calls.ts`, for **testing interpretation only**.
They do not assert that any call is open today and are never shown to users.

## Calls used

| Code | Call | Source | Notes |
|---|---|---|---|
| DYPA | ΔΥΠΑ — grant for new self-employed up to 29 (€14,800 over 12 months, digital economy emphasis) | [DYPA information leaflet (PDF)](https://www1.dypa.gov.gr/storage/apaskholisi/nee-18-29-o2ne-pshfiakh-ikonomia/enhmerotiko-nee-18-29.pdf) | The leaflet carries no publication date; no deadline is stated; applications are ranked and funded until the budget runs out |
| ESPA-T | ΕΣΠΑ 2021–27 — Founding and operation of new tourism SMEs | [ΕΦΕΠΑΕ action page](https://efepae.gr/drasi/%CE%B5%CE%BD%CE%AF%CF%83%CF%87%CF%85%CF%83%CE%B7-%CF%84%CE%B7%CF%82-%CE%AF%CE%B4%CF%81%CF%85%CF%83%CE%B7%CF%82-%CE%BA%CE%B1%CE%B9-%CE%BB%CE%B5%CE%B9%CF%84%CE%BF%CF%85%CF%81%CE%B3%CE%AF%CE%B1%CF%82/) | The page shows the action as inactive. Call issued 18/12/2023, with 10 amendments up to 06/03/2026. Comparative evaluation; de minimis basis |
| EIC | EIC Accelerator 2026 | [EIC FAQ (official)](https://eic.ec.europa.eu/eic-frequently-asked-questions/faqs-eic-accelerator_en) | Covers Work Programme 2026 and its 17 June 2026 amendment |
| HE | Horizon Europe WP 2026–27, General Annexes | [General Annexes (copy hosted by Science\|Business)](https://sciencebusiness.net/sites/default/files/inline-files/HORIZON-General-annexes-2026-2027_05_18_2026.pdf) | Not the official host; to be replaced with the Commission's copy |
| DM | De minimis Regulation (EU) 2023/2831 | [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2023/2831/oj/eng); [legal summary (MLGTS)](https://www.mlgts.pt/en/knowledge/legal-alerts/Legal-Alert-Increase-of-the-de-minimis-regulation-and-the-de-minimis-regulation-for-SGEI-exemption/24748/) | In force 1/1/2024–31/12/2030 |
| SME | Commission User Guide to the SME Definition (2020) | [European Commission](https://ec.europa.eu/docsroom/documents/42921/attachments/1/translations/en/renditions/native) | Non-binding; Recommendation 2003/361/EC is the authority |
| GBER | Regulation 651/2014, Art. 6 (incentive effect) | [Text as adopted](https://legislation.gov.uk/eur/2014/651/article/6/adopted?view=plain) | — |

## The nine questions

### 1. At which date is age measured?
- **Evidence.** DYPA applies its criteria at the funding application ("κατά την αίτηση χρηματοδότησης"). ESPA-T measures business age at the call's issue date.
- **Decision.** Every age or business-age rule carries a reference: `application`, `call_publication`, or a fixed date. If the call date is unknown, the rule stays unknown. An age range is used only when the whole range falls on one side of the limit. Otherwise we ask for year of birth, and only for that rule.
- **Engine.** The user can give a planned application date, and a later date can turn a pass into a fail.
- **Remaining risk.** Calls that say "up to the year in which the applicant turns X" need a `year_turning` mode. Not added until a call needs it.

### 2. "Anywhere in Greece" vs regional calls
- **Evidence.** ESPA-T is nationwide, but excludes the Mykonos and Thira regional units, except the community of Thirasia. Each applicant declares one region.
- **Decision.** A regional call is never assumed to suit an "anywhere in Greece" user; we ask whether they would establish there. Sub-regional exclusions are decided automatically only when the call lists the municipalities affected. Otherwise the result is "check the official wording". We never guess which municipalities belong to a regional unit.

### 3. Available capital vs own contribution
- **Evidence.** ESPA-T applicants must prove they have secured at least 60% of the private share. With 45% aid intensity, the private share is 55% of the budget.
- **Decision.** The amount to prove is budget × private % × proof %. This is shown with its inputs. A capital range is compared only when the whole range is clearly above or below that amount. No budget means no assumption.
- **Example.** A €200k budget means €66k must be proven. Someone with "over €50k" stays unknown.

### 4. When must the business be registered?
- **Evidence.**
  - DYPA: the business starts at the tax office after the application date, and at the latest 60 days after notice of a positive evaluation.
  - ESPA-T has two routes. "Under establishment" means set up after the call was issued and before the first payment. "Newly established" means at most 12 months old at the call date.
  - EIC: non-associated-country firms must be established by the full proposal.
- **Decision.** A new `registration_timing` rule with `not_before` and `by`. A not-yet-registered applicant satisfies the rule today and gets a stated **obligation** (for example, "start activity within 60 days of approval"). A business registered too early does not satisfy it.
- **Scenarios.** "Register now" is tested against the planned application date. Registering before applying breaks the DYPA rule, and the scenario shows that.

### 5. "No expenditure before applying" vs "before approval"
- **Evidence.** GBER Art. 6 requires a written application before work on the project starts. Calls under de minimis (such as ESPA-T) set their own expenditure rules in the call guide.
- **Decision.** A project that has already started fails. "Before submission" can be checked from the planned start date. "Before approval" stays unknown, because approval timing cannot be known in advance.
- **Open.** "Start of works" in state-aid law includes binding orders and contracts, not only physical start. A dedicated question ("Have you signed orders or contracts for this project?") is planned for the extraction review UI.

### 6. EU SME definition (linked and partner enterprises)
- **Evidence (SME User Guide).**
  - Ceilings: micro under 10 staff and up to €2m; small under 50 and up to €10m; medium under 250, with turnover up to €50m or balance sheet up to €43m.
  - The headcount test is mandatory; then either turnover or balance sheet must be within the ceiling.
  - Partner enterprises (25–50%) add their data proportionally; linked enterprises (over 50%) add 100%.
  - 25% or more public control means the firm is not an SME.
  - New firms use a good-faith estimate.
- **Decision.** A new `sme_status` rule. The firm's own figures decide only when they already exceed the ceilings, or when the firm is confirmed autonomous with no 25% public control. Otherwise we ask. The answer is satisfied if headcount passes and either financial test passes.

### 7. De minimis
- **Evidence (Reg. 2023/2831).**
  - €300,000 per single undertaking over a rolling three years.
  - "Single undertaking" includes linked companies in the same Member State.
  - A central register has been mandatory since 1/1/2026.
- **Decision.**
  - Ceiling, period and rolling basis come from the call; €300k / 3 years is the 2023 regulation default.
  - The answer is unknown until the enterprise relationship is known.
  - An exhausted ceiling is not satisfied. Remaining headroom is reported, not assumed sufficient.

### 8. Eligibility of Greek applicants for EU programmes
- **Evidence.**
  - HE: applicants from Member States are eligible. The default consortium is at least 3 independent entities from 3 countries, unless the topic says otherwise.
  - EIC: Member State companies are eligible, as are SMEs and small mid-caps up to 499 staff. The FAQ does not address natural persons.
- **Decision.**
  - Horizon topics get the default consortium rule as **information** (asked about, never decisive) until the topic's conditions are extracted.
  - The EIC natural-person question is recorded as "needs review", so a person without a company sees "under review", not a guess.

### 9. Date-only deadlines
- **Evidence.** None of the real calls examined used a date-only deadline. ESPA-T states 15:00 Athens time; EIC states 17:00 Brussels time.
- **Decision.** Kept: exact times in the source's timezone. Date-only deadlines (still possible elsewhere) count from the start of that day, are flagged, and keep the original wording.

## Also learned
- **Budget exhaustion is real.** DYPA funds in ranking order until the budget is spent. We report "closed — budget exhausted" only when an official notice confirms it.
- **Amendments are frequent.** ESPA-T had 10 amendments in about 2 years, so version history and re-matching are essential, not optional.
- **Paraphrase vs verbatim.** Paraphrased evidence is not enough to tell a user they are ineligible. Records without verbatim official wording carry medium confidence: they can make a call "unlikely", never "ineligible under the verified rules". Verbatim capture is a job for the extraction step below.
