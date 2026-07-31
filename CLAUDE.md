# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Locks of the Week" — a weekly sports picking contest. Whitelisted users sign in (Firebase Auth, email/password or Google), pick up to 3 games per week from a curated slate, and are ranked on a season-long leaderboard with payouts, weekly awards, and a separate 3-0 prize pool. Two separately deployed pieces: a Vite/React frontend on Firebase Hosting and a Node/Express backend on Google Cloud Run.

## Commands

### Frontend (project root)
- `npm run dev` — Vite dev server on `http://localhost:5173`. Proxies `/api/*` to `http://localhost:5001` (the local backend).
- `npm run build` — production build to `dist/`. Verified working; emits a >500 kB chunk warning (single bundle, no code splitting).
- `npm run preview` — serve the built `dist/` locally.
- `npm run lint` — **currently broken.** The script runs ESLint 8 but there is no `.eslintrc*` in the repo, so it exits with "ESLint couldn't find a configuration file." The `eslint-plugin-react*` devDependencies are installed but unused. Don't cite lint as a passing gate; if you need linting, a config has to be added first.

### Backend (`backend/`)
- `npm start` (or `node server.js`) — Express on `PORT` (default 5001).
- `MONGO_URI` is required — the process exits immediately without it.
- Firebase Admin init order: `backend/firebase-service-account.json` if present, else `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`. If neither is available it logs a warning and continues; the two token-protected endpoints then reject all requests.
- `node backend/debug_games.js` — standalone script that connects to Mongo, resolves the active year, and dumps `odds_*` collections. Useful for inspecting slate data without the server.

### Deploy
Pushing to `main` **auto-deploys both halves** via GitHub Actions:
- `.github/workflows/deploy-frontend.yml` — `npm ci && npm run build` (injecting `VITE_*` from repo secrets), then `FirebaseExtended/action-hosting-deploy` to the live channel of project `locks-of-the-week`.
- `.github/workflows/deploy-backend.yml` — `gcloud run deploy locks-backend --source ./backend` to `us-east1`.

Manual equivalents: `./deploy.sh` (production; secrets from Google Secret Manager) and `./deploy-dev.sh` (same, but passes secrets as `--set-env-vars` from your shell).

Note: **no deploy path sets `MONGO_URI`.** All four only wire the three Firebase secrets, so `MONGO_URI` must already exist as an env var on the Cloud Run service and survives redeploys. A fresh service will crash-loop until it's set.

There are no automated tests. `backend/package.json`'s `test` script is the npm default stub that exits 1.

## Architecture

### Split deployment, single origin
The frontend is served from Firebase Hosting; `firebase.json` rewrites `/api/**` to the `locks-backend` Cloud Run service in `us-east1` and everything else to `/index.html`. The frontend therefore calls a relative `/api/...` path in every environment — `src/config.js` is literally `export const API_URL = '/api'`. In local dev, Vite proxies that same prefix to `localhost:5001`. **Do not hardcode backend URLs in frontend code** — use `API_URL`.

`VITE_API_URL` in `.env.development`/`.env.production` is dead config: nothing imports it, and the production value points at a stale `…-uc.a.run.app` (us-central1) host. Ignore it; don't "fix" it by wiring it up.

Both Vite's dev server and the Express app set `Cross-Origin-Opener-Policy: same-origin-allow-popups` (also set in `firebase.json`) — required for the Google sign-in popup. Don't tighten it.

### Auth: Firebase + MongoDB user bridge
`src/contexts/AuthContext.jsx` is the source of truth for the logged-in user. On `onAuthStateChanged`:
1. `GET /api/users?firebaseUid=…` looks up the MongoDB record.
2. On 404, `GET /api/whitelist/check?email=…` gates creation; if allowed, `POST /api/users` creates the record, then it re-fetches (with a 500 ms sleep, plus an `?email=` fallback fetch). If not whitelisted, it signs the user out with an error.
3. `currentUser` is a **merged object**: Firebase user fields spread with MongoDB fields (`_id`, `role`, `venmoHandle`, `cellPhone`, `seasons`, …). Admin check is `currentUser.role === 'admin'`.
4. Registration stashes first/last name, Venmo handle, and cell phone in `localStorage` (`pendingFirstName`, `pendingVenmoId`, …) because the DB record is created later, from the auth-state callback rather than the signup call. Google users have none of these and get routed to profile setup.

Route gating lives in `src/App.jsx`: `<PrivateRoute>` (login required), `<PrivateRoute adminOnly>` (admin role), and `<ProfileSetupGuard>` which forces users to `/setup-profile` until `venmoHandle` and `cellPhone` are set. Routes: `/`, `/locks`, `/weekly`, `/standings`, `/awards`, `/snydermetrics`, `/settings`, `/admin`.

### Authorization is almost entirely client-side — know this before touching routes
`backend/server.js` defines `authenticateUser()` (verifies a Firebase ID token from `Authorization: Bearer …`), but it is applied to exactly **two** routes: `GET /api/picks/check-completion` and `GET /api/picks/secure-user-picks`. Everything else — user CRUD, whitelist management, pick submission, active-year switching, payout settings, announcements, prize pool, awards publish/unpublish, manual awards — is unauthenticated. Correspondingly, `Standings.jsx` is the only frontend file that attaches a bearer token.

`GET /api/awards` accepts `isAdmin` as a **query parameter** to bypass the published-week gate, so unpublished awards are readable by anyone who sets `?isAdmin=true`.

Treat this as the current state, not a design goal. Adding `authenticateUser` to a route is a breaking change for every caller — the frontend sends no token on those paths — so any hardening pass has to update both sides together.

### Data lives in Mongo but is *produced* elsewhere
Nothing in this repo writes game scores or grades picks. `POST /api/picks` `insertMany`s pick documents and never updates them again; `pick.result` (`'WIN'`/`'LOSS'`/`'TIE'`) and game `homeScore`/`awayScore`/`status` arrive from an out-of-band pipeline that also creates the `odds_*` collections. Standings, awards, and Snydermetrics are all pure read-time aggregations over that externally-written data. If results look wrong, the bug is usually upstream of this codebase.

### MongoDB layout (two-tier)
- **`locks_data`** (main DB, `dbName` constant): `users`, `whitelist`, `league_configurations` (key/value docs: `active_year`, `payout_settings`, `announcement`, `three_zero_prize_pool`), `awardsData` (per-week publish state), `manual_awards` (admin overrides), and per-season `cy_{seasonKey}_picks` collections.
- **`cy_{seasonKey}`** (one DB per season, reached via `client.db(...)`, not the pooled `db`): `odds_YYYY_MM_DD` collections, one per weekly slate.

**Season keys** are either a plain year (`2025`, stored/compared as a **number**) or a lowercase `YYYY_suffix` string (`2026_preseason` → DB `cy_2026_preseason`, picks `cy_2026_preseason_picks`) — validated by `SEASON_SUFFIX_RE` and canonicalized by `normalizeSeasonKey()` in `server.js` (numeric strings from query params collapse back to numbers so existing numeric-year docs in `awardsData`/`manual_awards` still match; never `parseInt` a season key directly). `GET /api/years` lists both forms from `listDatabases()` (empty DBs don't appear); the admin "Active Season" dropdown switches via `POST /api/active-year`. Frontend: `src/utils/seasonFormatter.js` has `formatSeasonLabel()` ('2026_preseason' → "2026 Preseason") and `seasonBaseYear()` (use this, never `activeYear + 1` arithmetic). `backend/seed_preseason.js` seeds a fake `cy_2026_preseason` slate for testing.

**`payout_settings`, `announcement`, and `three_zero_prize_pool` are season-scoped**: docs carry a `season` field; reads try `{key, season}` then fall back to the legacy unscoped doc (`season: {$exists: false}`) via `getSeasonConfig()`. `backend/migrate_2026_season_scoping.js` stamped the prod legacy docs with `season: 2025`, so the fallback normally finds nothing and a season without its own doc gets the route's empty defaults (that's intended — new seasons start fresh); the fallback code is retained defensively. Writes upsert with a `{key, season}` filter and must never drop the `season` field from the filter — a bare `{key}` filter would match and convert a legacy doc, breaking the fallback for every other season. The admin POSTs send the season they were editing in the body; the server falls back to the active season if absent.

**Users carry a per-season membership/dues map**: `user.seasons` is keyed by `String(seasonKey)` (e.g. `{"2025": {active, duesPaid, dateDuesPaid}, "2026_preseason": {…}}`). The old top-level `duesPaid`/`dateDuesPaid` fields were migrated into `seasons.2025` and are stripped by `PUT /api/users/:id`, which also refuses whole-map `seasons` writes — per-season edits go through a `seasonUpdate: {season, active, duesPaid, dateDuesPaid}` body field translated server-side into dot-notation `$set`s. `POST /api/users` seeds new users with the active season (`{active: true, duesPaid: false}`). Membership is **display-only** (admin User Management table shows the active season's column values): standings, awards, weekly views, and pick submission do NOT filter by it. The migration script backfilled membership from picks history (deliberately skipping season 2024) and is safe to re-run — it never overwrites existing season entries.

**Picks join users by `firebaseUid`, not Mongo `_id`.** `pick.userId` holds the Firebase UID, so every aggregation keys its user map on `user.firebaseUid` and silently skips users without one.

**Game documents are snake_case** (`away_team_abbrev`, `home_team_full`, `away_spread`, `home_spread`, `total`, `commence_time`, `league`) except the externally-added `homeScore`/`awayScore`/`status`, which are camelCase. `GET /api/games` returns raw documents; pages like `Locks.jsx` normalize to camelCase client-side. Keep that mapping in sync when adding fields.

**Pick documents** are `{ userId (firebaseUid), collectionName, gameId, pickType: 'spread'|'total', pickSide: <teamAbbrev>|'OVER'|'UNDER', line, price, submittedAt, threeOEligible }` plus `result` written externally.

### The week is a Tuesday date, and deadlines are hand-rolled Eastern Time
Collection names encode the **Tuesday** the slate opens; `parseCollectionNameToDate()` parses `odds_YYYY_MM_DD`, and week ordering/numbering everywhere is "sort the `odds_*` collection names by that date, then index into the array." Two derived rules in `server.js`:
- `calculateThreeOEligible(collectionName, submissionTime)` — stamped onto each pick at submission. True if submitted by **Saturday 11:59:59 AM ET** (Tuesday + 4 days). Gates the 3-0 prize pool.
- `isWeekComplete(collectionName)` — true after **4:00 AM ET the following Tuesday**. Gates awards calculation and publishing.

Both compute the ET offset with a local `isDST()` helper (2nd Sunday in March → 1st Sunday in November) rather than a timezone library, and both are duplicated inline. Server timezone is assumed to be irrelevant because the result is built in UTC — verify that assumption before changing either.

Pick limit (3 per week) is enforced server-side in `POST /api/picks`. Kickoff cutoffs are **not**: `Locks.jsx` only hides/greys games whose `commenceTime` has passed, so the backend will accept a pick on a started game.

### Awards flow
`GET /api/awards` returns `{}` with an explanatory message until `isWeekComplete()`; after that, non-admin callers also need a `published: true` doc in `awardsData` for that `{year, week}`. Admins publish via `POST /api/awards/publish` (rejects incomplete weeks) and `POST /api/awards/unpublish`. `calculateWeeklyAwards()` derives ten named awards — Flop of the Week, Lone Wolf, Lock of the Week, Close Call, Sore Loser, Biggest Loser, Boldest Favorite, Big Dawg, Big Kahuna, Tinkerbell — from picks + game details; `manual_awards` lets an admin override a category for a week.

### Pick submission side effect
`POST /api/picks` writes to MongoDB **and** POSTs to a hardcoded Google Apps Script URL (`server.js` ~line 685) with enriched pick details, username, email, formatted week label, and the user's optional message — for external spreadsheet logging. It's wrapped in its own try/catch so failures don't fail the submission (they only log). If you refactor pick submission, preserve or intentionally remove this: silent breakage lands in an external sheet, not the app.

### Backend is one file
`backend/server.js` is ~3,300 lines holding every route, helper, and aggregation. Middleware: Helmet, CORS (allow-list of `localhost:5173`–`5178`, `https://locks-of-the-week.web.app`, and `FRONTEND_URL`), JSON parser, COOP header. Two structural quirks worth knowing: the error-handling middleware is registered *before* all routes (so it never catches route errors — each handler try/catches itself), and `connectToDb()` retries 5×/5 s with a ping-based liveness check before `app.listen`, so the process won't serve traffic until Mongo is reachable.

### Frontend API pattern
There is no central API client. Most pages use `fetch` (`AdminDashboard`, `Awards`, `Standings`, `AuthContext`, `Snydermetrics`, `Register`); `Dashboard`, `Locks`, and `WeeklyLocks` use `axios`. Match the surrounding file's style when adding calls. Page sizes are large (`Standings.jsx` ~1,600 lines, `Locks.jsx` ~1,550, `WeeklyLocks.jsx` ~1,490, `Awards.jsx` ~1,350, `AdminDashboard.jsx` ~1,270) — expect to work inside long files rather than across many.

`WeeklyLocks.jsx` exports the week's picks to `.xlsx` via SheetJS, pinned to a CDN tarball (`xlsx@0.20.3` from `cdn.sheetjs.com`, not npm) — don't "fix" that dependency spec to a registry version.

### Styling
Tailwind with a custom `primary` palette (sky-blue 50–900) in `tailwind.config.js`. Headless UI + Heroicons for interactive primitives. Shared component classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.input`, `.card`) are `@apply` definitions in `src/index.css`.

## Repo debris — don't mistake these for live code

- `cfb_images/` (183 files) and `nfl_images/` (32 files) are committed team logos referenced by **nothing** in `src/`, and they're outside `public/`, so they aren't built or deployed. The app renders team abbreviations, not logos.
- `requirements.txt` lists Flask/pytest/black/flake8 but the repo contains zero `.py` files.
- `build/` holds a stale hosting artifact from before `firebase.json` pointed at `dist/`.
- `backend/README.md` is outdated (claims port 4000, references a nonexistent `.env.example`, documents one endpoint).
- `src/examples/ImprovedFilterExample.jsx` demonstrates the `useFilterModal` hook and is not imported by the app — documentation, not production.
- `.gitignore` is a Python template with Node entries appended; `dist/` and `build/` are ignored via its Python section.

## Environment variables

Frontend (Vite, `VITE_` prefix, consumed only in `AuthContext.jsx`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`. Local values live in the gitignored root `.env`; CI injects them from GitHub secrets.

Backend: `MONGO_URI` (required), `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (literal `\n` sequences, un-escaped at init), `PORT`, `NODE_ENV` (`development` surfaces error details in responses), `FRONTEND_URL` (appended to the CORS allow-list).
