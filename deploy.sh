#!/bin/bash

# TUAN Marketplace - Deployment Script
# Usage: ./deploy.sh [netlify|docker|both]

set -e

DEPLOY_TYPE=${1:-both}
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

echo "🚀 TUAN Marketplace Deployment Script"
echo "Started: $TIMESTAMP"
echo "Deploy Type: $DEPLOY_TYPE"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# FRONTEND BUILD
# ============================================
if [[ "$DEPLOY_TYPE" == "netlify" || "$DEPLOY_TYPE" == "both" ]]; then
    echo -e "${BLUE}Step 1: Building Frontend${NC}"
    cd "$(dirname "$0")"
    npm run build
    echo -e "${GREEN}✓ Frontend build complete${NC}"
    echo ""
    
    if command -v netlify &> /dev/null; then
        echo -e "${BLUE}Step 2: Deploying to Netlify${NC}"
        netlify deploy --prod --dir=dist
        echo -e "${GREEN}✓ Frontend deployed to Netlify${NC}"
    else
        echo -e "${YELLOW}ℹ Netlify CLI not installed. Run: npm install -g netlify-cli${NC}"
        echo -e "${YELLOW}Then deploy manually: netlify deploy --prod --dir=dist${NC}"
    fi
    echo ""
fi

# ============================================
# BACKEND DOCKER BUILD
# ============================================
if [[ "$DEPLOY_TYPE" == "docker" || "$DEPLOY_TYPE" == "both" ]]; then
    echo -e "${BLUE}Step 3: Building Backend Docker Image${NC}"
    cd "$(dirname "$0")/backend"
    docker build -t tuan-backend:latest -t tuan-backend:$(date +%Y%m%d-%H%M%S) .
    echo -e "${GREEN}✓ Backend Docker image built${NC}"
    echo ""
    
    echo -e "${BLUE}Step 4: Starting Docker Compose Stack${NC}"
    cd "$(dirname "$0")"
    docker-compose up -d
    echo -e "${GREEN}✓ Docker stack started${NC}"
    echo ""
    
    echo -e "${BLUE}Waiting for services to be ready...${NC}"
    sleep 5
    
    echo -e "${BLUE}Service Status:${NC}"
    docker-compose ps
    echo ""
fi

# ============================================
# HEALTH CHECKS
# ============================================
echo -e "${BLUE}Step 5: Running Health Checks${NC}"

if curl -s http://localhost:4000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${YELLOW}⚠ Backend not responding yet (might still be starting)${NC}"
fi

if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}⚠ Frontend not running (check if dev server is running)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Access your application:${NC}"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:4000"
echo ""
echo "Deployment completed: $(date +"%Y-%m-%d %H:%M:%S")"
