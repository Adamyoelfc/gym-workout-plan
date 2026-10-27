import pg from "pg";

const { Pool } = pg;

// DATABASE_URL is supplied by docker-compose (points at the `db` service).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);

// Retry on boot: the app container usually starts before Postgres is ready to
// accept connections, even with depends_on. Poll until a trivial query works.
export async function waitForDb({ retries = 30, delayMs = 1000 } = {}) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query("SELECT 1");
      console.log("[db] connected");
      return;
    } catch (err) {
      console.log(`[db] not ready (${i}/${retries}): ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Database not reachable after retries");
}

// Init scripts only run for a brand-new Postgres volume. These idempotent
// migrations also upgrade existing installations on every boot.
export async function migrateDb() {
  await pool.query(`
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS input_tokens INT;
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS output_tokens INT;
    ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12, 6);

    ALTER TABLE plans ADD COLUMN IF NOT EXISTS data JSONB;

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

    CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
      ON chat_messages(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS plan_changes (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'chat',
      summary TEXT NOT NULL,
      before_data JSONB,
      after_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_plan_changes_user_created
      ON plan_changes(user_id, created_at DESC);
  `);
  console.log("[db] schema ready");
}
