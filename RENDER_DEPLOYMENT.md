# Render.com Deployment Guide

## 🚀 Deploying TUAN Marketplace to Render

Render is a modern cloud platform with free tier support. Follow these steps to deploy.

---

## Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended)
3. Authorize Render to access your repositories

---

## Step 2: Connect GitHub Repository

1. Dashboard → New → Web Service
2. Select repository: `tuancreations/TUAN-CREATIONS-WEBSITE-with-backend`
3. Select branch: `main`

---

## Step 3: Configure Backend Service

**Service Settings:**
```
Name: tuan-backend
Environment: Node
Region: Oregon (or nearest to your users)
Branch: main
Build Command: cd backend && npm install
Start Command: cd backend && npm start
Plan: Free (or pay-as-you-go)
```

**Environment Variables:**

Add these in Render dashboard:

```
NODE_ENV = production
PORT = 4000
CLIENT_ORIGIN = https://your-frontend-domain.onrender.com

# REQUIRED: MongoDB
# Get connection string from MongoDB Atlas (https://cloud.mongodb.com)
MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/tuan_creations

# REQUIRED: JWT Secret
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET = your-cryptographically-strong-secret-here

# Admin Credentials
ADMIN_EMAIL = admin@tuancreations.africa
ADMIN_PASSWORD = your-secure-password-here

# Optional: Redis (for scaling Socket.IO)
# REDIS_URL = redis://red-username:password@redis-host:port
```

**Important:**
- ⚠️ Keep `MONGODB_URI`, `JWT_SECRET`, and `ADMIN_PASSWORD` private
- ⚠️ Do NOT commit these to GitHub
- ✅ Use Render's environment variable management

---

## Step 4: Configure Frontend Service (Static Site)

**Option A: Deploy as Static Site (Recommended)**

1. Dashboard → New → Static Site
2. Select repository: `tuancreations/TUAN-CREATIONS-WEBSITE-with-backend`
3. Build Command: `npm install && npm run build`
4. Publish directory: `./dist`

**Update API URL:**

Before deploying, update the frontend API base URL in `src/services/api.ts`:

```typescript
// Change this:
const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";

// To use environment variable or default to Render backend URL
```

Or set environment variable in Render:
```
VITE_API_URL = https://tuan-backend.onrender.com
```

---

## Step 5: Set Up MongoDB Atlas (Database)

1. Go to https://cloud.mongodb.com
2. Create free cluster
3. Create database user with credentials
4. Whitelist Render's IP range:
   - Allow from: `0.0.0.0/0` (or Render IP if available)
5. Get connection string
6. Add to Render environment variable `MONGODB_URI`

**Connection String Format:**
```
mongodb+srv://username:password@cluster.mongodb.net/tuan_creations?retryWrites=true&w=majority
```

---

## Step 6: Deploy

1. Click "Deploy" in Render dashboard
2. Wait for build to complete (5-10 minutes)
3. Check logs for errors
4. Once deployed, you'll get a URL like: `https://tuan-backend.onrender.com`

---

## Step 7: Verify Deployment

**Test Backend:**
```bash
curl https://your-backend-url.onrender.com/health
```

Should return server response.

**Test API:**
```bash
curl https://your-backend-url.onrender.com/api/listings
```

Should return marketplace listings.

---

## Troubleshooting

### ❌ Build Failed: "mongodb-memory-server"

**Error:**
```
ERR! node-gyp rebuild
ERR! gyp ERR! build error
```

**Solution:**
- Ensure `MONGODB_URI` is set in environment variables
- Backend needs real MongoDB connection, not in-memory

### ❌ 502 Bad Gateway

**Possible causes:**
- Backend crashed (check logs)
- MongoDB connection failed
- Port not exposed correctly

**Check logs in Render:**
1. Go to Service → Logs
2. Look for error messages
3. Verify environment variables are set

### ❌ Frontend shows "Cannot find Backend"

**Solution:**
- Update `CLIENT_ORIGIN` in backend environment to match frontend URL
- Update API URL in frontend to match backend URL
- Check CORS configuration

---

## Production Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user credentials set
- [ ] `MONGODB_URI` added to Render environment
- [ ] `JWT_SECRET` generated and set
- [ ] `ADMIN_PASSWORD` changed from default
- [ ] `CLIENT_ORIGIN` points to frontend URL
- [ ] Backend deployed and responding
- [ ] Frontend built and deployed
- [ ] API endpoints tested
- [ ] Admin login works
- [ ] Marketplace listing creation works
- [ ] Backups configured

---

## Cost Estimation (Render Free Tier)

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Web Service (Backend) | 750 hrs/month | 0.1 vCPU, 512MB RAM |
| Static Site (Frontend) | ∞ Bandwidth | CDN included |
| PostgreSQL | 90 days free | Not needed (using MongoDB) |
| **Total Cost** | **FREE** | All in free tier |

⚠️ Note: Free tier services go to sleep after 15 minutes of inactivity. Upgrade to "Pay-as-you-go" for always-on.

---

## Upgrade to Production (Optional)

**For production deployment:**

1. **Upgrade from Free to Pro:**
   - $12/month per service (auto-scales)
   - Always-on
   - Better performance
   - Better support

2. **Add Custom Domain:**
   - Go to Service → Settings → Custom Domain
   - Add your domain (e.g., api.tuancreations.africa)
   - Configure DNS in domain registrar

3. **Monitor Performance:**
   - Use Render Metrics tab
   - Monitor database performance
   - Scale services as needed

---

## Next Steps

1. ✅ Set up MongoDB Atlas
2. ✅ Deploy Backend to Render
3. ✅ Deploy Frontend to Render
4. ✅ Test all endpoints
5. ✅ Configure monitoring
6. ✅ Set up alerts

---

## Support

- **Render Documentation:** https://render.com/docs
- **MongoDB Atlas:** https://docs.mongodb.com/atlas/
- **GitHub Repository:** https://github.com/tuancreations/TUAN-CREATIONS-WEBSITE-with-backend
- **Email:** tuancreations.africa@gmail.com

---

## Quick Reference URLs

After deployment, you'll have:

```
Backend API: https://tuan-backend.onrender.com
Frontend: https://tuan-frontend.onrender.com
Admin Panel: https://tuan-frontend.onrender.com/admin
API Docs: https://tuan-backend.onrender.com/api/docs
```

**Default Admin Login:**
```
Email: admin@tuancreations.africa
Password: (set in ADMIN_PASSWORD env var)
```

---

**Ready to Deploy?** 🚀

Follow the steps above and your TUAN Marketplace will be live in 10-15 minutes!
