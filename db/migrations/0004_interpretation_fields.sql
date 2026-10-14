-- 0004 — Profile answers needed by the interpretation decisions in INTERPRETATIONS.md (SME status, exclusions, consortia).
ALTER TABLE user_profiles
  ADD COLUMN balance_sheet_range text CHECK (balance_sheet_range IN ('under_100k','100k_2m','2m_10m','10m_50m','over_50m','not_sure','prefer_not')),
  ADD COLUMN enterprise_relationship text CHECK (enterprise_relationship IN ('autonomous','partner_or_linked','not_sure')),
  ADD COLUMN public_ownership_25 text CHECK (public_ownership_25 IN ('yes','no','not_sure')),
  ADD COLUMN has_consortium_partners text CHECK (has_consortium_partners IN ('yes','no','not_sure'));
-- `municipality` already exists (0001); limit its length.
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_municipality_len CHECK (municipality IS NULL OR length(municipality) <= 80);

ALTER TABLE opportunity_requirements DROP CONSTRAINT IF EXISTS opportunity_requirements_origin_check;
ALTER TABLE opportunity_requirements ADD CONSTRAINT opportunity_requirements_origin_check
  CHECK (origin IN ('connector','ai','admin','synthetic','programme_default'));

SELECT lockdown_public_schema();
