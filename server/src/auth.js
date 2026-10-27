import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const TOKEN_TTL = process.env.SESSION_TTL || "14d";
const COOKIE_NAME = "shred_session";
const COOKIE_PATH = process.env.SESSION_COOKIE_PATH || "/";
// La cookie es Secure solo si la app se sirve por HTTPS (PUBLIC_URL) o la petición llegó por HTTPS.
// Con NODE_ENV=production en un Docker local por http://IP:8080 el navegador descartaba la sesión.
const PUBLIC_HOST = (() => {
  try { const url = new URL(process.env.PUBLIC_URL || ""); return url.protocol === "https:" ? url.hostname : null; } catch { return null; }
})();
const secureCookie = (req) => Boolean(req?.secure) || (PUBLIC_HOST !== null && req?.hostname === PUBLIC_HOST);

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production");
} else if (!process.env.JWT_SECRET) {
  console.warn("[auth] JWT_SECRET not set — using insecure dev fallback");
}

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);
// Hash de relleno: el login tarda lo mismo exista o no el email (evita enumerar cuentas).
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);
export const verifyPasswordOrDummy = (plain, hash) => bcrypt.compare(plain, hash || DUMMY_HASH).then((ok) => Boolean(hash) && ok);

export const signToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL, algorithm: "HS256" });

export function setSessionCookie(req, res, user) {
  res.cookie(COOKIE_NAME, signToken(user), {
    httpOnly: true,
    secure: secureCookie(req),
    sameSite: "strict",
    path: COOKIE_PATH,
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: secureCookie(req),
    sameSite: "strict",
    path: COOKIE_PATH,
  });
}

function readCookie(req, name) {
  const cookie = req.headers.cookie || "";
  const found = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

// Express middleware: requires a valid Bearer token, attaches req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : readCookie(req, COOKIE_NAME);
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: Number(payload.sub), email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Middleware: requires email verification
export async function requireVerified(req, res, next) {
  try {
    const { rows } = await query("SELECT email_verified FROM users WHERE id = $1", [req.user?.id]);
    if (!rows[0]?.email_verified) {
      return res.status(403).json({
        error: "Email not verified",
        message: "Please verify your email to use AI features",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

// Generate verification token (random hex)
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Token expires in 24 hours
export function getVerificationExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
