#!/bin/bash
set -e

# Build frontend
echo "Building frontend..."
npm run build

# Deploy backend to Google Cloud Run with secrets.
# Backend goes FIRST: the new bundle may call API routes that only exist in
# the new revision. gcloud blocks until that revision is serving traffic.
echo "Deploying backend to Google Cloud Run with secrets..."
gcloud run deploy locks-backend \
  --source ./backend \
  --platform managed \
  --region us-east1 \
  --project locks-of-the-week \
  --allow-unauthenticated \
  --port 5001 \
  --set-secrets FIREBASE_PROJECT_ID=firebase-project-id:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest

# Deploy frontend to Firebase (only after the backend is live)
echo "Deploying frontend to Firebase..."
firebase deploy --only hosting

echo "Deployment complete!"
