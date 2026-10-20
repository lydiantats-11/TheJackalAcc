# Business & Organisations sprint: first findings (20 Oct 2026)

Status: research only. Nothing has been imported, published or reclassified. Evidence is in `data/research/business-candidates-2026-10-20.json`, with `imported: false`.

## 1. Baseline: what Jackal has for businesses today

- **Records.** There are 12 hand-checked records. Only 4 are relevant to businesses:
  - EIC Accelerator (EU)
  - TED tenders (EU)
  - Άρθρο 5Α ΚΦΕ (investor tax regime)
  - the ΕΣΠΑ «Ξεκινώ Επιχειρηματικά» research example, which is not published
  
  There is **no Greek hiring subsidy and no ΔΥΠΑ business programme**. The other business-facing results are imported EU Funding & Tenders calls.
- **Profile.** The business fields already exist:
  - stage, legal form, registration date and country, region (NUTS-2), municipality
  - employees, turnover and balance-sheet ranges, SME linkage and public ownership
  - sectors (NACE *section letters only*), de minimis received over 3 years, own contribution, project budget
  
  These questions are missing, and every ΔΥΠΑ programme below depends on them:
  - **KAD** (exact activity code, KAD 2025 version)
  - **staff reductions** in the last month, quarter or 12 months
  - **plans to hire** (how many, full or part time, which groups)
  - whether the employer can submit on gov.gr or ΟΠΣΚΕ
- **Guides.** There is one guide (the unemployment benefit application, still a draft). There are no business guides.

## 2. ΔΥΠΑ catalogue (prosvasis.dypa.gov.gr, all 9 pages read)

The catalogue labels 10 programmes as «Ανοιχτό». Every candidate below was checked on its own programme page. **None reaches open-verified.** The reason is that the deciding evidence (the invitation PDF with the application window, or the live gov.gr service) could not be read; see section 4.

| Programme | Page label | Status (evidence) | Key facts read on the official page |
|---|---|---|---|
| 10,000 unemployed women | Open | **unconfirmed**: invitation 16/01/2026; no end condition readable | Private employers nationwide; 70–80%, up to €879.20 / €1,004.80 a month full time, €680 part time; 12+3 months |
| 5,000 unemployed aged 50+ (private) | Open | **unconfirmed**: started 01/10/2025; nothing dated since | De minimis 50–80% (€628–€1,004.80) or GBER 50% (€1,000); 18 months |
| 2,000 in Eastern Macedonia & Thrace | Open | **unconfirmed**: started 13/03/2026 | 70% (de minimis) or 50% (GBER), cap €875 a month; 12 months |
| Fur industry | Open | **unconfirmed**: started 21/01/2026 | Sector-specific; contributions plus up to €550 net a month for 24 months |
| Work experience 30+ | Open (catalogue only) | **unconfirmed**: page not read (URL too long for the tool) | — |
| Minimum Guaranteed Income action | Closed | **closed**: deadline 15/04/2026 | 100%, up to €1,118 a month |
| €17,500 entrepreneurship, ages 18–29 | Closed | **closed**: results 03/06/2026, budget exhausted | For unemployed people, not existing businesses; €4,700 + €6,400 + €6,400 |
| Vulnerable groups (3,000 + 7,000) | Closed | **closed**: deadlines 06/10/2025 (B) and 07/04/2026 (A) | — |
| Energy-transition areas (ΕΣΔΙΜ) | Open | **unconfirmed / conflicting**: 21/04/2026 notice says Western Macedonia closed; no word on Megalopoli or the islands | Up to €1,185 a month (€14,220) for ex-lignite workers, €829.50 for others; applications on ΟΠΣΚΕ |

Also checked:
- **Thessaly livestock work experience (250 places).** Unconfirmed. There is no employer subsidy: ΔΥΠΑ pays participants €748 a month.
- **56+ after the 55–67 programme.** Unconfirmed. Private employers; up to €715 a month; 12 months.
- **Out of business scope:**
  - 55+ (public bodies only)
  - ΑμεΑ in ΟΤΑ (municipalities only)
  - ΛΑΡΚΟ (former workers of one company)

**Count so far:** 11 programmes read; 3 confirmed closed; **0 open-verified**. A table of 20–30 verified items is not supported yet.

## 3. Credibility observations

- Every «Ανοιχτό» ΔΥΠΑ page gives no end date and no "until places run out" wording on the page itself. The label is the only signal, and the brief says not to rely on it.
- The ΕΣΔΙΜ page is labelled open but carries a closure notice. Catalogue labels can therefore be stale.
- Several «open» programmes have had no dated update for a long time:
  - 5,000 aged 50+: nothing since 01/10/2025
  - 56+: nothing since 05/12/2025

## 4. Access limitations (reported, not bypassed)

- `www.dypa.gov.gr`, `www1`, `www2` and `dypa.gov.gr` are blocked to the research tool by robots.txt.
- `prosvasis.dypa.gov.gr/storage/*` is blocked by robots.txt. This covers every invitation, ΦΕΚ and ΚΥΑ PDF, so the ΑΔΑ numbers, application windows and employer document lists were not read.
- gov.gr service pages fail for the research tool. GitHub Actions earlier received HTTP 403.
- The 30+ page URL exceeds the tool's length limit.
- The workspace shell cannot reach these sites.

## 5. Proposed next steps (need approval)

1. **Owner-supplied PDFs.** Lydia downloads 5 invitation PDFs from the prosvasis pages and attaches them: 10,000 women, 5,000 aged 50+, 2,000 ΑΜΘ, ΕΣΔΙΜ amendment 2 (17/04/2026), and 30+. This is the fastest way to move each one to open-verified or closed, with ΑΔΑ and window evidence. The alternative is to accept that these stay "unconfirmed".
2. Continue Phase 2 on the reachable sources:
   - efepae / antagonistikotita (ΕΣΠΑ calls for businesses)
   - ΑΑΔΕ (A.1117/2026, KAD 2025)
   - e-ΕΦΚΑ
   - ΟΠΣΚΕ public call list
3. **Profile proposal** (no code yet): KAD 2025 code(s), staff-reduction history, hiring intent and de minimis headroom. These turn the ΔΥΠΑ hiring programmes into deterministic eligibility checks.
4. **Website** (proposal only): a «Για επιχειρήσεις → Προσλήψεις με επιδότηση» view inside the existing Ευκαιρίες tab, showing the status label and the «Τι δεν γνωρίζουμε ακόμη» list per record.
