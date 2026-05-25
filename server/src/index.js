import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { router } from "./routes.js";
import { waitForDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const CLIENT_DIST = path.resolve(__dirname, "../public");

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
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
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`[server] listening on :${PORT}`));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
