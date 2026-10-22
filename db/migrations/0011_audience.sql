-- 0011 — One audience per programme (owner decision, 22 Oct 2026: two paths, «Πολίτες» and «Επιχειρήσεις & Επαγγελματίες»).
--  * 'citizen'  — the applicant is a natural person in a personal capacity (incl. people starting an activity).
--  * 'business' — the applicant is an enterprise (any legal form, existing, new or under establishment),
--                 a professional or an organisation.
--  * NULL       — not classified yet (HOLD): shown in NEITHER path until checked and approved. Never both.
-- The rule is "who applies, and in what capacity, under the official call", not the title.
-- Public queries always filter on this column, so a record cannot reach the wrong path. Additive only.
ALTER TABLE opportunities ADD COLUMN audience text CHECK (audience IS NULL OR audience IN ('citizen', 'business'));
CREATE INDEX opportunities_audience_idx ON opportunities (audience) WHERE audience IS NOT NULL;

SELECT lockdown_public_schema();
