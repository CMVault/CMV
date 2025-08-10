// automated-cmv-fix.js
// Fully automated fix for Camera Manual Vault syntax errors

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🤖 Automated CMV Fix Script');
console.log('===========================\n');

// Step 1: Find and restore the backup
console.log('📁 Step 1: Looking for backup file...');
const backupFiles = fs.readdirSync('.').filter(f => f.startsWith('unified-camera-system.js.backup-'));
if (backupFiles.length === 0) {
    console.error('❌ No backup files found!');
    process.exit(1);
}

// Use the most recent backup
const latestBackup = backupFiles.sort().pop();
console.log(`✅ Found backup: ${latestBackup}`);

// Restore it
console.log('📂 Step 2: Restoring from backup...');
fs.copyFileSync(latestBackup, 'unified-camera-system.js');
console.log('✅ Restored original file\n');

// Step 2: Read the file
console.log('📝 Step 3: Fixing syntax errors...');
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Fix the three specific functions that need 'function' keyword
// Using exact line replacements to be safe

// Fix line 322: scheduleDiscovery
content = content.split('\n').map((line, index) => {
    if (index === 321 && line.trim() === 'scheduleDiscovery() {') {
        console.log(`  ✅ Fixed line 322: scheduleDiscovery()`);
        return line.replace('scheduleDiscovery() {', 'function scheduleDiscovery() {');
    }
    return line;
}).join('\n');

// Fix line 335: scheduleBackup
content = content.split('\n').map((line, index) => {
    if (index === 334 && line.trim() === 'scheduleBackup() {') {
        console.log(`  ✅ Fixed line 335: scheduleBackup()`);
        return line.replace('scheduleBackup() {', 'function scheduleBackup() {');
    }
    return line;
}).join('\n');

// Fix line 358: cleanOldBackups
content = content.split('\n').map((line, index) => {
    if (index === 357 && line.trim() === 'cleanOldBackups() {') {
        console.log(`  ✅ Fixed line 358: cleanOldBackups()`);
        return line.replace('cleanOldBackups() {', 'function cleanOldBackups() {');
    }
    return line;
}).join('\n');

// Write the fixed content
fs.writeFileSync('unified-camera-system.js', content);
console.log('\n✅ All fixes applied!\n');

// Step 3: Test syntax
console.log('🧪 Step 4: Testing syntax...');
try {
    execSync('node -c unified-camera-system.js', { stdio: 'pipe' });
    console.log('✅ Syntax is valid!\n');
} catch (error) {
    console.error('❌ Syntax test failed!');
    console.error(error.message);
    process.exit(1);
}

// Step 4: Check PM2 status
console.log('🔍 Step 5: Checking PM2 status...');
try {
    const pm2List = execSync('npx pm2 list', { encoding: 'utf8' });
    const hasDiscovery = pm2List.includes('cmv-discovery');
    
    if (hasDiscovery) {
        console.log('✅ Found cmv-discovery process');
        
        // Restart it
        console.log('\n♻️  Step 6: Restarting discovery process...');
        execSync('npx pm2 restart cmv-discovery', { stdio: 'inherit' });
        console.log('✅ Process restarted');
    } else {
        console.log('🆕 No existing process found');
        
        // Start it fresh
        console.log('\n🚀 Step 6: Starting discovery process...');
        execSync('npx pm2 start unified-camera-system.js --name cmv-discovery', { stdio: 'inherit' });
        console.log('✅ Process started');
    }
} catch (error) {
    console.error('❌ PM2 error:', error.message);
    process.exit(1);
}

// Step 5: Wait and check status
console.log('\n⏳ Step 7: Waiting for process to stabilize...');
setTimeout(() => {
    try {
        // Check PM2 status
        console.log('\n📊 Final Status Check:');
        execSync('npx pm2 list', { stdio: 'inherit' });
        
        // Check database
        console.log('\n📈 Database Status:');
        try {
            const count = execSync('sqlite3 data/camera-vault.db "SELECT COUNT(*) FROM cameras;"', { encoding: 'utf8' }).trim();
            console.log(`  Total cameras: ${count}`);
        } catch (e) {
            console.log('  Could not check database');
        }
        
        // Show recent logs
        console.log('\n📜 Recent Logs:');
        execSync('npx pm2 logs cmv-discovery --lines 20 --nostream', { stdio: 'inherit' });
        
        console.log('\n✅ ✅ ✅ AUTOMATION COMPLETE! ✅ ✅ ✅');
        console.log('\n📋 Your discovery system should now be running!');
        console.log('   - Check status: npx pm2 list');
        console.log('   - View logs: npx pm2 logs cmv-discovery');
        console.log('   - Stop: npx pm2 stop cmv-discovery');
        
    } catch (error) {
        console.error('❌ Final check error:', error.message);
    }
}, 3000);
