# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Locks of the Week" — a weekly sports picking contest. Users sign in (Firebase Auth, email/password or Google), pick 1–3 games per week from a curated slate, and are ranked on a season-long leaderboard with payouts. Two separately deployed pieces: a Vite/React frontend on Firebase Hosting and a Node/Express backend on Google Cloud Run.

## Commands

### Frontend (project root)
- `npm run dev` — Vite dev server on `http://localhost:5173`. Proxies `/api/*` to `http://localhost:5001` (the local backend).
- `npm run build` — production build to `dist/`.
- `npm run lint` — ESLint with `--max-warnings 0`; CI/scripts assume zero warnings.
- `npm run preview` — serve the built `dist/` locally.

### Backend (`backend/`)
- `npm start` (or `node server.js`) — starts Express on `PORT` (default 5001).
- Requires `MONGO_URI` (process exits if missing) and `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (Firebase Admin token verification is disabled gracefully if missing).

### Deploy
- `./deploy.sh` — production. Runs `npm run build`, deploys frontend via `firebase deploy --only hosting`, then deploys backend to Cloud Run (`locks-backend`, region `us-east1`, project `locks-of-the-week`) wiring secrets from Google Secret Manager.
- `./deploy-dev.sh` — dev variant that passes secrets as `--set-env-vars` from the local shell instead of Secret Manager.

There are no automated tests in this project. GitHub Actions workflows under `.github/workflows/` are `.disabled`.

## Architecture

### Split deployment, single origin
The frontend is served from Firebase Hosting; `firebase.json` rewrites `/api/**` to the `locks-backend` Cloud Run service in `us-east1`. The frontend therefore calls a relative `/api/...` path in all environments (`API_URL` in `src/config.js`). In local dev, Vite proxies that same `/api` prefix to `localhost:5001`. **Do not hardcode backend URLs in frontend code** — use `API_URL` from `src/config.js`.

### Auth: Firebase + MongoDB user bridge
`src/contexts/AuthContext.jsx` is the source of truth for the logged-in user. The flow:
1. Firebase Auth handles credentials (email/password or Google popup).
2. On `onAuthStateChanged`, the context calls `GET /api/users?firebaseUid=…` to look up the user's MongoDB record.
3. For new users it first checks `GET /api/whitelist/check`; if allowed, it creates the MongoDB record via `POST /api/users`.
4. `currentUser` exposed by the context is a **merged object**: Firebase user fields + MongoDB fields including `_id`, `role`, `venmoHandle`, `cellPhone`. Treat `currentUser.role === 'admin'` as the admin check.
5. `<ProfileSetupGuard>` forces new users through `/setup-profile` until `venmoHandle` and `cellPhone` are set.

Route gating is in `src/App.jsx` via `<PrivateRoute>` (requires login) and `<PrivateRoute adminOnly>` (requires admin role).

### Backend is a single Express file
`backend/server.js` (~3,300 lines) holds every route. Middleware: Helmet, CORS (whitelist of localhost:5173–5178 plus the production Firebase domain), JSON parser. Auth middleware `authenticateUser()` validates Firebase ID tokens from the `Authorization: Bearer …` header via the Firebase Admin SDK. **Heads-up:** admin-only endpoints (`/api/payout-settings`, `/api/announcements`, `/api/three-zero-prize-pool`) are not currently behind `authenticateUser`.

### MongoDB layout (two-tier)
- **`locks_data`** (main DB): `users`, `whitelist`, `league_configurations` (key/value: `active_year`, `payout_settings`, `announcement`, `three_zero_prize_pool`), and per-year `cy_{year}_picks` collections (e.g., `cy_2025_picks`).
- **`cy_{year}`** (per-season DBs): one per active year, containing `odds_YYYY_MM_DD` collections — one per game slate/week. Game documents carry team abbreviations, spreads, totals, scores, status, and league.

To switch the active year, write to `league_configurations` via `POST /api/active-year`. Most reads use `GET /api/active-year` first, then query the corresponding `cy_{year}` DB.

### Pick submission side effect
`POST /api/picks` writes to MongoDB **and** fires a webhook to a hardcoded Google Apps Script URL (server.js ~line 685) for spreadsheet logging. If you refactor pick submission, preserve or intentionally remove this — silent breakage hits an external sheet, not the app.

### Frontend API pattern
Pages call the backend directly with `axios` (some places use `fetch`) against `${API_URL}/...`. There is no central API client. Match the surrounding file's style when adding new calls.

### Styling
Tailwind with a custom `primary` color palette (sky-blue scale 50–900) in `tailwind.config.js`. Headless UI + Heroicons for interactive primitives. Shared component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.card`) live in `src/index.css`.

### Static team logos
`cfb_images/` (~217 PNGs, CFB team logos) and `nfl_images/` (~7 PNGs, NFL logos) sit at the repo root. Confirm how they're served before changing the layout — they are not under `public/` or `src/`.

### `src/examples/`
Reference code (e.g., `ImprovedFilterExample.jsx` demonstrating the `useFilterModal` hook). Not imported by the app — treat it as documentation, not production.

## Environment variables

Frontend (Vite, prefix `VITE_`):
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_API_URL` exists in `.env.development` / `.env.production` but production frontend code uses the relative `/api` path from `src/config.js` (the Firebase Hosting rewrite handles routing).

Backend:
- `MONGO_URI` (required), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (newlines escaped as `\n`), `PORT`, `NODE_ENV`, `FRONTEND_URL`.
