const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data/camera-vault.db');

console.log('Fixing database schema...');

db.serialize(() => {
    // Check current columns
    db.all("PRAGMA table_info(cameras)", (err, columns) => {
        if (err) {
            console.error('Error checking columns:', err);
            return;
        }
        
        const columnNames = columns.map(c => c.name);
        console.log('Current columns:', columnNames);
        
        // Add missing columns if they don't exist
        const columnsToAdd = [
            { name: 'price', type: 'REAL', default: 'NULL' },
            { name: 'sensor_size', type: 'TEXT', default: 'NULL' },
            { name: 'megapixels', type: 'REAL', default: 'NULL' },
            { name: 'image_url', type: 'TEXT', default: 'NULL' },
            { name: 'manual_url', type: 'TEXT', default: 'NULL' },
            { name: 'description', type: 'TEXT', default: 'NULL' }
        ];
        
        columnsToAdd.forEach(col => {
            if (!columnNames.includes(col.name)) {
                const sql = `ALTER TABLE cameras ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}`;
                console.log(`Adding column: ${col.name}`);
                db.run(sql, (err) => {
                    if (err) {
                        console.error(`Error adding ${col.name}:`, err);
                    } else {
                        console.log(`✓ Added ${col.name}`);
                    }
                });
            }
        });
        
        // Update sample data with prices
        setTimeout(() => {
            const updates = [
                { model: 'Z9', price: 5496, sensor_size: 'Full Frame', megapixels: 45.7 },
                { model: 'Z8', price: 3996, sensor_size: 'Full Frame', megapixels: 45.7 },
                { model: 'EOS R6 Mark II', price: 2499, sensor_size: 'Full Frame', megapixels: 24.2 },
                { model: 'A7R V', price: 3898, sensor_size: 'Full Frame', megapixels: 61 },
                { model: 'A7 IV', price: 2498, sensor_size: 'Full Frame', megapixels: 33 },
                { model: 'EOS R5', price: 3899, sensor_size: 'Full Frame', megapixels: 45 }
            ];
            
            updates.forEach(update => {
                const sql = `UPDATE cameras SET price = ?, sensor_size = ?, megapixels = ? WHERE model = ?`;
                db.run(sql, [update.price, update.sensor_size, update.megapixels, update.model], (err) => {
                    if (err) {
                        console.error(`Error updating ${update.model}:`, err);
                    } else {
                        console.log(`✓ Updated ${update.model} with price $${update.price}`);
                    }
                });
            });
            
            // Check the results after a moment
            setTimeout(() => {
                db.all("SELECT brand, model, release_year, price FROM cameras", (err, rows) => {
                    if (err) {
                        console.error('Error checking data:', err);
                    } else {
                        console.log('\nFinal camera data:');
                        rows.forEach(row => {
                            console.log(`${row.brand} ${row.model} (${row.release_year}): $${row.price || 'N/A'}`);
                        });
                    }
                    db.close();
                });
            }, 1000);
        }, 1000);
    });
});
