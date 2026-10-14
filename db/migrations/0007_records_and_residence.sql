-- 0007 — Verified-record support and residents-abroad profile answers.
--  * opportunity type `public_benefit` (A21, unemployment benefit, student housing had no type)
--  * `record_kind`: individual opportunities vs tax regimes vs programmes; source directories stay in `sources`
--  * requirement / publication origin `manual_review` for records typed in by hand from official pages
--  * profile answers used by the new requirement categories (residence abroad, return, student, last job)
-- Additive only: no column is dropped or rewritten.

ALTER TABLE opportunities DROP CONSTRAINT opportunities_opportunity_type_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_opportunity_type_check CHECK (opportunity_type IN
  ('grant','subsidy','loan','guarantee','equity','tax_incentive','training','employment_subsidy','procurement','prize',
   'mixed','other','unknown','public_benefit'));

ALTER TABLE opportunities
  ADD COLUMN record_kind text NOT NULL DEFAULT 'call'
    CHECK (record_kind IN ('call','application_round','standing_procedure','programme','tax_regime')),
  ADD COLUMN stale_after_days integer CHECK (stale_after_days IS NULL OR stale_after_days > 0),
  ADD COLUMN uncertainties jsonb NOT NULL DEFAULT '[]'::jsonb;   -- conflicts / not-stated facts, shown to users

ALTER TABLE opportunities DROP CONSTRAINT opportunities_publication_basis_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_publication_basis_check
  CHECK (publication_basis IN ('official_structured','official_page','ai_extracted','manual','synthetic','manual_review'));

ALTER TABLE opportunity_requirements DROP CONSTRAINT IF EXISTS opportunity_requirements_origin_check;
ALTER TABLE opportunity_requirements ADD CONSTRAINT opportunity_requirements_origin_check
  CHECK (origin IN ('connector','ai','admin','synthetic','programme_default','manual_review'));

ALTER TABLE user_profiles
  ADD COLUMN citizenship_country text CHECK (citizenship_country ~ '^([A-Z]{2}|not_sure|prefer_not)$'),
  ADD COLUMN tax_residence_move text CHECK (tax_residence_move IN ('planning','moved','stay_abroad','already_gr','not_sure','prefer_not')),
  ADD COLUMN gr_tax_resident_prev6 text CHECK (gr_tax_resident_prev6 IN ('0','1','2plus','not_sure','prefer_not')),
  ADD COLUMN gr_tax_resident_prev8 text CHECK (gr_tax_resident_prev8 IN ('0','1','2plus','not_sure','prefer_not')),
  ADD COLUMN moving_from text CHECK (moving_from IN ('eu_eea','agreement','other','not_sure','prefer_not')),
  ADD COLUMN activity_in_greece text CHECK (activity_in_greece IN ('employee_gr','own_business','remote_foreign','pension','none','not_sure','prefer_not')),
  ADD COLUMN intends_to_stay_2y text CHECK (intends_to_stay_2y IN ('yes','no','not_sure')),
  ADD COLUMN planned_investment_range text CHECK (planned_investment_range IN ('none','under_100k','100k_500k','500k_plus','not_sure','prefer_not')),
  ADD COLUMN has_academic_id text CHECK (has_academic_id IN ('yes','no','not_sure')),
  ADD COLUMN last_job_end text CHECK (last_job_end IN ('ended_by_employer','contract_ended','resigned','still_employed','never_salaried','not_sure','prefer_not'));

-- country_of_residence existed since 0001 without a check; constrain it like the other country fields.
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_country_of_residence_check
  CHECK (country_of_residence IS NULL OR country_of_residence ~ '^([A-Z]{2}|not_sure|prefer_not)$');

SELECT lockdown_public_schema();
