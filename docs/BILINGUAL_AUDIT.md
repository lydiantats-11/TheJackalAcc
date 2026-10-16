# Bilingual content audit — Greek / English (16 Oct 2026, Workstream D)

## What was checked

Navigation, homepage, opportunities list and detail, profile, For Me, guides, About / How it works, eligibility labels
and explanations, decision record, empty and error states, verification and application-status labels, dates, times and
amounts. Two full language passes were already made on 16 Oct (commits "Language pass EL/EN" and "Language pass 2");
this audit checks the new Guides work and the places where official text and platform text meet.

Automated checks (`tests/i18n.test.ts`, run on every push): same keys in Greek and English; Greek always addresses
the reader formally (εσείς / «σας»); no Greek in English text except official names and acronyms; no empty strings,
doubled spaces or stray spaces before punctuation; no time-zone codes in visible text; Greek sentence case for
categories. Now also covers the eight guide categories. The unemployment guide has its own checks
(`tests/guides-catalog.test.ts`): formal Greek, and Greek in the English text only inside «» official names.

## Corrected in this workstream

| Where | Change |
|---|---|
| Guides | All new labels in both languages: categories, search, empty states, six verification states with explanations, application statuses, section headings, reading time (Greek singular «1 λεπτό ανάγνωσης») |
| Guide pages (English) | Note that English text is the platform's translation of Greek official sources |
| Opportunity detail, hand-checked Greek records (English) | Summary note now says the English text is the platform's translation, not an official one |
| Opportunity detail, EU calls (Greek) | Note that the official text is published in English only and is shown as published, untranslated |
| Primary buttons | Stronger blue, same wording in both languages |

## Official wording stays accessible

- The official title is shown under the translated title whenever they differ (opportunity detail).
- Deadlines keep the source's own wording («Όπως το γράφει η πηγή» / "As the source puts it").
- EU scope text and conditions are shown in the original language, marked with `lang="en"` for screen readers.
- Guides link every official source; quotes in the record files are kept verbatim.

## Missing translations (reported, not done)

| Content | Volume | Greek users see |
|---|---|---|
| EU Funding & Tenders call titles, scope text, condition headings | ~1,000 records | English original, with the note above |
| Hand-checked records | 8 of 8 bilingual | Both languages |
| Official PDF and page names in source lists | all | The authority's own language |

## Translation workflow for later (design, not built)

Machine translation must never be presented as an authority's wording. Proposed workflow:

1. **Keep the original.** Every official field keeps its source text and language; translations are stored beside it,
   never instead of it (`field`, `field_lang`, `field_translations[locale] = { text, method, reviewed_by, reviewed_at }`).
2. **Translate titles and short summaries only**, never conditions or legal text. Conditions stay in the original with a
   plain-language explanation written and reviewed by a person.
3. **Label the method** on screen: "platform translation" or "machine translation, not reviewed". Machine output is
   shown only after a reviewer approves it, and only for titles.
4. **Re-translate on change.** The official-details change detection (migration 0010) marks a translation stale when
   its source text changes.
5. **Priority:** EU calls that are open and relevant to Greek applicants first; closed calls never.
6. **Cost:** any paid translation or AI service needs the owner's approval first (Rule 4).
