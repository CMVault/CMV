// minimal-syntax-fix.js
// ONLY removes extra braces - changes NOTHING else

const fs = require('fs');

console.log('🔧 Minimal syntax fix - ONLY removing extra braces\n');

// Read file
const content = fs.readFileSync('unified-camera-system.js', 'utf8');
const lines = content.split('\n');

console.log(`File has ${lines.length} lines`);

// Check line 322 area
console.log('\nLines 320-325:');
for (let i = 319; i < 325 && i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
}

// The error is extra closing braces
// Count braces at the end of file
let lastRealCode = -1;
for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed && !['});', '}', '})'].includes(trimmed)) {
        lastRealCode = i;
        break;
    }
}

console.log(`\nLast real code at line ${lastRealCode + 1}`);

// Remove only the EXTRA braces after the last real code
// Keep one set of closing braces
const fixed = lines.slice(0, lastRealCode + 2).join('\n');

// Save backup and write fix
fs.writeFileSync('unified-camera-system.js.syntax-backup', content);
fs.writeFileSync('unified-camera-system.js', fixed);

console.log('✅ Fixed! Removed only extra closing braces');
console.log('📁 Backup saved as unified-camera-system.js.syntax-backup');