# Business candidates vs current Jackal records (audit, 20 Oct 2026)

**What was compared.** The 25 research candidates in `data/research/business-candidates-2026-10-20.json` against:
- the 12 hand-checked records (`data/official-records-2026-10-14.v2.json`, `db/seed/official-records-2026-10-14.sql`);
- the synthetic test records (`db/seed/synthetic-opportunities.ts`);
- the registered sources (`db/seed/sources.ts`);
- the imported EU Funding & Tenders calls, which are all EU-level, so none can match a Greek regional call.

**Result.** None of the 25 candidates exists in the database. No candidate duplicates another, but 9 calls appear on two official sites (ΕΦΕΠΑΕ and ΟΠΣΚΕ). They should become **one record with two source links**, keyed by the official ΟΠΣ ΕΣΠΑ number.

## Decision table

| # | Candidate | Official ID | Status (20/10) | Action | Reason |
|---|---|---|---|---|---|
| 1 | «Νέα Ευκαιρία» Ήπειρος | ΠΗΠΕ-06/3.0; ΑΔΑ 9ΨΩ67Λ9-ΣΨΨ | open-verified, **closes 21/10 15:00** | **NEW, time-critical** | Deadline confirmed by the 2nd amendment (Α.Π. 1814/12-08-2026). Worth importing only if approved before 21/10 15:00; after that it is history. Original call text not read (diavgeia blocked). |
| 2 | ΔΑΜ21: new and under-establishment SMEs, ΕΣΔΙΜ | 1.2.5.2 / ΟΠΣ 23467; ΑΔΑ ΨΖΤΑΗ-ΩΩ1 | open-verified to 16/11 14:00 | **NEW, ready** | 1st amendment read: deadline moved from 30/09 to 16/11. |
| 3 | ΔΑΜ22: existing SMEs, ΕΣΔΙΜ | 1.2.6.2 / ΟΠΣ 23487; ΑΔΑ 94ΨΑΗ-6ΩΒ | open-verified to 16/11 14:00 | **NEW, ready** | 1st amendment read. The ΟΠΣΚΕ page still shows 30/09 (stale); the record must cite the amendment. |
| 4 | ΔΑΜ23: existing large enterprises, ΕΣΔΙΜ | 1.4.1.2 / ΟΠΣ 23466 | open-verified to 16/11 14:00 | **NEW, ready** | 1st amendment read. Aid rates by cost type are on ΟΠΣΚΕ. |
| 5 | ΔΑΜ24: new large enterprises, ΕΣΔΙΜ | 1.4.2.2 / ΟΠΣ 23486; ΑΔΑ Ψ45ΦΗ-Θ5Χ | open-verified to 16/11 14:00 | **NEW, ready** | 1st amendment read. |
| 6 | «Καινοτομώ στην Κρήτη» | CRETE_1.1.2.1 / ΟΠΣ 24787 | open-verified to 30/11 15:00 | **NEW, ready** | Call text read. **Aid is 75%.** The 40% and 60% figures are the budget split between categories (€1m / €1.5m), not aid rates. De minimis. |
| 7 | South Aegean entrepreneurship | 75_Δ.1.7 / ΟΠΣ 24506 | open-verified to 30/10 15:00 | **NEW, ready** | 1st amendment read (no deadline change). The 60% aid rate comes from the ΕΦΕΠΑΕ page; the call text was not read. |
| 8 | South Aegean business–research cooperation | 76_Δ.1.2 / ΟΠΣ 24767 | open-verified to 11/12 15:00 | **NEW, ready** | Call text read (conditions, aid range, GBER). The window comes from the ΟΠΣΚΕ and ΕΦΕΠΑΕ pages. |
| 9 | North Aegean tourism and agricultural processing | ΠΒΑΡ05/ΒΑ_ΕΤΠΑ_1.3_56 / ΟΠΣ 20505 | open-verified to 17/11 15:00 | **NEW, ready** | 2nd amendment read: deadline moved from 30/09 to 17/11, and the employment-retention duty was removed. |
| 10 | «Επιχειρώ Στερεά» | Κωδ. 79 / ΟΠΣ 21766 | open-verified to 30/10 | **NEW, ready** | 3rd amendment read: deadline 30/10/2026; **total budget €25m** (the €12m/€16m figures on the portal are superseded). |
| 11 | Attica research & innovation partnerships | αττ130; Α.Π. 2089/29-09-2026 | open-verified to 28/01/2027 15:00 | **NEW, ready** | Call text read: needs at least one enterprise plus one research organisation. |
| 12 | Rethymno landslide support, round 1 | ΚΥΑ 74047/05-10-2026, ΦΕΚ Β' 6168 | open-verified to 23/10 | **NEW with caveat** | Window from the minfin press release; ΚΥΑ text not read. Expression of interest only, no amount. Very narrow area. |
| 13 | STEP & Defence in-company training | call PDF on ΟΠΣΚΕ | announced, opens 02/11 | **NEW as "upcoming"**, after the call text is read | Dates come from the ΟΠΣΚΕ page only. |
| 14–21 | ΔΥΠΑ hiring and work-experience programmes (10,000 women; 5,000 aged 50+; 2,000 ΑΜΘ; fur industry; 30+; Thessaly 250; 56+) | — | unconfirmed | **HOLD** | The page label is the only sign they are open; invitation PDFs are blocked by robots.txt. |
| 22 | ΔΥΠΑ ΕΣΔΙΜ hiring subsidy | ΟΠΣΚΕ call (2025) | Western Macedonia **closed** 21/04/2026; Megalopoli and islands unconfirmed | **HOLD** | Partly resolved; see "Conflicts". |
| 23 | CRGR-Animate cash rebate | ΦΕΚ Β' 84/24-01-2026 | unconfirmed | **HOLD** | No application window shown. |
| 24–26 | Closed: ΔΥΠΑ 18–29 €17,500; Minimum Guaranteed Income action; 3,000 + 7,000 | — | closed | **HOLD (do not import as opportunities)** | Possible future use: "past programmes" context in guides. |

Count of rows 14–21: 7 ΔΥΠΑ programmes, plus row 22 and CRGR (row 23) = **9 unconfirmed**.

**Totals (25 programmes read):**
- 12 open-verified (rows 1–12)
- 1 announced (row 13)
- 3 closed (rows 24–26)
- 9 unconfirmed (rows 14–23)

The conflicting ΔΥΠΑ ΕΣΔΙΜ record is one of the 9 unconfirmed, not an extra record.

**Ready for import if you approve:**
- **10 records:** rows 2–11.
- **Row 1** only before 21/10 15:00.
- **Row 12** with its caveat.

## UPDATE items in existing data (not opportunities)

| Item | Action | Reason |
|---|---|---|
| `db/seed/sources.ts`: no source rows for **ΟΠΣΚΕ (opske.gr)**, **ΕΦΕΠΑΕ (efepae.gr)**, **minfin.gov.gr**, **ΑΑΔΕ (aade.gr)** | **UPDATE (needs approval)** | Every imported record must point to a registered official source with allowed hosts. `prosvasis.dypa.gov.gr` is already covered by the existing `dypa.gov.gr` host rule (sub-domains allowed). |
| `dypa` source note says "blocked_by_robots" | **UPDATE** | It is true for www/www1/www2 and `/storage/`, but the `prosvasis.` programme pages are readable. |
| Synthetic test records «[ΔΟΚΙΜΑΣΤΙΚΟ] Πρόγραμμα ενίσχυσης νέων επιχειρηματιών 18–29» and «[ΔΟΚΙΜΑΣΤΙΚΟ] Κίνητρα τουριστικών επενδύσεων — Κρήτη» | **FLAG** | They look like real programmes (the closed ΔΥΠΑ 18–29 grant; Crete calls). They are clearly labelled, but should never appear in the business view next to real records. Proposal: exclude synthetic records from `/for-business`. |
| ΕΣΠΑ «Ξεκινώ Επιχειρηματικά» research example (lab page) | **UPDATE research note** | ΕΦΕΠΑΕ posted the 1st approval decision for less-developed regions on 07/10/2026. It remains research only. |

## Proposed import rules (for approval)

1. **Key.** `opske:<ΟΠΣ ΕΣΠΑ number>`, e.g. `opske:23467`. If ΕΦΕΠΑΕ and ΟΠΣΚΕ show the same call, it becomes one record with both links.
2. **Deadline evidence.** The governing document is the latest amendment. When a portal page disagrees with it, the record notes the discrepancy (as with ΔΑΜ22).
3. **Status.** Status is `open` only with an explicit window read from an official document or page. Every record gets a re-check date of no later than its deadline. A deadline closer than 7 days triggers the «Κλείνει σύντομα» flag (this ties into your deadline-alert idea).
4. **Unknown fields.** Fields not read stay UNKNOWN and appear under «Τι δεν γνωρίζουμε ακόμη».
