const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

function monitor() {
    const db = new sqlite3.Database('./data/camera-vault.db');
    
    console.clear();
    console.log('📊 Camera Manual Vault Monitor');
    console.log('==============================\n');
    
    db.get(`
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
            COUNT(CASE WHEN status = 'rumor' THEN 1 END) as rumors,
            COUNT(CASE WHEN localImagePath IS NOT NULL THEN 1 END) as withImages
        FROM cameras
    `, (err, stats) => {
        if (!err && stats) {
            console.log(`Total Cameras: ${stats.total}`);
            console.log(`Verified: ${stats.verified}`);
            console.log(`Rumors: ${stats.rumors}`);
            console.log(`With Images: ${stats.withImages}`);
            console.log(`Coverage: ${Math.round(stats.withImages / stats.total * 100)}%`);
        }
        db.close();
    });
}

monitor();
setInterval(monitor, 30000);
