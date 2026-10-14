-- 0006 — Five non-exclusive personas, interests, and household fields (Persona 4).
-- Personas and interests only choose which profile questions are shown; the eligibility engine never reads them.
-- The existing `persona` column stays as the applicant type ("Applying as").
ALTER TABLE user_profiles
  ADD COLUMN personas text[] CHECK (
    personas <@ ARRAY['young_adult','aspiring_entrepreneur','employee_jobseeker','household','business_org']::text[]
    AND cardinality(personas) <= 5),
  ADD COLUMN interests text[] CHECK (
    interests <@ ARRAY['housing','education','employment','entrepreneurship','mobility','financial_support','energy','family','tax_residency','tenders','eu_programmes']::text[]
    AND cardinality(interests) <= 11),
  ADD COLUMN housing_status text CHECK (housing_status IN ('renting','with_family','owner','other','not_sure','prefer_not')),
  ADD COLUMN first_home_purchase text CHECK (first_home_purchase IN ('yes','no','not_sure')),
  ADD COLUMN household_size text CHECK (household_size IN ('1','2','3','4','5_plus','prefer_not')),
  ADD COLUMN dependent_children text CHECK (dependent_children IN ('0','1','2','3_plus','prefer_not')),
  ADD COLUMN household_income_range text CHECK (household_income_range IN ('under_10k','10k_20k','20k_35k','35k_60k','over_60k','not_sure','prefer_not')),
  ADD COLUMN property_owned text CHECK (property_owned IN ('yes','no','not_sure','prefer_not'));

-- Carry existing answers over without guessing: "individual" could be several personas, "adviser" is an account role.
UPDATE user_profiles SET personas = ARRAY['aspiring_entrepreneur'] WHERE personas IS NULL AND persona = 'aspiring_entrepreneur';
UPDATE user_profiles SET personas = ARRAY['business_org'] WHERE personas IS NULL AND persona IN ('existing_business','tender_applicant');
UPDATE user_profiles SET interests = ARRAY['tenders'] WHERE interests IS NULL AND persona = 'tender_applicant';

SELECT lockdown_public_schema();
