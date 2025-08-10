// Save this as disable-auto-automation.js
// This script will comment out the automation in server.js

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');

console.log('🔧 Disabling automatic automation in server.js...\n');

// Read the server.js file
fs.readFile(serverPath, 'utf8', (err, data) => {
    if (err) {
        console.error('❌ Error reading server.js:', err);
        return;
    }

    // Look for automation-related code and comment it out
    let modified = data;
    
    // Pattern 1: Direct automation require
    modified = modified.replace(
        /^(\s*)(const\s+.*?=\s*require\s*\(\s*['"]\.\/cmv-automation.*?['"])/gm,
        '$1// $2 // DISABLED - Run automation separately'
    );
    
    // Pattern 2: Automation initialization
    modified = modified.replace(
        /^(\s*)(.*?CMVAutomation.*?)/gm,
        '$1// $2 // DISABLED - Run automation separately'
    );
    
    // Pattern 3: Running automation
    modified = modified.replace(
        /^(\s*)(automation\.(run|start|initialize).*?)/gm,
        '$1// $2 // DISABLED - Run automation separately'
    );
    
    // Pattern 4: Scraping initialization in server startup
    modified = modified.replace(
        /console\.log\('🚀 Initializing CMV Automation System\.\.\.'\);/g,
        '// console.log(\'🚀 Initializing CMV Automation System...\'); // DISABLED'
    );
    
    modified = modified.replace(
        /console\.log\('🏃 Running initial camera scraping\.\.\.'\);/g,
        '// console.log(\'🏃 Running initial camera scraping...\'); // DISABLED'
    );
    
    // Save backup
    const backupPath = path.join(__dirname, 'server.js.backup');
    fs.writeFileSync(backupPath, data);
    console.log(`✅ Backup saved as server.js.backup`);
    
    // Save modified file
    fs.writeFile(serverPath, modified, (err) => {
        if (err) {
            console.error('❌ Error writing server.js:', err);
            return;
        }
        
        console.log('✅ Automation disabled in server.js\n');
        console.log('📝 What changed:');
        console.log('   - Commented out automation imports');
        console.log('   - Disabled automatic scraping on startup');
        console.log('   - Server will now run without automation\n');
        console.log('🚀 Next steps:');
        console.log('   1. Run: node server.js');
        console.log('   2. Visit: http://localhost:3000');
        console.log('   3. Run automation separately when needed: node cmv-automation-fixed.js\n');
    });
});