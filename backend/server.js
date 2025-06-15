const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();
console.log("Server file loaded")
// Validate environment variables
if (!process.env.MONGO_URI) {
  console.error('MONGO_URI environment variable is not set');
  process.exit(1);
}

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174∂',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177', 
  'http://localhost:5178', 
];


const corsOptions = { 
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

const app = express();

app.use(cors(corsOptions));// Enhanced CORS configuration

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = 'locks_data';

// Global database connection
let db;
let isConnecting = false;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

// Connect to MongoDB
async function connectToDb() {
  if (isConnecting) {
    console.log('Connection attempt already in progress');
    return db;
  }

  if (db) {
    try {
      // Test the connection
      await db.command({ ping: 1 });
      return db;
    } catch (err) {
      console.log('Database connection lost, attempting to reconnect...');
      db = null;
    }
  }

  isConnecting = true;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      if (!db) {
        await client.connect();
        db = client.db(dbName);
        console.log('Connected to MongoDB successfully');
        isConnecting = false;
        return db;
      }
    } catch (err) {
      retries++;
      console.error(`Failed to connect to MongoDB (attempt ${retries}/${MAX_RETRIES}):`, err);
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  isConnecting = false;
  console.error('Failed to connect to MongoDB after multiple attempts');
  throw new Error('Database connection failed');
}

// Initialize database connection before starting server
connectToDb().then(() => {
  const port = process.env.PORT || 5001;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    // console.log(`CORS enabled for origin: ${corsOptions.origin}`);
  });
  console.log("Listening for requests");
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Get all users or by email
app.get('/api/users', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email } = req.query;
    let users;
    if (email) {
      users = await db.collection('users').find({ email }).toArray();
    } else {
      users = await db.collection('users').find({}).toArray();
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a user
app.put('/api/users/:id', async (req, res) => {
  try {
    const db = await connectToDb();
    const { id } = req.params;
    const updates = req.body;
    
    // Remove any fields that shouldn't be updated
    delete updates._id;
    delete updates.email; // Email should not be editable
    delete updates.firebaseUid; // Firebase UID should not be editable
    delete updates.createdAt; // Created timestamp should not be editable
    
    // Add updatedAt timestamp
    updates.updatedAt = new Date();
    
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const db = await connectToDb();
    const { id } = req.params;
    
    const result = await db.collection('users').deleteOne(
      { _id: new ObjectId(id) }
    );
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a whitelisted email
app.post('/api/whitelist', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if email already exists in whitelist
    const existing = await db.collection('whitelist').findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already whitelisted' });
    }
    
    await db.collection('whitelist').insertOne({
      email,
      createdAt: new Date()
    });
    
    res.json({ message: 'Email added to whitelist successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all whitelisted emails
app.get('/api/whitelist', async (req, res) => {
  try {
    const db = await connectToDb();
    const whitelist = await db.collection('whitelist').find({}).toArray();
    res.json(whitelist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if email is whitelisted
app.get('/api/whitelist/check', async (req, res) => {
  try {
    console.log('Received /api/whitelist/check request');
    const db = await connectToDb();
    console.log('Connected to DB');
    const { email } = req.query;
    if (!email) {
      console.log('No email provided');
      return res.status(400).json({ allowed: false, error: 'Email is required' });
    }
    const exists = await db.collection('whitelist').findOne({ email });
    console.log('Whitelist check result:', exists ? 'Found' : 'Not found');
    res.json({ allowed: !!exists });
  } catch (err) {
    console.error('Error checking whitelist:', err);
    res.status(500).json({ allowed: false, error: err.message });
  }
});

// Check if email is whitelisted before user creation
app.post('/api/users/check-whitelist', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ allowed: false, error: 'Email is required' });
    }
    
    const exists = await db.collection('whitelist').findOne({ email });
    if (!exists) {
      return res.status(403).json({ allowed: false, error: 'Email is not whitelisted' });
    }
    
    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(200).json({ allowed: true, userExists: true });
    }
    
    res.json({ allowed: true, userExists: false });
  } catch (err) {
    console.error('Error in check-whitelist:', err);
    res.status(500).json({ allowed: false, error: err.message });
  }
});

// Create a new user (if not exists and whitelisted)
app.post('/api/users', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email, firebaseUid, firstName, lastName, role, venmoHandle, duesPaid, dateDuesPaid, createdAt, updatedAt } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    // Check if user already exists
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      return res.status(200).json({ message: 'User already exists' });
    }
    // Check if email is whitelisted
    const whitelisted = await db.collection('whitelist').findOne({ email });
    if (!whitelisted) {
      return res.status(403).json({ error: 'This email is not authorized for account creation. Please contact an administrator.' });
    }
    const now = new Date();
    const userDoc = {
      email,
      firebaseUid: firebaseUid || '',
      firstName: firstName || '',
      lastName: lastName || '',
      role: role || 'user',
      venmoHandle: venmoHandle || '',
      duesPaid: duesPaid || false,
      dateDuesPaid: dateDuesPaid || '',
      createdAt: createdAt ? new Date(createdAt) : now,
      updatedAt: updatedAt ? new Date(updatedAt) : now,
    };
    await db.collection('users').insertOne(userDoc);
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a whitelisted email
app.delete('/api/whitelist/:email', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email } = req.params;
    
    const result = await db.collection('whitelist').deleteOne({ email });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Email not found in whitelist' });
    }
    
    res.json({ message: 'Email removed from whitelist successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all collections from db_YYYY database that match odds_YYYY_MM_DD pattern
app.get('/api/collections', async (req, res) => {
  try {
    const mainDb = await connectToDb();
    // Get the active year from league_configurations
    const config = await mainDb.collection('league_configurations').findOne({ key: 'active_year' });
    const activeYear = config ? config.value : null;
    if (!activeYear) {
      return res.status(400).json({ error: 'Active year is not set.' });
    }
    const dbName = `cy_${activeYear}`;
    const dbClient = await client.connect();
    const db = dbClient.db(dbName);

    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    // Filter for collections matching the pattern "odds_YYYY_MM_DD"
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    const filteredCollections = collectionNames.filter(name => oddsPattern.test(name));

    res.json(filteredCollections);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: 'Failed to fetch collections', details: err.message });
  }
});

// Get all games for a given collectionName
app.get('/api/games', async (req, res) => {
  try {
    const { collectionName } = req.query;
    if (!collectionName) {
      return res.status(400).json({ error: 'collectionName query parameter is required' });
    }

    // Validate collectionName format to prevent potential NoSQL injection issues if used directly
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    if (!oddsPattern.test(collectionName)) {
      return res.status(400).json({ error: 'Invalid collectionName format.' });
    }

    // Dynamically get the active year from league_configurations
    const mainDb = await connectToDb();
    const config = await mainDb.collection('league_configurations').findOne({ key: 'active_year' });
    const activeYear = config ? config.value : null;
    if (!activeYear) {
      return res.status(400).json({ error: 'Active year is not set.' });
    }
    const dbName = `cy_${activeYear}`;
    const dbClient = await client.connect();
    const db = dbClient.db(dbName);

    const games = await db.collection(collectionName).find({}).toArray();
    res.json(games);
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ error: 'Failed to fetch games', details: err.message });
  }
});

// Helper function to get picks collection name for a given year
function getPicksCollectionName(year) {
  return `cy_${year}_picks`;
}

// Submit picks for a user
app.post('/api/picks', async (req, res) => {
  try {
    const mainDb = await connectToDb();
    const { userId, collectionName, picks, year } = req.body;

    if (!userId || !collectionName || !Array.isArray(picks) || picks.length === 0 || !year) {
      return res.status(400).json({ error: 'userId, collectionName, year, and picks array are required' });
    }

    // Validate collectionName format
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    if (!oddsPattern.test(collectionName)) {
      return res.status(400).json({ error: 'Invalid collectionName format.' });
    }

    const picksCollection = getPicksCollectionName(year);

    // Check how many picks the user already has for this collectionName
    const existingPicks = await mainDb.collection(picksCollection).find({ 
      userId: userId,
      collectionName: collectionName
    }).toArray();

    if (existingPicks.length + picks.length > 3) {
      return res.status(400).json({ error: `Cannot submit more than 3 picks for ${collectionName}` });
    }

    const now = new Date();
    const picksToInsert = picks.map(pick => ({
      ...pick,
      userId: userId,
      collectionName: collectionName,
      submittedAt: now
    }));

    await mainDb.collection(picksCollection).insertMany(picksToInsert);
    res.status(201).json({ message: 'Picks submitted successfully', submittedPicks: picksToInsert });
  } catch (err) {
    console.error("Error submitting picks:", err);
    res.status(500).json({ error: 'Failed to submit picks', details: err.message });
  }
});

// Get a user's picks for a given collectionName
app.get('/api/picks', async (req, res) => {
  try {
    const mainDb = await connectToDb();
    const { userId, collectionName, year } = req.query;

    if (!year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    // Validate collectionName format
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    if (!oddsPattern.test(collectionName)) {
      return res.status(400).json({ error: 'Invalid collectionName format.' });
    }

    const picksCollection = getPicksCollectionName(year);
    let query = { collectionName };
    if (userId) {
      query.userId = userId;
    }

    // Fetch picks
    const userPicks = await mainDb.collection(picksCollection).find(query).toArray();

    // Fetch games for this collection
    const dbName = `cy_${year}`;
    const dbClient = await client.connect();
    const db = dbClient.db(dbName);
    const games = await db.collection(collectionName).find({}).toArray();
    
    // Build a map for quick lookup using the game's MongoDB _id
    const gameMap = {};
    for (const game of games) {
      if (game._id) {
        gameMap[game._id.toString()] = game;
      }
    }

    // Attach game details (including score/status) to each pick
    const enrichedPicks = userPicks.map(pick => {
      // Find the game using the gameId stored in the pick (which is the _id)
      const game = pick.gameId ? gameMap[pick.gameId] : null;
      return {
        ...pick,
        // Embed the full game object for the frontend to use
        gameDetails: game, 
        // Also keep direct access for convenience
        homeScore: game ? game.homeScore : null,
        awayScore: game ? game.awayScore : null,
        status: game ? game.status : null,
      };
    });

    res.json(enrichedPicks);
  } catch (err) {
    console.error("Error fetching user picks:", err);
    res.status(500).json({ error: 'Failed to fetch user picks', details: err.message });
  }
});

// List all databases matching 'cy_YYYY' pattern
app.get('/api/years', async (req, res) => {
  try {
    const dbClient = await client.connect();
    const adminDb = dbClient.db().admin();
    const dbs = await adminDb.listDatabases();
    const yearPattern = /^cy_(\d{4})$/;
    const years = dbs.databases
      .map(db => db.name)
      .filter(name => yearPattern.test(name))
      .map(name => parseInt(name.split('_')[1], 10))
      .sort((a, b) => b - a); // Descending order
    res.json(years);
  } catch (err) {
    console.error('Error fetching years:', err);
    res.status(500).json({ error: 'Failed to fetch years', details: err.message });
  }
});

// Get the active year from league_configurations
app.get('/api/active-year', async (req, res) => {
  try {
    const db = await connectToDb();
    const config = await db.collection('league_configurations').findOne({ key: 'active_year' });
    res.json({ year: config ? config.value : null });
  } catch (err) {
    console.error('Error fetching active year:', err);
    res.status(500).json({ error: 'Failed to fetch active year', details: err.message });
  }
});

// Set the active year in league_configurations
app.post('/api/active-year', async (req, res) => {
  try {
    const db = await connectToDb();
    const { year } = req.body;
    if (!year || typeof year !== 'number') {
      return res.status(400).json({ error: 'Year must be provided as a number' });
    }
    await db.collection('league_configurations').updateOne(
      { key: 'active_year' },
      { $set: { value: year } },
      { upsert: true }
    );
    res.json({ message: 'Active year updated', year });
  } catch (err) {
    console.error('Error setting active year:', err);
    res.status(500).json({ error: 'Failed to set active year', details: err.message });
  }
});

// Get standings data
app.get('/api/standings', async (req, res) => {
  try {
    const mainDb = await connectToDb();
    let { year, week: selectedGameWeek } = req.query;

    // 1. Determine the year
    if (!year) {
      const config = await mainDb.collection('league_configurations').findOne({ key: 'active_year' });
      year = config ? config.value : new Date().getFullYear();
    } else {
      year = parseInt(year);
    }

    const picksCollectionName = `cy_${year}_picks`;
    const picksCollection = mainDb.collection(picksCollectionName);

    // 2. Get available weeks (collection names) and all users
    const availableGameWeeks = await picksCollection.distinct('collectionName');
    const users = await mainDb.collection('users').find({}).toArray();

    if (availableGameWeeks.length === 0) {
      const emptyStandings = users.map(user => ({
        _id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        rank: '-', wins: 0, losses: 0, ties: 0,
        weekWins: 0, weekLosses: 0, weekTies: 0,
        rankChange: '0',
      }));
      return res.json({ standings: emptyStandings, availableWeeks: [], selectedWeek: null });
    }
    
    availableGameWeeks.sort((a, b) => a.localeCompare(b));

    // 3. Determine selected and previous week
    if (!selectedGameWeek) {
      selectedGameWeek = availableGameWeeks[availableGameWeeks.length - 1];
    }
    const selectedWeekIndex = availableGameWeeks.indexOf(selectedGameWeek);
    const previousGameWeek = selectedWeekIndex > 0 ? availableGameWeeks[selectedWeekIndex - 1] : null;

    // 4. Fetch all relevant picks
    const picksToProcess = await picksCollection.find({ 
      collectionName: { $in: availableGameWeeks.slice(0, selectedWeekIndex + 1) } 
    }).toArray();

    // 5. Calculate standings
    const userStatsByFirebaseUid = {};
    users.forEach(user => {
      if (user.firebaseUid) {
        userStatsByFirebaseUid[user.firebaseUid] = {
          _id: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          total: { wins: 0, losses: 0, ties: 0 },
          currentWeek: { wins: 0, losses: 0, ties: 0 },
          previousTotal: { wins: 0, losses: 0, ties: 0 }
        };
      }
    });

    picksToProcess.forEach(pick => {
      const stats = userStatsByFirebaseUid[pick.userId];
      if (!stats) return;

      const result = pick.result ? pick.result.toUpperCase() : '';
      const isWin = result === 'W';
      const isLoss = result === 'L';
      const isTie = result === 'T';
      
      stats.total.wins += isWin;
      stats.total.losses += isLoss;
      stats.total.ties += isTie;

      if (pick.collectionName === selectedGameWeek) {
        stats.currentWeek.wins += isWin;
        stats.currentWeek.losses += isLoss;
        stats.currentWeek.ties += isTie;
      }

      if (previousGameWeek && availableGameWeeks.indexOf(pick.collectionName) <= availableGameWeeks.indexOf(previousGameWeek)) {
        stats.previousTotal.wins += isWin;
        stats.previousTotal.losses += isLoss;
        stats.previousTotal.ties += isTie;
      }
    });

    // 6. Rank calculation
    const rankingFn = (a, b) => b.wins - a.wins || b.ties - a.ties || a.losses - b.losses;
    
    const calculateRanks = (statsDict, key) => {
      const sorted = Object.values(statsDict).sort((a, b) => rankingFn(a[key], b[key]));
      const ranks = {};
      sorted.forEach((s, i) => { ranks[s._id] = i + 1; });
      return ranks;
    };

    const currentRanks = calculateRanks(userStatsByFirebaseUid, 'total');
    const previousRanks = previousGameWeek ? calculateRanks(userStatsByFirebaseUid, 'previousTotal') : null;

    // 7. Combine and Return
    let combinedStandings = users.map(user => {
      const stats = user.firebaseUid ? userStatsByFirebaseUid[user.firebaseUid] : null;
      if (!stats) {
        return {
          _id: user._id.toString(), name: `${user.firstName} ${user.lastName}`,
          rank: '-', wins: 0, losses: 0, ties: 0, weekWins: 0, weekLosses: 0, weekTies: 0, rankChange: '0'
        };
      }
      
      const rank = currentRanks[stats._id];
      const prevRank = previousRanks ? previousRanks[stats._id] : null;
      const rankChange = (prevRank && rank) ? prevRank - rank : 0;

      return {
        _id: stats._id, name: stats.name, rank: rank,
        wins: stats.total.wins, losses: stats.total.losses, ties: stats.total.ties,
        weekWins: stats.currentWeek.wins, weekLosses: stats.currentWeek.losses, weekTies: stats.currentWeek.ties,
        rankChange: rankChange > 0 ? `+${rankChange}` : `${rankChange}`
      };
    });
    
    combinedStandings.sort((a,b) => {
        if (a.rank === '-') return 1;
        if (b.rank === '-') return -1;
        return a.rank - b.rank;
    });

    res.json({ standings: combinedStandings, availableWeeks: availableGameWeeks, selectedWeek: selectedGameWeek });

  } catch (err) {
    console.error('Error fetching standings:', err);
    res.status(500).json({ error: 'Failed to fetch standings', details: err.message });
  }
});
