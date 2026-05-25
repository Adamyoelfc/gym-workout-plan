# Adam Shred — full-stack, containerized

Personal weekly gym plan with **user accounts**, **server-synced progress**, and
**AI-generated workout plans**. Originally a static Vite SPA; now a Dockerized
full-stack app ready to deploy on a VPS (Linode, etc.).

## Stack

| Layer    | Tech                                                        |
|----------|-------------------------------------------------------------|
| Frontend | React + Vite (`client/`)                                    |
| Backend  | Node + Express (`server/`) — serves the API **and** the built client |
| Auth     | Email + password, bcrypt hashes, JWT (30-day tokens)        |
| Database | PostgreSQL (own container + persistent volume)              |
| AI       | OpenRouter (OpenAI-compatible chat completions)             |

Two containers: `db` (Postgres) and `app` (Express serving API + static client on port 8080).

## Layout

```
docker-compose.yml      # db + app services
Dockerfile              # multi-stage: build client → run server serving it
.env.example            # copy to .env and fill in
client/                 # Vite React SPA (auth UI, progress sync, AI modal)
server/
  src/{index,db,auth,routes,ai}.js
  db/init.sql           # users / progress / plans schema (runs on first DB boot)
```

## Run locally (Docker)

```bash
cp .env.example .env          # then edit: set JWT_SECRET, POSTGRES_PASSWORD, OPENROUTER_API_KEY
docker compose up -d --build
```

Open http://localhost:8080 → register → train. To use AI plan generation, set
`OPENROUTER_API_KEY` in `.env` (get one at https://openrouter.ai/keys) and restart:
`docker compose up -d`.

Generate a strong secret: `openssl rand -hex 32`.

## Run locally (without Docker)

```bash
# terminal 1 — server (needs a reachable Postgres)
cd server && npm install
DATABASE_URL=postgres://shred:shred@localhost:5432/shred \
JWT_SECRET=dev OPENROUTER_API_KEY=sk-... npm run dev

# terminal 2 — client (Vite proxies /api → :8080)
cd client && npm install && npm run dev
```

## Deploy to a Linode VPS

1. Install Docker + Compose on the VPS, then clone this repo.
2. `cp .env.example .env` and set real values:
   - `JWT_SECRET` (long random), `POSTGRES_PASSWORD`, `OPENROUTER_API_KEY`
   - `PUBLIC_URL=https://your-domain` and `APP_PORT` if not 8080.
3. `docker compose up -d --build`.
4. Put it behind a reverse proxy (Caddy/Nginx) for TLS, forwarding `:443 → app:8080`.
   The Postgres `db_data` volume persists across restarts/rebuilds.

To reset the database (wipes all users/progress): `docker compose down -v`.

## API

| Method | Path                  | Auth | Purpose                          |
|--------|-----------------------|------|----------------------------------|
| POST   | `/api/auth/register`  | —    | Create account, returns JWT      |
| POST   | `/api/auth/login`     | —    | Returns JWT                      |
| GET    | `/api/auth/me`        | ✓    | Current user                     |
| GET    | `/api/progress`       | ✓    | Fetch synced progress            |
| PUT    | `/api/progress`       | ✓    | Save progress blob               |
| GET    | `/api/plan`           | ✓    | Fetch saved plan (or null)       |
| PUT    | `/api/plan`           | ✓    | Save a custom plan               |
| POST   | `/api/plan/generate`  | ✓    | AI-generate + save a weekly plan |

The AI returns a `days` array matching the frontend schema, so generated plans
render exactly like the built-in default program.

---

The original Cloudflare Pages function (`functions/exercise-api/`) is left in the
repo for reference but is unused in this VPS deployment.
