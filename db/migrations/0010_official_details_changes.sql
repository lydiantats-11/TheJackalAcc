-- 0010 — Change detection for official details (core capability 3, 15 Oct 2026).
-- When a source changes a call's published budget, conditions, submission model, type of action or documents, the
-- pipeline records an 'official_details_changed' event (which fields changed, before → after for the budget).
-- The record's version is not bumped (the fingerprinted facts did not change), but the change is logged and shown
-- in the record's change history. Additive only.
ALTER TABLE opportunity_events DROP CONSTRAINT opportunity_events_event_type_check;
ALTER TABLE opportunity_events ADD CONSTRAINT opportunity_events_event_type_check
  CHECK (event_type IN ('new_opportunity','status_changed','deadline_changed','requirements_changed','conflict_detected','status_unverified',
                        'official_details_changed'));

SELECT lockdown_public_schema();
