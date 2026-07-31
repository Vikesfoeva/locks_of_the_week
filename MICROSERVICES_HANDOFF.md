# Handoff: Multi-Season ("Season Key") Support — What the Data Pipeline Must Do

**Audience:** the agent/team maintaining the external microservices that write MongoDB data for the "Locks of the Week" app — the pipeline that creates weekly `odds_*` slates, writes game scores, and grades picks. Nothing in the app repo writes scores or results; your services own that data, and the app is a read-time consumer of it.

**What changed in the app (working tree, July 2026):** the app generalized "year" into a **season key** so that non-calendar seasons (e.g. an NFL preseason) can exist alongside plain years. This changes how databases are named, how several config documents are keyed, and the types of values you will encounter in `league_configurations`, `awardsData`, and `manual_awards`. The rest of your contract (slate collection naming, game doc schema, pick grading) is unchanged, but it is restated here precisely because the app now depends on it across more databases.

---

## 1. The season key — the one concept everything else derives from

A season key is **exactly one of two shapes**:

| Shape | Example | BSON/JSON type | Used for |
|---|---|---|---|
| Plain year | `2025` | **number** (never the string `"2025"`) | Normal seasons |
| Suffixed | `"2026_preseason"` | **string**, lowercase | Special seasons |

Suffixed keys must match `/^\d{4}_[a-z0-9]+$/` (server: `SEASON_SUFFIX_RE`, `backend/server.js:568`):

- 4-digit base year, one underscore, then a **single** `[a-z0-9]+` token.
- ❌ `2026_Preseason` (uppercase), `2026_pre_season` (second underscore), `2026-preseason` (hyphen), `2026_` (empty suffix).

The server canonicalizes with `normalizeSeasonKey()` (`backend/server.js:570-577`): integer numbers pass through, all-digit strings collapse to numbers (`"2025"` → `2025`), valid suffixed strings pass through, everything else returns `null` — and the endpoints listed in §7 turn that null into HTTP 400. Two caveats: the **`/api/picks` family never normalizes at all** (raw interpolation, silent failure — see §7), and plain-year values are not shape-checked (any integer or all-digit string passes, so a typo'd `225` gets a 200, not a 400).

**Two hard rules for your services:**

1. **Never `parseInt` a season key.** `parseInt('2026_preseason')` = `2026` → you'd write into the wrong season's DB/collections.
2. **Never store a plain year as a string.** MongoDB equality is type-sensitive: a doc with `year: "2025"` (string) is invisible to the server, which queries with the number `2025`. Numbers for plain years, lowercase strings for suffixed keys — always.

## 2. Database & collection naming

Everything is interpolated raw from the season key:

- **Season game DB:** `cy_{seasonKey}` → `cy_2025`, `cy_2026_preseason`. **Lowercase only.** The `GET /api/years` discovery regex is case-insensitive, so an uppercase DB name (even `cy_2025_PICKS` — the `picks` exclusion guard is case-sensitive) would *appear* in the admin dropdown but then be rejected by every season-validating endpoint, while the non-validating picks endpoints would interpolate it raw. Never create a non-lowercase `cy_*` DB of any kind.
- **Picks collection (lives in the main `locks_data` DB, not the season DB):** `cy_{seasonKey}_picks` → `locks_data.cy_2026_preseason_picks`.
- **Weekly slate collections (inside the season DB):** `odds_YYYY_MM_DD`, zero-padded, the date being the **Tuesday the slate opens**. The strict regex `/^odds_\d{4}_\d{2}_\d{2}$/` gates discovery/listing and all pick endpoints; `GET /api/awards-summary` is looser and accepts *anything* starting with `odds_` (lexicographic sort). Practical rules: always zero-pad (a non-padded name is invisible to discovery), and **never create auxiliary collections with an `odds_` prefix** (e.g. `odds_2026_08_11_backup`) inside a season DB — awards-summary would count them as weeks.
- **Week numbers are positional**: "Week N" = 1 + index of the collection name in the date-sorted list of **all** `odds_*` collections in the season DB. A stray or test slate collection renumbers every later week's label and pollutes standings/awards. Don't leave extras behind.
- Never name a database `cy_YYYY_picks` — `/api/years` filters that pattern out as a guard, but don't rely on it.
- **The calendar year inside `odds_YYYY_MM_DD` is independent of the season key.** Inside `cy_2026_preseason`, slates are still `odds_2026_08_11` etc. Frontend constraint: the pick/dashboard surfaces (pages fed by `GET /api/collections` — Dashboard, Locks, WeeklyLocks, AdminDashboard) only display collections whose embedded year equals the season's **base year** (leading 4 digits of the key) or base year + 1 (January spillover). Standings, Awards, awards-summary, and Snydermetrics apply **no** year filter — a mis-dated slate (say `odds_2031_01_05`) would be unpickable yet still show up in standings and week dropdowns. Keep embedded years at base year or base year + 1.

New seasons appear in the admin "Active Season" dropdown automatically once the `cy_{seasonKey}` DB exists and is non-empty (`GET /api/years` uses `listDatabases()`; empty DBs don't show up).

## 3. `league_configurations.active_year` can now be a string

If your pipeline reads `locks_data.league_configurations` `{key: 'active_year'}` to decide where to write:

- `value` was always a number; it can now be a **string** like `'2026_preseason'`.
- Handle both types and interpolate directly: DB `cy_${value}`, picks `cy_${value}_picks`. Do not `parseInt`.
- If the `active_year` doc is missing, season-parameterized endpoints fall back to the current calendar year (`new Date().getFullYear()`, a number) — never a suffixed key. Don't delete or rename this doc.
- **Never drop or fully empty the DB of the currently active season.** It vanishes from `GET /api/years` but `active_year` still points at it; the server keeps serving the vanished season while the admin dropdown silently displays a different one. Switch the active season first (see §9).

If your pipeline *sets* the active season via `POST /api/active-year`: body `{year: 2025}` (JSON **number** — the numeric string `"2025"` is rejected by this one endpoint) or `{year: "2026_preseason"}`.

## 4. Season-scoped config docs — the dangerous change if you touch `league_configurations`

`payout_settings`, `announcement`, and `three_zero_prize_pool` used to be one doc per key. Now:

- There can be **multiple docs per `key`**, each carrying a `season` field (number-or-string, matching the canonical season key type exactly), plus one **legacy doc with no `season` field** that serves as the read fallback for seasons that haven't been edited yet.
- Server reads: try `{key, season}`, fall back to `{key, season: {$exists: false}}` (`getSeasonConfig()`, `backend/server.js:590-596`).
- Server writes always upsert with `{key, season}` in the **filter**.
- Doc shapes, if you ever create them directly: `payout_settings.value = {first, second, third, fourth, fifth, last}` (numbers), `announcement.value = {message, active, updatedAt}`, `three_zero_prize_pool.value = <number>`; all docs also carry `key`, `season`, `updatedAt`.
- The plain config GETs (`/api/payout-settings`, `/api/announcements`, `/api/three-zero-prize-pool`) are hard-wired to the **active** season and take no season parameter. To read a non-active season's config, query `league_configurations` directly with a typed `{key, season}` filter (or use `/api/standings?year=` / `/api/three-zero-standings?year=`, which resolve season-scoped payouts/prize pool).

**Rule for any external reader/writer of these three keys:** never use a bare `{key: ...}` filter. A bare-filter `findOne` grabs an arbitrary doc; worse, a bare-filter `updateOne` would capture and convert the legacy doc, silently breaking the fallback for every other season. Always include `season` (with the exact BSON type) or explicitly target `season: {$exists: false}` for the legacy doc.

## 5. `awardsData` and `manual_awards` keying

Both collections (in `locks_data`) are keyed `{year, week}` where `week` is the full slate collection name (e.g. `'odds_2026_08_11'`). `year` now follows the season-key typing:

- Plain seasons: `year: 2025` (number) — existing docs keep working unchanged.
- Suffixed seasons: `year: '2026_preseason'` (exact lowercase string).

A query with `year: 2026` will **not** match a `'2026_preseason'` doc and vice versa. If your tooling reads or writes these collections, match the type exactly. `awardsData` docs also carry `published`, `publishedAt`/`publishedBy`/`createdAt`/`updatedAt` (and `unpublishedAt` after unpublish) — a reader checking "is this week published" must filter on `published: true`, not on doc existence.

## 6. Unchanged, but restated: your write contracts per season

These did not change in this diff, but they now apply per season DB (including suffixed ones):

**Game documents** (you create at slate time, in `cy_{seasonKey}.odds_YYYY_MM_DD`) — reference implementation: `backend/seed_preseason.js` (run with `node backend/seed_preseason.js`; reads `MONGO_URI` from `backend/.env`; idempotent — skips if the collection is non-empty):

```js
{
  league: 'NFL Preseason',                       // 'NFL' | 'NFL Preseason' | 'CFB' | 'NCAAF'
  sportKey: 'americanfootball_nfl_preseason',    // camelCase field name
  away_team_abbrev: 'DET', away_team_full: 'Detroit Lions',
  home_team_abbrev: 'NYG', home_team_full: 'New York Giants',
  commence_time: '2026-08-13T17:00:00.000Z',     // ISO-8601 string
  away_spread: -3.5, home_spread: 3.5, total: 37.5,
  homeScore: null, awayScore: null, status: 'scheduled'
}
```

- Odds fields are **snake_case**; the fields you update post-game — `homeScore`, `awayScore`, `status` — are **camelCase**. Keep that split.
- `_id` must be a real ObjectId (the app looks games up via `new ObjectId(pick.gameId)`).
- Award/margin math runs when `homeScore !== null && awayScore !== null && status === 'final'` (lowercase `'final'` exactly). ⚠️ **A missing field passes that gate** (`undefined !== null` is true) and `parseFloat(undefined) || 0` grades the game 0–0 — so setting `status: 'final'` without both scores silently corrupts awards. **Write both scores and the status flip in one atomic update.**
- Write scores as **BSON numbers**. The backend `parseFloat`s them, but the frontend score display requires `typeof === 'number'` — string scores grade correctly yet render blank in the UI.
- Status vocabulary the UI knows: `'scheduled'`, `'in-progress'` (renders "Live"/"In Progress"), `'unstarted'` (renders "NS"), `'final'`. Any other string is displayed raw.
- Snydermetrics sport bucketing is league label **or** sportKey substring: NFL bucket = `league === 'NFL' || league === 'NFL Preseason' || sportKey.includes('nfl')`; CFB bucket = `league === 'CFB' || 'NCAAF' || sportKey.includes('ncaaf')`. The `'NFL Preseason'` league match is new in this diff; it matters only for docs whose `sportKey` doesn't contain `'nfl'`.

**Pick grading** (you update docs in `locks_data.cy_{seasonKey}_picks`):

- Join a pick to its game via `pick.collectionName` + `pick.gameId` (the game `_id` as a string).
- Write `result: 'WIN' | 'LOSS' | 'TIE'` — **uppercase full words**. Most reads uppercase before comparing, but the manual-awards query matches `result: 'WIN'` exactly, and single letters (`'W'`/`'L'`/`'T'`) are recognized *only* by Snydermetrics — they'd break standings and awards.
- Do **not** modify `threeOEligible` (stamped at submission), `submittedAt`, or `userId` (a Firebase UID, not a Mongo `_id`). If you ever insert or backfill pick docs, always include `threeOEligible` explicitly: a **missing** flag is treated as eligible (`pick.threeOEligible !== false`) and would silently qualify for the 3-0 prize pool.

**Deadline logic is untouched:** 3-0 eligibility (submitted by Saturday 11:59:59 AM ET) and week-completion (4:00 AM ET the following Tuesday) are still derived from the Tuesday encoded in the slate collection name.

## 7. If your services call the app's HTTP API

- `GET /api/years` now returns a **mixed-type array**, e.g. `[2026, "2026_preseason", 2025]`, sorted by base year descending with the plain year before its suffixed variants. Don't assume numbers.
- `GET /api/active-year` → `{year: <number|string|null>}`.
- Query-parameterized reads accept `?year=2026_preseason` and now return **HTTP 400 `{error: 'Invalid year'}`** for malformed values (previously they silently misread the wrong season via `parseInt`): `/api/standings`, `/api/three-zero-standings`, `/api/awards`, `/api/awards-summary`, `/api/snydermetrics`, `/api/manual-awards/winning-picks`, `/api/awards/published-status`, `DELETE /api/manual-awards`.
- Same validation, but season key in the **JSON body**: `POST /api/awards/publish`, `POST /api/awards/unpublish`, `POST /api/manual-awards`.
- `POST /api/payout-settings`, `POST /api/announcements`, `POST /api/three-zero-prize-pool` accept an optional `season` body field (normalized — here a numeric string `"2025"` is tolerated and collapsed to `2025`, unlike `/api/active-year`); omitted → the active season is used.
- ⚠️ The **`/api/picks` family performs no season-key validation at all**: `POST /api/picks` (body `year`), `GET /api/picks`, `GET /api/picks/check-completion`, `GET /api/picks/secure-user-picks` (query `year`) interpolate the value raw into `cy_${year}` / `cy_${year}_picks`. A malformed or wrong-type key doesn't 400 — it silently reads a nonexistent collection (empty results) or creates a garbage one. Send the canonical key exactly.
- `GET /api/collections` and `GET /api/games` serve **only the currently active season's DB** and take no year parameter. If you verify your writes through the app's API, slates written to a non-active season DB are invisible until an admin switches the Active Season — check Mongo directly instead.
- Endpoints remain unauthenticated except `GET /api/picks/check-completion` and `GET /api/picks/secure-user-picks` (Firebase bearer token) — unchanged.

Also fixed app-side (no action needed, FYI): the Google Apps Script webhook fired on pick submission previously computed its "Week N - M/D/YY" label from the wrong DB for cross-year slates and suffixed seasons; it now uses the season key from the request. Payload shape is unchanged.

## 8. Quick checklist for supporting a new suffixed season (e.g. `2026_preseason`)

1. Pick a key matching `/^\d{4}_[a-z0-9]+$/` — lowercase, single-token suffix.
2. Create DB `cy_2026_preseason`; add slates as `odds_YYYY_MM_DD` (Tuesday dates, calendar year = 2026/2027) with game docs in the schema above. The season then auto-appears in the admin dropdown.
3. Treat the season key as an opaque string everywhere: DB `cy_2026_preseason`, picks `locks_data.cy_2026_preseason_picks`, `awardsData`/`manual_awards` docs with `year: '2026_preseason'` (string), config docs with `season: '2026_preseason'`.
4. Grade picks and write scores exactly as for a plain year, just in the suffixed DB/collection.
5. Never `parseInt` the key; never uppercase it; never store plain years as strings.

## 9. Rollover: preseason → main 2026 season

The plain-year path is the original app behavior — **no code changes are needed** (the only year literal in live code is an inert `activeYear === 2024` in `Locks.jsx`). The rollover is data + one admin action, in this order:

1. **Pipeline:** create DB `cy_2026` and load the Week 1 slate (`odds_2026_MM_DD`, the opening Tuesday, zero-padded). Once non-empty, "2026" auto-appears in the admin dropdown. Season key = the **number** `2026` everywhere from here on.
2. **Admin:** switch Active Season to 2026 in the dashboard (sends `POST /api/active-year {year: 2026}`). Users can't see or pick 2026 games until this happens (`/api/collections`//`/api/games` are active-season-only), so do it once Week 1 is loaded.
3. **Admin, after switching:** re-save the season-scoped settings for 2026 — payout settings, 3-0 prize pool, announcement. Preseason values won't leak (they're stored under `season: '2026_preseason'`), but until 2026-scoped docs are saved, reads fall back to the **legacy unscoped docs** (pre-season-scoping values, i.e. 2025's) — so don't skip this if amounts changed.
4. **Pipeline, weekly ops:** identical to before, keyed by the number `2026`: slates into `cy_2026`, scores+`status:'final'` atomically onto game docs, uppercase results into `locks_data.cy_2026_picks` (auto-created on first pick submission), `awardsData`/`manual_awards` docs with `year: 2026` (number).
5. **Cleanup of preseason test data (only after step 2):** drop DB `cy_2026_preseason` (removes it from the dropdown), drop `locks_data.cy_2026_preseason_picks`, and delete `league_configurations` docs with `season: '2026_preseason'` plus any `awardsData`/`manual_awards` docs with `year: '2026_preseason'`. Skip this if you want the preseason results kept for the record — it coexists harmlessly.
6. **Roster bookkeeping (manual, optional):** `duesPaid`/`dateDuesPaid` are global booleans on the user doc, not season-scoped — they carry over and nothing functional filters on them, but reset them in the admin UI if you track dues per season. Every user doc appears in the new season's standings as a 0-0-0 row regardless of participation, so remove departed users (admin delete also clears their whitelist entry).
