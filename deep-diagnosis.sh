#!/bin/bash

# deep-diagnosis.sh - Find the real problem

echo "🔍 Deep Diagnosis of CMV System"
echo "================================"

# 1. Check what PM2 is actually running
echo -e "\n1️⃣ PM2 Process Details:"
npx pm2 show cmv-discovery

# 2. Check if there are multiple Node processes
echo -e "\n2️⃣ All Node Processes:"
ps aux | grep node | grep -v grep

# 3. Look at the actual file being run
echo -e "\n3️⃣ File PM2 is running:"
npx pm2 describe cmv-discovery | grep "script path"

# 4. Check for syntax errors in the file
echo -e "\n4️⃣ Syntax check on main file:"
node -c unified-camera-system.js 2>&1 | head -20

# 5. Look for other JS files that might be involved
echo -e "\n5️⃣ Other JavaScript files in directory:"
ls -la *.js | grep -v backup | grep -v node_modules

# 6. Check if ecosystem.config.js is interfering
echo -e "\n6️⃣ PM2 Ecosystem config:"
if [ -f ecosystem.config.js ]; then
    cat ecosystem.config.js
else
    echo "No ecosystem.config.js found"
fi

# 7. Look at package.json scripts
echo -e "\n7️⃣ Package.json scripts:"
cat package.json | grep -A 10 '"scripts"'

# 8. Check the actual error location
echo -e "\n8️⃣ Line 322 content:"
sed -n '320,325p' unified-camera-system.js | cat -n

# 9. Search for duplicate function definitions
echo -e "\n9️⃣ Searching for duplicate 'scheduleDiscovery' definitions:"
grep -n "scheduleDiscovery" unified-camera-system.js

# 10. Check if file is complete
echo -e "\n🔟 File size and line count:"
wc -l unified-camera-system.js
ls -lh unified-camera-system.js

echo -e "\n📋 Diagnosis complete!"
