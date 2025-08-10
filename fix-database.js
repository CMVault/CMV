const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database('./data/camera-vault.db');

db.serialize(() => {
    // Create table if not exists
    db.run(`
        CREATE TABLE IF NOT EXISTS cameras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            model TEXT NOT NULL,
            slug TEXT UNIQUE,
            release_year INTEGER,
            price REAL,
            sensor_size TEXT,
            megapixels REAL,
            image_url TEXT,
            manual_url TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Check if we have data
    db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
        if (!row || row.count === 0) {
            console.log('Inserting sample cameras...');
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO cameras (brand, model, slug, release_year, price, sensor_size, megapixels)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const cameras = [
                ['Nikon', 'Z9', 'nikon-z9', 2021, 5496, 'Full Frame', 45.7],
                ['Nikon', 'Z8', 'nikon-z8', 2023, 3996, 'Full Frame', 45.7],
                ['Canon', 'EOS R6 Mark II', 'canon-eos-r6-mark-ii', 2022, 2499, 'Full Frame', 24.2],
                ['Sony', 'A7R V', 'sony-a7r-v', 2022, 3898, 'Full Frame', 61],
                ['Sony', 'A7 IV', 'sony-a7-iv', 2021, 2498, 'Full Frame', 33],
                ['Canon', 'EOS R5', 'canon-eos-r5', 2020, 3899, 'Full Frame', 45]
            ];
            
            cameras.forEach(camera => stmt.run(camera));
            stmt.finalize();
            console.log('✓ Sample cameras inserted');
        } else {
            console.log(`✓ Database has ${row.count} cameras`);
        }
        db.close();
    });
});
