-- Schema for Adam Shred. Runs automatically on first Postgres container boot
-- (mounted into /docker-entrypoint-initdb.d). Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  name              TEXT,
  email_verified    BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  verification_expires TIMESTAMPTZ,
  ai_credits        INT NOT NULL DEFAULT 10,  -- Daily AI generations quota
  ai_credits_reset  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user training progress. Mirrors the frontend PROGRESS_KEY shape:
-- { [exId]: { [setNo]: { weight, reps, done } } } stored as one JSONB blob.
CREATE TABLE IF NOT EXISTS progress (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI-generated (or default) weekly plan per user. `days` matches the App.jsx
-- `days` array schema so the frontend can render it directly.
CREATE TABLE IF NOT EXISTS plans (
  user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  days       JSONB NOT NULL,
  meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS data JSONB;

-- AI usage logs for monitoring and abuse prevention
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,  -- 'generate_plan', etc.
  input_tokens INT,
  output_tokens INT,
  estimated_cost_usd NUMERIC(12, 6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage_logs(user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_memories (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_changes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'chat',
  summary TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_changes_user_created ON plan_changes(user_id, created_at DESC);
