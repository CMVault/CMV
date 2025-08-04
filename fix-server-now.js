// Save this as fix-server-now.js
const fs = require('fs');

console.log('🔧 Fixing server.js to disable automation...\n');

// Read server.js
const serverContent = fs.readFileSync('server.js', 'utf8');

// Create backup
fs.writeFileSync('server.js.backup', serverContent);
console.log('✅ Backup created: server.js.backup');

// Replace problematic lines
let fixed = serverContent;

// Comment out any automation initialization
fixed = fixed.replace(/console\.log\(['"'].*?Initializing CMV Automation.*?['"']\);?/g, 
    '// $& // DISABLED - Run automation separately');

fixed = fixed.replace(/console\.log\(['"'].*?Running initial camera scraping.*?['"']\);?/g, 
    '// $& // DISABLED - Run automation separately');

// Comment out the actual automation code
// This regex looks for common automation patterns
fixed = fixed.replace(/(const.*?=.*?require.*?cmv-automation.*?);/gi, 
    '// $1 // DISABLED');

fixed = fixed.replace(/(.*?new.*?CMVAutomation.*?);/gi, 
    '// $1 // DISABLED');

fixed = fixed.replace(/(.*?automation\.(run|start|initialize).*?);/gi, 
    '// $1 // DISABLED');

fixed = fixed.replace(/(.*?scrapeAllCameras.*?);/gi, 
    '// $1 // DISABLED');

fixed = fixed.replace(/(.*?startAutomation.*?);/gi, 
    '// $1 // DISABLED');

// Look for automation in startup code
fixed = fixed.replace(/(.*?Running initial camera scraping.*?)/g,
    '// $1 // DISABLED');

// Write fixed file
fs.writeFileSync('server.js', fixed);

console.log('\n✅ Server.js has been fixed!');
console.log('\n🔍 Changes made:');
console.log('   - Commented out automation imports');
console.log('   - Disabled automation initialization');
console.log('   - Disabled automatic scraping\n');
console.log('📝 Original file backed up as: server.js.backup\n');
console.log('🚀 Now run: node server.js');
console.log('   The server should start WITHOUT automation!\n');