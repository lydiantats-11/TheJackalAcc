# ΕΣΠΑ design-validation case — «Ξεκινώ Επιχειρηματικά» (research only, 17 Oct 2026)

Owner approval: 17 Oct 2026 («approved for research»). **Not imported, not published, not an approved record.**
Purpose: test whether the opportunity-detail template can carry a complex ΕΣΠΑ business grant.

Why this call: an official national ΕΣΠΑ 2021-2027 action aimed at people starting a business (B2C-relevant), with a
full lifecycle on record — call, two amendments, FAQ, results. Its window **closed on 30/06/2026**, so it also tests the
«deadline passed» and «results published» states. espa.gr itself blocks our research tool; the intermediate body's site
(efepae.gr) is the official source used here.

## Sources (read 17 Oct 2026)

| # | Source | Status |
| --- | --- | --- |
| E1 | [ΕΦΕΠΑΕ — Ξεκινώ Επιχειρηματικά (action page)](https://efepae.gr/drasi/%CE%BE%CE%B5%CE%BA%CE%B9%CE%BD%CF%89-%CE%B5%CF%80%CE%B9%CF%87%CE%B5%CE%B9%CF%81%CE%B7%CE%BC%CE%B1%CF%84%CE%B9%CE%BA%CE%B1/) | Read; marks the action «Ανενεργή» |
| E2 | [Call, Α.Π. 67978 ΕΞ 2026, 30/04/2026 (PDF)](https://efepae.gr/wp-content/uploads/2026/04/9ΡΙΒΗ-ΔΟΟ_ΥΑ_-ΞΕΚΙΝΩ-ΕΠΙΧΕΙΡΗΜΑΤΙΚΑ.pdf) | **Only the decision and section 1 were readable**; sections 5, 9, 9.1, 10, 11, 17 not yet read |
| E3 | [1st amendment (PDF)](https://efepae.gr/wp-content/uploads/2026/04/ΡΩ9ΤΗ-ΔΝΟ_ΥΑ-1ης-ΤΡΟΠ_ΞΕΚΙΝΩ-ΕΠΙΧΕΙΡ.pdf) · [2nd amendment (PDF)](https://efepae.gr/wp-content/uploads/2026/04/20260715_2h_trop_prosklhshs_xekinw_epixeirhmatika.pdf) | Not read; E1 gives two different dates for each (02/06 vs 12/06; 16/07 vs 03/09) — **conflict to resolve from the PDFs** |
| E4 | [Programme page (antagonistikotita.gr)](https://21-27.antagonistikotita.gr/xekino-epicheirimatika/) | Fetch failed (server error) |

## Facts as found (E1 unless stated) — every line still needs field-level checking against E2/E3

| Field | Value | Template field it tests |
| --- | --- | --- |
| Programme / fund | Ανταγωνιστικότητα 2021-2027, ΕΚΤ+ | authority, funding source |
| Intermediate body | ΕΦΕΠΑΕ | issuing authority |
| Budget | €70m (€55m less-developed regions; €15m transition regions: Αττική, Νότιο Αιγαίο) | split budget by region |
| Applicants | Micro/very small enterprises under establishment (cat. A) or started 1/1/2025–submission (cat. B); sole traders and companies | applicant type = both (person who will found a business) |
| Founder conditions | First tertiary degree obtained after 1/1/2016; individual income ≤ €30,000 (Table Γ), protected member without filing duty: family income ≤ €75,000; not employed or old-age pensioner; no ≥25% stake elsewhere since 01/2025 | income and date thresholds with units |
| Premises | Separate professional space, not the home of the beneficiary or 1st/2nd-degree relatives; one establishment | conditions that profile cannot answer → «Χρειάζονται στοιχεία» |
| Aid | Lump sum €13,000 (individual) or €21,000 (company) in 3 semester milestones; + up to €15,000 per new job (1 ΕΜΕ); 100% public funding | amount table with conditions |
| Operation | 12 or 18 months; ≥ 2 verified milestones or recovery | obligations after approval |
| Eligible costs | Simplified costs: operating expenses, third-party services, promotion, consumables, equipment, own social security, 1 ΕΜΕ | list |
| State aid | De minimis, Reg. (EU) 2023/2831; ceiling €300,000 per single undertaking over any 3 years (E2, definitions, p. 6) | de minimis explainer link |
| ΚΑΔ | Only those in Annex II of the call (examples on E1: ICT, STEM, tourism) — **annex not read** | ΚΑΔ list (long) |
| Geography | Whole of Greece, two region categories | region filter |
| Window | 06/05/2026 15:00 – 30/06/2026 15:00 (E1, E2 para. 8) | **deadline passed** |
| Platform | ΟΠΣΚΕ, https://app.opske.gr/ | application destination |
| Evaluation | Comparative (all applications ranked together) | how it is decided |
| Documents | Tax assessment summary; E1 for protected members; sworn-statement templates; full list in call §9.1 — **not read** | documents: «incomplete» state |
| Results | Transition regions 03/09/2026; less-developed regions 07/10/2026 (E1 links) | «results published» milestone |

## What the template needs (design findings)

1. A **«Η προθεσμία έληξε — δημοσιεύθηκαν αποτελέσματα»** state with links to results, instead of only «έληξε».
2. **Amendments timeline** (call → amendments → FAQ → results) with dates; conflicting dates must show as conflicting.
3. **Amounts table** with conditions per applicant form, not one «Ποσό» value.
4. **Region categories** and split budget.
5. **ΚΑΔ annex** as a searchable collapsible list linked to the official annex.
6. Conditions the profile cannot answer (premises, stakes in other businesses) stay «Χρειάζονται περισσότερα στοιχεία».

## Before this could become a record (needs your approval)

Read E2 §§5, 9, 9.1, 10, 11, 17 and both amendments; resolve the amendment-date conflict; capture verbatim quotes per
condition. Because the window is closed, it would enter only as a «closed / results published» record, or wait for a
new cycle.
