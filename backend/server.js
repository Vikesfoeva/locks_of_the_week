const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

// Utility function to ensure Venmo handle starts with @
function formatVenmoHandle(venmoHandle) {
  if (!venmoHandle || typeof venmoHandle !== 'string') {
    return '';
  }
  
  const trimmed = venmoHandle.trim();
  if (!trimmed) {
    return '';
  }
  
  // If it already starts with @, return as is
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  
  // Otherwise, add @ prefix
  return `@${trimmed}`;
}

dotenv.config();
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
    return db;
  }

  if (db) {
    try {
      // Test the connection
      await db.command({ ping: 1 });
      return db;
    } catch (err) {
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
        isConnecting = false;
        return db;
      }
    } catch (err) {
      retries++;
      console.error(`Failed to connect to MongoDB (attempt ${retries}/${MAX_RETRIES}):`, err);
      if (retries < MAX_RETRIES) {
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
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Debug endpoint to check database connection
app.get('/api/debug/users', async (req, res) => {
  try {
    const db = await connectToDb();
    const users = await db.collection('users').find({}).toArray();
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
    let query = {};
    if (email) {
      // Normalize email to lowercase for case-insensitive lookup
      query = { email: email.toLowerCase() };
    } else if (firebaseUid) {
      query = { firebaseUid };
    }
    
    // If a specific user is requested, find one. Otherwise, find all.
    if (email || firebaseUid) {
      const user = await db.collection('users').findOne(query);
      if (user) {
        // Convert ObjectId to string for frontend compatibility
        if (user._id) {
          user._id = user._id.toString();
        }
        res.json(user);
      } else {
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
    
    // Format Venmo handle to ensure it starts with @ if being updated
    if (updates.venmoHandle !== undefined) {
      updates.venmoHandle = formatVenmoHandle(updates.venmoHandle);
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
    const db = await connectToDb();
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ allowed: false, error: 'Email is required' });
    }
    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email.toLowerCase();
    const exists = await db.collection('whitelist').findOne({ email: normalizedEmail });
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
      venmoHandle: formatVenmoHandle(venmoHandle || ''),
      cellPhone: cleanPhone,
      duesPaid: duesPaid || false,
      dateDuesPaid: dateDuesPaid || '',
      createdAt: createdAt ? new Date(createdAt) : now,
      updatedAt: updatedAt ? new Date(updatedAt) : now,
    };
    const result = await db.collection('users').insertOne(userDoc);
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
    const { userId, collectionName, picks, year, userMessage } = req.body;

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
      submittedAt: now,
      threeOEligible: calculateThreeOEligible(collectionName, now)
    }));

    await mainDb.collection(picksCollection).insertMany(picksToInsert);
    
    // Send data to Google Apps Script
    try {
      // Get user details for the Google Apps Script
      const user = await mainDb.collection('users').findOne({ firebaseUid: userId });
      const username = user && user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user?.displayName || 'Unknown User';
      const email = user?.email || '';
      
      // Get detailed pick information including game details
      const dbName = `cy_${year}`;
      const dbClient = await client.connect();
      const db = dbClient.db(dbName);
      const games = await db.collection(collectionName).find({}).toArray();
      
      // Build a map for quick lookup
      const gameMap = {};
      for (const game of games) {
        if (game._id) {
          gameMap[game._id.toString()] = game;
        }
      }
      
      const detailedPicks = picksToInsert.map(pick => {
        const game = pick.gameId ? gameMap[pick.gameId] : null;
        return {
          ...pick,
          gameDetails: game ? {
            league: game.league,
            awayTeam: game.away_team_abbrev,
            awayTeamFull: game.away_team_full,
            homeTeam: game.home_team_abbrev,
            homeTeamFull: game.home_team_full,
            commenceTime: game.commence_time,
            awaySpread: game.away_spread,
            homeSpread: game.home_spread,
            total: game.total
          } : null,
          // Ensure threeOEligible is included in webhook payload
          threeOEligible: pick.threeOEligible
        };
      });
      
      // Format week name for locksWebhook (same format as standings page)
      const formatWeekForLocksWebhook = (collectionName, year) => {
        const parts = collectionName.split('_');
        if (parts.length === 4 && parts[0] === 'odds') {
          const year = parseInt(parts[1], 10);
          const month = parseInt(parts[2], 10) - 1; // Month is 0-indexed in JS Date
          const day = parseInt(parts[3], 10);
          const date = new Date(year, month, day);
          const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
          
          // Get week number by finding position in sorted available weeks
          const yearDbName = `cy_${year}`;
          const yearDb = client.db(yearDbName);
          return yearDb.listCollections().toArray().then(collections => {
            const oddsPattern = /^odds_\d{4}_\d{2}_\d{2}$/;
            const availableWeeks = collections
              .map(col => col.name)
              .filter(name => oddsPattern.test(name))
              .sort((a, b) => {
                const dateA = parseCollectionNameToDate(a);
                const dateB = parseCollectionNameToDate(b);
                if (!dateA || !dateB) return a.localeCompare(b);
                return dateA - dateB;
              });
            
            const weekIndex = availableWeeks.indexOf(collectionName);
            const weekNumber = weekIndex >= 0 ? weekIndex + 1 : '?';
            
            return `Week ${weekNumber} - ${formattedDate}`;
          });
        }
        return collectionName; // Fallback to original collection name
      };

      // Send to Google Apps Script
      const currentLocksWeek = await formatWeekForLocksWebhook(collectionName, year);
      const axios = require('axios');
      await axios.post('https://script.google.com/macros/s/AKfycbxDXkwPsH5yPjpFCiIa3Cv5Xd3HTb_fj9A5s9DJQMKRfmQlMVLNGyGQkXtVOsZL-I_GQw/exec'
        , {
        picks: detailedPicks,
        username: username,
        email: email,
        collectionName: collectionName,
        currentLocksWeek: currentLocksWeek,
        userMessage: userMessage || '',
        submissionTime: new Date().toISOString()
      });
    } catch (googleScriptError) {
      console.error('Failed to send data to Google Apps Script:', googleScriptError);
      // Don't fail the entire submission if Google Apps Script fails
      // Just log the error and continue
    }
    
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

// Calculate threeOEligible status based on submission time vs Saturday deadline
const calculateThreeOEligible = (collectionName, submissionTime) => {
  try {
    // Parse the Tuesday date from collection name
    const tuesdayDate = parseCollectionNameToDate(collectionName);
    if (!tuesdayDate) {
      console.warn(`Could not parse collection name: ${collectionName}`);
      return false; // Default to false if we can't parse the date
    }

    // Calculate Saturday of that week (Tuesday + 4 days)
    const saturdayDate = new Date(tuesdayDate);
    saturdayDate.setDate(tuesdayDate.getDate() + 4);

    // Determine if this date falls in DST
    const isDST = (date) => {
      const year = date.getFullYear();
      // DST typically runs from 2nd Sunday in March to 1st Sunday in November
      const march = new Date(year, 2, 1);
      const november = new Date(year, 10, 1);
      
      // Find second Sunday in March
      const marchSecondSunday = new Date(year, 2, 8 + (7 - march.getDay()) % 7);
      // Find first Sunday in November  
      const novemberFirstSunday = new Date(year, 10, 1 + (7 - november.getDay()) % 7);
      
      return date >= marchSecondSunday && date < novemberFirstSunday;
    };

    // Create deadline directly in UTC
    // Saturday 11:59:59.999 AM ET = Saturday 16:59:59.999 UTC (EST) or Saturday 15:59:59.999 UTC (EDT)
    const etOffset = isDST(saturdayDate) ? 4 : 5; // EDT = UTC-4, EST = UTC-5
    const deadlineUTC = new Date(Date.UTC(
      saturdayDate.getFullYear(),
      saturdayDate.getMonth(),
      saturdayDate.getDate(),
      11 + etOffset, // 11am ET + offset = UTC hours
      59,
      59,
      999
    ));

    // Compare submission time against deadline
    const submissionUTC = new Date(submissionTime);
    
    return submissionUTC <= deadlineUTC;
  } catch (error) {
    console.error('Error calculating threeOEligible:', error);
    return false; // Default to false on error
  }
};

// Check if a week has concluded (midnight Monday Eastern Time)
const isWeekComplete = (collectionName) => {
  try {
    // Parse the Tuesday date from collection name
    const tuesdayDate = parseCollectionNameToDate(collectionName);
    if (!tuesdayDate) {
      console.warn(`Could not parse collection name: ${collectionName}`);
      return false; // Default to false if we can't parse the date
    }

    // Calculate Monday of the following week (Tuesday + 6 days)
    const mondayDate = new Date(tuesdayDate);
    mondayDate.setDate(tuesdayDate.getDate() + 6);

    // Determine if this date falls in DST
    const isDST = (date) => {
      const year = date.getFullYear();
      // DST typically runs from 2nd Sunday in March to 1st Sunday in November
      const march = new Date(year, 2, 1);
      const november = new Date(year, 10, 1);
      
      // Find second Sunday in March
      const marchSecondSunday = new Date(year, 2, 8 + (7 - march.getDay()) % 7);
      // Find first Sunday in November  
      const novemberFirstSunday = new Date(year, 10, 1 + (7 - november.getDay()) % 7);
      
      return date >= marchSecondSunday && date < novemberFirstSunday;
    };

    // Create week end time: Tuesday 12:00:00 AM ET of the following week
    // This is midnight Monday night/Tuesday morning Eastern Time
    const etOffset = isDST(mondayDate) ? 4 : 5; // EDT = UTC-4, EST = UTC-5
    const weekEndUTC = new Date(Date.UTC(
      mondayDate.getFullYear(),
      mondayDate.getMonth(),
      mondayDate.getDate() + 1, // Tuesday (Monday + 1)
      0 + etOffset, // Midnight ET + offset = UTC hours
      0,
      0,
      0
    ));

    // Compare current time against week end time
    const nowUTC = new Date();
    
    return nowUTC >= weekEndUTC;
  } catch (error) {
    console.error('Error checking if week is complete:', error);
    return false; // Default to false on error
  }
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
    const rankingFn = (a, b) => b.wins - a.wins || a.losses - b.losses || a.ties - b.ties;
    
    const calculateRanks = (statsDict, key) => {
      const sorted = Object.values(statsDict).sort((a, b) => rankingFn(a[key], b[key]));
      const ranks = {};
      let currentRank = 1;
      
      for (let i = 0; i < sorted.length; i++) {
        const currentUser = sorted[i];
        
        if (i > 0) {
          const prevUser = sorted[i - 1];
          // Check if current user has different stats than previous user
          const currentStats = currentUser[key];
          const prevStats = prevUser[key];
          
          if (currentStats.wins !== prevStats.wins || 
              currentStats.ties !== prevStats.ties || 
              currentStats.losses !== prevStats.losses) {
            currentRank = i + 1; // Move to next available rank
          }
          // If stats are the same, keep the same rank (tie)
        }
        
        ranks[currentUser._id] = currentRank;
      }
      
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
    
    // First, calculate games back for all users
    combinedStandings.forEach((user, index) => {
      if (user.rank === '-') {
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
    });

    // Calculate payouts with tie handling
    const rankGroups = {};
    combinedStandings.forEach(user => {
      if (user.rank !== '-') {
        if (!rankGroups[user.rank]) {
          rankGroups[user.rank] = [];
        }
        rankGroups[user.rank].push(user);
      }
    });

    // Determine which ranks get prizes and split them accordingly
    Object.keys(rankGroups).forEach(rankStr => {
      const rank = parseInt(rankStr);
      const usersAtRank = rankGroups[rank];
      let totalPrize = 0;
      
      // Determine what prizes this rank group should split
      if (rank === 1) {
        totalPrize += payouts.first || 0;
        // If tied for first, also split second place prize if there are enough tied users
        if (usersAtRank.length > 1) {
          totalPrize += payouts.second || 0;
          // If 3+ tied for first, also include third place
          if (usersAtRank.length > 2) {
            totalPrize += payouts.third || 0;
            // If 4+ tied for first, also include fourth place
            if (usersAtRank.length > 3) {
              totalPrize += payouts.fourth || 0;
              // If 5+ tied for first, also include fifth place
              if (usersAtRank.length > 4) {
                totalPrize += payouts.fifth || 0;
              }
            }
          }
        }
      } else if (rank === 2) {
        totalPrize += payouts.second || 0;
        // If tied for second, also split third place prize
        if (usersAtRank.length > 1) {
          totalPrize += payouts.third || 0;
          // If 3+ tied for second, also include fourth place
          if (usersAtRank.length > 2) {
            totalPrize += payouts.fourth || 0;
            // If 4+ tied for second, also include fifth place
            if (usersAtRank.length > 3) {
              totalPrize += payouts.fifth || 0;
            }
          }
        }
      } else if (rank === 3) {
        totalPrize += payouts.third || 0;
        // If tied for third, also split fourth place prize
        if (usersAtRank.length > 1) {
          totalPrize += payouts.fourth || 0;
          // If 3+ tied for third, also include fifth place
          if (usersAtRank.length > 2) {
            totalPrize += payouts.fifth || 0;
          }
        }
      } else if (rank === 4) {
        totalPrize += payouts.fourth || 0;
        // If tied for fourth, also split fifth place prize
        if (usersAtRank.length > 1) {
          totalPrize += payouts.fifth || 0;
        }
      } else if (rank === 5) {
        totalPrize += payouts.fifth || 0;
      }
      
      // Special handling for last place when there are ties
      // Check if this rank group includes the last place
      const maxRank = Math.max(...combinedStandings.filter(u => u.rank !== '-').map(u => u.rank));
      if (rank === maxRank) {
        totalPrize += payouts.last || 0;
      }
      
      // Split the total prize among all users at this rank
      const prizePerUser = usersAtRank.length > 0 ? totalPrize / usersAtRank.length : 0;
      usersAtRank.forEach(user => {
        user.payout = parseFloat(prizePerUser.toFixed(2));
      });
    });

    // Set payout to 0 for users with no rank
    combinedStandings.forEach(user => {
      if (user.rank === '-') {
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
          // Check if all 3 picks are eligible for 3-0 consideration (threeOEligible must be true)
          // Handle legacy data by defaulting to true if threeOEligible is undefined
          const allEligible = weekPicks.every(pick => pick.threeOEligible !== false);
          
          if (allWins && allEligible && userThreeZeroWeeks[userId]) {
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

// Get awards data for a specific week
app.get('/api/awards', async (req, res) => {
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

    if (!selectedGameWeek) {
      return res.status(400).json({ error: 'Week parameter is required' });
    }

    // 2. Check if the week has concluded before calculating awards
    if (!isWeekComplete(selectedGameWeek)) {
      return res.json({ 
        awards: {}, 
        message: 'Awards will be calculated after the week concludes (midnight Monday Eastern Time)',
        weekComplete: false
      });
    }

    const picksCollectionName = `cy_${year}_picks`;
    const picksCollection = mainDb.collection(picksCollectionName);

    // 2. Get all users
    const users = await mainDb.collection('users').find({}).toArray();
    const userMap = {};
    users.forEach(user => {
      if (user.firebaseUid) {
        userMap[user.firebaseUid] = {
          _id: user._id.toString(),
          name: `${user.firstName} ${user.lastName}`,
          firebaseUid: user.firebaseUid
        };
      }
    });

    // 3. Fetch all picks for the selected week
    const weekPicks = await picksCollection.find({ 
      collectionName: selectedGameWeek 
    }).toArray();

    if (weekPicks.length === 0) {
      return res.json({ awards: [], message: 'No picks found for this week' });
    }

    // 4. Get game details for this week
    const yearDbName = `cy_${year}`;
    const yearDb = client.db(yearDbName);
    const games = await yearDb.collection(selectedGameWeek).find({}).toArray();
    
    // Build game map
    const gameMap = {};
    games.forEach(game => {
      if (game._id) {
        gameMap[game._id.toString()] = game;
      }
    });

    // 5. Enrich picks with game details and calculate margins
    const enrichedPicks = weekPicks.map(pick => {
      const game = gameMap[pick.gameId];
      const user = userMap[pick.userId];
      
      if (!game || !user) return null;

      let margin = null;
      let actualSpread = null;
      let actualTotal = null;

      // Calculate margin based on pick type and game result
      if (game.homeScore !== null && game.awayScore !== null && game.status === 'final') {
        const homeScore = parseFloat(game.homeScore) || 0;
        const awayScore = parseFloat(game.awayScore) || 0;
        const scoreDiff = homeScore - awayScore; // Positive if home wins

        if (pick.pickType === 'spread') {
          // For spread picks, calculate margin of victory/defeat relative to the spread
          const pickedSpread = parseFloat(pick.line) || 0;
          
          // Determine which team was picked based on pickSide
          const pickedHome = pick.pickSide === game.home_team_abbrev || pick.pickSide === game.home_team_full;
          
          // Calculate the margin relative to what was needed to cover the spread
          if (pickedHome) {
            // User picked home team (e.g., UTAH -6.5)
            // They needed home team to win by MORE than the spread
            // Margin = actual victory margin - spread requirement
            // Example: UTAH wins 43-10 with -6.5 spread: (43-10) - 6.5 = 33 - 6.5 = 26.5
            margin = scoreDiff - Math.abs(pickedSpread);
          } else {
            // User picked away team
            if (pickedSpread < 0) {
              // Away team is favorite (e.g., UTAH -6.5 @ UCLA or BAMA -13.5 @ FSU)
              // They needed away team to win by MORE than the spread
              if (scoreDiff < 0) {
                // Away team won (scoreDiff is negative when away team wins)
                // Margin = actual away victory margin - spread requirement
                // Example: UTAH wins 43-10 with -6.5 spread: (43-10) - 6.5 = 33 - 6.5 = 26.5
                margin = Math.abs(scoreDiff) - Math.abs(pickedSpread);
              } else {
                // Away team lost (scoreDiff is positive when home team wins)
                // Margin = -(actual defeat margin + spread requirement)
                // Example: BAMA loses 17-31 with -13.5 spread: -(14 + 13.5) = -27.5
                margin = -(scoreDiff + Math.abs(pickedSpread));
              }
            } else {
              // Away team is underdog (e.g., UCLA +6.5 @ UTAH)  
              // They needed away team to lose by LESS than the spread (or win outright)
              // Margin = spread cushion - actual defeat margin
              // Example: UCLA loses 10-43 with +6.5 spread: 6.5 - (43-10) = 6.5 - 33 = -26.5
              margin = Math.abs(pickedSpread) - scoreDiff;
            }
          }
          actualSpread = pickedSpread;
        } else if (pick.pickType === 'total') {
          // For total picks, calculate how far the actual total was from the picked total
          const totalScore = homeScore + awayScore;
          const pickedTotal = parseFloat(pick.line) || 0;
          const isOverPick = pick.pickSide === 'OVER';
          
          if (isOverPick) {
            // Over pick: margin = actual total - picked total
            // Example: Over 45.5, game total 52: 52 - 45.5 = 6.5 margin of victory
            margin = totalScore - pickedTotal;
          } else {
            // Under pick: margin = picked total - actual total
            // Example: Under 45.5, game total 38: 45.5 - 38 = 7.5 margin of victory
            margin = pickedTotal - totalScore;
          }
          actualTotal = pickedTotal;
        }
      }

      return {
        ...pick,
        user: user,
        game: game,
        margin: margin,
        actualSpread: actualSpread,
        actualTotal: actualTotal
      };
    }).filter(Boolean);

    // 6. Calculate awards
    const awards = calculateWeeklyAwards(enrichedPicks);

    res.json({ awards, weekPicks: enrichedPicks.length, weekComplete: true });
  } catch (err) {
    console.error("Error fetching awards:", err);
    res.status(500).json({ error: 'Failed to fetch awards', details: err.message });
  }
});

// Helper function to calculate weekly awards
function calculateWeeklyAwards(picks) {
  const awards = {};
  const awardNames = [
    'Flop of the Week',
    'Lone Wolf', 
    'Lock of the Week',
    'Close Call',
    'Sore Loser',
    'Biggest Loser',
    'Boldest Favorite',
    'Big Dawg',
    'Big Kahuna',
    'Tinkerbell'
  ];

  // Initialize awards structure
  awardNames.forEach(award => {
    awards[award] = [];
  });

  // Filter picks by result
  const correctPicks = picks.filter(pick => pick.result && pick.result.toUpperCase() === 'WIN');
  const incorrectPicks = picks.filter(pick => pick.result && pick.result.toUpperCase() === 'LOSS');
  const spreadPicks = picks.filter(pick => pick.pickType === 'spread');
  const totalPicks = picks.filter(pick => pick.pickType === 'total');

  // 1. Flop of the Week - incorrect pick that resulted in most losses for group
  // Count how many people made each incorrect pick
  const incorrectPickCounts = {};
  incorrectPicks.forEach(pick => {
    const key = `${pick.gameId}_${pick.pickType}_${pick.pickSide}_${pick.line}`;
    if (!incorrectPickCounts[key]) {
      incorrectPickCounts[key] = { count: 0, pick: pick };
    }
    incorrectPickCounts[key].count++;
  });
  
  let maxIncorrectCount = 0;
  let flopPicks = [];
  Object.values(incorrectPickCounts).forEach(({ count, pick }) => {
    if (count > maxIncorrectCount) {
      maxIncorrectCount = count;
      flopPicks = [pick];
    } else if (count === maxIncorrectCount) {
      flopPicks.push(pick);
    }
  });
  
  awards['Flop of the Week'] = flopPicks.map(pick => ({
    userId: pick.user.firebaseUid,
    userName: pick.user.name,
    details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
    score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
    count: maxIncorrectCount
  }));

  // 2. Lone Wolf - correct pick by one person countered by 2+ others on the SAME GAME
  const gamePickAnalysis = {};
  
  // Group all picks by game and pick type (spread vs total)
  picks.forEach(pick => {
    const gameKey = `${pick.gameId}_${pick.pickType}`;
    if (!gamePickAnalysis[gameKey]) {
      gamePickAnalysis[gameKey] = { allPicks: [], game: pick.game };
    }
    gamePickAnalysis[gameKey].allPicks.push(pick);
  });


  
  Object.entries(gamePickAnalysis).forEach(([gameKey, { allPicks, game }]) => {
    // Group picks by their specific choice (side + line)
    const choiceGroups = {};
    allPicks.forEach(pick => {
      const choiceKey = `${pick.pickSide}_${pick.line}`;
      if (!choiceGroups[choiceKey]) {
        choiceGroups[choiceKey] = { picks: [], correct: 0, incorrect: 0 };
      }
      choiceGroups[choiceKey].picks.push(pick);
      
      if (pick.result && pick.result.toUpperCase() === 'WIN') {
        choiceGroups[choiceKey].correct++;
      } else if (pick.result && pick.result.toUpperCase() === 'LOSS') {
        choiceGroups[choiceKey].incorrect++;
      }
    });
    

    
    // Look for Lone Wolf scenarios in this game
    Object.entries(choiceGroups).forEach(([choice, { picks, correct, incorrect }]) => {
      if (correct === 1) {
        // Found someone who was correct alone, now check if 2+ others were wrong on opposing picks
        const otherIncorrectCount = Object.entries(choiceGroups)
          .filter(([otherChoice]) => otherChoice !== choice)
          .reduce((sum, [, { incorrect: otherIncorrect }]) => sum + otherIncorrect, 0);
        
        if (otherIncorrectCount >= 2) {
          const loneWolfPick = picks.find(p => p.result && p.result.toUpperCase() === 'WIN');
          
          awards['Lone Wolf'].push({
            userId: loneWolfPick.user.firebaseUid,
            userName: loneWolfPick.user.name,
            details: `${loneWolfPick.game.away_team_abbrev} @ ${loneWolfPick.game.home_team_abbrev} - ${formatPickDetails(loneWolfPick)}`,
            score: `${loneWolfPick.game.away_team_abbrev} ${loneWolfPick.game.awayScore}, ${loneWolfPick.game.home_team_abbrev} ${loneWolfPick.game.homeScore}`,
            againstCount: otherIncorrectCount
          });
        }
      }
    });
  });
  


  // 3. Lock of the Week - correct pick furthest from being incorrect (largest margin)
  const correctPicksWithMargin = correctPicks.filter(pick => pick.margin !== null);
  if (correctPicksWithMargin.length > 0) {
    const maxMargin = Math.max(...correctPicksWithMargin.map(pick => pick.margin));
    const lockPicks = correctPicksWithMargin.filter(pick => pick.margin === maxMargin);
    
    awards['Lock of the Week'] = lockPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      margin: pick.margin
    }));
  }

  // 4. Close Call - correct pick closest to being incorrect (smallest margin)
  if (correctPicksWithMargin.length > 0) {
    const minMargin = Math.min(...correctPicksWithMargin.map(pick => pick.margin));
    const closeCallPicks = correctPicksWithMargin.filter(pick => pick.margin === minMargin);
    
    awards['Close Call'] = closeCallPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      margin: pick.margin
    }));
  }

  // 5. Sore Loser - incorrect pick closest to being correct (smallest negative margin)
  const incorrectPicksWithMargin = incorrectPicks.filter(pick => pick.margin !== null);
  if (incorrectPicksWithMargin.length > 0) {
    // For incorrect picks, we want the one with the smallest absolute margin (closest to 0)
    const minAbsMargin = Math.min(...incorrectPicksWithMargin.map(pick => Math.abs(pick.margin)));
    const soreLoserPicks = incorrectPicksWithMargin.filter(pick => Math.abs(pick.margin) === minAbsMargin);
    
    awards['Sore Loser'] = soreLoserPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      margin: Math.abs(pick.margin)
    }));
  }

  // 6. Biggest Loser - incorrect pick furthest from being correct (largest negative margin)
  if (incorrectPicksWithMargin.length > 0) {
    const maxAbsMargin = Math.max(...incorrectPicksWithMargin.map(pick => Math.abs(pick.margin)));
    const biggestLoserPicks = incorrectPicksWithMargin.filter(pick => Math.abs(pick.margin) === maxAbsMargin);
    
    awards['Biggest Loser'] = biggestLoserPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      margin: Math.abs(pick.margin)
    }));
  }

  // 7. Boldest Favorite - correct spread pick with largest spread by favorite (most negative line)
  const correctSpreadPicks = correctPicks.filter(pick => 
    pick.pickType === 'spread' && pick.actualSpread !== null
  );
  if (correctSpreadPicks.length > 0) {
    // Filter for picks where the line was negative (picked the favorite)
    const favoritePicks = correctSpreadPicks.filter(pick => parseFloat(pick.line) < 0);
    if (favoritePicks.length > 0) {
      const largestFavoriteSpread = Math.min(...favoritePicks.map(pick => parseFloat(pick.line))); // Most negative line
      const boldestFavoritePicks = favoritePicks.filter(pick => parseFloat(pick.line) === largestFavoriteSpread);
      
      awards['Boldest Favorite'] = boldestFavoritePicks.map(pick => ({
        userId: pick.user.firebaseUid,
        userName: pick.user.name,
        details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
        score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
        spread: parseFloat(pick.line)
      }));
    }
  }

  // 8. Big Dawg - correct spread pick with largest spread by underdog (most positive line)
  if (correctSpreadPicks.length > 0) {
    // Filter for picks where the line was positive (picked the underdog)
    const underdogPicks = correctSpreadPicks.filter(pick => parseFloat(pick.line) > 0);
    if (underdogPicks.length > 0) {
      const largestUnderdogSpread = Math.max(...underdogPicks.map(pick => parseFloat(pick.line))); // Most positive line
      const bigDawgPicks = underdogPicks.filter(pick => parseFloat(pick.line) === largestUnderdogSpread);
      
      awards['Big Dawg'] = bigDawgPicks.map(pick => ({
        userId: pick.user.firebaseUid,
        userName: pick.user.name,
        details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
        score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
        spread: parseFloat(pick.line)
      }));
    }
  }

  // 9. Big Kahuna - correct over pick with highest total
  const correctOverPicks = correctPicks.filter(pick => 
    pick.pickType === 'total' && 
    pick.pickSide === 'OVER' && 
    pick.actualTotal !== null
  );
  if (correctOverPicks.length > 0) {
    const highestTotal = Math.max(...correctOverPicks.map(pick => pick.actualTotal));
    const bigKahunaPicks = correctOverPicks.filter(pick => pick.actualTotal === highestTotal);
    
    awards['Big Kahuna'] = bigKahunaPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      total: pick.actualTotal
    }));
  }

  // 10. Tinkerbell - correct under pick with smallest total
  const correctUnderPicks = correctPicks.filter(pick => 
    pick.pickType === 'total' && 
    pick.pickSide === 'UNDER' && 
    pick.actualTotal !== null
  );
  if (correctUnderPicks.length > 0) {
    const lowestTotal = Math.min(...correctUnderPicks.map(pick => pick.actualTotal));
    const tinkerbellPicks = correctUnderPicks.filter(pick => pick.actualTotal === lowestTotal);
    
    awards['Tinkerbell'] = tinkerbellPicks.map(pick => ({
      userId: pick.user.firebaseUid,
      userName: pick.user.name,
      details: `${pick.game.away_team_abbrev} @ ${pick.game.home_team_abbrev} - ${formatPickDetails(pick)}`,
      score: `${pick.game.away_team_abbrev} ${pick.game.awayScore}, ${pick.game.home_team_abbrev} ${pick.game.homeScore}`,
      total: pick.actualTotal
    }));
  }

  return awards;
}

// Get Snydermetrics data
app.get('/api/snydermetrics', async (req, res) => {
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

    if (availableGameWeeks.length === 0) {
      return res.json({
        cfb: { total: { O: 0, U: 0, 'Line (H)': 0, 'Line (A)': 0, Fav: 0, Dog: 0, 'Fav (H)': 0, 'Dog (H)': 0, 'Fav (A)': 0, 'Dog (A)': 0 } },
        nfl: { total: { O: 0, U: 0, 'Line (H)': 0, 'Line (A)': 0, Fav: 0, Dog: 0, 'Fav (H)': 0, 'Dog (H)': 0, 'Fav (A)': 0, 'Dog (A)': 0 } },
        totals: { total: { O: 0, U: 0, 'Line (H)': 0, 'Line (A)': 0, Fav: 0, Dog: 0, 'Fav (H)': 0, 'Dog (H)': 0, 'Fav (A)': 0, 'Dog (A)': 0 } }
      });
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

    // 4. Fetch all games for enrichment
    const allGames = {};
    for (const week of availableGameWeeks) {
      const games = await yearDb.collection(week).find({}).toArray();
      games.forEach(game => {
        if (game._id) {
          allGames[game._id.toString()] = game;
        }
      });
    }

    // 5. Enrich picks with game details
    const enrichedPicks = allPicks.map(pick => {
      const game = pick.gameId ? allGames[pick.gameId] : null;
      return {
        ...pick,
        gameDetails: game
      };
    }).filter(pick => pick.gameDetails); // Only include picks with valid game details

    // 6. Calculate Snydermetrics
    const calculateSnydermetrics = (picks) => {
      const stats = {
        O: { W: 0, L: 0, T: 0 },
        U: { W: 0, L: 0, T: 0 },
        'Line (H)': { W: 0, L: 0, T: 0 },
        'Line (A)': { W: 0, L: 0, T: 0 },
        Fav: { W: 0, L: 0, T: 0 },
        Dog: { W: 0, L: 0, T: 0 },
        'Fav (H)': { W: 0, L: 0, T: 0 },
        'Dog (H)': { W: 0, L: 0, T: 0 },
        'Fav (A)': { W: 0, L: 0, T: 0 },
        'Dog (A)': { W: 0, L: 0, T: 0 }
      };

      picks.forEach(pick => {
        const game = pick.gameDetails;
        if (!game || !pick.result) return;

        const result = pick.result.toUpperCase();
        // Handle both single letter and full word formats
        if (!['WIN', 'LOSS', 'TIE', 'W', 'L', 'T'].includes(result)) return;

        const resultKey = (result === 'WIN' || result === 'W') ? 'W' : 
                         (result === 'LOSS' || result === 'L') ? 'L' : 'T';

        // Over/Under classification
        if (pick.pickType === 'total') {
          if (pick.pickSide === 'OVER') {
            stats.O[resultKey]++;
          } else if (pick.pickSide === 'UNDER') {
            stats.U[resultKey]++;
          }
        }

        // Line (Home/Away) classification - for spread picks only
        if (pick.pickType === 'spread') {
          const pickedHome = pick.pickSide === game.home_team_abbrev || pick.pickSide === game.home_team_full;
          
          if (pickedHome) {
            stats['Line (H)'][resultKey]++;
          } else {
            stats['Line (A)'][resultKey]++;
          }

          // Favorite/Dog classification based on line sign
          const line = parseFloat(pick.line) || 0;
          const isFavorite = line < 0;
          
          if (isFavorite) {
            stats.Fav[resultKey]++;
            if (pickedHome) {
              stats['Fav (H)'][resultKey]++;
            } else {
              stats['Fav (A)'][resultKey]++;
            }
          } else if (line > 0) {
            stats.Dog[resultKey]++;
            if (pickedHome) {
              stats['Dog (H)'][resultKey]++;
            } else {
              stats['Dog (A)'][resultKey]++;
            }
          }
        }
      });

      return stats;
    };

    // 7. Calculate stats by league
    const cfbPicks = enrichedPicks.filter(pick => 
      pick.gameDetails.league === 'CFB' || 
      pick.gameDetails.league === 'NCAAF' ||
      (pick.gameDetails.sportKey && pick.gameDetails.sportKey.includes('ncaaf'))
    );
    
    const nflPicks = enrichedPicks.filter(pick => 
      pick.gameDetails.league === 'NFL' ||
      (pick.gameDetails.sportKey && pick.gameDetails.sportKey.includes('nfl'))
    );

    const cfbStats = calculateSnydermetrics(cfbPicks);
    const nflStats = calculateSnydermetrics(nflPicks);
    const totalStats = calculateSnydermetrics(enrichedPicks);

    // 8. Format response with percentages
    const formatStatsSection = (stats) => {
      const result = {};
      
      Object.keys(stats).forEach(category => {
        const { W, L, T } = stats[category];
        const total = W + L + T;
        const percentage = total > 0 ? (W / total) : 0;
        
        result[category] = {
          W,
          L,
          T,
          total,
          percentage: parseFloat((percentage * 100).toFixed(1))
        };
      });

      return result;
    };

    // 8. Calculate true totals for each league (avoiding double counting)
    const calculateTrueTotals = (picks) => {
      let totalW = 0, totalL = 0, totalT = 0;
      picks.forEach(pick => {
        if (!pick.result) return;
        const result = pick.result.toUpperCase();
        // Handle both single letter and full word formats
        if (result === 'WIN' || result === 'W') totalW++;
        else if (result === 'LOSS' || result === 'L') totalL++;
        else if (result === 'TIE' || result === 'T') totalT++;
      });
      return { W: totalW, L: totalL, T: totalT };
    };

    const cfbTrueTotals = calculateTrueTotals(cfbPicks);
    const nflTrueTotals = calculateTrueTotals(nflPicks);
    const overallTrueTotals = calculateTrueTotals(enrichedPicks);

    // 9. Format response as consolidated table
    const consolidatedData = {};
    const categories = ['O', 'U', 'Line (H)', 'Line (A)', 'Fav', 'Dog', 'Fav (H)', 'Dog (H)', 'Fav (A)', 'Dog (A)'];
    
    categories.forEach(category => {
      const cfbData = cfbStats[category] || { W: 0, L: 0, T: 0 };
      const nflData = nflStats[category] || { W: 0, L: 0, T: 0 };
      const totalData = totalStats[category] || { W: 0, L: 0, T: 0 };
      
      consolidatedData[category] = {
        cfb: {
          W: cfbData.W,
          L: cfbData.L,
          T: cfbData.T,
          total: cfbData.W + cfbData.L + cfbData.T,
          percentage: (cfbData.W + cfbData.L + cfbData.T) > 0 ? parseFloat(((cfbData.W / (cfbData.W + cfbData.L + cfbData.T)) * 100).toFixed(1)) : 0
        },
        nfl: {
          W: nflData.W,
          L: nflData.L,
          T: nflData.T,
          total: nflData.W + nflData.L + nflData.T,
          percentage: (nflData.W + nflData.L + nflData.T) > 0 ? parseFloat(((nflData.W / (nflData.W + nflData.L + nflData.T)) * 100).toFixed(1)) : 0
        },
        totals: {
          W: totalData.W,
          L: totalData.L,
          T: totalData.T,
          total: totalData.W + totalData.L + totalData.T,
          percentage: (totalData.W + totalData.L + totalData.T) > 0 ? parseFloat(((totalData.W / (totalData.W + totalData.L + totalData.T)) * 100).toFixed(1)) : 0
        }
      };
    });

    res.json({
      data: consolidatedData,
      trueTotals: {
        cfb: {
          W: cfbTrueTotals.W,
          L: cfbTrueTotals.L,
          T: cfbTrueTotals.T,
          total: cfbTrueTotals.W + cfbTrueTotals.L + cfbTrueTotals.T,
          percentage: (cfbTrueTotals.W + cfbTrueTotals.L + cfbTrueTotals.T) > 0 ? parseFloat(((cfbTrueTotals.W / (cfbTrueTotals.W + cfbTrueTotals.L + cfbTrueTotals.T)) * 100).toFixed(1)) : 0
        },
        nfl: {
          W: nflTrueTotals.W,
          L: nflTrueTotals.L,
          T: nflTrueTotals.T,
          total: nflTrueTotals.W + nflTrueTotals.L + nflTrueTotals.T,
          percentage: (nflTrueTotals.W + nflTrueTotals.L + nflTrueTotals.T) > 0 ? parseFloat(((nflTrueTotals.W / (nflTrueTotals.W + nflTrueTotals.L + nflTrueTotals.T)) * 100).toFixed(1)) : 0
        },
        totals: {
          W: overallTrueTotals.W,
          L: overallTrueTotals.L,
          T: overallTrueTotals.T,
          total: overallTrueTotals.W + overallTrueTotals.L + overallTrueTotals.T,
          percentage: (overallTrueTotals.W + overallTrueTotals.L + overallTrueTotals.T) > 0 ? parseFloat(((overallTrueTotals.W / (overallTrueTotals.W + overallTrueTotals.L + overallTrueTotals.T)) * 100).toFixed(1)) : 0
        }
      },
      availableWeeks: availableGameWeeks
    });

  } catch (err) {
    console.error('Error fetching Snydermetrics:', err);
    res.status(500).json({ error: 'Failed to fetch Snydermetrics', details: err.message });
  }
});

// Helper function to format pick details for display
function formatPickDetails(pick) {
  if (pick.pickType === 'spread') {
    return `${pick.pickSide} ${pick.line > 0 ? '+' : ''}${pick.line}`;
  } else if (pick.pickType === 'total') {
    return `${pick.pickSide === 'OVER' ? 'Over' : 'Under'} ${pick.line}`;
  } else {
    // Fallback to selectedOutcomeName if it exists, or a generic format
    return pick.selectedOutcomeName || `${pick.pickSide || 'Unknown'} ${pick.line || ''}`;
  }
}
