#!/bin/bash

# Camera Manual Vault - Complete System Fix
# This script will fix all issues and get your system running properly

echo "================================================"
echo "Camera Manual Vault - Complete System Fix"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the current directory
PROJECT_DIR=$(pwd)

echo -e "${BLUE}Working directory: $PROJECT_DIR${NC}"
echo ""

# Step 1: Stop any running servers
echo -e "${YELLOW}Step 1: Stopping existing servers...${NC}"
npx pm2 stop all 2>/dev/null || true
npx pm2 delete all 2>/dev/null || true
killall node 2>/dev/null || true
echo -e "${GREEN}✓ Servers stopped${NC}"
echo ""

# Step 2: Create directory structure
echo -e "${YELLOW}Step 2: Creating directory structure...${NC}"
mkdir -p public/css
mkdir -p public/images/cameras/thumbs
mkdir -p data/attributions
mkdir -p data/db-backups
mkdir -p views/pages
mkdir -p config
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# Step 3: Backup existing database
echo -e "${YELLOW}Step 3: Backing up database...${NC}"
if [ -f "data/camera-vault.db" ]; then
    cp data/camera-vault.db "data/db-backups/camera-vault-$(date +%Y%m%d-%H%M%S).db"
    echo -e "${GREEN}✓ Database backed up${NC}"
else
    echo -e "${YELLOW}No existing database to backup${NC}"
fi
echo ""

# Step 4: Create package.json if missing
echo -e "${YELLOW}Step 4: Checking package.json...${NC}"
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "camera-manual-vault",
  "version": "1.0.0",
  "description": "Camera Manual Vault - Every Camera Manual Ever Made",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "audit": "node cmv-audit.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
EOF
    echo -e "${GREEN}✓ package.json created${NC}"
else
    echo -e "${GREEN}✓ package.json exists${NC}"
fi
echo ""

# Step 5: Install dependencies
echo -e "${YELLOW}Step 5: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${GREEN}Basic setup complete!${NC}"
