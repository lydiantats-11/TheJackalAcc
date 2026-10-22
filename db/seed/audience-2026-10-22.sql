-- Audience of each approved record (owner approval, 22 Oct 2026; development database and shared preview only).
-- 9 «Πολίτες», 10 «Επιχειρήσεις & Επαγγελματίες». Everything else (incl. the 37 EU Funding & Tenders calls) stays NULL
-- = outside both paths until the official applicants are checked and the owner approves. Nothing is deleted.
-- Basis: who applies and in what capacity under the official call (data/business-records-2026-10-20.json, applicants;
-- data/official-records-2026-10-14.v2.json, eligibility rules).
BEGIN;
UPDATE opportunities SET audience = NULL;

-- Πολίτες (9): natural persons in a personal capacity
UPDATE opportunities SET audience = 'citizen' WHERE external_key IN (
  'manual:unemployment',     -- insured persons who lost salaried work
  'manual:a21',              -- households with children
  'manual:spiti2',           -- young people and families, first home
  'manual:studenthousing',   -- students' families
  'manual:discovereu',       -- 18-year-olds apply themselves
  'manual:art5a',            -- natural persons investing (personal tax regime)
  'manual:art5b',            -- pensioners with a foreign pension
  'manual:art5c',            -- natural persons moving their tax residence
  'opske:code:ΠΗΠΕ-06/3.0'   -- «Νέα Ευκαιρία» Ηπείρου: unemployed / part-time employees, as natural persons
);

-- Επιχειρήσεις & Επαγγελματίες (10): the applicant is the enterprise or organisation
UPDATE opportunities SET audience = 'business' WHERE external_key IN (
  'opske:21766',             -- «Επιχειρώ Στερεά»
  'opske:24506',             -- Νότιο Αιγαίο, επιχειρηματικότητα
  'opske:23467',             -- ΔΑΜ21, new and under-establishment SMEs (owner: business)
  'opske:23487',             -- ΔΑΜ22, existing SMEs
  'opske:23466',             -- ΔΑΜ23, existing large enterprises
  'opske:23486',             -- ΔΑΜ24, new and under-establishment large enterprises (owner: business)
  'opske:20505',             -- Βόρειο Αιγαίο, tourism and processing
  'opske:24787',             -- «Καινοτομώ στην Κρήτη» (owner: business)
  'opske:24767',             -- Νότιο Αιγαίο, cooperation with research bodies
  'opske:code:αττ130'        -- Συμπράξεις Έρευνας και Καινοτομίας Αττικής
);
COMMIT;
