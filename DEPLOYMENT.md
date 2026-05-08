# TUAN Marketplace - Deployment Guide

**Project:** TUAN Creations Company Ltd  
**Status:** Production Ready ✅  
**Date:** May 8, 2026

---

## 📊 Deployment Options

### Option 1: Netlify (Recommended for Frontend)
**Status:** ✅ Ready  
**Frontend Deployment:** Automatic from GitHub  
**Cost:** Free tier available

**Setup:**
1. Connect GitHub repository to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist/`
4. Environment variables configured in netlify.toml

**Link Repository:**
```bash
https://github.com/tuancreations/TUAN-CREATIONS-WEBSITE-with-backend
```

**Deploy:**
- Netlify will auto-build on git push to main branch
- Frontend automatically deploys to production
- SPA routing configured with redirects

---

### Option 2: Docker Compose (Full Stack)
**Status:** ✅ Ready  
**Components:** MongoDB + Redis + Backend  
**Cost:** Self-hosted or cloud provider

**Services:**
```yaml
- MongoDB 7 (database)
- Redis 7 (cache/Socket.IO)
- Node.js Backend (Express server)
```

**Deploy Locally:**
```bash
docker-compose up -d
```

**Deploy on Cloud:**
- AWS ECS / Fargate
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform

---

### Option 3: Standalone Backend + Managed Frontend

**Frontend:** Netlify / Vercel  
**Backend:** Heroku / Railway / Render  
**Database:** MongoDB Atlas  
**Cache:** Redis Cloud / Upstash

---

## 🚀 Quick Start Deployment

### Step 1: Production Environment Setup

Create `.env.production` with production values:

```bash
# Backend Configuration
PORT=4000
NODE_ENV=production

# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/tuan_creations

# JWT Security
JWT_SECRET=<generate-strong-secret>

# Frontend Origin
CLIENT_ORIGIN=https://your-domain.com

# Admin Credentials
ADMIN_EMAIL=admin@tuancreations.africa
ADMIN_PASSWORD=<secure-password>

# Optional: Redis Cloud
REDIS_URL=redis://:password@host:port

# Optional: Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="TUAN Creations <noreply@tuancreations.africa>"
```

---

### Step 2: Frontend Deployment (Netlify)

**Current Status:** ✅ Build Complete

**Artifacts Ready:**
```
dist/
├── index.html (0.80 kB)
├── assets/
│   ├── index-*.js (205 kB)
│   ├── vendor-*.js (141 kB)
│   ├── router-*.js (33 kB)
│   ├── icons-*.js (16 kB)
│   ├── select-*.js (102 kB)
│   └── index-*.css (43 kB)
└── _redirects (SPA routing)
```

**Deploy to Netlify:**
```bash
# Option A: CLI
npm install -g netlify-cli
netlify deploy --prod --dir=dist

# Option B: GitHub Integration
# Push to main branch → Netlify auto-builds & deploys
```

---

### Step 3: Backend Deployment (Docker)

**Current Status:** ✅ Dockerized

**Build Backend Image:**
```bash
cd backend
docker build -t tuan-backend:latest .
```

**Run Backend:**
```bash
# Local Docker
docker run -p 4000:4000 \
  -e MONGODB_URI=mongodb://... \
  -e JWT_SECRET=... \
  tuan-backend:latest

# Docker Compose (all services)
docker-compose up -d
```

**Deploy to Cloud:**
```bash
# AWS ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

docker tag tuan-backend:latest <account>.dkr.ecr.us-east-1.amazonaws.com/tuan-backend:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/tuan-backend:latest

# Deploy to ECS / Fargate
# (Use AWS Console or CLI to create task definition and service)
```

---

### Step 4: Database Setup

**Option A: MongoDB Atlas (Recommended)**
```
1. Create account: https://www.mongodb.com/cloud/atlas
2. Create cluster in appropriate region
3. Create database user with credentials
4. Whitelist IP addresses
5. Get connection string
6. Add to MONGODB_URI in .env
```

**Option B: Self-Hosted MongoDB**
```bash
# Docker
docker run -d -p 27017:27017 mongo:7

# Or install locally: https://docs.mongodb.com/manual/installation/
```

---

### Step 5: Redis Setup (Optional)

**Option A: Redis Cloud**
```
1. Sign up: https://redis.com/try-free/
2. Create database
3. Get connection URL
4. Add to REDIS_URL in .env
```

**Option B: Self-Hosted Redis**
```bash
# Docker
docker run -d -p 6379:6379 redis:7

# Or local: brew install redis (Mac) or apt-get install redis (Linux)
```

---

## 📋 Pre-Deployment Checklist

- [ ] Frontend build successful (✅ Done: 14.01s)
- [ ] All TypeScript errors resolved (✅ Zero errors)
- [ ] All tests passing (ready for integration testing)
- [ ] Environment variables configured
- [ ] MongoDB database ready
- [ ] Redis cache configured (optional)
- [ ] GitHub repository updated
- [ ] Netlify project connected
- [ ] Backend Docker image built
- [ ] SSL/HTTPS certificate obtained
- [ ] Domain DNS configured
- [ ] Error tracking (Sentry) configured (optional)
- [ ] Analytics service configured (optional)

---

## 🎯 Deployment Scenarios

### Scenario 1: Frontend Only (Netlify)

**For:** Quick frontend deployment, backend managed separately

**Steps:**
1. ✅ Frontend built (dist/ ready)
2. Connect GitHub to Netlify
3. Set environment variables in Netlify
4. Deploy

**Deployed in:** ~2-5 minutes

---

### Scenario 2: Full Stack (Docker)

**For:** Complete self-contained deployment

**Steps:**
1. ✅ Frontend built
2. ✅ Backend Dockerized
3. Create docker-compose.yml (ready)
4. Configure MongoDB & Redis
5. Deploy docker-compose.yml

**Deployed in:** ~5-10 minutes

---

### Scenario 3: Hybrid (Netlify + Railway Backend)

**For:** Scalable, cost-effective deployment

**Steps:**
1. ✅ Frontend built → Deploy to Netlify
2. Backend code → Deploy to Railway
3. Database → MongoDB Atlas
4. Cache → Redis Cloud

**Deployed in:** ~10-15 minutes

#### Railway backend setup

This repository now includes a [railway.json](railway.json) config so Railway can build and start the backend from `backend/` without extra manual wiring.

Use these backend environment variables in Railway:

- `NODE_ENV=production`
- `PORT=4000` or leave Railway to manage the port and keep the default startup behavior
- `MONGODB_URI` or the Atlas parts supported by [backend/src/config.js](backend/src/config.js)
- `JWT_SECRET`
- `CLIENT_ORIGIN` set to your frontend URL
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `REDIS_URL` if you want the Socket.IO Redis adapter

For the frontend, set `VITE_API_BASE_URL` to the Railway backend domain so the browser app calls the deployed API instead of localhost.

---

## 🔒 Security Checklist

- [ ] JWT_SECRET is cryptographically strong (64+ chars)
- [ ] DATABASE credentials are not in version control
- [ ] Environment variables are set per environment
- [ ] HTTPS/SSL enabled on all endpoints
- [ ] CORS_ORIGIN correctly configured
- [ ] Rate limiting active (50 req/min for orders)
- [ ] Admin credentials rotated
- [ ] Audit logging enabled for compliance
- [ ] Error messages don't expose sensitive info
- [ ] Secrets stored in secure vault (not .env files)

---

## 📊 Production Configuration

### Backend Health Endpoints

```bash
# Health check
curl https://api.yourdomain.com/health

# Marketplace stats
curl https://api.yourdomain.com/api/marketplace/stats

# Metrics
curl https://api.yourdomain.com/api/metrics/marketplace
```

### Monitoring

**Metrics to Track:**
- API response times
- Error rates
- Database query performance
- Redis cache hit ratio
- Fraud detection triggers
- Payout processing times

**Recommended Tools:**
- Datadog
- New Relic
- Prometheus + Grafana
- CloudWatch (AWS)

---

## 🚨 Post-Deployment Tasks

1. **Verify Functionality:**
   - Test marketplace listing creation
   - Create test orders
   - Verify commission calculations
   - Test fraud detection
   - Check audit logging

2. **Monitor Initial Traffic:**
   - Watch error logs
   - Monitor response times
   - Check database load
   - Verify cache hit rates

3. **Configure Backups:**
   - Database: MongoDB Atlas backup
   - Files: S3 or similar backup
   - Regular snapshots

4. **Set Up Alerts:**
   - High error rate (>1%)
   - API latency (>2s)
   - Database connection issues
   - Low disk space

---

## 🔧 Troubleshooting

### Frontend Build Issues
```bash
# Clear cache and rebuild
rm -rf dist node_modules/.vite
npm run build
```

### Backend Connection Issues
```bash
# Test database connection
node -e "require('./backend/src/config.js').then(c => console.log('Connected'))"

# Test Redis connection
redis-cli -u $REDIS_URL PING
```

### Docker Issues
```bash
# View logs
docker-compose logs -f

# Rebuild images
docker-compose build --no-cache
```

---

## 📞 Support & Resources

**Documentation:**
- Frontend: [Vite Docs](https://vitejs.dev)
- Backend: [Express.js](https://expressjs.com)
- Database: [MongoDB Docs](https://docs.mongodb.com)
- Deployment: [Docker Docs](https://docs.docker.com)

**Contact:**
- Email: tuancreations.africa@gmail.com
- GitHub: https://github.com/tuancreations/TUAN-CREATIONS-WEBSITE-with-backend

---

## ✅ Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Frontend Build** | ✅ Ready | 205 kB JS (51 kB gzipped), production optimized |
| **Backend Dockerfile** | ✅ Ready | Multi-stage build, production optimized |
| **Docker Compose** | ✅ Ready | MongoDB + Redis + Backend |
| **Environment Config** | ✅ Ready | .env.example with all variables |
| **Git Repository** | ✅ Ready | tuancreations/TUAN-CREATIONS-WEBSITE-with-backend |
| **Netlify Config** | ✅ Ready | netlify.toml with build & redirects |

---

**Ready to Deploy!** 🚀

Choose your deployment option above and follow the steps. All components are production-ready.
