-- Corrections of six records and «Υπό επιβεβαίωση» for two (owner approval, Lydia, 22 Oct 2026 15:52 — Phase 1 of the
-- credibility sprint; development database / preview only). Run after audience-2026-10-22.sql. Idempotent.
--
-- Every change was checked on 22 Oct 2026 against the official text named in its summary. Before each change the
-- record's previous state is kept in opportunity_versions (change_kind 'admin_correction'), so the page history and
-- the «Νέα» feed show that a correction was made, and the earlier state can be restored.
-- No record is deleted, no record changes path, no requirement changes, nothing outside these eight records changes.
-- The same corrections for the hand-checked records are in data/official-records-corrections-2026-10-22.json.
--
-- Not changed here (reported to the owner, waiting for a decision):
--   * ΔΑΜ22 / ΔΑΜ23 budget labels and the 5Β summary wording, found during this check.

BEGIN;

CREATE TEMP TABLE fix (key text PRIMARY KEY, summary text NOT NULL) ON COMMIT DROP;
INSERT INTO fix VALUES
  ('manual:art5b', 'Διόρθωση 22/10/2026: προθεσμία αίτησης 31 Οκτωβρίου (όχι 31 Μαρτίου) — Α.1192/2026, ΦΕΚ Β'' 5767/24.9.2026, άρθρο 4 παρ. 1'),
  ('manual:art5a', 'Διόρθωση 22/10/2026: προθεσμία αίτησης 30 Σεπτεμβρίου (όχι 31 Μαρτίου) — Α.1147/2026, ΦΕΚ Β'' 4431/20.7.2026, άρθρο 4 παρ. 1'),
  ('manual:art5c', 'Ενημέρωση 22/10/2026: προστέθηκε η πηγή Α.1096/2026· η προθεσμία ελέγχθηκε και δεν αλλάζει'),
  ('manual:a21',   'Έλεγχος 22/10/2026: η προθεσμία 13/11/2026, 18:00 επιβεβαιώθηκε από την ανακοίνωση ΟΠΕΚΑ της 8/10/2026· δεν αλλάζει'),
  ('opske:23467',  'Διόρθωση 22/10/2026: επιχορηγούμενος προϋπολογισμός σχεδίου €300.000–€12.000.000 (σελίδα δράσης ΟΠΣΚΕ)'),
  ('opske:24506',  'Διόρθωση 22/10/2026: το €30.000–€400.000 είναι επιχορηγούμενος (όχι επιλέξιμος) προϋπολογισμός (σελίδα δράσης ΟΠΣΚΕ)'),
  ('opske:23486',  'Υπό επιβεβαίωση 22/10/2026: ο προϋπολογισμός ανά σχέδιο δεν αναφέρεται στη σελίδα της δράσης'),
  ('manual:discovereu', 'Υπό επιβεβαίωση 22/10/2026: η επίσημη σελίδα δεν επιβεβαιώνει ότι ο γύρος 1–15/10/2026 πραγματοποιήθηκε');

-- 1. Keep the state before the change (once per correction).
INSERT INTO opportunity_versions (opportunity_id, version, snapshot, change_kind, change_summary)
SELECT o.id, o.version, to_jsonb(o.*) - 'version', 'admin_correction', f.summary
FROM opportunities o JOIN fix f ON f.key = o.external_key
WHERE o.merged_into_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM opportunity_versions v WHERE v.opportunity_id = o.id AND v.change_summary = f.summary)
ON CONFLICT (opportunity_id, version) DO NOTHING;

-- 2. Article 5Β — application deadline 31 Oct (A.1192/2026 art. 4(1)); 23:59 Athens time (UTC+2 after 25 Oct).
UPDATE opportunities SET
  closes_at = '2026-10-31T21:59:59Z', deadline_state = 'known', deadline_kind = 'official', deadline_is_date_only = true,
  deadline_timezone = 'Europe/Athens',
  deadline_original_text = 'Αίτηση έως 31 Οκτωβρίου του έτους μεταφοράς της φορολογικής κατοικίας ή του επόμενου έτους· δικαιολογητικά έως 30 Νοεμβρίου του ίδιου έτους. Μεταφορά έως 2/7: αίτηση το ίδιο ή το επόμενο έτος. Μεταφορά μετά τις 2/7: αίτηση μόνο για το επόμενο έτος. Η 31/10/2026 ισχύει για όσους μετέφεραν την κατοικία τους το 2025 ή έως 2/7/2026· όσοι τη μετέφεραν μετά τις 2/7/2026 υποβάλλουν έως 31/10/2027 (Α.1192/2026, άρθρο 4 παρ. 1).',
  canonical_url = 'https://www.aade.gr/egkyklioi-kai-apofaseis/1192-22-09-2026',
  status = 'open', status_confidence = 'high',
  status_evidence = '{"checked_on": "2026-10-22", "method": "manual reading of the official decision", "governing_document": "Α.1192/2026, ΦΕΚ Β'' 5767/24.9.2026, άρθρο 4 παρ. 1", "sources": ["https://aade.gr/sites/default/files/2026-09/a1192_2026.pdf", "https://www.aade.gr/egkyklioi-kai-apofaseis/1192-22-09-2026"], "corroborated_by": "kalitheapress.gr, 27/09/2026 (report of the same decision)", "status_as_checked": "open", "approved_by_owner_on": "2026-10-22"}'::jsonb,
  status_reason = 'manual_review_2026_10_22',
  uncertainties = '["Η προθεσμία εξαρτάται από το πότε μεταφέρθηκε η κατοικία: όσοι τη μετέφεραν μετά τις 2/7/2026 υποβάλλουν έως 31/10/2027."]'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'manual:art5b' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 3. Article 5Α — application deadline 30 Sep (A.1147/2026 art. 4(1)); the 2026 date has passed, the next is 30 Sep 2027.
UPDATE opportunities SET
  closes_at = '2027-09-30T20:59:59Z', deadline_state = 'known', deadline_kind = 'official', deadline_is_date_only = true,
  deadline_timezone = 'Europe/Athens',
  deadline_original_text = 'Αίτηση έως 30 Σεπτεμβρίου του έτους μεταφοράς της φορολογικής κατοικίας ή του επόμενου έτους· δικαιολογητικά έως 31 Οκτωβρίου του ίδιου έτους. Μεταφορά έως 2/7: αίτηση το ίδιο ή το επόμενο έτος. Μεταφορά μετά τις 2/7: αίτηση μόνο για το επόμενο έτος. Η προθεσμία της 30/9/2026 έχει λήξει· όσοι μετέφεραν την κατοικία τους το 2026 υποβάλλουν έως 30/9/2027 (Α.1147/2026, άρθρο 4 παρ. 1).',
  canonical_url = 'https://aade.gr/sites/default/files/2026-08/a1147_2026orthi.pdf',
  status = 'open', status_confidence = 'high',
  status_evidence = '{"checked_on": "2026-10-22", "method": "manual reading of the official decision", "governing_document": "Α.1147/2026, ΦΕΚ Β'' 4431/20.7.2026 (ορθή επανάληψη ως προς το άρθρο 3: ΦΕΚ Β'' 4838/4.8.2026), άρθρο 4 παρ. 1", "sources": ["https://aade.gr/sites/default/files/2026-08/a1147_2026orthi.pdf", "https://www.aade.gr/sites/default/files/2026-07/a1147fek.pdf"], "status_as_checked": "open", "approved_by_owner_on": "2026-10-22"}'::jsonb,
  status_reason = 'manual_review_2026_10_22',
  uncertainties = '["Η προθεσμία εξαρτάται από το πότε μεταφέρθηκε η κατοικία· η προθεσμία της 30/9/2026 έχει λήξει."]'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'manual:art5a' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 4. Article 5Γ — deadline rule unchanged; source A.1096/2026 added; checked again.
UPDATE opportunities SET
  status_evidence = status_evidence || '{"checked_on": "2026-10-22", "sources": ["https://www.aade.gr/en/psifiakes-ypiresies/eisodima/ypoboli-aitisis-ypagogis-se-eidiko-tropo-forologisis-arthro-5g-toy-kfe", "https://www.aade.gr/sites/default/files/2025-10/FAQS_5G_KFE.pdf", "https://www.aade.gr/egkyklioi-kai-apofaseis/1096-29-04-2026"]}'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'manual:art5c' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 4b. Α21 — deadline unchanged (ΟΠΕΚΑ announcement 8 Oct 2026: «Παρασκευή 13 Νοεμβρίου 2026 και ώρα 18:00»); checked again.
UPDATE opportunities SET
  status_evidence = status_evidence || '{"checked_on": "2026-10-22", "recheck": "ΟΠΕΚΑ, ανακοίνωση 8/10/2026: νέες ή τροποποιητικές αιτήσεις έως Παρασκευή 13 Νοεμβρίου 2026 και ώρα 18:00", "sources": ["https://opeka.gov.gr/katavoli-tis-sympliromatikis-pliromis-epidomatos-paidioy-a21-ypovoli-neon-aitiseon/"]}'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'manual:a21' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 5. ΔΑΜ21 — subsidised project budget €300.000–€12.000.000 as stated on the ΟΠΣΚΕ call page.
UPDATE opportunities SET
  official_details = jsonb_set(official_details, '{funding,project_budget}', '{"min": 300000, "max": 12000000, "basis": "subsidised"}'::jsonb),
  uncertainties = '["Οι επιλέξιμοι ΚΑΔ (Παράρτημα XVIII) δεν έχουν ελεγχθεί από εμάς.", "Το καθεστώς κρατικής ενίσχυσης δεν αναφέρεται στη σελίδα της δράσης.", "Ο σύνδεσμος υποβολής είναι η γενική πύλη του ΟΠΣΚΕ· η σελίδα της δράσης δεν ορίζει ρητά σύστημα υποβολής."]'::jsonb,
  status_evidence = status_evidence || '{"rechecked_at": "2026-10-22T16:00:00+03:00", "recheck": "ΟΠΣΚΕ call page: «επιχορηγούμενο προϋπολογισμό τουλάχιστον 300.000€ και έως 12.000.000€»"}'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'opske:23467' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 6. Νότιο Αιγαίο, επιχειρηματικότητα — the €30.000–€400.000 range is the subsidised budget («επιχορηγούμενος»).
UPDATE opportunities SET
  official_details = jsonb_set(official_details, '{funding,project_budget,basis}', '"subsidised"'::jsonb),
  status_evidence = status_evidence || '{"rechecked_at": "2026-10-22T16:00:00+03:00", "recheck": "ΟΠΣΚΕ call page: «Ο επιχορηγούμενος προϋπολογισμός κάθε επενδυτικού σχεδίου κυμαίνεται από 30.000€ έως 400.000€»"}'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'opske:24506' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 7. ΔΑΜ24 — the call is open (dates confirmed); the per-project budget is not stated on the call page → «Υπό επιβεβαίωση».
UPDATE opportunities SET
  official_details = jsonb_set(jsonb_set(official_details, '{funding,project_budget}', 'null'::jsonb), '{funding,pending}', '["project_budget"]'::jsonb),
  uncertainties = '["Οι επιλέξιμοι ΚΑΔ δεν έχουν ελεγχθεί από εμάς.", "Το καθεστώς κρατικής ενίσχυσης δεν αναφέρεται στη σελίδα της δράσης.", "Ο προϋπολογισμός ανά επενδυτικό σχέδιο δεν αναφέρεται στη σελίδα της δράσης (έλεγχος 22/10/2026)· υπό επιβεβαίωση από το κείμενο της πρόσκλησης."]'::jsonb,
  status_evidence = status_evidence || '{"rechecked_at": "2026-10-22T16:00:00+03:00", "recheck": "ΟΠΣΚΕ call page: dates 15/07/2026 13:00 – 16/11/2026 14:00, public expenditure €30.000.000; no per-project budget range"}'::jsonb,
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'opske:23486' AND merged_into_id IS NULL
  AND last_verified_at IS DISTINCT FROM '2026-10-22T16:00:00+03:00';

-- 8. DiscoverEU — the official page does not confirm the 1–15 Oct 2026 round → «Υπό επιβεβαίωση», no dates shown as fact.
UPDATE opportunities SET
  status = 'unverified', status_confidence = 'low',
  opens_at = NULL, closes_at = NULL, deadline_state = 'unknown', deadline_kind = 'not_announced', deadline_is_date_only = false,
  deadline_original_text = 'Υπό επιβεβαίωση: η επίσημη σελίδα ανέφερε προγραμματισμένο γύρο αιτήσεων 1–15/10/2026, αλλά στις 22/10/2026 γράφει ότι οι αιτήσεις είναι κλειστές και δεν επιβεβαιώνει ότι ο γύρος πραγματοποιήθηκε.',
  status_evidence = status_evidence || '{"checked_on": "2026-10-22", "sources": ["https://youth.europa.eu/discoverEU", "https://youth.europa.eu/discovereu_en"], "status_as_checked": "unconfirmed", "recheck": "«The application round is currently closed.» / «The next application round will take place from 1 to 15 October 2026.»"}'::jsonb,
  status_reason = 'manual_review_2026_10_22',
  last_retrieved_at = '2026-10-22T16:00:00+03:00', last_verified_at = '2026-10-22T16:00:00+03:00',
  version = version + 1, updated_at = now()
WHERE external_key = 'manual:discovereu' AND merged_into_id IS NULL
  AND status <> 'unverified';

INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
SELECT NULL, 'opportunity_corrected', 'opportunity', o.id::text,
       jsonb_build_object('external_key', o.external_key, 'summary', f.summary, 'approved_by', 'owner', 'approved_on', '2026-10-22T15:52:00+03:00',
                          'scope', 'preview_only', 'via', 'db/seed/corrections-2026-10-22.sql')
FROM opportunities o JOIN fix f ON f.key = o.external_key
WHERE o.merged_into_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_id = o.id::text AND a.action = 'opportunity_corrected' AND a.details->>'summary' = f.summary);

COMMIT;
