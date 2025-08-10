#!/bin/bash

# undo-and-fix.sh - Undo the comment and fix properly

echo "🔧 Undoing comment and fixing properly"
echo "====================================="

# First, restore from backup
if [ -f unified-camera-system.js.backup-line381 ]; then
    echo "📂 Restoring from backup..."
    cp unified-camera-system.js.backup-line381 unified-camera-system.js
    echo "✅ Restored"
else
    echo "❌ No backup found, trying to uncomment..."
    sed -i '' '381s/^\/\/ //' unified-camera-system.js
    sed -i '' '382s/^\/\/ //' unified-camera-system.js
fi

# Now let's see what's actually at the end of the file
echo -e "\n📋 Last 20 lines of file:"
tail -20 unified-camera-system.js | cat -n

# Check lines 380-385
echo -e "\n📋 Lines 380-385:"
sed -n '380,385p' unified-camera-system.js | cat -n

# The fix: We need to move the instantiation OUTSIDE the class
# Let's create a proper fix
cat > proper-fix.js << 'EOF'
const fs = require('fs');

console.log('Applying proper fix...');

let content = fs.readFileSync('unified-camera-system.js', 'utf8');
let lines = content.split('\n');

// Find where we have the instantiation
let instantiationLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const system = new UnifiedCameraSystem()')) {
        instantiationLine = i;
        console.log(`Found instantiation at line ${i + 1}`);
        break;
    }
}

// Check if this is the last few lines (it should be)
if (instantiationLine >= lines.length - 5) {
    console.log('✅ Instantiation is already at the end - file structure is correct');
    console.log('The error must be something else...');
    
    // Check if we're missing a closing brace
    const openBraces = content.split('{').length - 1;
    const closeBraces = content.split('}').length - 1;
    console.log(`Braces: ${openBraces} open, ${closeBraces} close`);
    
    if (openBraces > closeBraces) {
        console.log('Missing closing brace! Adding...');
        // Add closing brace before the instantiation
        lines.splice(instantiationLine, 0, '}');
        fs.writeFileSync('unified-camera-system.js', lines.join('\n'));
        console.log('✅ Added missing closing brace');
    }
} else {
    console.log('❌ Instantiation is in the wrong place');
    // Move it to the end
    const instantiation = lines[instantiationLine];
    const start = lines[instantiationLine + 1];
    
    // Remove from current location
    lines.splice(instantiationLine, 2);
    
    // Add to end
    lines.push('');
    lines.push(instantiation);
    lines.push(start);
    
    fs.writeFileSync('unified-camera-system.js', lines.join('\n'));
    console.log('✅ Moved instantiation to end of file');
}
EOF

# Run the proper fix
node proper-fix.js

# Test syntax
echo -e "\n🧪 Testing syntax..."
if node -c unified-camera-system.js 2>&1; then
    echo "✅ Syntax is valid!"
    
    # Restart PM2
    echo -e "\n🚀 Restarting..."
    npx pm2 restart cmv-discovery
    
    echo -e "\n✅ Fixed! Monitor with: npx pm2 logs cmv-discovery"
else
    echo "❌ Still has syntax errors"
    echo "Let's check the structure..."
    
    # Show where the class ends and what's after
    echo -e "\n📍 Looking for class end..."
    grep -n "^}" unified-camera-system.js | tail -5
fi

# Cleanup
rm -f proper-fix.js
