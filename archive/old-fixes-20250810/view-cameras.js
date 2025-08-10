const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data', 'camera-vault.db'));

console.log('='.repeat(70));
console.log('📷 CAMERA VAULT DATABASE VIEWER');
console.log('='.repeat(70));

// View all cameras
db.all('SELECT * FROM cameras_comprehensive', (err, cameras) => {
    if (err) {
        console.error('Error:', err);
        return;
    }
    
    console.log(`\n📊 Total Cameras: ${cameras.length}\n`);
    
    cameras.forEach((camera, index) => {
        console.log(`${index + 1}. ${camera.brand} ${camera.model}`);
        console.log(`   Slug: ${camera.slug}`);
        console.log(`   Category: ${camera.category || 'Not specified'}`);
        console.log(`   Year: ${camera.release_year || 'Unknown'}`);
        console.log(`   Sensor: ${camera.sensor_size || 'Unknown'} - ${camera.megapixels || '?'}MP`);
        console.log(`   Video: ${camera.video_resolution_max || 'Unknown'}`);
        console.log(`   Features: ${[
            camera.has_ibis ? 'IBIS' : '',
            camera.has_wifi ? 'WiFi' : '',
            camera.has_gps ? 'GPS' : '',
            camera.weather_sealed ? 'Weather Sealed' : ''
        ].filter(f => f).join(', ') || 'None specified'}`);
        console.log(`   Price: ${camera.msrp_usd ? `$${camera.msrp_usd}` : 'Unknown'}`);
        console.log('');
    });
    
    // Show database structure
    console.log('='.repeat(70));
    console.log('📊 DATABASE STRUCTURE:');
    console.log('='.repeat(70));
    
    db.all("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') ORDER BY type, name", (err, tables) => {
        if (!err) {
            console.log('\nTables and Views:');
            tables.forEach(t => {
                console.log(`  - ${t.name} (${t.type})`);
            });
        }
        
        // Count fields in comprehensive table
        db.all("PRAGMA table_info(cameras_comprehensive)", (err, columns) => {
            if (!err) {
                console.log(`\n📋 Total fields in cameras_comprehensive: ${columns.length}`);
                console.log('\nSample fields:');
                const categories = {
                    'Basic': ['brand', 'model', 'slug', 'category'],
                    'Sensor': ['sensor_size', 'megapixels', 'sensor_type'],
                    'Video': ['video_resolution_max', 'video_4k', 'video_fps_1080p'],
                    'Features': ['has_ibis', 'has_wifi', 'weather_sealed'],
                    'Advanced': ['af_system', 'battery_life_cipa_shots', 'lens_mount']
                };
                
                for (const [cat, fields] of Object.entries(categories)) {
                    const found = fields.filter(f => columns.some(c => c.name === f));
                    console.log(`  ${cat}: ${found.join(', ')}`);
                }
            }
            
            db.close();
        });
    });
});