#!/bin/bash

# Build frontend
echo "Building frontend..."
npm run build

# Deploy frontend to Firebase
echo "Deploying frontend to Firebase..."
firebase deploy --only hosting

# Deploy backend to Google Cloud Run with secrets
echo "Deploying backend to Google Cloud Run with secrets..."
cd backend
gcloud run deploy locks-backend \
  --source . \
  --platform managed \
  --region us-east1 \
  --project locks-of-the-week \
  --allow-unauthenticated \
  --port 5001 \
  --set-secrets FIREBASE_PROJECT_ID=firebase-project-id:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest

echo "Deployment complete!"
