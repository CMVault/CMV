#!/bin/bash

echo "================================================"
echo "Starting Camera Manual Vault System"
echo "================================================"

# Create necessary directories
echo "Creating directories..."
mkdir -p logs
mkdir -p data/attributions
mkdir -p public/images/cameras/thumbs

# Check if database exists
if [ ! -f "data/camera-vault.db" ]; then
    echo "ERROR: Database not found at data/camera-vault.db"
    echo "Please run the database setup first!"
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing PM2 globally..."
    npm install -g pm2
fi

# Create server-minimal.js if it doesn't exist
if [ ! -f "server-minimal.js" ]; then
    echo "Creating server-minimal.js..."
    cp server.js server-minimal.js
    echo "You need to manually edit server-minimal.js to remove automation!"
fi

# Create automation-scheduler.js if it doesn't exist
if [ ! -f "automation-scheduler.js" ]; then
    echo "Creating automation-scheduler.js..."
    echo "Please copy the automation-scheduler.js content from the artifact!"
fi

# Stop any existing PM2 processes
echo "Stopping any existing PM2 processes..."
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Start with PM2
echo "Starting services with PM2..."
pm2 start ecosystem.config.js

# Show status
echo ""
echo "================================================"
echo "System Status:"
echo "================================================"
pm2 status

echo ""
echo "================================================"
echo "Logs:"
echo "================================================"
echo "View server logs: pm2 logs cmv-server"
echo "View automation logs: pm2 logs cmv-automation"
echo "View all logs: pm2 logs"
echo ""
echo "Server URL: http://localhost:3000"
echo ""
echo "To stop: pm2 stop all"
echo "To restart: pm2 restart all"
echo "To monitor: pm2 monit"
echo "================================================"