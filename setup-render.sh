#!/bin/bash

# TUAN Marketplace - Setup for Render Deployment
# This script helps configure environment variables for Render

set -e

echo "🚀 TUAN Marketplace - Render Setup Assistant"
echo ""
echo "This script will help you set up your Render deployment."
echo ""

# Check if we have required tools
if ! command -v git &> /dev/null; then
    echo "❌ Git is required but not installed. Please install Git first."
    exit 1
fi

# Get repository information
echo "📦 Repository Information:"
REPO=$(git config --get remote.origin.url)
echo "Repository: $REPO"
echo ""

# MongoDB Setup
echo "🗄️  MongoDB Setup:"
echo ""
echo "You need a MongoDB database for production. Choose one:"
echo ""
echo "Option 1: MongoDB Atlas (Recommended)"
echo "  1. Go to https://cloud.mongodb.com"
echo "  2. Create a free cluster"
echo "  3. Create a database user"
echo "  4. Get the connection string"
echo "  5. Add to Render environment variables as MONGODB_URI"
echo ""
echo "Option 2: Self-hosted MongoDB"
echo "  1. Set up MongoDB on your own server"
echo "  2. Get connection string: mongodb://user:pass@host:port/database"
echo "  3. Add to Render environment variables as MONGODB_URI"
echo ""

# Generate JWT Secret
echo "🔐 JWT Secret Generation:"
echo ""
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -hex 32)
    echo "Generated JWT_SECRET:"
    echo "$JWT_SECRET"
else
    echo "Please generate a JWT secret using:"
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
fi
echo ""
echo "Save this for Render environment variables as JWT_SECRET"
echo ""

# Summary
echo "📋 Summary of Required Render Environment Variables:"
echo ""
echo "1. NODE_ENV = production"
echo "2. PORT = 4000"
echo "3. MONGODB_URI = (MongoDB connection string from Atlas or your server)"
echo "4. JWT_SECRET = (Generated secret from above)"
echo "5. CLIENT_ORIGIN = https://your-frontend-url.onrender.com"
echo "6. ADMIN_EMAIL = admin@tuancreations.africa"
echo "7. ADMIN_PASSWORD = (Your secure password)"
echo ""

echo "✅ Next Steps:"
echo ""
echo "1. Go to Render Dashboard"
echo "2. Create a new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Set the build command: cd backend && npm install"
echo "5. Set the start command: cd backend && npm start"
echo "6. Add the environment variables from above"
echo "7. Deploy"
echo ""

echo "📚 Documentation:"
echo "  - Full Render guide: See RENDER_DEPLOYMENT.md"
echo "  - Troubleshooting: https://render.com/docs/troubleshooting-deploys"
echo ""

echo "✨ Ready? Visit https://render.com and create your service!"
