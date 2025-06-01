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

const app = express();

// Enhanced CORS configuration
console.log(process.env.FRONTEND_URL)
const corsOptions = { 
  origin: process.env.FRONTEND_URL || 'http://localhost:5178', // Replace with your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(express.json());

// Request logging middleware
// app.use((req, res, next) => {
//   console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
//   next();
// });

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
    console.log('DB query complete', exists);
    res.json({ allowed: !!exists });
  } catch (err) {
    console.error('Error in /api/whitelist/check:', err);
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
