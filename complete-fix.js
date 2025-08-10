// complete-fix.js
// Completely fixes the database and server issues

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
console.log('🔧 Complete fix for CMV...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// Step 1: Fix the database schema properly
console.log('📋 Step 1: Fixing database schema...');

db.serialize(() => {
    // First, check what columns exist
    db.all("PRAGMA table_info(cameras)", (err, columns) => {
        if (err) {
            console.error('Error:', err);
            return;
        }
        
        const columnNames = columns.map(col => col.name);
        console.log('Current columns:', columnNames.join(', '));
        
        // Add lastUpdated column if it doesn't exist (without default)
        if (!columnNames.includes('lastUpdated')) {
            db.run("ALTER TABLE cameras ADD COLUMN lastUpdated TEXT", (err) => {
                if (err) {
                    console.log('Note:', err.message);
                } else {
                    console.log('✅ Added lastUpdated column');
                }
                
                // Set values for lastUpdated
                db.run("UPDATE cameras SET lastUpdated = datetime('now') WHERE lastUpdated IS NULL", (err) => {
                    if (err) {
                        console.error('Error setting lastUpdated:', err);
                    } else {
                        console.log('✅ Set lastUpdated values');
                    }
                    fixServerFile();
                });
            });
        } else {
            console.log('✅ lastUpdated column already exists');
            fixServerFile();
        }
    });
});

function fixServerFile() {
    console.log('\n📋 Step 2: Fixing server.js...');
    
    const serverPath = path.join(__dirname, 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Check if the API endpoints exist properly
    if (!serverContent.includes("app.get('/api/cameras'")) {
        console.log('❌ API endpoint missing, adding it...');
        
        // Find where to insert (before static files)
        const insertPoint = serverContent.indexOf('// Serve static files') || 
                           serverContent.indexOf('app.use(express.static');
        
        const apiCode = `
// API Routes
app.get('/api/cameras', async (req, res) => {
    try {
        // Simple query that works
        db.all('SELECT * FROM cameras ORDER BY id DESC', (err, cameras) => {
            if (err) {
                console.error('Database error:', err);
                res.status(500).json({ error: 'Failed to fetch cameras' });
            } else {
                res.json(cameras || []);
            }
        });
    } catch (error) {
        console.error('Error in /api/cameras:', error);
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});

app.get('/api/stats', async (req, res) => {
    db.get(\`
        SELECT 
            COUNT(*) as total_cameras,
            COUNT(DISTINCT brand) as total_brands,
            COUNT(manual_url) as manuals_available
        FROM cameras
    \`, (err, stats) => {
        if (err) {
            console.error('Stats error:', err);
            res.json({ total_cameras: 0, total_brands: 0, manuals_available: 0 });
        } else {
            res.json(stats || { total_cameras: 0, total_brands: 0, manuals_available: 0 });
        }
    });
});

`;
        
        if (insertPoint > 0) {
            serverContent = serverContent.slice(0, insertPoint) + apiCode + serverContent.slice(insertPoint);
        } else {
            // Add before the last app.listen or at the end
            const listenPoint = serverContent.lastIndexOf('app.listen');
            if (listenPoint > 0) {
                serverContent = serverContent.slice(0, listenPoint) + apiCode + '\n' + serverContent.slice(listenPoint);
            }
        }
        
        fs.writeFileSync(serverPath, serverContent);
        console.log('✅ Added API endpoints');
    } else {
        console.log('✅ API endpoint exists');
        
        // Fix the problematic query
        serverContent = serverContent.replace(
            /ORDER BY lastUpdated DESC/g,
            'ORDER BY id DESC'
        );
        
        // Also fix any async/await issues with direct callbacks
        serverContent = serverContent.replace(
            /await dbAll\(['"]SELECT \* FROM cameras/g,
            "db.all('SELECT * FROM cameras"
        );
        
        fs.writeFileSync(serverPath, serverContent);
        console.log('✅ Fixed query issues');
    }
    
    testEverything();
}

function testEverything() {
    console.log('\n📋 Step 3: Testing database...');
    
    // Test the database directly
    db.all('SELECT brand, model, id FROM cameras', (err, rows) => {
        if (err) {
            console.error('❌ Database test failed:', err);
        } else {
            console.log(`✅ Database test passed: ${rows.length} cameras found`);
            if (rows.length > 0) {
                console.log('Cameras in database:');
                rows.forEach(cam => {
                    console.log(`  - ${cam.brand} ${cam.model} (ID: ${cam.id})`);
                });
            }
        }
        
        // Make sure we have cameras, if not add them
        if (!rows || rows.length === 0) {
            console.log('\n📝 Adding cameras to empty database...');
            addCameras();
        } else {
            finishUp();
        }
    });
}

function addCameras() {
    const cameras = [
        ['Canon', 'EOS R5', 'canon-eos-r5', 'Canon EOS R5', 2020, 'mirrorless', 'Full Frame', 45, '8K', 3899],
        ['Canon', 'EOS R6 Mark II', 'canon-eos-r6-mark-ii', 'Canon EOS R6 Mark II', 2022, 'mirrorless', 'Full Frame', 24, '4K', 2499],
        ['Nikon', 'Z9', 'nikon-z9', 'Nikon Z9', 2021, 'mirrorless', 'Full Frame', 45.7, '8K', 5496],
        ['Nikon', 'Z8', 'nikon-z8', 'Nikon Z8', 2023, 'mirrorless', 'Full Frame', 45.7, '8K', 3996],
        ['Sony', 'A7R V', 'sony-a7r-v', 'Sony A7R V', 2022, 'mirrorless', 'Full Frame', 61, '8K', 3898],
        ['Sony', 'A7 IV', 'sony-a7-iv', 'Sony A7 IV', 2021, 'mirrorless', 'Full Frame', 33, '4K', 2498]
    ];
    
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO cameras 
        (brand, model, slug, full_name, release_year, category, sensor_size, megapixels, max_video_resolution, price_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    cameras.forEach(camera => {
        stmt.run(...camera);
    });
    
    stmt.finalize(() => {
        console.log('✅ Added all cameras');
        finishUp();
    });
}

function finishUp() {
    db.close();
    
    console.log('\n✅ Fix complete!');
    console.log('\n📋 Final steps:');
    console.log('1. Restart server: npx pm2 restart cmv-server');
    console.log('2. Wait 3 seconds, then test:');
    console.log('   curl http://localhost:3001/api/cameras');
    console.log('3. Visit: http://localhost:3001/cameras');
    console.log('\nIf it still shows "Failed to fetch cameras", check:');
    console.log('   npx pm2 logs cmv-server --lines 20');
}