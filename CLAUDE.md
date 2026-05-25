# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Full-stack, containerized. Two deployable containers via `docker-compose.yml`: `db` (Postgres) and `app` (Express serving the API **and** the built client on port 8080). Frontend in `client/`, backend in `server/`. Deployed to a VPS (Linode), not Cloudflare anymore.

## Commands

Containers (preferred):
- `cp .env.example .env` then `docker compose up -d --build` — full stack on http://localhost:8080
- `docker compose down` (keep data) / `docker compose down -v` (wipe DB volume)

Client only (`client/`):
- `npm install`; `npm run dev` — Vite dev server on `0.0.0.0`, proxies `/exercise-api/*` → ExerciseDB and `/api/*` → backend (`localhost:8080`, override with `VITE_API_TARGET`)
- `npm run build` — production build to `client/dist/` (copied into the server image's `public/`)

Server only (`server/`): `npm install`; `npm run dev` (needs `DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY` env).

No tests, linter, or typechecker are configured.

## Backend (`server/`)

Express, ES modules, Node 20. `src/index.js` waits for the DB (`db.js` retries `SELECT 1`), mounts `/api` routes, then serves the static client from `../public` with an `index.html` fallback for non-`/api` paths.
- `auth.js` — bcrypt password hashing + JWT (`requireAuth` middleware, `Authorization: Bearer`). `JWT_SECRET` from env.
- `routes.js` — `/api/auth/{register,login,me}`, `/api/progress` (GET/PUT one JSONB blob per user), `/api/plan` (GET/PUT) and `/api/plan/generate` (AI).
- `ai.js` — OpenRouter (OpenAI-compatible) chat completion. `OPENROUTER_API_KEY` + `OPENROUTER_MODEL`. Returns a `days` array matching the frontend schema; `validateDays` coerces/sanitizes the model output.
- `db/init.sql` — `users`, `progress`, `plans` tables. Mounted into Postgres `/docker-entrypoint-initdb.d`, runs **only on first boot of an empty volume**. Schema changes after data exists need a manual migration or `down -v`.

## Frontend (`client/`)

React + Vite, no router, no TS. UI and default workout data live in `src/App.jsx`. `src/style.css` holds all styles. New modules: `src/api.js` (fetch wrapper, token in localStorage under `adam_shred_token`, all calls to same-origin `/api`) and `src/auth.jsx` (`AuthProvider`/`useAuth`, `AuthScreen` login-register, `LogoutButton`). `App.jsx` mounts `<AuthProvider><Root/></AuthProvider>`; `Root` gates the app behind login.

On login the app fetches the user's saved plan and progress from the server, then debounce-saves progress back (800ms). `days` is now React state (default `defaultDays`); the AI modal (`AiPlanModal`) calls `/api/plan/generate` and swaps `days`. localStorage (`PROGRESS_KEY`, `GIF_CACHE_KEY`) remains as an offline cache.

### Workout data
The `defaultDays` array in `App.jsx` is the source of truth for the weekly plan — each day has a `key` (`sun`/`mon`/…), label, and an `exercises` list built via the `ex(name, search, sets, reps, rest, cue, abs?)` helper. The `search` field is the lookup term sent to ExerciseDB; the `abs` boolean tags lower-ab work for styling. To change the program, edit this array.

### GIF lookup pipeline
`loadGif(search, …)` fans out to several query variants (handles common name reorderings like `romanian deadlift dumbbell` ↔ `dumbbell romanian deadlift`), calls `${API_BASE}/search`, then `pickBestMatch` scores results by normalized name overlap. The chosen match's `gifUrl` (or `${STATIC_BASE}${id}.gif`) is cached in `localStorage` under `GIF_CACHE_KEY`. `NO_GIF_SEARCHES` is the skip-list for terms ExerciseDB has no usable GIF for (walking, stretching, vacuum) — those go straight to `failed`. `FALLBACK_GIFS` hardcodes overrides for known-bad matches.

### ExerciseDB API path (dev vs prod)
`API_BASE` switches on `import.meta.env.DEV`: dev uses `/exercise-api` (Vite proxies to ExerciseDB to bypass CORS); prod hits `https://oss.exercisedb.dev/api/v1/exercises` directly. This is separate from the app's own backend (same-origin `/api`, see `src/api.js`). `functions/exercise-api/search.js` is a leftover Cloudflare Pages Function, unused in the VPS deployment.

### Local persistence
Two `localStorage` keys via the `useLocalStorage` hook:
- `GIF_CACHE_KEY` (`adam_shred_react_gifs_v2`) — `{ [search]: { gif, id, name, status, ts } }`. Bump the `_v2` suffix to invalidate caches across users after a schema change.
- `PROGRESS_KEY` (`adam_shred_react_progress_v1`) — `{ [exId]: { [setNo]: { weight, reps, done } } }` where `exId = ${dayKey}-${slug(name)}-${index}`.

### Rest timer
Marking a set `done` auto-starts a `setInterval` countdown derived from the exercise's `rest` string (`parseRest` extracts the first integer). On completion it triggers `navigator.vibrate` if available. Only one timer at a time (top-level `timer` state).

## Notes for edits
- Keep the single-file structure in `App.jsx` unless splitting is explicitly requested — components (`GifBox`, `SetTracker`, `Stat`, `Info`) live alongside `App` intentionally.
- UI copy mixes Spanish (descriptions, labels) and English (cues) — preserve that mix.
- `lucide-react` is the only icon library; reuse it rather than adding another.
