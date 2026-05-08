# Railway Deployment Guide

## Architecture

This is a single-service deployment where:
- Frontend: React SPA built to dist/ during deployment
- Backend: Node.js/Express serves both the API and the frontend
- Database: MongoDB, provisioned separately
- Cache: Redis, provisioned separately

## Deployment Steps

### 1. Create the Service

1. Go to the Railway dashboard.
2. Create a new project or open an existing one.
3. Click Create Service, then GitHub Repo.
4. Select tuancreations/TUAN-CREATIONS-WEBSITE-with-backend.
5. Name the service TUAN Creations.

### 2. Configure Service Settings

1. Open the Settings tab.
2. Leave Root Directory empty.
3. Use the repository config in backend/Dockerfile.
4. Keep the service as a GitHub-connected deployment.

### 3. Provision MongoDB

1. Click Create Service, then Database.
2. Choose MongoDB.
3. Name it MongoDB.
4. Railway will expose DATABASE_URL.

### 4. Provision Redis

1. Click Create Service, then Database.
2. Choose Redis.
3. Name it Redis.
4. Railway will expose REDIS_URL.

### 5. Set Environment Variables

Add these to the TUAN Creations service:

- NODE_ENV=production
- PORT=4000
- JWT_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- MONGODB_URI or ATLAS_* parts
- REDIS_URL
- CLIENT_ORIGIN set to your Railway or custom frontend domain

### 6. Deploy

1. Click Deploy.
2. Watch the build logs.
3. Open the Railway domain when the deployment is healthy.

## Troubleshooting

### Build Fails: Cannot find module
- Make sure backend/Dockerfile exists.
- Confirm the root package.json has the backend postinstall hook.

### Frontend Shows 404
- Check that backend/src/server.js serves the dist/ folder.
- Verify the frontend build completed.

### API Calls Fail
- Check CLIENT_ORIGIN.
- Verify MongoDB and Redis are running.
- Inspect backend logs for connection errors.

### WebSocket Connection Fails
- Confirm REDIS_URL is set.
- Check Socket.IO adapter initialization in the backend logs.

## Local Development

```bash
npm install
cd backend && npm install
npm run build
cd backend && npm start
```

## Environment Variables Reference

- PORT: Server port.
- NODE_ENV: Set to production in Railway.
- CLIENT_ORIGIN: Frontend URL.
- JWT_SECRET: Secret for JWT signing.
- MONGODB_URI: MongoDB connection string.
- ADMIN_EMAIL: Admin account email.
- ADMIN_PASSWORD: Admin account password.
- REDIS_URL: Redis connection string.
- EMAIL_HOST: SMTP host, optional.
- EMAIL_PORT: SMTP port, optional.
- EMAIL_USER: SMTP username, optional.
- EMAIL_PASS: SMTP password, optional.
- EMAIL_FROM: From address for emails, optional.

## Post-Deployment Verification

1. Visit /api/health.
2. Load the frontend URL in a browser.
3. Test authentication.
4. Test database writes.
5. Join a live session and verify Socket.IO behavior.