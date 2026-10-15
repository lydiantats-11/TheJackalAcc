-- Owner approval of the 8 hand-checked official records (Lydia, in the Claude session of 15 Oct 2026:
-- "Approve all 8"). Run after official-records-2026-10-14.sql. Idempotent: records already approved are left alone.
-- Each approval is recorded in admin_reviews and audit_logs (reviewer unknown to the database, so reviewer_id is NULL;
-- the notes say who approved and where).
BEGIN;

WITH approved AS (
  UPDATE opportunities SET review_status = 'approved', updated_at = now()
  WHERE external_key IN ('manual:discovereu', 'manual:art5c', 'manual:art5b', 'manual:art5a',
                         'manual:spiti2', 'manual:studenthousing', 'manual:a21', 'manual:unemployment')
    AND review_status = 'pending' AND merged_into_id IS NULL
  RETURNING id, external_key
), reviews AS (
  INSERT INTO admin_reviews (opportunity_id, reviewer_id, decision, notes)
  SELECT id, NULL, 'approved', 'Approved by the owner (Lydia) in the Claude session of 15 Oct 2026, after the manual check of 14 Oct 2026.' FROM approved
)
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
SELECT NULL, 'opportunity_approved', 'opportunity', id::text,
       jsonb_build_object('external_key', external_key, 'approved_by', 'owner', 'approved_on', '2026-10-15', 'via', 'db/seed/approvals-2026-10-15.sql')
FROM approved;

COMMIT;
