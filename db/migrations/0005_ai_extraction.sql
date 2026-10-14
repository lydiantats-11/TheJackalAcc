-- 0005 — AI-assisted extraction with mandatory human review.
-- AI output is staged as candidates; nothing reaches opportunity_requirements or opportunity facts until a reviewer approves it.
ALTER TABLE ai_usage ADD COLUMN est_cost_usd numeric(10,5);
ALTER TABLE ai_usage ALTER COLUMN est_cost_eur DROP NOT NULL;

CREATE TABLE extraction_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  document_id    uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  provider       text NOT NULL,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  status         text NOT NULL CHECK (status IN ('succeeded','failed','invalid_output','skipped_budget','skipped_unchanged')),
  error          text,
  injection_suspected boolean NOT NULL DEFAULT false,
  input_tokens   integer,
  output_tokens  integer,
  est_cost_usd   numeric(10,5),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extraction_runs_opp_idx ON extraction_runs(opportunity_id, created_at DESC);

CREATE TABLE extraction_candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES extraction_runs(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  document_id     uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  candidate_type  text NOT NULL CHECK (candidate_type IN ('requirement','fact')),
  payload         jsonb NOT NULL,
  quote           text NOT NULL,
  quote_verified  boolean NOT NULL,            -- quote found verbatim in the stored official document
  value_valid     boolean NOT NULL,            -- value matches the engine schema for its category
  review_reasons  text[] NOT NULL DEFAULT '{}',-- why a human must look closely
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  reviewer_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  review_note     text CHECK (length(review_note) <= 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extraction_candidates_pending_idx ON extraction_candidates(opportunity_id) WHERE status = 'pending';

ALTER TABLE opportunity_requirements ADD COLUMN candidate_id uuid REFERENCES extraction_candidates(id) ON DELETE SET NULL;
ALTER TABLE opportunity_requirements ADD COLUMN reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL;

SELECT lockdown_public_schema();
