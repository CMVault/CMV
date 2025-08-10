const fs = require('fs');

// Read the file
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Add scheduleBackup function definition after the other helper functions
const scheduleBackupFunc = `
function scheduleBackup() {
    console.log('📅 Scheduling daily backup at 3 AM');
    // This will be implemented later
}
`;

// Find where to insert (after scheduleDiscovery function)
const lines = content.split('\n');
let insertIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function scheduleDiscovery()')) {
        // Find the end of this function
        let braceCount = 0;
        for (let j = i; j < lines.length; j++) {
            braceCount += (lines[j].match(/{/g) || []).length;
            braceCount -= (lines[j].match(/}/g) || []).length;
            if (braceCount === 0 && j > i) {
                insertIndex = j + 1;
                break;
            }
        }
        break;
    }
}

if (insertIndex > 0) {
    lines.splice(insertIndex, 0, scheduleBackupFunc);
}

// Join back and remove all this. references
content = lines.join('\n');
content = content.replace(/this\.scheduleBackup\(/g, 'scheduleBackup(');

// Write back
fs.writeFileSync('unified-camera-system.js', content);
console.log('Added scheduleBackup function and fixed references');
