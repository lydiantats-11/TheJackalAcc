-- Owner approval (Lydia, Claude session of 20 Oct 2026): import the reviewed business batch into the development
-- database / preview only — not public. Run after business-records-2026-10-20.sql. Idempotent.
BEGIN;
WITH approved AS (
  UPDATE opportunities SET review_status = 'approved', updated_at = now()
  WHERE external_key IN ('opske:code:ΠΗΠΕ-06/3.0', 'opske:21766', 'opske:24506', 'opske:23467', 'opske:23487', 'opske:23466', 'opske:23486', 'opske:20505', 'opske:24787', 'opske:24767', 'opske:code:αττ130')
    AND publication_basis = 'manual_review' AND review_status = 'pending' AND merged_into_id IS NULL
  RETURNING id, external_key
), reviews AS (
  INSERT INTO admin_reviews (opportunity_id, reviewer_id, decision, notes)
  SELECT id, NULL, 'approved', 'Approved by the owner (Lydia) in the Claude session of 20 Oct 2026 for the development database / preview only, after the final check of the latest amendments on 20 Oct 2026.' FROM approved
)
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details)
SELECT NULL, 'opportunity_approved', 'opportunity', id::text,
       jsonb_build_object('external_key', external_key, 'approved_by', 'owner', 'approved_on', '2026-10-20', 'scope', 'preview_only', 'via', 'db/seed/approvals-2026-10-20.sql')
FROM approved;
COMMIT;
