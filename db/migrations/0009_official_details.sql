-- 0009 — Official details for display (owner request, 15 Oct 2026: "more details on each opportunity: amount, dates,
-- funding, eligibility"). Holds what a source publishes in structured form — e.g. for EU Funding & Tenders topics:
-- total budget by year, expected number of grants, min/max grant per project (only when published), type of action,
-- single/two-stage submission, call title, official scope text (shortened) and condition headings with document links.
--  * Display only: the eligibility engine never reads it; per-applicant amounts stay in funding_min / funding_max.
--  * Refreshed on every connector run without creating a new version of the record (not part of the fingerprint).
--  * NULL = the source has not provided details (e.g. hand-checked records, whose verified facts live in
--    data/official-records-*.json and are shown from there).
-- Additive only.
ALTER TABLE opportunities ADD COLUMN official_details jsonb CHECK (official_details IS NULL OR jsonb_typeof(official_details) = 'object');

SELECT lockdown_public_schema();
