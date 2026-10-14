-- 0003 — Adaptive profile fields used by the v2 requirement categories.
-- Values are stored as text so explicit answers ("not_sure", "prefer_not") stay distinct from "never asked" (NULL).
ALTER TABLE user_profiles
  ADD COLUMN tax_residence_country text CHECK (tax_residence_country ~ '^([A-Z]{2}|not_sure|prefer_not)$'),
  ADD COLUMN birth_year integer CHECK (birth_year BETWEEN 1900 AND 2100),
  ADD COLUMN legal_form text CHECK (legal_form IN ('sole_proprietor','company','partnership','cooperative','nonprofit','not_sure')),
  ADD COLUMN business_registration_date text CHECK (business_registration_date ~ '^(\d{4}-\d{2}-\d{2}|not_sure)$'),
  ADD COLUMN business_region text CHECK (business_region ~ '^(EL[0-9]{2}|not_sure)$'),
  ADD COLUMN employees_range text CHECK (employees_range IN ('0','1_9','10_49','50_249','250_plus','not_sure','prefer_not')),
  ADD COLUMN turnover_range text CHECK (turnover_range IN ('under_100k','100k_2m','2m_10m','10m_50m','over_50m','not_sure','prefer_not')),
  ADD COLUMN project_budget_eur text CHECK (project_budget_eur ~ '^([0-9]{1,10}|not_sure|prefer_not)$'),
  ADD COLUMN planned_project_start text CHECK (planned_project_start ~ '^(\d{4}-\d{2}-\d{2}|not_sure)$'),
  ADD COLUMN de_minimis_received_3y_eur text CHECK (de_minimis_received_3y_eur ~ '^([0-9]{1,10}|not_sure|prefer_not)$');

SELECT lockdown_public_schema();
