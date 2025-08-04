#!/bin/bash

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     🎥 CAMERA VAULT - INTELLIGENT FIX SCRIPT 🎥      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Not in Camera Vault directory!${NC}"
    echo "Please run this from your project root."
    exit 1
fi

# Make sure the fix script exists
if [ ! -f "fix-everything-intelligently.js" ]; then
    echo -e "${YELLOW}Creating fix script...${NC}"
    # The script should already be created by the artifact above
    # But if not, this is a safety check
fi

# Make the script executable
chmod +x fix-everything-intelligently.js

echo -e "${BLUE}Starting intelligent fix process...${NC}"
echo ""

# Run the fix script
node fix-everything-intelligently.js

# Check if it succeeded
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}${BOLD}✅ Fix completed successfully!${NC}"
    echo ""
    echo -e "${CYAN}Quick status check:${NC}"
    pm2 list
    echo ""
    echo -e "${YELLOW}To monitor your camera discovery:${NC}"
    echo "  pm2 logs cmv-discovery --lines 50"
    echo ""
else
    echo -e "${RED}Fix script failed. Check the errors above.${NC}"
    exit 1
fi
