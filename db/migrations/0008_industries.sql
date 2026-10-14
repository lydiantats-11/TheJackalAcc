-- 0008 — Industry categories (owner request, 14 Oct 2026). Discovery and ordering only; the eligibility engine never
-- reads them. Sector-restricted calls keep using the official NACE / ΚΑΔ activity (`sectors`).
--  * user_profiles.industries: what the person works in or plans to enter, plus 'all' / 'undecided' (explicit answers);
--    NULL = never asked. Specific industries and the two special answers are exclusive.
--  * opportunities.industries: NULL = not restricted to any industry (true of every record imported so far).
-- Additive only.
ALTER TABLE user_profiles
  ADD COLUMN industries text[] CHECK (
    industries <@ ARRAY['all','undecided','agriculture','food_beverage','tourism_hospitality','retail_ecommerce','technology_it','manufacturing','construction_real_estate','energy_environment','health_life_sciences','education_training','sports_recreation','arts_culture_creative','media_marketing','transport_logistics','maritime_blue_economy','financial_professional','research_innovation','social_economy_ngos','public_sector','personal_other_services','forestry','mining','telecommunications','insurance','wholesale','water_waste','aerospace_defence','legal_services','fashion_textiles','automotive']::text[]
    AND cardinality(industries) <= 30
    AND NOT (cardinality(industries) > 1 AND industries && ARRAY['all','undecided']::text[]));

ALTER TABLE opportunities
  ADD COLUMN industries text[] CHECK (industries IS NULL OR (industries <@ ARRAY['agriculture','food_beverage','tourism_hospitality','retail_ecommerce','technology_it','manufacturing','construction_real_estate','energy_environment','health_life_sciences','education_training','sports_recreation','arts_culture_creative','media_marketing','transport_logistics','maritime_blue_economy','financial_professional','research_innovation','social_economy_ngos','public_sector','personal_other_services','forestry','mining','telecommunications','insurance','wholesale','water_waste','aerospace_defence','legal_services','fashion_textiles','automotive']::text[] AND cardinality(industries) >= 1));

SELECT lockdown_public_schema();
