-- 0002 — Phase 2: source provenance, structured requirements, ingestion bookkeeping, eligibility v2, privilege hardening.

-- ───────────── Source registry: verified access facts ─────────────
ALTER TABLE sources
  ADD COLUMN access_status text NOT NULL DEFAULT 'untested'
    CHECK (access_status IN ('untested','verified','inaccessible','blocked_by_robots','undocumented','unsupported')),
  ADD COLUMN auth_required text NOT NULL DEFAULT 'unknown' CHECK (auth_required IN ('none','api_key','account','unknown')),
  ADD COLUMN terms_url text,
  ADD COLUMN licence_notes text,
  ADD COLUMN robots_status text NOT NULL DEFAULT 'unknown' CHECK (robots_status IN ('unknown','allowed','disallowed','partial')),
  ADD COLUMN connector_version text,
  ADD COLUMN retry_policy jsonb NOT NULL DEFAULT '{"retries":3,"baseDelayMs":2000,"maxDelayMs":60000}'::jsonb,
  ADD COLUMN rate_limit_status text,
  ADD COLUMN last_content_at timestamptz,          -- last run that actually returned items
  ADD COLUMN latest_publication_at timestamptz,    -- newest publication/modification date seen at the source
  ADD COLUMN access_verified_at timestamptz,
  ADD COLUMN stale_after_hours integer NOT NULL DEFAULT 72 CHECK (stale_after_hours >= 1);

ALTER TABLE ingestion_runs
  ADD COLUMN connector_version text,
  ADD COLUMN items_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN items_conflicted integer NOT NULL DEFAULT 0,
  ADD COLUMN heartbeat_at timestamptz;
ALTER TABLE ingestion_runs DROP CONSTRAINT ingestion_runs_status_check;
ALTER TABLE ingestion_runs ADD CONSTRAINT ingestion_runs_status_check
  CHECK (status IN ('running','succeeded','partial','failed','interrupted','skipped_locked'));

-- ───────────── Opportunities: provenance and deadline fidelity ─────────────
ALTER TABLE opportunities
  ADD COLUMN external_key text,                    -- cross-source identity, e.g. 'eu-topic:HORIZON-CL5-2027-D3-01'
  ADD COLUMN source_modified_at timestamptz,       -- newest source timestamp applied; guards against stale re-application
  ADD COLUMN publication_basis text NOT NULL DEFAULT 'manual'
    CHECK (publication_basis IN ('official_structured','official_page','ai_extracted','manual','synthetic')),
  ADD COLUMN deadline_kind text NOT NULL DEFAULT 'not_announced'
    CHECK (deadline_kind IN ('official','estimated','not_announced','rolling','not_applicable')),
  ADD COLUMN deadline_original_text text,          -- verbatim wording/value from the source
  ADD COLUMN deadline_is_date_only boolean NOT NULL DEFAULT false,
  ADD COLUMN additional_deadlines jsonb,           -- e.g. two-stage calls: [{"stage":2,"at":"...","original":"..."}]
  ADD COLUMN budget_exhausted text NOT NULL DEFAULT 'unknown' CHECK (budget_exhausted IN ('unknown','confirmed','no')),
  ADD COLUMN status_reason text,
  ADD COLUMN has_conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN requirement_set_completeness text NOT NULL DEFAULT 'unknown'
    CHECK (requirement_set_completeness IN ('unknown','partial','complete')),
  ADD COLUMN requirement_set_version integer NOT NULL DEFAULT 0,
  ADD COLUMN programme text;
CREATE UNIQUE INDEX opportunities_external_key_uq ON opportunities(external_key)
  WHERE external_key IS NOT NULL AND merged_into_id IS NULL;
UPDATE opportunities SET publication_basis = 'synthetic' WHERE is_synthetic;
UPDATE opportunities SET deadline_kind = CASE deadline_state WHEN 'known' THEN 'official' WHEN 'rolling' THEN 'rolling'
                                                             WHEN 'not_applicable' THEN 'not_applicable' ELSE 'not_announced' END;

-- ───────────── Structured, versioned requirements ─────────────
-- Replaces the unused Phase 1 eligibility_rules table.
DROP TABLE eligibility_rules;
CREATE TABLE opportunity_requirements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id    uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  requirement_key   text NOT NULL,                     -- stable key within the opportunity, e.g. 'age'
  version           integer NOT NULL DEFAULT 1,
  category          text NOT NULL,
  kind              text NOT NULL CHECK (kind IN ('mandatory','conditional','optional','informational')),
  applies_to        text[],                            -- applicant types the requirement applies to (conditional)
  value             jsonb,                             -- normalised interpretation; NULL = not interpretable
  original_text     text NOT NULL,                     -- official wording, source language
  original_lang     text NOT NULL DEFAULT 'el',
  translation_text  text,
  interpretation    text,                              -- plain-language platform interpretation (labelled as such)
  evidence          jsonb NOT NULL,                    -- {"source_url","excerpt","location"}
  evidence_rank     smallint NOT NULL CHECK (evidence_rank BETWEEN 1 AND 4),
  confidence        text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low','medium','high')),
  flags             text[] NOT NULL DEFAULT '{}',      -- conflicting | needs_review | unsupported | ai_extracted
  origin            text NOT NULL CHECK (origin IN ('connector','ai','admin','synthetic')),
  effective_from    date,
  effective_to      date,
  verified_at       timestamptz,
  superseded_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, requirement_key, version)
);
CREATE INDEX opp_requirements_current_idx ON opportunity_requirements(opportunity_id) WHERE superseded_at IS NULL;

-- ───────────── Notification-ready events (consumed in Phase 5) ─────────────
CREATE TABLE opportunity_events (
  id              bigserial PRIMARY KEY,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN ('new_opportunity','status_changed','deadline_changed','requirements_changed','conflict_detected','status_unverified')),
  dedupe_key      text NOT NULL UNIQUE,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);
CREATE INDEX opportunity_events_unprocessed_idx ON opportunity_events(created_at) WHERE processed_at IS NULL;

-- ───────────── Eligibility v2 statuses on stored matches ─────────────
ALTER TABLE user_opportunity_matches DROP CONSTRAINT user_opportunity_matches_eligibility_status_check;
DELETE FROM user_opportunity_matches;  -- recomputed by the worker under the new rule version
ALTER TABLE user_opportunity_matches ADD CONSTRAINT user_opportunity_matches_eligibility_status_check
  CHECK (eligibility_status IN ('potentially_eligible','potentially_eligible_verification_required','unlikely_eligible',
                                'ineligible_verified','insufficient_information','under_review','not_assessed'));
ALTER TABLE user_opportunity_matches
  ADD COLUMN previous_eligibility text,
  ADD COLUMN availability text,
  ADD COLUMN opportunity_version integer,
  ADD COLUMN changed_at timestamptz;

-- ───────────── Worker heartbeat (observability) ─────────────
CREATE TABLE worker_heartbeats (
  worker_id    text PRIMARY KEY,
  started_at   timestamptz NOT NULL,
  last_beat_at timestamptz NOT NULL,
  details      jsonb
);

-- ───────────── Privilege hardening ─────────────
-- RLS alone is not enough: also remove grants (incl. sequences and FUTURE tables) from Supabase's API roles.
CREATE OR REPLACE FUNCTION lockdown_public_schema() RETURNS void LANGUAGE plpgsql AS $$
DECLARE t text; r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION lockdown_public_schema() FROM PUBLIC;
SELECT lockdown_public_schema();
-- Every future migration must end with: SELECT lockdown_public_schema();
