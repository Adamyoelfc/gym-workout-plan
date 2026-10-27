import express, { Router } from "express";
import { pool, query } from "./db.js";
import { 
  hashPassword, 
  verifyPasswordOrDummy, 
  requireAuth,
  requireVerified,
  setSessionCookie,
  clearSessionCookie,
  generateVerificationToken,
  getVerificationExpiry
} from "./auth.js";
import { applyPlanOperations, chatAboutPlan, generatePlan, validatePlan } from "./ai.js";
import { PlanImportError, pdfToText, planFromText } from "./plan-import.js";
import { findExerciseGif } from "./exercises.js";
import { sendVerificationEmail } from "./email.js";
import { 
  registrationLimiter, 
  loginLimiter, 
  aiGeneralLimiter,
  checkAiCredits,
  logAiUsage,
  getAiUsageStats,
  exerciseLimiter,
  checkGlobalAiBudget,
} from "./ratelimit.js";

export const router = Router();

const publicUser = (u) => ({ 
  id: u.id, 
  email: u.email, 
  name: u.name,
  emailVerified: u.email_verified,
  aiCredits: u.ai_credits
});

const isEmail = (s) => typeof s === "string" && s.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// Registro cerrado por defecto: solo ALLOW_REGISTRATION=true lo abre a todos,
// o ALLOWED_EMAILS (lista separada por comas) lo abre solo a esos correos.
const allowedEmails = String(process.env.ALLOWED_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
const openRegistration = process.env.ALLOW_REGISTRATION === "true";
const canRegister = (email) => openRegistration || allowedEmails.includes(String(email).toLowerCase());

router.get("/auth/config", (_req, res) => {
  res.json({ registration: openRegistration ? "open" : allowedEmails.length ? "invite" : "closed" });
});

// --- Auth ----------------------------------------------------------------

// Register with email verification
router.post("/auth/register", registrationLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: "Escribe un email válido" });
  if (!canRegister(email)) return res.status(403).json({ error: "El registro está cerrado. Esta app es privada." });
  if (typeof password !== "string" || password.length < 10 || password.length > 128)
    return res.status(400).json({ error: "La contraseña debe tener entre 10 y 128 caracteres" });
  if (name && (typeof name !== "string" || name.length > 80))
    return res.status(400).json({ error: "El nombre es demasiado largo" });

  try {
    const hash = await hashPassword(password);
    const verificationToken = generateVerificationToken();
    const verificationExpires = getVerificationExpiry();
    
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, name, verification_token, verification_expires) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, email, name, email_verified, ai_credits`,
      [email.toLowerCase(), hash, name || null, verificationToken, verificationExpires]
    );
    
    const user = rows[0];
    
    setSessionCookie(req, res, user);
    res.status(201).json({
      user: publicUser(user),
      message: "Account created! Please check your email to verify."
    });

    // Do not keep the registration request waiting on an external SMTP server.
    // A failed delivery can be retried from the verification banner.
    void sendVerificationEmail(email, verificationToken).catch((emailError) => {
      console.error("[routes] verification email error", emailError);
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Ese email ya tiene cuenta. Entra con tu contraseña." });
    console.error("[routes] register error", err);
    res.status(500).json({ error: "No se pudo crear la cuenta" });
  }
});

// Verify email with token
router.get("/auth/verify-email", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Verification token required" });

  try {
    const { rows } = await query(
      `UPDATE users 
       SET email_verified = true, 
           verification_token = NULL,
           verification_expires = NULL
       WHERE verification_token = $1 
         AND verification_expires > NOW()
       RETURNING id, email, name, email_verified, ai_credits`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    const user = rows[0];
    res.json({ 
      success: true,
      message: "Email verified successfully! You can now use AI features.",
      user: publicUser(user)
    });
  } catch (err) {
    console.error("[routes] verify email error", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// Resend verification email
router.post("/auth/resend-verification", requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT email, email_verified FROM users WHERE id = $1",
      [req.user.id]
    );
    
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.email_verified) return res.status(400).json({ error: "Email already verified" });

    // Generate new token
    const verificationToken = generateVerificationToken();
    const verificationExpires = getVerificationExpiry();
    
    await query(
      `UPDATE users 
       SET verification_token = $1, verification_expires = $2 
       WHERE id = $3`,
      [verificationToken, verificationExpires, req.user.id]
    );

    const delivery = await sendVerificationEmail(user.email, verificationToken);
    if (!delivery.success) {
      return res.status(502).json({
        error: "No se pudo enviar el correo. Revisa la configuración SMTP e inténtalo de nuevo.",
      });
    }
    
    res.json({ 
      success: true,
      message: "Verification email sent! Check your inbox."
    });
  } catch (err) {
    console.error("[routes] resend verification error", err);
    res.status(500).json({ error: "Failed to resend verification" });
  }
});

// Login
router.post("/auth/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== "string" || !password || password.length > 128)
    return res.status(400).json({ error: "Escribe tu email y contraseña" });

  try {
    const { rows } = await query(
      "SELECT id, email, name, password_hash, email_verified, ai_credits FROM users WHERE email = $1", 
      [email.toLowerCase()]
    );
    const user = rows[0];
    
    if (!(await verifyPasswordOrDummy(password, user?.password_hash)))
      return res.status(401).json({ error: "Email o contraseña incorrectos" });

    setSessionCookie(req, res, user);
    res.json({
      user: publicUser(user),
      warning: !user.email_verified ? "Please verify your email to use AI features" : null
    });
  } catch (err) {
    console.error("[routes] login error", err);
    res.status(500).json({ error: "No se pudo iniciar sesión. Inténtalo de nuevo." });
  }
});

router.post("/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

// Get current user info
router.get("/auth/me", requireAuth, async (req, res) => {
  const { rows } = await query(
    "SELECT id, email, name, email_verified, ai_credits FROM users WHERE id = $1", 
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  
  // Attach emailVerified to req.user for middleware
  req.user.emailVerified = rows[0].email_verified;
  
  res.json({ user: publicUser(rows[0]) });
});

// Get AI usage stats
router.get("/auth/ai-stats", requireAuth, async (req, res) => {
  try {
    const stats = await getAiUsageStats(req.user.id, 7);
    const { rows } = await query(
      "SELECT ai_credits, ai_credits_reset FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json({ 
      credits: rows[0]?.ai_credits || 0,
      resetAt: rows[0]?.ai_credits_reset,
      history: stats 
    });
  } catch (err) {
    console.error("[routes] ai stats error", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- Progress ------------------------------------------------------------
router.get("/progress", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT data FROM progress WHERE user_id = $1", [req.user.id]);
  res.json({ progress: rows[0]?.data || {} });
});

router.put("/progress", requireAuth, async (req, res) => {
  const data = req.body?.progress;
  if (typeof data !== "object" || data === null) 
    return res.status(400).json({ error: "progress must be an object" });
  if (JSON.stringify(data).length > 500_000)
    return res.status(413).json({ error: "progress is too large" });
  
  await query(
    `INSERT INTO progress (user_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
    [req.user.id, data]
  );
  res.json({ ok: true });
});

// --- Plans ---------------------------------------------------------------
router.get("/plan", requireAuth, async (req, res) => {
  const { rows } = await query(
    "SELECT data, days, meta, updated_at FROM plans WHERE user_id = $1",
    [req.user.id]
  );
  if (!rows[0]) return res.json({ plan: null });
  res.json({
    plan: rows[0].data || {
      days: rows[0].days, 
      meta: rows[0].meta, 
      updatedAt: rows[0].updated_at 
    },
    updatedAt: rows[0].updated_at,
  });
});

// Save a plan directly (e.g. an edited/custom one) - no AI, no verification needed
router.put("/plan", requireAuth, async (req, res) => {
  const data = req.body?.plan;
  const { days, meta } = req.body || {};
  if (data) {
    const encoded = JSON.stringify(data);
    if (typeof data !== "object" || encoded.length > 180_000)
      return res.status(400).json({ error: "invalid plan" });
    await savePlanData(req.user.id, data);
    return res.json({ ok: true });
  }
  if (!Array.isArray(days) || days.length === 0)
    return res.status(400).json({ error: "plan required" });
  await savePlan(req.user.id, days, meta || {});
  res.json({ ok: true });
});

router.get("/chat", requireAuth, async (req, res) => {
  const [messages, memories, changes] = await Promise.all([
    query(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30`,
      [req.user.id],
    ),
    query("SELECT key, value, updated_at FROM ai_memories WHERE user_id = $1 ORDER BY updated_at DESC", [req.user.id]),
    query(
      `SELECT id, summary, created_at FROM plan_changes
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15`,
      [req.user.id],
    ),
  ]);
  res.json({
    messages: messages.rows.reverse(),
    memories: memories.rows,
    changes: changes.rows,
  });
});

router.post("/chat", aiGeneralLimiter, requireAuth, requireVerified, async (req, res) => {
  const message = String(req.body?.message || "").trim();
  if (!message || message.length > 1600) return res.status(400).json({ error: "Message must be 1-1600 characters" });

  try {
    const globalBudget = await checkGlobalAiBudget();
    if (!globalBudget.allowed) return res.status(503).json({ error: "AI budget paused for today" });
    const [planResult, memoryResult, historyResult] = await Promise.all([
      query("SELECT data FROM plans WHERE user_id = $1", [req.user.id]),
      query("SELECT key, value FROM ai_memories WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 30", [req.user.id]),
      query(
        `SELECT role, content FROM chat_messages WHERE user_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 8`,
        [req.user.id],
      ),
    ]);
    const currentPlan = planResult.rows[0]?.data;
    if (!currentPlan) return res.status(409).json({ error: "Save your plan before starting the coach chat" });
    const creditCheck = await checkAiCredits(req.user.id);
    if (!creditCheck.allowed) return res.status(429).json({ error: "AI limit reached", ...creditCheck });

    const result = await chatAboutPlan({
      message,
      plan: currentPlan,
      memories: memoryResult.rows,
      history: historyResult.rows.reverse(),
      timeZone: req.body?.timeZone,
    });
    const updatedPlan = result.operations.length
      ? applyPlanOperations(currentPlan, result.operations)
      : currentPlan;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2), ($1, 'assistant', $3)",
        [req.user.id, message, result.reply],
      );
      for (const memory of result.memories) {
        await client.query(
          `INSERT INTO ai_memories (user_id, key, value, updated_at) VALUES ($1, $2, $3, now())
           ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = now()`,
          [req.user.id, memory.key, memory.value],
        );
      }
      if (result.forgottenMemoryKeys.length) {
        await client.query(
          "DELETE FROM ai_memories WHERE user_id = $1 AND key = ANY($2::text[])",
          [req.user.id, result.forgottenMemoryKeys],
        );
      }
      if (result.operations.length) {
        await client.query("UPDATE plans SET data = $2, updated_at = now() WHERE user_id = $1", [req.user.id, updatedPlan]);
        await client.query(
          `INSERT INTO plan_changes (user_id, source, summary, before_data, after_data)
           VALUES ($1, 'chat', $2, $3, $4)`,
          [req.user.id, result.summary || "Plan actualizado por el coach", currentPlan, updatedPlan],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await logAiUsage(req.user.id, "coach_chat", result.usage);
    res.json({
      reply: result.reply,
      summary: result.summary,
      plan: updatedPlan,
      changed: result.operations.length > 0,
      credits: creditCheck.credits,
    });
  } catch (error) {
    console.error("[routes] chat error", error);
    res.status(502).json({ error: error.message || "Coach chat failed" });
  }
});

router.post("/plan/undo", requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, before_data, summary FROM plan_changes
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [req.user.id],
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No changes to undo" });
    }
    await client.query("UPDATE plans SET data = $2, updated_at = now() WHERE user_id = $1", [req.user.id, rows[0].before_data]);
    await client.query("DELETE FROM plan_changes WHERE id = $1", [rows[0].id]);
    await client.query("COMMIT");
    res.json({ plan: rows[0].before_data, undone: rows[0].summary });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.get("/exercises/gif", exerciseLimiter, requireAuth, async (req, res) => {
  const name = String(req.query.name || "").slice(0, 100);
  if (!name) return res.status(400).json({ error: "Exercise name required" });
  const result = await findExerciseGif(name);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.json({ exercise: result });
});

// Generate a plan with AI - REQUIRES EMAIL VERIFICATION + AI CREDITS
router.post("/plan/generate", 
  aiGeneralLimiter,  // IP-based rate limit
  requireAuth,        // Must be logged in
  requireVerified,    // Must have verified email
  async (req, res) => {
    try {
      const globalBudget = await checkGlobalAiBudget();
      if (!globalBudget.allowed) return res.status(503).json({ error: "AI budget paused for today" });
      // Check AI credits
      const creditCheck = await checkAiCredits(req.user.id);
      if (!creditCheck.allowed) {
        return res.status(429).json({ 
          error: "AI limit reached",
          message: creditCheck.message,
          credits: creditCheck.credits,
          resetIn: creditCheck.resetIn
        });
      }

      // Generate plan
      const { days, meta } = await generatePlan(req.body || {});
      await savePlan(req.user.id, days, meta);
      
      // Log usage
      await logAiUsage(req.user.id, 'generate_plan');

      res.json({ 
        plan: { days, meta },
        credits: creditCheck.credits,
        message: creditCheck.message
      });
    } catch (err) {
      console.error("[routes] plan generation error", err);
      res.status(502).json({ error: err.message || "AI generation failed" });
    }
  }
);

// Importar un plan desde un PDF: devuelve un borrador (no lo guarda) para revisarlo antes.
// El PDF llega como cuerpo binario (Content-Type: application/pdf), máx. 6 MB.
router.post("/plan/import",
  aiGeneralLimiter,
  requireAuth,
  requireVerified,
  express.raw({ type: "application/pdf", limit: "6mb" }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) return res.status(415).json({ error: "Sube un archivo PDF" });
      const text = await pdfToText(req.body);
      const globalBudget = await checkGlobalAiBudget();
      if (!globalBudget.allowed) return res.status(503).json({ error: "La IA está en pausa por hoy (presupuesto diario agotado)" });
      const creditCheck = await checkAiCredits(req.user.id);
      if (!creditCheck.allowed) return res.status(429).json({ error: `Límite diario de IA alcanzado. Se renueva en ${creditCheck.resetIn} h.` });
      const { plan, usage } = await planFromText(text);
      await logAiUsage(req.user.id, "import_plan", usage);
      res.json({ plan, credits: creditCheck.credits });
    } catch (err) {
      if (err instanceof PlanImportError) return res.status(err.status).json({ error: err.message });
      console.error("[routes] plan import error", err);
      res.status(502).json({ error: "No se pudo convertir el PDF en un plan" });
    }
  }
);

// Aplicar un plan (importado o el original) guardando el anterior para poder deshacer.
router.post("/plan/apply", requireAuth, async (req, res) => {
  const plan = req.body?.plan;
  const summary = String(req.body?.summary || "Plan reemplazado").slice(0, 160);
  try {
    validatePlan(plan);
  } catch (err) {
    return res.status(400).json({ error: `Plan no válido: ${err.message}` });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT data FROM plans WHERE user_id = $1 FOR UPDATE", [req.user.id]);
    await client.query(
      `INSERT INTO plans (user_id, days, meta, data, updated_at)
       VALUES ($1, '[]'::jsonb, '{}'::jsonb, $2, now())
       ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
      [req.user.id, plan],
    );
    await client.query(
      `INSERT INTO plan_changes (user_id, source, summary, before_data, after_data) VALUES ($1, 'import', $2, $3, $4)`,
      [req.user.id, summary, rows[0]?.data || null, plan],
    );
    await client.query("COMMIT");
    res.json({ ok: true, plan });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[routes] plan apply error", err);
    res.status(500).json({ error: "No se pudo guardar el plan" });
  } finally {
    client.release();
  }
});

async function savePlan(userId, days, meta) {
  await query(
    `INSERT INTO plans (user_id, days, meta, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET days = $2, meta = $3, updated_at = now()`,
    [userId, JSON.stringify(days), JSON.stringify(meta)]
  );
}

async function savePlanData(userId, data) {
  await query(
    `INSERT INTO plans (user_id, days, meta, data, updated_at)
     VALUES ($1, '[]'::jsonb, '{}'::jsonb, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()`,
    [userId, data],
  );
}
