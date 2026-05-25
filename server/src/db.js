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
