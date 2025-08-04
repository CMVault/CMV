const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔧 Starting database schema fix...\n');

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
const db = new sqlite3.Database(dbPath);

// SQL to rename columns from snake_case to camelCase
const fixes = `
-- First, let's see what columns we have
SELECT sql FROM sqlite_master WHERE type='table' AND name='cameras';

-- Create a new table with correct column names
CREATE TABLE IF NOT EXISTS cameras_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    fullName TEXT,
    slug TEXT UNIQUE,
    category TEXT,
    releaseYear INTEGER,
    discontinued BOOLEAN DEFAULT 0,
    sensorSize TEXT,
    sensorType TEXT,
    sensorMegapixels REAL,
    sensorNotes TEXT,
    isoMin INTEGER,
    isoMax INTEGER,
    shutterSpeedMin TEXT,
    shutterSpeedMax TEXT,
    continuousShooting REAL,
    videoMaxResolution TEXT,
    videoMaxFrameRate INTEGER,
    videoFormats TEXT,
    hdmi BOOLEAN DEFAULT 0,
    headphoneJack BOOLEAN DEFAULT 0,
    microphoneJack BOOLEAN DEFAULT 0,
    wireless TEXT,
    gps BOOLEAN DEFAULT 0,
    batteryLife INTEGER,
    batteryType TEXT,
    weatherSealed BOOLEAN DEFAULT 0,
    weight REAL,
    dimensionsWidth REAL,
    dimensionsHeight REAL,
    dimensionsDepth REAL,
    price REAL,
    manualUrl TEXT,
    imageUrl TEXT,
    imageId TEXT,
    thumbUrl TEXT,
    imageAttribution TEXT,
    ibis BOOLEAN DEFAULT 0,
    lensMount TEXT,
    builtInFlash BOOLEAN DEFAULT 0,
    hotShoe BOOLEAN DEFAULT 0,
    viewfinderType TEXT,
    viewfinderCoverage INTEGER,
    viewfinderMagnification REAL,
    dualCardSlots BOOLEAN DEFAULT 0,
    cardSlot1Type TEXT,
    cardSlot2Type TEXT,
    connectivity TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from old table if it exists
INSERT OR IGNORE INTO cameras_new SELECT * FROM cameras WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='cameras');

-- Drop old table and rename new one
DROP TABLE IF EXISTS cameras;
ALTER TABLE cameras_new RENAME TO cameras;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cameras_brand ON cameras(brand);
CREATE INDEX IF NOT EXISTS idx_cameras_slug ON cameras(slug);
CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras(category);
CREATE INDEX IF NOT EXISTS idx_cameras_releaseYear ON cameras(releaseYear);
`;

console.log('📊 Current schema:');
db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='cameras'", (err, row) => {
    if (err) {
        console.error('❌ Error checking schema:', err);
    } else if (row) {
        console.log(row.sql);
    } else {
        console.log('No cameras table found');
    }
    console.log('\n');

    // Run the fixes
    console.log('🔄 Applying schema fixes...');
    db.exec(fixes, (err) => {
        if (err) {
            console.error('❌ Error applying fixes:', err);
            process.exit(1);
        }

        console.log('✅ Schema fixed successfully!\n');

        // Verify the new schema
        db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='cameras'", (err, row) => {
            if (err) {
                console.error('❌ Error verifying schema:', err);
            } else {
                console.log('📊 New schema:');
                console.log(row.sql);
            }

            // Check if we have any data
            db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
                if (err) {
                    console.error('❌ Error counting cameras:', err);
                } else {
                    console.log(`\n📷 Current camera count: ${row.count}`);
                }

                db.close((err) => {
                    if (err) {
                        console.error('❌ Error closing database:', err);
                    } else {
                        console.log('\n✅ Database connection closed');
                        console.log('\n🎉 Schema fix complete! You can now run the automation.');
                        console.log('👉 Next step: node cmv-automation-with-images.js');
                    }
                });
            });
        });
    });
});