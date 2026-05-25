import rateLimit from "express-rate-limit";
import { pool } from "./db.js";

// Rate limit for registration (prevent spam accounts)
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per IP per hour
  message: { error: "Too many accounts created from this IP, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for login (prevent brute force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per IP
  message: { error: "Too many login attempts, please try again later" },
  skipSuccessfulRequests: true,
});

// Rate limit for AI generation (per IP, before auth check)
export const aiGeneralLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per IP per hour
  message: { error: "Too many AI requests from this IP" },
});

// Check and consume AI credits for a user
export async function checkAiCredits(userId) {
  const DAILY_LIMIT = 10; // Free tier: 10 generations per day
  const RESET_HOURS = 24;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current credits and reset time
    const { rows } = await client.query(
      `SELECT ai_credits, ai_credits_reset FROM users WHERE id = $1`,
      [userId]
    );
    
    if (rows.length === 0) {
      throw new Error("User not found");
    }

    let { ai_credits, ai_credits_reset } = rows[0];
    const now = new Date();
    const resetTime = new Date(ai_credits_reset);

    // Reset credits if period expired
    if (now > new Date(resetTime.getTime() + RESET_HOURS * 60 * 60 * 1000)) {
      ai_credits = DAILY_LIMIT;
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

// Log AI usage for monitoring
export async function logAiUsage(userId, action) {
  try {
    await pool.query(
      `INSERT INTO ai_usage_logs (user_id, action) VALUES ($1, $2)`,
      [userId, action]
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
