import { Router } from "express";
import { query } from "./db.js";
import { 
  hashPassword, 
  verifyPassword, 
  signToken, 
  requireAuth,
  requireVerified,
  generateVerificationToken,
  getVerificationExpiry
} from "./auth.js";
import { generatePlan } from "./ai.js";
import { sendVerificationEmail } from "./email.js";
import { 
  registrationLimiter, 
  loginLimiter, 
  aiGeneralLimiter,
  checkAiCredits,
  logAiUsage,
  getAiUsageStats
} from "./ratelimit.js";

export const router = Router();

const publicUser = (u) => ({ 
  id: u.id, 
  email: u.email, 
  name: u.name,
  emailVerified: u.email_verified,
  aiCredits: u.ai_credits
});

const isEmail = (s) => typeof s === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

// --- Auth ----------------------------------------------------------------

// Register with email verification
router.post("/auth/register", registrationLimiter, async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: "Valid email required" });
  if (!password || password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters" });

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
    
    // Send verification email
    await sendVerificationEmail(email, verificationToken);
    
    res.status(201).json({ 
      token: signToken(user), 
      user: publicUser(user),
      message: "Account created! Please check your email to verify."
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    console.error("[routes] register error", err);
    res.status(500).json({ error: "Registration failed" });
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

    await sendVerificationEmail(user.email, verificationToken);
    
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
  if (!isEmail(email) || !password) return res.status(400).json({ error: "Email and password required" });

  const { rows } = await query(
    "SELECT id, email, name, password_hash, email_verified, ai_credits FROM users WHERE email = $1", 
    [email.toLowerCase()]
  );
  const user = rows[0];
  
  if (!user || !(await verifyPassword(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });

  res.json({ 
    token: signToken(user), 
    user: publicUser(user),
    warning: !user.email_verified ? "Please verify your email to use AI features" : null
  });
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
    "SELECT days, meta, updated_at FROM plans WHERE user_id = $1", 
    [req.user.id]
  );
  if (!rows[0]) return res.json({ plan: null });
  res.json({ 
    plan: { 
      days: rows[0].days, 
      meta: rows[0].meta, 
      updatedAt: rows[0].updated_at 
    } 
  });
});

// Save a plan directly (e.g. an edited/custom one) - no AI, no verification needed
router.put("/plan", requireAuth, async (req, res) => {
  const { days, meta } = req.body || {};
  if (!Array.isArray(days) || days.length === 0) 
    return res.status(400).json({ error: "days array required" });
  
  await savePlan(req.user.id, days, meta || {});
  res.json({ ok: true });
});

// Generate a plan with AI - REQUIRES EMAIL VERIFICATION + AI CREDITS
router.post("/plan/generate", 
  aiGeneralLimiter,  // IP-based rate limit
  requireAuth,        // Must be logged in
  requireVerified,    // Must have verified email
  async (req, res) => {
    try {
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

async function savePlan(userId, days, meta) {
  await query(
    `INSERT INTO plans (user_id, days, meta, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id) DO UPDATE SET days = $2, meta = $3, updated_at = now()`,
    [userId, JSON.stringify(days), JSON.stringify(meta)]
  );
}
