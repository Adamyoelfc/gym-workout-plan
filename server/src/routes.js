import { Router } from "express";
import { query } from "./db.js";
import { hashPassword, verifyPassword, signToken, requireAuth } from "./auth.js";
import { generatePlan } from "./ai.js";

export const router = Router();

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });
const isEmail = (s) => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// --- Auth ----------------------------------------------------------------
router.post("/auth/register", async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: "Valid email required" });
  if (!password || password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

  try {
    const hash = await hashPassword(password);
    const { rows } = await query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email.toLowerCase(), hash, name || null]
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("register error", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || !password) return res.status(400).json({ error: "Email and password required" });

  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT id, email, name FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: rows[0] });
});

// --- Progress ------------------------------------------------------------
router.get("/progress", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT data FROM progress WHERE user_id = $1", [req.user.id]);
  res.json({ progress: rows[0]?.data || {} });
});

router.put("/progress", requireAuth, async (req, res) => {
  const data = req.body?.progress;
  if (typeof data !== "object" || data === null) return res.status(400).json({ error: "progress must be an object" });
  await query(
    `INSERT INTO progress (user_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
    [req.user.id, data]
  );
  res.json({ ok: true });
});

// --- Plans ---------------------------------------------------------------
router.get("/plan", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT days, meta, updated_at FROM plans WHERE user_id = $1", [req.user.id]);
  if (!rows[0]) return res.json({ plan: null });
  res.json({ plan: { days: rows[0].days, meta: rows[0].meta, updatedAt: rows[0].updated_at } });
});

// Save a plan directly (e.g. an edited/custom one).
router.put("/plan", requireAuth, async (req, res) => {
  const { days, meta } = req.body || {};
  if (!Array.isArray(days) || days.length === 0) return res.status(400).json({ error: "days array required" });
  await savePlan(req.user.id, days, meta || {});
  res.json({ ok: true });
});

// Generate a plan with AI and persist it.
router.post("/plan/generate", requireAuth, async (req, res) => {
  try {
    const { days, meta } = await generatePlan(req.body || {});
    await savePlan(req.user.id, days, meta);
    res.json({ plan: { days, meta } });
  } catch (err) {
    console.error("plan generation error", err);
    res.status(502).json({ error: err.message || "AI generation failed" });
  }
});

async function savePlan(userId, days, meta) {
  await query(
    `INSERT INTO plans (user_id, days, meta, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET days = $2, meta = $3, updated_at = now()`,
    [userId, JSON.stringify(days), JSON.stringify(meta)]
  );
}
