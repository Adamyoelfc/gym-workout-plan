import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router } from "./routes.js";
import { migrateDb, waitForDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const CLIENT_DIST = path.resolve(__dirname, "../public");

const app = express();
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src https://www.youtube-nocookie.com; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
// Respuestas privadas: que ningún navegador o proxy las guarde (las rutas pueden sobrescribirlo).
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
app.use("/api", router);

// Serve the built client (copied to ../public in the Docker image) and
// fall back to index.html for client-side routes.
app.use(express.static(CLIENT_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
    if (err) res.status(404).send("Client build not found");
  });
});

waitForDb()
  .then(migrateDb)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`[server] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
