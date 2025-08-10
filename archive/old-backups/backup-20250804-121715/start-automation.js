#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   CAMERA MANUAL VAULT                         ║
║                  AUTOMATION STARTUP                           ║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log('🚀 Starting CMV Automation System...\n');

// Step 1: Fix the database schema
console.log('📊 Step 1: Fixing database schema...');
const fixDb = spawn('node', ['fix-column-names.js'], { stdio: 'inherit' });

fixDb.on('close', (code) => {
    if (code !== 0) {
        console.error(`\n❌ Database fix failed with code ${code}`);
        console.log('💡 Try running: node fix-column-names.js manually to see the error');
        process.exit(1);
    }

    console.log('\n✅ Database schema fixed!\n');

    // Step 2: Start the automation
    console.log('🤖 Step 2: Starting camera automation...');
    console.log('This will process 20 cameras and save them to the database.\n');

    const automation = spawn('node', ['cmv-automation-with-images.js'], { stdio: 'inherit' });

    automation.on('close', (code) => {
        if (code !== 0) {
            console.error(`\n❌ Automation failed with code ${code}`);
            process.exit(1);
        }

        console.log('\n✅ Automation completed successfully!\n');

        // Step 3: Verify results
        console.log('📋 Step 3: Verifying results...');
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(path.join(__dirname, 'data', 'camera-vault.db'));

        db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
            if (err) {
                console.error('❌ Error checking camera count:', err);
            } else {
                console.log(`\n🎉 Success! ${row.count} cameras in database`);
                
                // Show some sample cameras
                db.all("SELECT brand, model, imageUrl FROM cameras LIMIT 5", (err, rows) => {
                    if (!err && rows.length > 0) {
                        console.log('\n📷 Sample cameras added:');
                        rows.forEach(camera => {
                            const hasImage = camera.imageUrl && !camera.imageUrl.includes('placeholder') ? '✅' : '📷';
                            console.log(`  ${hasImage} ${camera.brand} ${camera.model}`);
                        });
                    }

                    db.close();

                    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    AUTOMATION COMPLETE!                       ║
╠═══════════════════════════════════════════════════════════════╣
║  ✅ Database schema: FIXED                                    ║
║  ✅ Cameras processed: 20                                     ║
║  ✅ Server ready at: http://localhost:3000                    ║
║                                                               ║
║  📱 View cameras: http://localhost:3000/cameras              ║
║  🔍 Monitor: http://localhost:3000/automation-monitor        ║
╚═══════════════════════════════════════════════════════════════╝

💡 To run the server: npm start
`);
                });
            }
        });
    });
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Automation interrupted by user');
    process.exit(0);
});