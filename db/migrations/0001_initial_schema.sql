-- 0001 — Initial schema for Funding Radar.
-- Conventions:
--   * Enumerations are TEXT + CHECK so they can evolve without enum migrations.
--   * Requirement columns are JSONB "requirement envelopes" validated in code (src/lib/domain/requirements.ts):
--       {"state":"unknown"} | {"state":"not_applicable"} | {"state":"confirmed_absent", ...evidence}
--       | {"state":"required", "value": {...}, ...evidence}
--     "unknown" must never be treated as "no restriction".
--   * Money amounts are NUMERIC; NULL + *_state='unknown' means not published / not yet extracted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────── Users & auth ─────────────────────────────
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'user' CHECK (role IN ('user','adviser','admin')),
  locale         text NOT NULL DEFAULT 'el' CHECK (locale IN ('el','en')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email)) WHERE deleted_at IS NULL;

CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,                 -- SHA-256 of the cookie token; raw token never stored
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE login_attempts (
  id            bigserial PRIMARY KEY,
  key           text NOT NULL,                  -- hashed (email|ip) bucket
  attempted_at  timestamptz NOT NULL DEFAULT now(),
  succeeded     boolean NOT NULL
);
CREATE INDEX login_attempts_key_time_idx ON login_attempts(key, attempted_at DESC);

-- ───────────────────────────── Profiles ─────────────────────────────
-- Every answer is optional. 'not_sure' and 'prefer_not' are explicit answers, distinct from NULL (= never asked).
CREATE TABLE user_profiles (
  user_id                  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  persona                  text CHECK (persona IN ('individual','aspiring_entrepreneur','existing_business','tender_applicant','adviser')),
  country_of_residence     text,               -- ISO 3166-1 alpha-2
  application_country      text,
  region_codes             text[],             -- NUTS-2 codes, or {'GR'} for "all Greece / flexible"
  municipality             text,
  age_range                text CHECK (age_range IN ('under_18','18_24','25_29','30_34','35_39','40_44','45_54','55_64','65_plus','prefer_not')),
  employment_status        text CHECK (employment_status IN ('employed','self_employed','unemployed','student','inactive','not_sure','prefer_not')),
  dypa_registered          text CHECK (dypa_registered IN ('yes','no','not_sure','prefer_not')),
  education_level          text CHECK (education_level IN ('none','secondary','post_secondary','bachelor','master','doctorate','master_or_doctorate','not_sure','prefer_not')),
  qualifications           text[],
  sectors                  text[],             -- NACE section letters, or {'*'} for "any sector"
  business_stage           text CHECK (business_stage IN ('idea','planning','registered_new','established','not_sure')),
  business_registered      text CHECK (business_registered IN ('yes','no','not_sure','prefer_not')),
  own_contribution_range   text CHECK (own_contribution_range IN ('none','under_5k','5k_20k','20k_50k','over_50k','not_sure','prefer_not')),
  project_budget_range     text CHECK (project_budget_range IN ('under_10k','10k_50k','50k_200k','200k_1m','over_1m','not_sure','prefer_not')),
  financing_ability        text CHECK (financing_ability IN ('yes','no','not_sure','prefer_not')),
  prior_state_aid          text CHECK (prior_state_aid IN ('yes','no','not_sure','prefer_not')),
  willing_to_relocate      text CHECK (willing_to_relocate IN ('yes','no','not_sure')),
  preferred_categories     text[],
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organisations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  legal_form            text,
  registration_date     date,
  employee_count_range  text CHECK (employee_count_range IN ('0','1_9','10_49','50_249','250_plus','not_sure')),
  size_class            text CHECK (size_class IN ('micro','small','medium','large','not_sure')),
  sectors               text[],
  region_codes          text[],
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organisations_owner_idx ON organisations(owner_user_id);

-- ───────────────────────────── Sources ─────────────────────────────
CREATE TABLE sources (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  authority               text NOT NULL,
  scope                   text NOT NULL CHECK (scope IN ('national','regional','eu')),
  country                 text,                 -- NULL for EU-level
  base_url                text NOT NULL,
  allowed_hosts           text[] NOT NULL,      -- fetcher refuses any other host (SSRF guard)
  access_method           text NOT NULL CHECK (access_method IN ('api','rss','sitemap','html','document','manual')),
  adapter                 text NOT NULL,        -- key into src/lib/sources/adapters registry
  config                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  lifecycle               text NOT NULL DEFAULT 'configured'
                            CHECK (lifecycle IN ('configured','tested','active','degraded','inactive')),
  enabled                 boolean NOT NULL DEFAULT false,
  check_interval_minutes  integer NOT NULL DEFAULT 720 CHECK (check_interval_minutes >= 15),
  compliance_notes        text,                 -- robots/terms findings, recorded by a human
  compliance_checked_at   timestamptz,
  last_check_at           timestamptz,
  last_success_at         timestamptz,
  next_check_at           timestamptz,
  consecutive_failures    integer NOT NULL DEFAULT 0,
  last_error              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT (enabled AND lifecycle = 'configured'))  -- cannot run unattended before a successful test
);

CREATE TABLE ingestion_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  trigger         text NOT NULL CHECK (trigger IN ('schedule','manual','test')),
  triggered_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','partial','failed')),
  items_seen      integer NOT NULL DEFAULT 0,
  items_new       integer NOT NULL DEFAULT 0,
  items_changed   integer NOT NULL DEFAULT 0,
  attempts        integer NOT NULL DEFAULT 1,
  error           text,
  metrics         jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX ingestion_runs_source_time_idx ON ingestion_runs(source_id, started_at DESC);

CREATE TABLE source_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  run_id         uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  url            text NOT NULL,
  canonical_url  text NOT NULL,
  content_hash   text NOT NULL,              -- SHA-256 of normalised content
  mime_type      text,
  http_status    integer,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  title          text,
  text_content   text,                       -- extracted text (untrusted data)
  classification text CHECK (classification IN ('opportunity','amendment','extension','closure','announcement','irrelevant','unclassified')) DEFAULT 'unclassified',
  UNIQUE (source_id, canonical_url, content_hash)
);
CREATE INDEX source_documents_canonical_idx ON source_documents(canonical_url);

-- ───────────────────────────── Opportunities ─────────────────────────────
CREATE TABLE opportunity_categories (
  code     text PRIMARY KEY,
  name_el  text NOT NULL,
  name_en  text NOT NULL,
  sort     integer NOT NULL DEFAULT 0
);

CREATE TABLE opportunities (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_synthetic               boolean NOT NULL DEFAULT false,   -- demo/test data; always labelled in UI
  source_id                  uuid REFERENCES sources(id) ON DELETE SET NULL,
  official_identifier        text,                             -- call code / ADA / TED notice no.
  official_title             text NOT NULL,
  title_lang                 text NOT NULL DEFAULT 'el',
  summary_plain              text,                             -- AI-generated or admin-written; labelled as such
  summary_origin             text CHECK (summary_origin IN ('ai','admin','official')),
  opportunity_type           text NOT NULL DEFAULT 'unknown'
                               CHECK (opportunity_type IN ('grant','subsidy','loan','guarantee','equity','tax_incentive','training','employment_subsidy','procurement','prize','mixed','other','unknown')),
  publishing_authority       text,
  canonical_url              text NOT NULL,
  application_url            text,
  published_on               date,
  opens_at                   timestamptz,
  closes_at                  timestamptz,
  deadline_state             text NOT NULL DEFAULT 'unknown' CHECK (deadline_state IN ('known','unknown','rolling','not_applicable')),
  deadline_timezone          text NOT NULL DEFAULT 'Europe/Athens',
  last_retrieved_at          timestamptz,
  last_verified_at           timestamptz,
  status                     text NOT NULL DEFAULT 'discovered'
                               CHECK (status IN ('discovered','under_review','upcoming','open','suspended','extended','closed','cancelled','archived','unverified')),
  status_confidence          text NOT NULL DEFAULT 'low' CHECK (status_confidence IN ('low','medium','high')),
  status_evidence            jsonb,
  applicant_types            jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  geographic_scope           jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  age_requirement            jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  education_requirement      jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  employment_requirement     jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  business_stage_requirement jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  sector_requirement         jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  company_size_requirement   jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  cofinancing_requirement    jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  funding_amount_state       text NOT NULL DEFAULT 'unknown' CHECK (funding_amount_state IN ('known','unknown','not_applicable')),
  funding_min                numeric(14,2),
  funding_max                numeric(14,2),
  currency                   text DEFAULT 'EUR',
  funding_intensity_pct      numeric(5,2) CHECK (funding_intensity_pct IS NULL OR (funding_intensity_pct >= 0 AND funding_intensity_pct <= 100)),
  eligible_expenditure       jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  ineligible_expenditure     jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  state_aid                  jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  required_documents         jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  selection_criteria         jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  exclusion_conditions       jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  application_procedure      jsonb NOT NULL DEFAULT '{"state":"unknown"}'::jsonb,
  extraction_confidence      text CHECK (extraction_confidence IN ('low','medium','high')),
  review_status              text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','needs_changes')),
  content_fingerprint        text,
  merged_into_id             uuid REFERENCES opportunities(id),
  version                    integer NOT NULL DEFAULT 1,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CHECK (funding_amount_state <> 'known' OR funding_min IS NOT NULL OR funding_max IS NOT NULL),
  CHECK (funding_amount_state = 'known' OR (funding_min IS NULL AND funding_max IS NULL)),
  CHECK (funding_min IS NULL OR funding_max IS NULL OR funding_min <= funding_max),
  CHECK (deadline_state <> 'known' OR closes_at IS NOT NULL),
  CHECK (deadline_state = 'known' OR closes_at IS NULL),
  CHECK (canonical_url ~ '^https://')
);
CREATE UNIQUE INDEX opportunities_canonical_uq ON opportunities(canonical_url) WHERE merged_into_id IS NULL;
CREATE UNIQUE INDEX opportunities_official_id_uq ON opportunities(source_id, official_identifier)
  WHERE official_identifier IS NOT NULL AND merged_into_id IS NULL;
CREATE INDEX opportunities_status_idx ON opportunities(status);
CREATE INDEX opportunities_closes_idx ON opportunities(closes_at);
CREATE INDEX opportunities_fingerprint_idx ON opportunities(content_fingerprint);

CREATE TABLE opportunity_category_links (
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  category_code   text NOT NULL REFERENCES opportunity_categories(code),
  PRIMARY KEY (opportunity_id, category_code)
);

-- Evidence for individual extracted fields.
CREATE TABLE opportunity_field_evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  field           text NOT NULL,
  value           jsonb,
  evidence_text   text,
  source_url      text,
  document_id     uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  page_ref        text,
  method          text NOT NULL CHECK (method IN ('parser','ai','admin')),
  evidence_rank   smallint NOT NULL CHECK (evidence_rank BETWEEN 1 AND 4),  -- 1 = official call document … 4 = secondary
  confidence      text CHECK (confidence IN ('low','medium','high')),
  review_status   text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected','conflict')),
  extracted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX field_evidence_opp_field_idx ON opportunity_field_evidence(opportunity_id, field);

CREATE TABLE eligibility_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  rule_key        text NOT NULL,
  mandatory       boolean NOT NULL DEFAULT true,
  params          jsonb NOT NULL,
  evidence_id     uuid REFERENCES opportunity_field_evidence(id) ON DELETE SET NULL,
  rule_version    integer NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eligibility_rules_opp_idx ON eligibility_rules(opportunity_id);

-- Full snapshot per material change; never overwrite history.
CREATE TABLE opportunity_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  snapshot        jsonb NOT NULL,
  change_kind     text NOT NULL CHECK (change_kind IN ('created','amendment','corrigendum','extension','status','admin_correction','merge')),
  change_summary  text,
  changed_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  document_id     uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, version)
);

CREATE TABLE opportunity_status_history (
  id              bigserial PRIMARY KEY,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL,
  reason          text NOT NULL,
  evidence        jsonb,
  actor           text NOT NULL CHECK (actor IN ('system','admin')),
  actor_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX status_history_opp_idx ON opportunity_status_history(opportunity_id, changed_at DESC);

-- ───────────────────────────── Matching & user data ─────────────────────────────
CREATE TABLE user_opportunity_matches (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id      uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  eligibility_status  text NOT NULL CHECK (eligibility_status IN ('potentially_eligible','needs_more_information','likely_ineligible','unverified','closed','not_assessed')),
  relevance_score     numeric(5,2),
  evidence_coverage   numeric(5,4),
  unresolved_count    integer NOT NULL DEFAULT 0,
  explanation         jsonb NOT NULL,
  rule_version        text NOT NULL,
  assessed_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);
CREATE INDEX matches_user_score_idx ON user_opportunity_matches(user_id, relevance_score DESC);

CREATE TABLE saved_opportunities (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  notes           text CHECK (length(notes) <= 5000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, opportunity_id)
);

CREATE TABLE application_checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  items           jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opportunity_id)
);

CREATE TABLE notification_preferences (
  user_id                  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled            boolean NOT NULL DEFAULT false,   -- opt-in (consent)
  frequency                text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('instant','daily','weekly')),
  categories               text[],
  min_relevance            integer NOT NULL DEFAULT 50 CHECK (min_relevance BETWEEN 0 AND 100),
  deadline_reminder_days   integer[] NOT NULL DEFAULT '{14,3}',
  paused_until             timestamptz,
  unsubscribed_at          timestamptz,
  unsubscribe_token_hash   text,
  consent_recorded_at      timestamptz,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_id  uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  event_type      text NOT NULL CHECK (event_type IN ('new_match','high_relevance','deadline_approaching','deadline_extended','status_changed','eligibility_changed','official_correction')),
  event_key       text NOT NULL,                 -- deterministic key of the material event → duplicate suppression
  channel         text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','in_app','telegram')),
  status          text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','suppressed','dead')),
  payload         jsonb NOT NULL,
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  UNIQUE (user_id, channel, event_key)
);
CREATE INDEX notifications_queue_idx ON notifications(status, next_attempt_at);

CREATE TABLE notification_attempts (
  id                 bigserial PRIMARY KEY,
  notification_id    uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  attempted_at       timestamptz NOT NULL DEFAULT now(),
  success            boolean NOT NULL,
  provider_response  jsonb
);

-- ───────────────────────────── Admin, audit, cost ─────────────────────────────
CREATE TABLE admin_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id  uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  reviewer_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  decision        text NOT NULL CHECK (decision IN ('approved','rejected','needs_changes','merged')),
  notes           text,                             -- internal; never shown to ordinary users
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id             bigserial PRIMARY KEY,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  action         text NOT NULL,
  entity_type    text NOT NULL,
  entity_id      text,
  details        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX audit_logs_time_idx ON audit_logs(created_at DESC);

CREATE TABLE ai_usage (
  id             bigserial PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  provider       text NOT NULL,
  model          text NOT NULL,
  purpose        text NOT NULL,
  input_tokens   integer NOT NULL,
  output_tokens  integer NOT NULL,
  est_cost_eur   numeric(10,5) NOT NULL
);
CREATE INDEX ai_usage_time_idx ON ai_usage(at);

-- ───────────────────────────── Row-level security lockdown ─────────────────────────────
-- The application connects with a privileged server role and enforces authorisation in code.
-- RLS is enabled with NO policies on every table so that Supabase's public PostgREST API
-- (roles anon/authenticated) cannot read or write anything.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
  END IF;
END $$;
