# 13 — K1 source evidence (40 priority terms)

Where each of the 40 priority Γνώση terms stands against official sources, on 24 Oct 2026. The full evidence
(document, exact locator, verbatim quote, draft EL/EN text, open items) is in the owner's workbook,
`Jackal_Knowledge_K1_Verification_Progress_2026-10-24_v3.xlsx`, sheet «K1 — Έλεγχος πηγών 24Oct». The workbook in
`data/knowledge/source/` is the 23 Oct version; it is replaced only when the owner sends a new one, and then
re-imported with `scripts/import_knowledge_register.py` ([07](07-knowledge.md)).

**Nothing here is approved.** «Επιβεβαιώθηκε» means an official source with an exact locator and a verbatim quote was
found. It does not pass the publication gate: an entry still needs EL/EN text, editorial review and the owner's
approval.

| Result | Terms |
| --- | --- |
| Επιβεβαιώθηκε (source confirmed) | 21 |
| Μερικώς (partly) | 9 |
| Δεν επιβεβαιώθηκε (not confirmed) | 10 |

Limits of this check:

- Six confirmations rest on English EUR-Lex texts (ΜΜΕ, ΕΜΕ, συνδεδεμένη επιχείρηση, κύκλος εργασιών, ΓΑΚ,
  δικαιούχος). The Greek EUR-Lex pages were not reachable from the work environment; the Greek text is needed before
  publication.
- Seven rest on the law as first published (ΑΦΜ and φορολογική ενημερότητα: ΚΦΔ 2024; ΦΠΑ: Κώδικας ΦΠΑ 2024;
  φορολογητέο εισόδημα: ΚΦΕ 2013; ΟΕ, ΕΕ, ΙΚΕ: ν. 4072/2012). The current consolidated text must be checked for later
  amendments.
- opske.gr, efka.gov.gr, www1.dypa.gov.gr and the espa.gr library were not reachable. The register's candidate sources
  on opske.gr were therefore not checked.

## Findings that affect more than one entry

- **ΚΑΔ 2025.** Since 1 Mar 2026 the activity codes are the ΚΑΔ 2025, based on NACE Rev. 2.1 (Α.1003/2026 and
  Α.1004/2026). The ΚΑΔ entry must say so.
- **ΕΝΦΙΑ / Ε9.** A January 2026 ΑΑΔΕ decision cites the new Κώδικας Φορολογίας Περιουσίας (ν. 5219/2025, Α' 130)
  alongside ν. 4223/2013. Which text now governs ΕΝΦΙΑ and the Ε9 must be settled before either entry is written.
- **ΟΠΣΚΕ.** Its full name is «Ολοκληρωμένο Πληροφοριακό Σύστημα Διαχείρισης Κρατικών Ενισχύσεων»; the register's
  English title is shorter.
- **δικαιούχος.** The term has a funding sense (Regulation 2021/1060, art. 2(9)) and a benefits sense (ΟΠΕΚΑ). The
  owner decides between one entry with two senses or two entries.
- **ΟΠΕΚΑ** moved to `opeka.gov.gr`; register URLs on `opeka.gr` redirect.

## Term by term

| ID | Term | Result | Source | Exact locator |
| --- | --- | --- | --- | --- |
| LEX-0001 | ΑΦΜ | Επιβεβαιώθηκε | [ν. 5104/2024](https://www.aade.gr/sites/default/files/2024-04/FEK-a58_2024_n5104.pdf) | Άρθρο 10 παρ. 3 (απόδοση) και παρ. 4 (χρήση) |
| LEX-0002 | ΑΑΔΕ | Επιβεβαιώθηκε | [«Κανονισμός Λειτουργίας της Ανεξάρτητης Αρχής Δημοσίων Εσόδων (Α.Α.Δ.Ε.)», Δ.ΟΡΓ.Α 1063420 ΕΞ 2017, 27/4/2017, ΦΕΚ Β΄ 1579/9-5-2017](https://www.aade.gr/sites/default/files/2017-05/kanonismos_aade.pdf) | Άρθρο 1 παρ. 1 (σύσταση, νομική φύση) και παρ. 3 (αποστολή) |
| LEX-0005 | Ε1 | Επιβεβαιώθηκε | [ΑΑΔΕ](https://www.aade.gr/sites/default/files/2026-03/Odigies_E1_2026_0.pdf) | §1.1.1 «Γενικά», σελ. 11· §1.1.2 (παρ. 1 άρθρου 67 ν. 4172/2013) |
| LEX-0010 | φορολογητέο εισόδημα | Επιβεβαιώθηκε | [ν. 4172/2013](https://www.aade.gr/sites/default/files/2017-11/N4172_2013.pdf) | Άρθρο 7 παρ. 1 και 2 |
| LEX-0014 | ΦΠΑ | Επιβεβαιώθηκε | [ν. 5144/2024](https://www.aade.gr/sites/default/files/2024-10/kodikas_fpa.pdf) | Άρθρο 1· άρθρο 2 παρ. 1 περ. α–β |
| LEX-0016 | φορολογική ενημερότητα | Επιβεβαιώθηκε | [ν. 5104/2024](https://www.aade.gr/sites/default/files/2024-04/FEK-a58_2024_n5104.pdf) | Άρθρο 12 παρ. 1 (Αποδεικτικό ενημερότητας και βεβαίωση οφειλής) |
| LEX-0017 | φορολογική κατοικία | Επιβεβαιώθηκε | [ΑΑΔΕ](https://aade.gr/omogeneis-katoikoi-exoterikoy/eisodima/forologiki-katoikia-gia-fysika-prosopa-fke) | Ενότητα «Κριτήρια φορολογικής κατοικίας (άρθρο 4 ΚΦΕ)»· ν. 4172/2013 (Α΄167) |
| LEX-0032 | Ομόρρυθμη Εταιρεία (ΟΕ) | Επιβεβαιώθηκε | [ν. 4072/2012 (Α' 86), Μέρος Έβδομο](https://eyms.businessportal.gr/4072-OE-EE.pdf) | Άρθρο 249 παρ. 1 |
| LEX-0033 | Ετερόρρυθμη Εταιρεία (ΕΕ) | Επιβεβαιώθηκε | [ν. 4072/2012 (Α' 86), Μέρος Έβδομο](https://eyms.businessportal.gr/4072-OE-EE.pdf) | Άρθρο 271 παρ. 1 |
| LEX-0034 | Ιδιωτική Κεφαλαιουχική Εταιρεία (ΙΚΕ) | Επιβεβαιώθηκε | [ν. 4072/2012 (Α' 86/11-4-2012), Μέρος Δεύτερο](https://eyms.businessportal.gr/4072.pdf) | Άρθρο 43 παρ. 1 και 2 |
| LEX-0047 | Μικρομεσαίες επιχειρήσεις (ΜΜΕ) | Επιβεβαιώθηκε | [Σύσταση 2003/361/ΕΚ της Επιτροπής, 6.5.2003](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32003H0361) | Παράρτημα, άρθρο 2 παρ. 1–3 |
| LEX-0048 | ΕΜΕ | Επιβεβαιώθηκε | [Σύσταση 2003/361/ΕΚ της Επιτροπής, 6.5.2003](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32003H0361) | Παράρτημα, άρθρο 5, πρώτη περίοδος |
| LEX-0049 | Συνδεδεμένη επιχείρηση | Επιβεβαιώθηκε | [Σύσταση 2003/361/ΕΚ της Επιτροπής, 6.5.2003](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32003H0361) | Παράρτημα, άρθρο 3 παρ. 3, πρώτο εδάφιο (α–δ) |
| LEX-0055 | κύκλος εργασιών | Επιβεβαιώθηκε | [Σύσταση 2003/361/ΕΚ της Επιτροπής, 6.5.2003](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX%3A32003H0361) | Παράρτημα, άρθρο 4 παρ. 1 |
| LEX-0116 | ΕΣΠΑ | Επιβεβαιώθηκε | [espa.gr](https://espa.gr/el/Pages/SynedrioNeoESPA21-27.aspx) | Εισαγωγικό κείμενο της σελίδας |
| LEX-0117 | ΟΠΣΚΕ | Επιβεβαιώθηκε | [espa.gr](https://www.espa.gr/el/Pages/ProclamationsFS.aspx?item=6832) | Ενότητα υποβολής αίτησης |
| LEX-0120 | δικαιούχος | Επιβεβαιώθηκε | [Κανονισμός (ΕΕ) 2021/1060 (Κοινές Διατάξεις), ενοποιημένο κείμενο 01.07.2026](https://eur-lex.europa.eu/eli/reg/2021/1060) | Άρθρο 2 σημείο 9 |
| LEX-0131 | de minimis | Επιβεβαιώθηκε | [Κανονισμός (ΕΕ) 2023/2831 της Επιτροπής, 13.12.2023](https://opske.gr/sites/default/files/legal-el-2024-06/OJ%20L_2023-2831%20EL%20TXT_0.pdf) | Άρθρο 3 παρ. 2 (ανώτατο όριο)· άρθρο 2 παρ. 2 (ενιαία επιχείρηση) |
| LEX-0132 | ΓΑΚ (Γενικός Απαλλακτικός Κανονισμός) | Επιβεβαιώθηκε | [Κανονισμός (ΕΕ) αριθ. 651/2014 της Επιτροπής, 17.6.2014 (EE L 187, 26.6.2014)](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0651) | Άρθρο 1 παρ. 1· άρθρο 3 |
| LEX-0176 | Α21 | Επιβεβαιώθηκε | [ΟΠΕΚΑ](https://opeka.gov.gr/oikogeneia/epidoma-paidiou-a21/nomothesia/) | Σελίδα «Νομοθεσία»: άρθρο 214 ν. 4512/2018· ΚΥΑ Γ.Π.οικ.Δ22/11/2705/58 (ΦΕΚ Β/2018), όπως ισχύει |
| LEX-0196 | ΦΕΚ | Επιβεβαιώθηκε | [N-Lex (Ευρωπαϊκή Ένωση)](https://n-lex.europa.eu/n-lex/info/info-gr/index?lang=el) | Ενότητες για το Εθνικό Τυπογραφείο και τα τεύχη του ΦΕΚ |
| LEX-0008 | Ε9 | Μερικώς | [ΑΑΔΕ](https://www.aade.gr/en/e9enfia) | Αναφορά στο άρθρο 23 παρ. 1 ν. 3427/2005 (υποχρέωση δήλωσης) και στον ν. 4223/2013 |
| LEX-0012 | τεκμαρτό εισόδημα | Μερικώς | [ΑΑΔΕ](https://www.aade.gr/sites/default/files/2024-05/odigos_amfisvitisi_eee.pdf) | Οδηγός §1 και §2.1 (άρθρο 28Α ν. 4172/2013)· Οδηγίες Ε1 §1.1.1 |
| LEX-0035 | Εταιρεία Περιορισμένης Ευθύνης (ΕΠΕ) | Μερικώς | [ν. 4919/2022, ΦΕΚ Α' 71/07.04.2022 (e-ΥΜΣ, businessportal.gr)](https://eyms.businessportal.gr/4919.pdf) | Άρθρο 7 παρ. 1 περ. β |
| LEX-0036 | Ανώνυμη Εταιρεία (ΑΕ) | Μερικώς | [ν. 4919/2022, ΦΕΚ Α' 71/07.04.2022 (e-ΥΜΣ, businessportal.gr)](https://eyms.businessportal.gr/4919.pdf) | Άρθρο 7 παρ. 1 περ. α |
| LEX-0041 | ΚΑΔ | Μερικώς | [ΑΑΔΕ](https://www.aade.gr/egkyklioi-kai-apofaseis/1004-12-01-2026) | Σελίδα απόφασης Α.1004/2026 |
| LEX-0069 | ισολογισμός | Μερικώς | [ν. 4308/2014](https://www.aade.gr/sites/default/files/2022-02/n4308_2014.pdf) | Άρθρο 16 παρ. 3 περ. α |
| LEX-0090 | ΔΥΠΑ | Μερικώς | [dypa.gov.gr](https://www.dypa.gov.gr/en/register-as-unemployed-unemployment-cards) | — |
| LEX-0097 | εγγεγραμμένος άνεργος | Μερικώς | [dypa.gov.gr](https://www.dypa.gov.gr/en/register-as-unemployed-unemployment-cards) | Ενότητες «Who can register» και «Legislation» (άρθρο 3 ν. 1545/1985· άρθρο 5 ν. 2656/1953· Κανονισμός (ΕΚ) 1897/2000· απόφαση 1850/30/15.03.2020, ΦΕΚ Β' 911/17.03.2020) |
| LEX-0126 | Επιλέξιμη δαπάνη | Μερικώς | [ΥΑ 114947/2022](https://www.taxheaven.gr/circulars/41568/114947-29-11-2022) | Άρθρο 2 παρ. 3· άρθρο 13 παρ. 1 |
| LEX-0031 | Ατομική επιχείρηση | Δεν επιβεβαιώθηκε | [businessportal.gr](https://www.businessportal.gr/en/i-want-to-set-up-a-new-business/) | Κατάλογος νομικών μορφών e-ΥΜΣ |
| LEX-0054 | κλεισμένη διαχειριστική χρήση | Δεν επιβεβαιώθηκε | — | — |
| LEX-0104 | ασφαλιστικές εισφορές | Δεν επιβεβαιώθηκε | [e-ΕΦΚΑ](https://efka.gov.gr/el/nees-eisphores-eleytheron-epaggelmation-aytotelos-apascholoymenon-kai-agroton) | — |
| LEX-0119 | πρόσκληση | Δεν επιβεβαιώθηκε | [espa.gr](https://www.espa.gr/el/Pages/ProclamationsFS.aspx?item=6832) | — |
| LEX-0122 | επιλέξιμος | Δεν επιβεβαιώθηκε | — | — |
| LEX-0123 | επιχορήγηση | Δεν επιβεβαιώθηκε | [espa.gr](https://www.espa.gr/el/Pages/ProclamationsFS.aspx?item=6832) | Ενότητα de minimis |
| LEX-0127 | Επιχορηγούμενος προϋπολογισμός | Δεν επιβεβαιώθηκε | [espa.gr](https://www.espa.gr/el/Pages/ProclamationsFS.aspx?item=6832) | Ένταση ενίσχυσης |
| LEX-0129 | Ιδιωτική συμμετοχή | Δεν επιβεβαιώθηκε | [Κανονισμός (ΕΕ) 2021/1060, ενοποιημένο κείμενο 01.07.2026](https://eur-lex.europa.eu/eli/reg/2021/1060) | Άρθρο 2 σημείο 28 (ορίζει μόνο τη «δημόσια συνεισφορά») |
| LEX-0158 | ΕΝΦΙΑ | Δεν επιβεβαιώθηκε | [Απόφαση Α.1005/2026, ΦΕΚ Β' 86/14.01.2026 (προοίμιο)](https://www.aade.gr/sites/default/files/2026-01/a1005_2026fek.pdf) | Προοίμιο, παρ. 1 εδ. α |
| LEX-0180 | νοικοκυριό | Δεν επιβεβαιώθηκε | [ΟΠΕΚΑ](https://opeka.gov.gr/oikogeneia/epidoma-paidiou-a21/) | — |
