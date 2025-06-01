# Backend for Locks of the Week

## Setup

1. Copy `.env.example` to `.env` and fill in your MongoDB connection string.
2. Install dependencies (already done):
   ```sh
   npm install
   ```
3. Start the server:
   ```sh
   node server.js
   ```

## Endpoints

- `GET /api/users` — Returns all users from the `locks_data.users` collection.

## Notes
- Make sure your MongoDB Atlas cluster is accessible from your IP.
- The server runs on port 4000 by default. 