const fs = require('fs');

// Read the existing unified-camera-system.js file
const content = fs.readFileSync('unified-camera-system.js', 'utf8');
const lines = content.split('\n');

// Find where imports end
let lastImportLine = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('require(')) {
        lastImportLine = i;
    }
}

// Extract delay function
let delayStart = -1, delayEnd = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function delay(ms)')) {
        delayStart = i;
        delayEnd = i + 3; // It's a 3-line function
        break;
    }
}

// Extract scheduleDiscovery function
let schedStart = -1, schedEnd = -1;
let braceCount = 0;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('function scheduleDiscovery()')) {
        schedStart = i;
        braceCount = 0;
        for (let j = i; j < lines.length; j++) {
            braceCount += (lines[j].match(/{/g) || []).length;
            braceCount -= (lines[j].match(/}/g) || []).length;
            if (braceCount === 0 && j > i) {
                schedEnd = j;
                break;
            }
        }
        break;
    }
}

// Extract the functions
const delayFunc = lines.slice(delayStart, delayEnd + 1).join('\n');
const schedFunc = lines.slice(schedStart, schedEnd + 1).join('\n');

// Remove them from their current positions
const newLines = [];
for (let i = 0; i < lines.length; i++) {
    if ((i >= delayStart && i <= delayEnd) || (i >= schedStart && i <= schedEnd)) {
        continue;
    }
    newLines.push(lines[i]);
}

// Insert functions after imports
newLines.splice(lastImportLine + 1, 0, '', '// Helper functions', delayFunc, '', schedFunc, '');

// Write back to the SAME file (unified-camera-system.js)
fs.writeFileSync('unified-camera-system.js', newLines.join('\n'));
console.log('✅ Fixed unified-camera-system.js - Functions moved to top!');