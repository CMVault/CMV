const fs = require('fs');

// Read the file
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Remove 'this.' from function calls that shouldn't have it
content = content.replace(/this\.delay\(/g, 'delay(');
content = content.replace(/this\.scheduleDiscovery\(/g, 'scheduleDiscovery(');
content = content.replace(/this\.scheduleBackup\(/g, 'scheduleBackup(');

// Write back
fs.writeFileSync('unified-camera-system.js', content);
console.log('Fixed all this. references');
