const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
  'https://locks-of-the-week.web.app',
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
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

// Use Helmet to set various security headers
app.use(helmet());

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

// Debug endpoint to check database connection
app.get('/api/debug/users', async (req, res) => {
  try {
    const db = await connectToDb();
    const users = await db.collection('users').find({}).toArray();
    console.log('[Backend] Debug: All users in database:', users);
    res.json({ 
      message: 'Database connection successful',
      userCount: users.length,
      users: users 
    });
  } catch (err) {
    console.error('[Backend] Debug error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all users or by email
app.get('/api/users', async (req, res) => {
  try {
    const db = await connectToDb();
    const { email, firebaseUid } = req.query;
    console.log('[Backend] GET /api/users called with:', { email, firebaseUid });
    let query = {};
    if (email) {
      // Normalize email to lowercase for case-insensitive lookup
      query = { email: email.toLowerCase() };
    } else if (firebaseUid) {
      query = { firebaseUid };
    }
    console.log('[Backend] Final query:', query);
    
    // If a specific user is requested, find one. Otherwise, find all.
    if (email || firebaseUid) {
      console.log('[Backend] Searching for user with query:', query);
      const user = await db.collection('users').findOne(query);
      console.log('[Backend] User search result:', user);
      if (user) {
        // Convert ObjectId to string for frontend compatibility
        if (user._id) {
          user._id = user._id.toString();
        }
        res.json(user);
      } else {
        console.log('[Backend] User not found for query:', query);
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      const users = await db.collection('users').find({}).toArray();
      // Convert ObjectIds to strings for frontend compatibility
      users.forEach(user => {
        if (user._id) {
          user._id = user._id.toString();
        }
      });
      console.log('[Backend] All users in database:', users);
      res.json(users);
    }
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
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
    // Remove any fields that shouldn't be updated
    delete updates._id;
    delete updates.email; // Email should not be editable
    delete updates.firebaseUid; // Firebase UID should not be editable
    delete updates.createdAt; // Created timestamp should not be editable
    
    // Validate cell phone number if being updated
    if (updates.cellPhone && updates.cellPhone.trim()) {
      const phoneRegex = /^\d{10}$/;
      const cleanPhone = updates.cellPhone.replace(/\D/g, ''); // Remove all non-digits
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ error: 'Cell phone number must be a valid 10-digit number' });
      }
      // Store the cleaned phone number
      updates.cellPhone = cleanPhone;
    }
    
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
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    
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
    
    // Normalize email to lowercase for consistent storage
    const normalizedEmail = email.toLowerCase();
    
    // Check if email already exists in whitelist (case-insensitive)
    const existing = await db.collection('whitelist').findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already whitelisted' });
    }
    
    await db.collection('whitelist').insertOne({
      email: normalizedEmail,
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
    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase();
    const exists = await db.collection('whitelist').findOne({ email: normalizedEmail });
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
    
    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase();
    const exists = await db.collection('whitelist').findOne({ email: normalizedEmail });
    if (!exists) {
      return res.status(403).json({ allowed: false, error: 'Email is not whitelisted' });
    }
    
    // Check if user already exists (case-insensitive)
    const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
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
    const { email, firebaseUid, firstName, lastName, role, venmoHandle, cellPhone, duesPaid, dateDuesPaid, createdAt, updatedAt } = req.body;
    console.log('[Backend] Creating user with data:', { email, firebaseUid, firstName, lastName });
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!firebaseUid) {
      return res.status(400).json({ error: 'Firebase UID is required' });
    }
    
    // Validate cell phone number if provided
    let cleanPhone = '';
    if (cellPhone && cellPhone.trim()) {
      const phoneRegex = /^\d{10}$/;
      cleanPhone = cellPhone.replace(/\D/g, ''); // Remove all non-digits
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ error: 'Cell phone number must be a valid 10-digit number' });
      }
    }
    
    // Allow creation without Venmo ID - users will be redirected to setup if missing
    // The frontend will handle the requirement and redirect appropriately
    // Normalize email to lowercase for consistent storage and comparison
    const normalizedEmail = email.toLowerCase();
    
    // Check if user already exists (case-insensitive)
    const existing = await db.collection('users').findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(200).json({ message: 'User already exists' });
    }
    // Check if email is whitelisted (case-insensitive)
    const whitelisted = await db.collection('whitelist').findOne({ email: normalizedEmail });
    if (!whitelisted) {
      return res.status(403).json({ error: 'This email is not authorized for account creation. Please contact an administrator.' });
    }
    const now = new Date();
    const userDoc = {
      email: normalizedEmail, // Store normalized email
      firebaseUid: firebaseUid,
      firstName: firstName || '',
      lastName: lastName || '',
      role: role || 'user',
      venmoHandle: venmoHandle ? venmoHandle.trim() : '',
      cellPhone: cleanPhone,
      duesPaid: duesPaid || false,
      dateDuesPaid: dateDuesPaid || '',
      createdAt: createdAt ? new Date(createdAt) : now,
      updatedAt: updatedAt ? new Date(updatedAt) : now,
    };
    const result = await db.collection('users').insertOne(userDoc);
    console.log('[Backend] User created with ID:', result.insertedId);
    console.log('[Backend] Created user document:', userDoc);
    res.status(201).json({ message: 'User created', userId: result.insertedId.toString() });
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

const parseCollectionNameToDate = (collectionName) => {
  if (!collectionName || typeof collectionName !== 'string') return null;
  const parts = collectionName.split('_'); // Expected format: "odds_YYYY_MM_DD"
  if (parts.length === 4 && parts[0] === 'odds') {
    const year = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed in JS Date
    const day = parseInt(parts[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  return null;
};

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

    // 2. Get available weeks from the specific year's database collections
    const yearDbName = `cy_${year}`;
    const yearDb = client.db(yearDbName);
    const collections = await yearDb.listCollections().toArray();
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    let availableGameWeeks = collections
      .map(col => col.name)
      .filter(name => oddsPattern.test(name));
    
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
    
    availableGameWeeks.sort((a, b) => {
      const dateA = parseCollectionNameToDate(a);
      const dateB = parseCollectionNameToDate(b);
      if (!dateA || !dateB) return a.localeCompare(b); // Fallback for safety
      return dateA - dateB; // Sort ascending
    });

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
      const isWin = result === 'WIN';
      const isLoss = result === 'LOSS';
      const isTie = result === 'TIE';
      
      stats.total.wins += isWin ? 1 : 0;
      stats.total.losses += isLoss ? 1 : 0;
      stats.total.ties += isTie ? 1 : 0;

      if (pick.collectionName === selectedGameWeek) {
        stats.currentWeek.wins += isWin ? 1 : 0;
        stats.currentWeek.losses += isLoss ? 1 : 0;
        stats.currentWeek.ties += isTie ? 1 : 0;
      }

      if (previousGameWeek && availableGameWeeks.indexOf(pick.collectionName) <= availableGameWeeks.indexOf(previousGameWeek)) {
        stats.previousTotal.wins += isWin ? 1 : 0;
        stats.previousTotal.losses += isLoss ? 1 : 0;
        stats.previousTotal.ties += isTie ? 1 : 0;
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

    // 7. Get payout settings
    const payoutSettings = await mainDb.collection('league_configurations').findOne({ key: 'payout_settings' });
    const payouts = payoutSettings ? payoutSettings.value : {
      first: 0, second: 0, third: 0, fourth: 0, fifth: 0, last: 0
    };

    // 8. Combine and Return
    let combinedStandings = users.map(user => {
      const stats = user.firebaseUid ? userStatsByFirebaseUid[user.firebaseUid] : null;
      if (!stats) {
        return {
          _id: user._id.toString(), name: `${user.firstName} ${user.lastName}`,
          rank: '-', wins: 0, losses: 0, ties: 0, weekWins: 0, weekLosses: 0, weekTies: 0, rankChange: '0',
          payout: 0, gamesBack: '-'
        };
      }
      
      const rank = currentRanks[stats._id];
      const prevRank = previousRanks ? previousRanks[stats._id] : null;
      const rankChange = (prevRank && rank) ? prevRank - rank : 0;

      return {
        _id: stats._id, name: stats.name, rank: rank,
        wins: stats.total.wins, losses: stats.total.losses, ties: stats.total.ties,
        weekWins: stats.currentWeek.wins, weekLosses: stats.currentWeek.losses, weekTies: stats.currentWeek.ties,
        rankChange: rankChange > 0 ? `+${rankChange}` : `${rankChange}`,
        payout: 0, // Will be calculated after sorting
        gamesBack: 0 // Will be calculated after sorting
      };
    });
    
    combinedStandings.sort((a,b) => {
        if (a.rank === '-') return 1;
        if (b.rank === '-') return -1;
        return a.rank - b.rank;
    });

    // 9. Calculate payouts and games back based on final rankings
    const totalUsers = combinedStandings.filter(user => user.rank !== '-').length;
    const leader = combinedStandings.find(user => user.rank === 1);
    
    combinedStandings.forEach((user, index) => {
      if (user.rank === '-') {
        user.payout = 0;
        user.gamesBack = '-';
        return;
      }
      
      // Calculate games back from leader
      if (leader && user.rank > 1) {
        const leaderWins = leader.wins;
        const leaderLosses = leader.losses;
        const userWins = user.wins;
        const userLosses = user.losses;
        
        // Games back = leader wins - user wins (showing full games back)
        const gamesBack = leaderWins - userWins;
        user.gamesBack = gamesBack > 0 ? gamesBack.toFixed(1) : '0.0';
      } else if (leader && user.rank === 1) {
        user.gamesBack = '0.0'; // Leader
      } else {
        user.gamesBack = '-'; // No leader or invalid data
      }
      
      // Calculate payouts
      const rank = user.rank;
      if (rank === 1) {
        user.payout = payouts.first || 0;
      } else if (rank === 2) {
        user.payout = payouts.second || 0;
      } else if (rank === 3) {
        user.payout = payouts.third || 0;
      } else if (rank === 4) {
        user.payout = payouts.fourth || 0;
      } else if (rank === 5) {
        user.payout = payouts.fifth || 0;
      } else if (rank === totalUsers) {
        user.payout = payouts.last || 0;
      } else {
        user.payout = 0;
      }
    });

    res.json({ standings: combinedStandings, availableWeeks: availableGameWeeks, selectedWeek: selectedGameWeek });

  } catch (err) {
    console.error('Error fetching standings:', err);
    res.status(500).json({ error: 'Failed to fetch standings', details: err.message });
  }
});

// Get payout settings
app.get('/api/payout-settings', async (req, res) => {
  try {
    const db = await connectToDb();
    const settings = await db.collection('league_configurations').findOne({ key: 'payout_settings' });
    
    if (!settings) {
      // Return default settings if none exist
      const defaultSettings = {
        first: 0,
        second: 0,
        third: 0,
        fourth: 0,
        fifth: 0,
        last: 0
      };
      return res.json(defaultSettings);
    }
    
    res.json(settings.value);
  } catch (err) {
    console.error('Error fetching payout settings:', err);
    res.status(500).json({ error: 'Failed to fetch payout settings', details: err.message });
  }
});

// Update payout settings
app.post('/api/payout-settings', async (req, res) => {
  try {
    const db = await connectToDb();
    const { first, second, third, fourth, fifth, last } = req.body;
    
    // Validate input
    const payouts = { first, second, third, fourth, fifth, last };
    for (const [place, amount] of Object.entries(payouts)) {
      if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({ error: `Invalid payout amount for ${place} place` });
      }
    }
    
    await db.collection('league_configurations').updateOne(
      { key: 'payout_settings' },
      { 
        $set: { 
          key: 'payout_settings',
          value: payouts,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({ message: 'Payout settings updated successfully', settings: payouts });
  } catch (err) {
    console.error('Error updating payout settings:', err);
    res.status(500).json({ error: 'Failed to update payout settings', details: err.message });
  }
});

// Get announcements
app.get('/api/announcements', async (req, res) => {
  try {
    const db = await connectToDb();
    const announcement = await db.collection('league_configurations').findOne({ key: 'announcement' });
    
    if (!announcement) {
      return res.json({ message: '', active: false });
    }
    
    res.json({
      message: announcement.value.message || '',
      active: announcement.value.active || false,
      updatedAt: announcement.value.updatedAt
    });
  } catch (err) {
    console.error('Error fetching announcement:', err);
    res.status(500).json({ error: 'Failed to fetch announcement', details: err.message });
  }
});

// Update announcement
app.post('/api/announcements', async (req, res) => {
  try {
    const db = await connectToDb();
    const { message, active } = req.body;
    
    // Validate input
    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'Message must be a string' });
    }
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Active must be a boolean' });
    }
    
    await db.collection('league_configurations').updateOne(
      { key: 'announcement' },
      { 
        $set: { 
          key: 'announcement',
          value: {
            message: message.trim(),
            active: active,
            updatedAt: new Date()
          }
        }
      },
      { upsert: true }
    );
    
    res.json({ 
      message: 'Announcement updated successfully', 
      announcement: {
        message: message.trim(),
        active: active,
        updatedAt: new Date()
      }
    });
  } catch (err) {
    console.error('Error updating announcement:', err);
    res.status(500).json({ error: 'Failed to update announcement', details: err.message });
  }
});

// Get 3-0 week prize pool setting
app.get('/api/three-zero-prize-pool', async (req, res) => {
  try {
    const db = await connectToDb();
    const settings = await db.collection('league_configurations').findOne({ key: 'three_zero_prize_pool' });
    
    if (!settings) {
      return res.json({ prizePool: 0 });
    }
    
    res.json({ prizePool: settings.value || 0 });
  } catch (err) {
    console.error('Error fetching 3-0 prize pool:', err);
    res.status(500).json({ error: 'Failed to fetch 3-0 prize pool', details: err.message });
  }
});

// Update 3-0 week prize pool setting
app.post('/api/three-zero-prize-pool', async (req, res) => {
  try {
    const db = await connectToDb();
    const { prizePool } = req.body;
    
    // Validate input
    if (typeof prizePool !== 'number' || prizePool < 0) {
      return res.status(400).json({ error: 'Prize pool must be a non-negative number' });
    }
    
    await db.collection('league_configurations').updateOne(
      { key: 'three_zero_prize_pool' },
      { 
        $set: { 
          key: 'three_zero_prize_pool',
          value: prizePool,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({ message: '3-0 week prize pool updated successfully', prizePool });
  } catch (err) {
    console.error('Error updating 3-0 prize pool:', err);
    res.status(500).json({ error: 'Failed to update 3-0 prize pool', details: err.message });
  }
});

// Calculate 3-0 weeks for all users
app.get('/api/three-zero-standings', async (req, res) => {
  try {
    const mainDb = await connectToDb();
    let { year } = req.query;

    // 1. Determine the year
    if (!year) {
      const config = await mainDb.collection('league_configurations').findOne({ key: 'active_year' });
      year = config ? config.value : new Date().getFullYear();
    } else {
      year = parseInt(year);
    }

    const picksCollectionName = `cy_${year}_picks`;
    const picksCollection = mainDb.collection(picksCollectionName);

    // 2. Get available weeks from the specific year's database collections
    const yearDbName = `cy_${year}`;
    const yearDb = client.db(yearDbName);
    const collections = await yearDb.listCollections().toArray();
    const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
    let availableGameWeeks = collections
      .map(col => col.name)
      .filter(name => oddsPattern.test(name));
    
    const users = await mainDb.collection('users').find({}).toArray();

    if (availableGameWeeks.length === 0) {
      const emptyStandings = users.map(user => ({
        _id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        threeZeroWeeks: 0,
        percentage: 0,
        payout: 0
      }));
      return res.json({ standings: emptyStandings, totalThreeZeroWeeks: 0, prizePool: 0 });
    }
    
    availableGameWeeks.sort((a, b) => {
      const dateA = parseCollectionNameToDate(a);
      const dateB = parseCollectionNameToDate(b);
      if (!dateA || !dateB) return a.localeCompare(b);
      return dateA - dateB;
    });

    // 3. Fetch all picks for all weeks
    const allPicks = await picksCollection.find({ 
      collectionName: { $in: availableGameWeeks } 
    }).toArray();

    // 4. Calculate 3-0 weeks for each user
    const userThreeZeroWeeks = {};
    users.forEach(user => {
      if (user.firebaseUid) {
        userThreeZeroWeeks[user.firebaseUid] = {
          _id: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          threeZeroWeeks: 0
        };
      }
    });

    // Group picks by user and week
    const userWeekPicks = {};
    allPicks.forEach(pick => {
      if (!userWeekPicks[pick.userId]) {
        userWeekPicks[pick.userId] = {};
      }
      if (!userWeekPicks[pick.userId][pick.collectionName]) {
        userWeekPicks[pick.userId][pick.collectionName] = [];
      }
      userWeekPicks[pick.userId][pick.collectionName].push(pick);
    });

    // Calculate 3-0 weeks for each user
    Object.keys(userWeekPicks).forEach(userId => {
      const userWeeks = userWeekPicks[userId];
      Object.keys(userWeeks).forEach(week => {
        const weekPicks = userWeeks[week];
        if (weekPicks.length === 3) {
          // Check if all 3 picks are wins
          const allWins = weekPicks.every(pick => pick.result && pick.result.toUpperCase() === 'WIN');
          if (allWins && userThreeZeroWeeks[userId]) {
            userThreeZeroWeeks[userId].threeZeroWeeks++;
          }
        }
      });
    });

    // 5. Calculate total 3-0 weeks and prize pool distribution
    const totalThreeZeroWeeks = Object.values(userThreeZeroWeeks).reduce((sum, user) => sum + user.threeZeroWeeks, 0);
    
    // Get prize pool setting
    const prizePoolSettings = await mainDb.collection('league_configurations').findOne({ key: 'three_zero_prize_pool' });
    const prizePool = prizePoolSettings ? prizePoolSettings.value : 0;

    // 6. Create standings with payouts
    const standings = users.map(user => {
      const userStats = user.firebaseUid ? userThreeZeroWeeks[user.firebaseUid] : null;
      const threeZeroWeeks = userStats ? userStats.threeZeroWeeks : 0;
      const percentage = totalThreeZeroWeeks > 0 ? (threeZeroWeeks / totalThreeZeroWeeks) * 100 : 0;
      const payout = totalThreeZeroWeeks > 0 ? (threeZeroWeeks / totalThreeZeroWeeks) * prizePool : 0;

      return {
        _id: user._id.toString(),
        name: `${user.firstName} ${user.lastName}`,
        threeZeroWeeks,
        percentage: parseFloat(percentage.toFixed(1)),
        payout: parseFloat(payout.toFixed(2))
      };
    });

    // Sort by 3-0 weeks (descending)
    standings.sort((a, b) => b.threeZeroWeeks - a.threeZeroWeeks || a.name.localeCompare(b.name));

    res.json({ 
      standings, 
      totalThreeZeroWeeks, 
      prizePool: prizePool || 0,
      availableWeeks: availableGameWeeks
    });

  } catch (err) {
    console.error('Error fetching 3-0 standings:', err);
    res.status(500).json({ error: 'Failed to fetch 3-0 standings', details: err.message });
  }
});
