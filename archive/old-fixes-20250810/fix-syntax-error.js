const fs = require('fs');

console.log('🔧 Fixing syntax error in unified-camera-system.js...\n');

// Read the file
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// The error shows "Unexpected token ')'" at line 160
// This usually means there's an extra closing parenthesis or brace

// Count opening and closing braces/parentheses
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`Braces: { ${openBraces} } ${closeBraces}`);
console.log(`Parentheses: ( ${openParens} ) ${closeParens}`);

// Find lines around 160
const lines = content.split('\n');
console.log('\nLines around 160:');
for (let i = 155; i < 165 && i < lines.length; i++) {
    console.log(`${i}: ${lines[i]}`);
}

// Look for the specific pattern that's causing issues
// The error suggests there's a });^ pattern
if (content.includes('});\n        ^')) {
    console.log('\nFound problematic pattern!');
    content = content.replace(/}\);\n\s*\^/g, '});');
}

// Also check for any lines that just have });
const problematicPattern = /^\s*}\);\s*$/gm;
const matches = content.match(problematicPattern);
if (matches) {
    console.log(`\nFound ${matches.length} instances of standalone });`);
}

// Look for the specific issue around line 160
// Based on the error, it seems there's an issue with the module structure
// Let's check if there's an improperly closed function or class

// Find the UnifiedCameraSystem class and ensure it's properly closed
const classMatch = content.match(/class UnifiedCameraSystem\s*{[\s\S]*?^}/m);
if (!classMatch) {
    console.log('\n⚠️  Class structure might be broken. Attempting to fix...');
    
    // Remove any extra closing braces at the end
    content = content.replace(/}\s*}\s*$/, '}');
    
    // Ensure the file ends properly
    if (!content.trim().endsWith('system.start().catch(console.error);')) {
        console.log('Adding proper ending...');
        content = content.trim() + '\n\n// Start the system\nconst system = new UnifiedCameraSystem();\nsystem.start().catch(console.error);\n';
    }
}

// Write the fixed content back
fs.writeFileSync('unified-camera-system.js', content);

console.log('\n✅ Applied syntax fixes');
console.log('\n📝 If this doesn\'t work, run:');
console.log('   node fix-unified-system.js');
console.log('   (to get a completely fresh version)');
console.log('\n🔄 Then restart:');
console.log('   npx pm2 restart cmv-discovery');
console.log('   npx pm2 logs cmv-discovery --lines 50');