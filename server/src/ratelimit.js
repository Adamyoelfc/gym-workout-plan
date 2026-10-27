import rateLimit from "express-rate-limit";
import { pool } from "./db.js";

// Rate limit for registration (prevent spam accounts)
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  message: { error: "Demasiados intentos de registro. Prueba más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for login (prevent brute force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: { error: "Demasiados intentos fallidos. Espera 15 minutos." },
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for AI generation (per IP, before auth check)
export const aiGeneralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per IP per hour
  message: { error: "Too many AI requests from this IP" },
});

export const exerciseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 180,
  message: { error: "Too many exercise media requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Check and consume AI credits for a user
export async function checkAiCredits(userId) {
  const DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT || 10));
  const RESET_HOURS = 24;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current credits and reset time
    const { rows } = await client.query(
      `SELECT ai_credits, ai_credits_reset FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    
    if (rows.length === 0) {
      throw new Error("User not found");
    }

    let { ai_credits, ai_credits_reset } = rows[0];
    const now = new Date();
    let resetTime = new Date(ai_credits_reset);

    // Reset credits if period expired
    if (now > new Date(resetTime.getTime() + RESET_HOURS * 60 * 60 * 1000)) {
      ai_credits = DAILY_LIMIT;
      resetTime = now;
      await client.query(
        `UPDATE users SET ai_credits = $1, ai_credits_reset = $2 WHERE id = $3`,
        [DAILY_LIMIT, now, userId]
      );
    }

    // Check if user has credits
    if (ai_credits <= 0) {
      await client.query('COMMIT');
      const resetIn = new Date(resetTime.getTime() + RESET_HOURS * 60 * 60 * 1000);
      const hoursLeft = Math.ceil((resetIn - now) / (1000 * 60 * 60));
      return { 
        allowed: false, 
        credits: 0,
        resetIn: hoursLeft,
        message: `Daily AI limit reached. Resets in ${hoursLeft} hours.`
      };
    }

    // Consume one credit
    await client.query(
      `UPDATE users SET ai_credits = ai_credits - 1 WHERE id = $1`,
      [userId]
    );

    await client.query('COMMIT');
    return { 
      allowed: true, 
      credits: ai_credits - 1,
      message: `${ai_credits - 1} AI generations remaining today`
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkGlobalAiBudget() {
  const maxRequests = Math.max(1, Number(process.env.AI_GLOBAL_DAILY_LIMIT || 100));
  const maxCost = Math.max(0, Number(process.env.AI_GLOBAL_DAILY_USD || 5));
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS requests,
            COALESCE(SUM(estimated_cost_usd), 0)::numeric AS cost
     FROM ai_usage_logs WHERE created_at > now() - interval '24 hours'`,
  );
  const requests = Number(rows[0]?.requests || 0);
  const cost = Number(rows[0]?.cost || 0);
  return {
    allowed: requests < maxRequests && (maxCost === 0 || cost < maxCost),
    requests,
    cost,
  };
}

// Log AI usage for monitoring
export async function logAiUsage(userId, action, usage = {}) {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs
        (user_id, action, input_tokens, output_tokens, estimated_cost_usd)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, usage.inputTokens || null, usage.outputTokens || null, usage.cost || null]
    );
  } catch (error) {
    console.error("[ratelimit] Failed to log AI usage:", error);
    // Don't throw - logging failure shouldn't block the request
  }
}

// Get AI usage stats for a user
export async function getAiUsageStats(userId, days = 7) {
  const { rows } = await pool.query(
    `SELECT 
      DATE(created_at) as date,
      COUNT(*) as count
     FROM ai_usage_logs 
     WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    [userId]
  );
  return rows;
}
