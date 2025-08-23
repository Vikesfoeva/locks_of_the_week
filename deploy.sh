#!/bin/bash

# Build frontend
echo "Building frontend..."
npm run build

# Deploy frontend to Firebase
echo "Deploying frontend to Firebase..."
firebase deploy --only hosting

# Deploy backend to Google Cloud Run
echo "Deploying backend to Google Cloud Run..."
cd backend
gcloud run deploy locks-backend \
  --source . \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --port 5001

echo "Deployment complete!"