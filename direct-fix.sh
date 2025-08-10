#!/bin/bash
# direct-fix.sh - Directly fixes the problematic query in server.js

echo "🔧 Directly fixing server.js..."

# Backup current server.js
cp server.js server.js.backup-$(date +%s)

# Fix the problematic ORDER BY clause
# Replace any ORDER BY lastUpdated with ORDER BY id
sed -i.bak 's/ORDER BY lastUpdated/ORDER BY id/g' server.js

# Also fix if there's a space pattern
sed -i.bak 's/ORDER BY\s\+lastUpdated/ORDER BY id/g' server.js

# Fix potential column reference in WHERE clause
sed -i.bak 's/WHERE lastUpdated/WHERE updated_at/g' server.js

# Check if the fix was applied
echo "✅ Fixed ORDER BY clauses"

# Show the changed lines
echo ""
echo "📋 Checking for any remaining 'lastUpdated' references:"
grep -n "lastUpdated" server.js || echo "✅ No more lastUpdated references found"

echo ""
echo "📋 Next steps:"
echo "1. Restart server: npx pm2 restart cmv-server"
echo "2. Test API: curl http://localhost:3001/api/cameras"