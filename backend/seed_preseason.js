// Seed a fake NFL 2026 preseason test season (DB cy_2026_preseason) so it
// appears in the admin Active Season dropdown and can be exercised end-to-end.
// Usage: node backend/seed_preseason.js
// Cleanup when testing is done: drop the cy_2026_preseason database, the
// locks_data.cy_2026_preseason_picks collection, and any league_configurations
// docs with season: '2026_preseason'.
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is not set.');
  process.exit(1);
}

// Slate opens Tuesday Aug 11, 2026; commence times are relative to "now" so
// the games are always in the future (pickable) whenever this is run.
const SEASON_DB = 'cy_2026_preseason';
const SLATE_COLLECTION = 'odds_2026_08_11';
const daysFromNow = (d) => new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();

const games = [
  {
    league: 'NFL Preseason',
    sportKey: 'americanfootball_nfl_preseason',
    away_team_abbrev: 'DET', away_team_full: 'Detroit Lions',
    home_team_abbrev: 'NYG', home_team_full: 'New York Giants',
    commence_time: daysFromNow(2),
    away_spread: -3.5, home_spread: 3.5, total: 37.5,
    homeScore: null, awayScore: null, status: 'scheduled'
  },
  {
    league: 'NFL Preseason',
    sportKey: 'americanfootball_nfl_preseason',
    away_team_abbrev: 'KC', away_team_full: 'Kansas City Chiefs',
    home_team_abbrev: 'CHI', home_team_full: 'Chicago Bears',
    commence_time: daysFromNow(3),
    away_spread: 1.5, home_spread: -1.5, total: 40.5,
    homeScore: null, awayScore: null, status: 'scheduled'
  },
  {
    league: 'NFL Preseason',
    sportKey: 'americanfootball_nfl_preseason',
    away_team_abbrev: 'DAL', away_team_full: 'Dallas Cowboys',
    home_team_abbrev: 'LAR', home_team_full: 'Los Angeles Rams',
    commence_time: daysFromNow(4),
    away_spread: 2.5, home_spread: -2.5, total: 35.5,
    homeScore: null, awayScore: null, status: 'scheduled'
  }
];

async function seed() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(SEASON_DB);
    const existing = await db.collection(SLATE_COLLECTION).countDocuments();
    if (existing > 0) {
      console.log(`${SEASON_DB}.${SLATE_COLLECTION} already has ${existing} games — nothing inserted.`);
      return;
    }
    const result = await db.collection(SLATE_COLLECTION).insertMany(games);
    console.log(`Inserted ${result.insertedCount} games into ${SEASON_DB}.${SLATE_COLLECTION}`);
    console.log('The "2026 Preseason" season will now appear in the admin Active Season dropdown.');
  } finally {
    await client.close();
  }
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
