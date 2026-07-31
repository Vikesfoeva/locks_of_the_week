// One-time migration for the 2026 season-scoping work. Two phases:
//   1. Stamp the legacy unscoped league_configurations docs (payout_settings,
//      announcement, three_zero_prize_pool) with season: 2025 so seasons
//      without their own value start fresh instead of inheriting them. If a
//      scoped 2025 doc already exists, the legacy doc is deleted instead.
//   2. Backfill per-user season membership/dues. users.seasons is a map keyed
//      by String(seasonKey). Each user is marked active in every season where
//      they have picks (2024 deliberately excluded) plus the current active
//      season, legacy top-level duesPaid/dateDuesPaid values are copied into
//      the 2025 entry, and the legacy fields are $unset.
// Usage: node backend/migrate_2026_season_scoping.js [--dry-run]
// Safe to re-run: phase 1 self-exhausts, and phase 2 only creates season
// entries that don't exist yet, so admin edits (e.g. untoggled members)
// survive. Re-running after a season switch intentionally enrolls everyone in
// the new active season.
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is not set.');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const MAIN_DB = 'locks_data';
const LEGACY_SEASON = 2025; // number — matches the season typing on scoped config docs
const LEGACY_SEASON_KEY = '2025';
const SKIP_SEASON_KEYS = new Set(['2024']);
const CONFIG_KEYS = ['payout_settings', 'announcement', 'three_zero_prize_pool'];
const PICKS_COLLECTION_RE = /^cy_(\d{4}(?:_[a-z0-9]+)?)_picks$/;

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(MAIN_DB);
    if (dryRun) console.log('DRY RUN — no writes will be performed.\n');

    // Phase 1: stamp legacy config docs
    console.log('Phase 1: stamping legacy league_configurations docs');
    const configs = db.collection('league_configurations');
    for (const key of CONFIG_KEYS) {
      const legacy = await configs.findOne({ key, season: { $exists: false } });
      if (!legacy) {
        console.log(`  ${key}: no legacy doc — nothing to do`);
        continue;
      }
      const scoped = await configs.findOne({ key, season: LEGACY_SEASON });
      if (scoped) {
        if (!dryRun) await configs.deleteOne({ _id: legacy._id });
        console.log(`  ${key}: scoped ${LEGACY_SEASON} doc already exists; deleted legacy doc ${legacy._id}`);
      } else {
        if (!dryRun) await configs.updateOne({ _id: legacy._id }, { $set: { season: LEGACY_SEASON } });
        console.log(`  ${key}: stamped legacy doc as season ${LEGACY_SEASON}`);
      }
    }

    // Phase 2: per-user season membership/dues backfill
    console.log('\nPhase 2: user season backfill');
    const activeDoc = await configs.findOne({ key: 'active_year' });
    const activeSeason = activeDoc && activeDoc.value !== undefined ? activeDoc.value : null;
    if (activeSeason === null) {
      console.warn('  WARNING: active_year not set; users will only be marked for seasons with picks.');
    } else {
      console.log(`  Active season: ${activeSeason} (everyone will be marked active in it)`);
    }

    const allCollections = await db.listCollections().toArray();
    const picksCollections = allCollections
      .map(c => c.name)
      .filter(name => PICKS_COLLECTION_RE.test(name));
    const scanned = picksCollections.filter(name => !SKIP_SEASON_KEYS.has(name.match(PICKS_COLLECTION_RE)[1]));
    const skipped = picksCollections.filter(name => SKIP_SEASON_KEYS.has(name.match(PICKS_COLLECTION_RE)[1]));
    console.log(`  Picks collections scanned: ${scanned.join(', ') || '(none)'}`);
    console.log(`  Picks collections skipped: ${skipped.join(', ') || '(none)'}`);

    const seasonsByUid = new Map(); // firebaseUid -> Set<seasonKeyString>
    for (const name of scanned) {
      const seasonKey = name.match(PICKS_COLLECTION_RE)[1];
      const uids = await db.collection(name).distinct('userId');
      for (const uid of uids) {
        if (!seasonsByUid.has(uid)) seasonsByUid.set(uid, new Set());
        seasonsByUid.get(uid).add(seasonKey);
      }
    }

    const users = await db.collection('users').find({}).toArray();
    let modified = 0;
    let untouched = 0;
    const addedPerSeason = {};
    for (const user of users) {
      const desired = new Set(seasonsByUid.get(user.firebaseUid) || []);
      if (activeSeason !== null) desired.add(String(activeSeason));
      const hasLegacyDues = ('duesPaid' in user) || ('dateDuesPaid' in user);
      // A paid user gets a 2025 entry even without 2025 picks, so the dues
      // values have somewhere to land.
      if (hasLegacyDues && (user.duesPaid || user.dateDuesPaid)) desired.add(LEGACY_SEASON_KEY);

      const set = {};
      const added = [];
      let duesNote = '';
      for (const s of desired) {
        if (user.seasons && user.seasons[s] !== undefined) continue; // never touch existing entries
        if (s === LEGACY_SEASON_KEY && hasLegacyDues) {
          set[`seasons.${s}`] = { active: true, duesPaid: !!user.duesPaid, dateDuesPaid: user.dateDuesPaid || '' };
          duesNote = `; dues copied to ${LEGACY_SEASON_KEY}`;
        } else {
          set[`seasons.${s}`] = { active: true, duesPaid: false, dateDuesPaid: '' };
        }
        added.push(s);
        addedPerSeason[s] = (addedPerSeason[s] || 0) + 1;
      }

      // Legacy dues need a home even when the 2025 entry already exists (e.g.
      // an admin edit during the deploy window created it, or a prior run
      // crashed mid-phase). Merge into the entry if its dues are still
      // defaults; otherwise the entry wins and the discarded values are
      // logged loudly so the operator can reconcile.
      const legacyDuesTruthy = hasLegacyDues && (user.duesPaid || user.dateDuesPaid);
      const existing2025 = user.seasons && user.seasons[LEGACY_SEASON_KEY];
      if (legacyDuesTruthy && existing2025 !== undefined) {
        if (!existing2025.duesPaid && !existing2025.dateDuesPaid) {
          set[`seasons.${LEGACY_SEASON_KEY}.duesPaid`] = !!user.duesPaid;
          set[`seasons.${LEGACY_SEASON_KEY}.dateDuesPaid`] = user.dateDuesPaid || '';
          duesNote = `; dues merged into existing ${LEGACY_SEASON_KEY} entry`;
        } else {
          console.warn(`  WARNING ${user.email}: existing ${LEGACY_SEASON_KEY} entry already has dues data; DISCARDING legacy duesPaid=${user.duesPaid}, dateDuesPaid='${user.dateDuesPaid || ''}'`);
        }
      }

      const unset = {};
      if ('duesPaid' in user) unset.duesPaid = '';
      if ('dateDuesPaid' in user) unset.dateDuesPaid = '';
      if ('seasonUpdate' in user) unset.seasonUpdate = ''; // junk from the deploy window, if any

      const update = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;
      if (Object.keys(update).length === 0) {
        untouched++;
        console.log(`  ${user.email}: no changes`);
        continue;
      }
      if (!dryRun) await db.collection('users').updateOne({ _id: user._id }, update);
      modified++;
      console.log(`  ${user.email}: seasons added [${added.join(', ') || 'none'}]${duesNote}${Object.keys(unset).length ? '; legacy fields removed' : ''}`);
    }

    console.log('\nSummary');
    console.log(`  Users modified: ${modified}, untouched: ${untouched}`);
    for (const [s, n] of Object.entries(addedPerSeason)) {
      console.log(`  Season ${s}: ${n} membership entries added`);
    }
    console.log('  (Admins can untoggle members per season in the User Management table.)');
    if (dryRun) console.log('\nDRY RUN — no writes were performed.');
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
