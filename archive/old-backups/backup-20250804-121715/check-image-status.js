// check-image-status.js
// Check the current status of camera images in the database

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');

const db = new sqlite3.Database('./data/camera-vault.db');

async function checkImageStatus() {
    console.log('📊 Checking camera image status...\n');
    
    // Get all cameras
    const allCameras = await new Promise((resolve, reject) => {
        db.all(`SELECT id, brand, model, localImagePath, imageUrl FROM cameras ORDER BY brand, model`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    console.log(`Total cameras in database: ${allCameras.length}\n`);
    
    // Categorize cameras
    const stats = {
        total: allCameras.length,
        withLocalPath: 0,
        withPlaceholder: 0,
        withNull: 0,
        withRealImage: 0,
        filesExist: 0,
        filesMissing: 0
    };
    
    console.log('Checking each camera:\n');
    
    for (const camera of allCameras) {
        const status = [];
        
        // Check localImagePath
        if (!camera.localImagePath) {
            stats.withNull++;
            status.push('❌ No path');
        } else {
            stats.withLocalPath++;
            
            if (camera.localImagePath.includes('placeholder')) {
                stats.withPlaceholder++;
                status.push('📦 Placeholder');
            } else {
                stats.withRealImage++;
                status.push('✅ Has path');
            }
            
            // Check if file actually exists
            const filePath = path.join(__dirname, 'public', camera.localImagePath);
            try {
                await fs.access(filePath);
                stats.filesExist++;
                status.push('📁 File exists');
            } catch {
                stats.filesMissing++;
                status.push('⚠️ File missing');
            }
        }
        
        console.log(`${camera.brand} ${camera.model}: ${status.join(', ')}`);
        if (camera.localImagePath) {
            console.log(`  Path: ${camera.localImagePath}`);
        }
    }
    
    console.log('\n📈 Summary:');
    console.log(`Total cameras: ${stats.total}`);
    console.log(`With localImagePath: ${stats.withLocalPath}`);
    console.log(`  - Placeholders: ${stats.withPlaceholder}`);
    console.log(`  - Real paths: ${stats.withRealImage}`);
    console.log(`With NULL path: ${stats.withNull}`);
    console.log(`Files that exist: ${stats.filesExist}`);
    console.log(`Files missing: ${stats.filesMissing}`);
    
    // Show which cameras need updates
    console.log('\n🔧 Cameras needing image updates:');
    const needingUpdates = await new Promise((resolve, reject) => {
        db.all(`
            SELECT brand, model, localImagePath 
            FROM cameras 
            WHERE localImagePath IS NULL 
               OR localImagePath LIKE '%placeholder%'
               OR localImagePath = ''
            LIMIT 10
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    if (needingUpdates.length === 0) {
        console.log('None found! All cameras have image paths.');
    } else {
        needingUpdates.forEach(cam => {
            console.log(`- ${cam.brand} ${cam.model} (path: ${cam.localImagePath || 'NULL'})`);
        });
        if (needingUpdates.length === 10) {
            console.log('... and more');
        }
    }
    
    db.close();
}

checkImageStatus().catch(console.error);
