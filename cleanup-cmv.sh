#!/bin/bash

# CMV CLEANUP AND RESTART SCRIPT
# This will clean up unnecessary files and prepare for fresh start

echo "================================================"
echo "   CMV CLEANUP AND RESTART AUTOMATION"
echo "   Date: $(date)"
echo "================================================"

# Create cleanup directory for archiving
mkdir -p archive/old-fixes-$(date +%Y%m%d)
mkdir -p archive/old-backups
mkdir -p archive/old-migrations

# Step 1: Archive all fix/migration/cleanup scripts
echo ""
echo "📦 Step 1: Archiving old fix files..."
mv fix-*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv cleanup*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv migrate*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv ultimate-*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv smart-fix*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv safe-*.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv simple-migrate.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv automated-cmv-fix.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv minimal-syntax-fix.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv check-database-status.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv diagnose-db.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv debug-save.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv quick-db-fix.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv view-cameras.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv add-all-missing-functions.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv disable-auto-automation.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv final-unified-camera-system.js archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null

# Step 2: Archive .save and .backup files
echo "📦 Step 2: Archiving backup files..."
mv *.save archive/old-backups/ 2>/dev/null
mv *.backup archive/old-backups/ 2>/dev/null
mv *.backup-* archive/old-backups/ 2>/dev/null
mv *.syntax-backup archive/old-backups/ 2>/dev/null
mv *.broken.js archive/old-backups/ 2>/dev/null
mv unified-camera-system-temp.js archive/old-backups/ 2>/dev/null
mv "nano fix-api-response.js" archive/old-backups/ 2>/dev/null

# Step 3: Archive old backup directories
echo "📦 Step 3: Archiving backup directories..."
mv backup-20250804-* archive/old-backups/ 2>/dev/null
mv backup-fix-* archive/old-backups/ 2>/dev/null
mv backups archive/old-backups/ 2>/dev/null

# Step 4: Clean up shell scripts not needed
echo "📦 Step 4: Archiving unused shell scripts..."
mv fix-now.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv complete-db-fix.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv deep-diagnosis.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv undo-and-fix.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv restore-generate-structure.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null
mv activate-discovery.sh archive/old-fixes-$(date +%Y%m%d)/ 2>/dev/null

# Step 5: Clean up other unnecessary files
echo "📦 Step 5: Cleaning up misc files..."
rm -f diagnosis-output.txt
rm -f fix-report.json
rm -f monitor.js

# Step 6: Keep only essential files
echo ""
echo "✅ Step 6: Verifying essential files..."
echo ""
echo "Essential files that should remain:"
echo "--------------------------------"
ls -la server.js 2>/dev/null && echo "✓ server.js"
ls -la server-minimal.js 2>/dev/null && echo "✓ server-minimal.js (backup)"
ls -la unified-camera-system.js 2>/dev/null && echo "✓ unified-camera-system.js"
ls -la automation-routes.js 2>/dev/null && echo "✓ automation-routes.js"
ls -la camera-utils.js 2>/dev/null && echo "✓ camera-utils.js"
ls -la update-camera-images.js 2>/dev/null && echo "✓ update-camera-images.js"
ls -la package.json 2>/dev/null && echo "✓ package.json"
ls -la ecosystem.config.js 2>/dev/null && echo "✓ ecosystem.config.js"
ls -la start-cmv.sh 2>/dev/null && echo "✓ start-cmv.sh"
ls -la implement-cmv.sh 2>/dev/null && echo "✓ implement-cmv.sh"

echo ""
echo "📁 Directories that should remain:"
echo "--------------------------------"
ls -d config 2>/dev/null && echo "✓ config/"
ls -d data 2>/dev/null && echo "✓ data/"
ls -d public 2>/dev/null && echo "✓ public/"
ls -d scripts 2>/dev/null && echo "✓ scripts/"
ls -d views 2>/dev/null && echo "✓ views/"

echo ""
echo "================================================"
echo "   CLEANUP COMPLETE!"
echo "================================================"
echo ""
echo "Files archived to: archive/"
echo ""
echo "Next steps:"
echo "1. Review archived files in archive/ directory"
echo "2. Delete archive/ when confident everything works"
echo "3. Run './start-fresh-cmv.sh' to start with clean database"
echo ""
