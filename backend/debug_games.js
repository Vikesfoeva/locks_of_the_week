const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        // Get active year
        const mainDb = client.db('locks_data');
        const config = await mainDb.collection('league_configurations').findOne({ key: 'active_year' });
        const year = config ? config.value : 2024;
        console.log(`Active Year: ${year}`);

        const dbName = `cy_${year}`;
        const db = client.db(dbName);

        // List all odds collections
        const collections = await db.listCollections().toArray();
        const oddsCollections = collections
            .map(c => c.name)
            .filter(name => name.startsWith('odds_'));

        console.log(`Found ${oddsCollections.length} odds collections.`);

        for (const colName of oddsCollections) {
            const games = await db.collection(colName).find({
                $or: [
                    { away_team_abbrev: 'ATL', home_team_abbrev: 'NE' },
                    { away_team_abbrev: 'NE', home_team_abbrev: 'ATL' }
                ]
            }).toArray();

            if (games.length > 0) {
                console.log(`\nCollection: ${colName}`);
                console.log(`Found ${games.length} games for ATL vs NE:`);
                for (const g of games) {
                    console.log(`- ID: ${g._id}, Away: ${g.away_team_abbrev}, Home: ${g.home_team_abbrev}, Score: ${g.awayScore}-${g.homeScore}`);

                    // Fetch picks for this game
                    const picksCollectionName = `cy_${year}_picks`;
                    const picks = await mainDb.collection(picksCollectionName).find({
                        gameId: g._id.toString()
                    }).toArray();

                    console.log(`  Found ${picks.length} picks for this game:`);

                    // Fetch user names for context
                    const userIds = picks.map(p => p.userId);
                    const users = await mainDb.collection('users').find({ firebaseUid: { $in: userIds } }).toArray();
                    const userMap = {};
                    users.forEach(u => userMap[u.firebaseUid] = u.firstName + ' ' + u.lastName);

                    picks.forEach(p => {
                        const userName = userMap[p.userId] || p.userId;
                        console.log(`  - User: ${userName}, Type: '${p.pickType}', Side: '${p.pickSide}', Line: '${p.line}', Result: '${p.result}'`);
                    });
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

run();
