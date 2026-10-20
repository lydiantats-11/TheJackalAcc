# Open decisions, blockers and next actions

Single source of truth for project status. The daily report (`scripts/daily-report.mjs`) reads the three lists below;
keep each item to one line and remove it when it is settled. Last updated 17 Oct 2026.

Settled on 16 Oct (owner): Guides Phase 2 approved; unemployment guide stays a draft; daily report task stays active;
private hosting postponed; fictional test profiles only.

Settled on 17 Oct (owner): navigation has five tabs — Αρχική · Ευκαιρίες · Για Εμένα · Οδηγοί · Πώς λειτουργεί, plus
EL/EN and the profile menu («Για Εμένα» keeps its name); palette navy #102B49, blue #2563EB for actions, ice blue #E9F1FC,
off-white #F6F8FB, border #D6E2EE, no gold, status colours only for verified states; order: Milestone 2, then design in the
order Homepage → opportunity cards and detail → personal dashboard → Guides → How it works.

Settled on 17 Oct (owner, 13:35): Milestone 2 approved; source-connector order approved (docs/SOURCE_COVERAGE.md, nothing
switched on); Option C approved in principle (exact wording pending); ΕΣΠΑ example approved for research only; A21 approved
for re-verification; design work continues without changing the engine, approved records or navigation.

## Decisions needed

- Approve the 7 record revisions item by item (table in today's report; data/proposed-revisions-2026-10-16.json).
- Approve the A21 re-verification proposals (docs/research/A21_REVERIFICATION_2026-10-17.md): refresh verified date, add school-attendance condition, November payment note.
- Approve the document lists (data/document-lists-2026-10-17.json): A21 updated with 2026 notice, 5Γ now itemised from Α.1087/2021.
- Confirm the exact Option C wording (docs/TAXONOMY_PROPOSAL_2026-10-17.md §5) before it is applied.
- Choose on the proposed 8-category taxonomy and EU-as-geography (docs/TAXONOMY_PROPOSAL_2026-10-17.md).

## Blockers

- Unemployment guide: redacted ΔΥΠΑ screenshots from the owner are needed to confirm three steps.
- espa.gr help-desk and call pages refuse automated reading; ΕΣΠΑ research needs the owner to open them or a chosen call PDF.
- Legal review needed before real users: controller, privacy notice, transfers, DPIA (docs/GDPR_READINESS_CHECKLIST.md).

## Next

- Read the student housing circular (income criteria, documents) and the later amendments to Α.1087/2021.
- Read Reg. (EU) 2023/2831 Art. 3 and 6 and the Greek de minimis register page; draft the de minimis explainer.
- Confirm A21 income limits (€6,000 / €10,000 / €15,000 equivalent income, found on a secondary legal site) against the official ΦΕΚ text.
- ΕΣΠΑ «Ξεκινώ Επιχειρηματικά»: read call §§5, 9, 9.1, 10, 11, 17 and both amendments; resolve amendment-date conflict.

## Decided 20 Oct 2026 — one platform, audience-specific journeys (direction approved, not yet built)
- One site, one database, one eligibility engine, the existing five tabs. No separate business portal, no duplicate records, no second account system.
- Audience switch «Ιδιώτες | Επιχειρήσεις & Οργανισμοί» plus "all".
- Three separate dimensions: who you are (individual, business, non-profit, public body, adviser); business stage and size (planning / new / existing; micro / small / medium / large); what you look for (funding, subsidised hiring, loans, tax incentives, procurement, guidance).
- Funding opportunities, regulatory updates and guides stay separate content types.
- Proposed `/for-business` landing page on the existing design system and shared records.
- Browsing without registration; progressive business profiling (location, KAD, size, interests first; de minimis, staff cuts etc. only when an opportunity needs them).
- No fixed record count before launch: launch criteria are verified statuses and source links, region/KAD filtering, several useful guides, and a clear statement of what Jackal can and cannot determine.
- Taxonomy unchanged until approved.
- Order of work: finish official-source research and record audit → user journey, page structure and screen sketches for approval → then code.
