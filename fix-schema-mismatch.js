// fix-schema-mismatch.js
// Fixes the lastUpdated vs updated_at column name issue

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
console.log('🔧 Fixing database schema mismatch...\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
    console.log('✅ Connected to database');
});

// First, check current schema
db.all("PRAGMA table_info(cameras)", (err, columns) => {
    if (err) {
        console.error('❌ Error checking schema:', err);
        process.exit(1);
    }
    
    console.log('📋 Current columns:');
    const columnNames = columns.map(col => col.name);
    columnNames.forEach(name => console.log(`  - ${name}`));
    
    const hasLastUpdated = columnNames.includes('lastUpdated');
    const hasUpdatedAt = columnNames.includes('updated_at');
    
    console.log(`\n📊 Status:`);
    console.log(`  - Has 'lastUpdated': ${hasLastUpdated}`);
    console.log(`  - Has 'updated_at': ${hasUpdatedAt}`);
    
    if (!hasLastUpdated && hasUpdatedAt) {
        console.log('\n✅ Schema looks correct, adding alias column for compatibility...');
        
        // Add lastUpdated column that mirrors updated_at
        db.run(`ALTER TABLE cameras ADD COLUMN lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error('❌ Error adding column:', err);
            } else {
                console.log('✅ Added lastUpdated column');
                
                // Copy data from updated_at to lastUpdated
                db.run(`UPDATE cameras SET lastUpdated = updated_at`, (err) => {
                    if (err) {
                        console.error('❌ Error copying data:', err);
                    } else {
                        console.log('✅ Synced lastUpdated with updated_at');
                        testQueries();
                    }
                });
            }
        });
    } else if (hasLastUpdated && !hasUpdatedAt) {
        console.log('\n⚠️ Has lastUpdated but not updated_at, adding updated_at...');
        
        db.run(`ALTER TABLE cameras ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error('❌ Error adding column:', err);
            } else {
                console.log('✅ Added updated_at column');
                
                // Copy data from lastUpdated to updated_at
                db.run(`UPDATE cameras SET updated_at = lastUpdated`, (err) => {
                    if (err) {
                        console.error('❌ Error copying data:', err);
                    } else {
                        console.log('✅ Synced updated_at with lastUpdated');
                        testQueries();
                    }
                });
            }
        });
    } else if (hasLastUpdated && hasUpdatedAt) {
        console.log('\n✅ Both columns exist, testing queries...');
        testQueries();
    } else {
        console.log('\n⚠️ Neither column exists, adding both...');
        
        db.serialize(() => {
            db.run(`ALTER TABLE cameras ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Warning:', err.message);
                }
            });
            
            db.run(`ALTER TABLE cameras ADD COLUMN lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Warning:', err.message);
                }
                console.log('✅ Added timestamp columns');
                testQueries();
            });
        });
    }
});

function testQueries() {
    console.log('\n🧪 Testing queries...');
    
    // Test the problematic query
    db.all('SELECT * FROM cameras WHERE 1=1 ORDER BY lastUpdated DESC LIMIT 50 OFFSET 0', (err, rows) => {
        if (err) {
            console.error('❌ Query with lastUpdated failed:', err.message);
            console.log('🔧 Trying alternative fix...');
            
            // Try creating a view as a workaround
            db.run(`CREATE VIEW IF NOT EXISTS cameras_view AS 
                    SELECT *, updated_at as lastUpdated FROM cameras`, (err) => {
                if (err) {
                    console.error('❌ Could not create view:', err);
                } else {
                    console.log('✅ Created compatibility view');
                }
                fixServerFile();
            });
        } else {
            console.log(`✅ Query successful! Found ${rows.length} cameras`);
            fixServerFile();
        }
    });
}

function fixServerFile() {
    console.log('\n🔧 Patching server.js to use correct column name...');
    
    const fs = require('fs');
    const serverPath = path.join(__dirname, 'server.js');
    
    try {
        let serverContent = fs.readFileSync(serverPath, 'utf8');
        
        // Replace lastUpdated with updated_at in queries
        const originalContent = serverContent;
        serverContent = serverContent.replace(/ORDER BY lastUpdated/g, 'ORDER BY updated_at');
        serverContent = serverContent.replace(/ORDER BY\s+lastUpdated/g, 'ORDER BY updated_at');
        
        if (originalContent !== serverContent) {
            fs.writeFileSync(serverPath, serverContent);
            console.log('✅ Patched server.js to use updated_at');
        } else {
            console.log('ℹ️ No changes needed in server.js');
        }
        
        console.log('\n✅ Fix complete!');
        console.log('\n📋 Next steps:');
        console.log('1. Restart the server: npx pm2 restart cmv-server');
        console.log('2. Test the API: curl http://localhost:3001/api/cameras');
        console.log('3. Visit: http://localhost:3001/cameras');
        
        db.close();
    } catch (error) {
        console.error('❌ Error patching server.js:', error);
        db.close();
    }
}