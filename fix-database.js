const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function fixDatabase() {
    console.log('🔧 Fixing SQLite database...\n');
    
    const dbDir = path.join(__dirname, 'data');
    const dbPath = path.join(dbDir, 'camera-vault.db');
    
    try {
        // 1. Delete the corrupted database file
        if (fs.existsSync(dbPath)) {
            console.log('📁 Removing corrupted database file...');
            fs.unlinkSync(dbPath);
            console.log('✅ Corrupted file removed');
        }
        
        // 2. Ensure data directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            console.log('✅ Created data directory');
        }
        
        // 3. Create new database with proper schema
        console.log('\n📊 Creating fresh database...');
        const db = new sqlite3.Database(dbPath);
        
        db.serialize(() => {
            // Create cameras table
            db.run(`
                CREATE TABLE IF NOT EXISTS cameras (
                    id TEXT PRIMARY KEY,
                    brand TEXT NOT NULL,
                    model TEXT NOT NULL,
                    fullName TEXT,
                    category TEXT,
                    releaseYear INTEGER,
                    price REAL,
                    imageUrl TEXT,
                    localImagePath TEXT,
                    imageVerified BOOLEAN DEFAULT 0,
                    imageLastChecked DATETIME,
                    manualUrl TEXT,
                    specs TEXT,
                    features TEXT,
                    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating cameras table:', err);
                else console.log('✅ Created cameras table');
            });
            
            // Create image_cache table
            db.run(`
                CREATE TABLE IF NOT EXISTS image_cache (
                    url TEXT PRIMARY KEY,
                    localPath TEXT,
                    contentType TEXT,
                    size INTEGER,
                    cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    lastAccessed DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) console.error('Error creating image_cache table:', err);
                else console.log('✅ Created image_cache table');
            });
            
            // Create indexes
            db.run('CREATE INDEX IF NOT EXISTS idx_cameras_brand ON cameras(brand)');
            db.run('CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras(category)');
            
            // Insert sample data
            console.log('\n📷 Adding sample cameras...');
            
            const sampleCameras = [
                {
                    id: 'canon-r5',
                    brand: 'Canon',
                    model: 'EOS R5',
                    fullName: 'Canon EOS R5',
                    category: 'mirrorless',
                    releaseYear: 2020,
                    price: 3899,
                    imageUrl: 'https://www.usa.canon.com/internet/wcm/connect/us/51e5e3c8-4ae4-42e0-b7f4-8a04e6d4b821/eos-r5-rf24-105mm-f4-l-is-usm-3q-handler.jpg?MOD=AJPERES&CACHEID=ROOTWORKSPACE.Z18_P1KGHJ01L85180AUEPQQJ53034-51e5e3c8-4ae4-42e0-b7f4-8a04e6d4b821-nYcJxSt',
                    manualUrl: 'https://www.usa.canon.com/support/p/eos-r5',
                    specs: { sensor: 'Full Frame CMOS', megapixels: '45MP', video: '8K 30fps' },
                    features: ['Dual Card Slots', 'Weather Sealed', 'WiFi & Bluetooth', '8K Video', 'IBIS']
                },
                {
                    id: 'sony-a7iv',
                    brand: 'Sony',
                    model: 'α7 IV',
                    fullName: 'Sony α7 IV',
                    category: 'mirrorless',
                    releaseYear: 2021,
                    price: 2498,
                    imageUrl: 'https://www.sony.com/image/5021346f2b11868ad66b1c9e23fb7ce8?fmt=png-alpha&wid=440',
                    manualUrl: 'https://www.sony.com/electronics/support/e-mount-body-ilce-7-series/ilce-7m4',
                    specs: { sensor: 'Full Frame CMOS', megapixels: '33MP', video: '4K 60fps' },
                    features: ['Real-time Eye AF', 'Weather Sealed', '10fps Burst', 'IBIS', 'Dual Card Slots']
                },
                {
                    id: 'nikon-z9',
                    brand: 'Nikon',
                    model: 'Z 9',
                    fullName: 'Nikon Z 9',
                    category: 'mirrorless',
                    releaseYear: 2021,
                    price: 5496,
                    imageUrl: 'https://www.nikonusa.com/images/Z-9/Z-9_angle1.png',
                    manualUrl: 'https://www.nikonusa.com/en/nikon-products/product/mirrorless-cameras/z-9.html',
                    specs: { sensor: 'Full Frame Stacked CMOS', megapixels: '45.7MP', video: '8K 30fps' },
                    features: ['No Mechanical Shutter', '120fps Burst', 'ProRes RAW', '8K Video', 'Dual CFexpress']
                },
                {
                    id: 'fuji-xh2s',
                    brand: 'Fujifilm',
                    model: 'X-H2S',
                    fullName: 'Fujifilm X-H2S',
                    category: 'mirrorless',
                    releaseYear: 2022,
                    price: 2499,
                    imageUrl: 'https://fujifilm-x.com/wp-content/uploads/2022/05/x-h2s_index_thum_01.jpg',
                    manualUrl: 'https://fujifilm-x.com/global/products/cameras/x-h2s/',
                    specs: { sensor: 'APS-C X-Trans CMOS 5 HS', megapixels: '26.1MP', video: '6.2K 30fps' },
                    features: ['40fps Burst', 'F-Log2', 'ProRes Recording', 'IBIS', 'Weather Resistant']
                },
                {
                    id: 'canon-r3',
                    brand: 'Canon',
                    model: 'EOS R3',
                    fullName: 'Canon EOS R3',
                    category: 'mirrorless',
                    releaseYear: 2021,
                    price: 5999,
                    imageUrl: 'https://www.usa.canon.com/internet/wcm/connect/us/e6e48289-f0e8-4b7f-a84c-2f0c6b5a4bc2/eos-r3-rf24-70mm-f28l-is-usm-3q-handler.jpg?MOD=AJPERES&CACHEID=ROOTWORKSPACE.Z18_P1KGHJ01L85180AUEPQQJ53034-e6e48289-f0e8-4b7f-a84c-2f0c6b5a4bc2-o3-3xfM',
                    manualUrl: 'https://www.usa.canon.com/support/p/eos-r3',
                    specs: { sensor: 'Full Frame Stacked BSI CMOS', megapixels: '24.1MP', video: '6K 60fps RAW' },
                    features: ['Eye Control AF', '30fps Burst', 'Weather Sealed', 'Dual Card Slots', 'Built-in Grip']
                },
                {
                    id: 'panasonic-gh6',
                    brand: 'Panasonic',
                    model: 'LUMIX GH6',
                    fullName: 'Panasonic LUMIX GH6',
                    category: 'mirrorless',
                    releaseYear: 2022,
                    price: 2197,
                    imageUrl: 'https://www.panasonic.com/content/dam/pim/mi/en/DC/DC-GH6/DC-GH6L/ast-1395790.png',
                    manualUrl: 'https://www.panasonic.com/global/consumer/lumix/gh6.html',
                    specs: { sensor: 'Micro Four Thirds', megapixels: '25.2MP', video: '5.7K 60fps' },
                    features: ['ProRes Internal', 'Unlimited Recording', 'Dual Native ISO', 'IBIS', 'CFexpress']
                }
            ];
            
            const stmt = db.prepare(
                `INSERT OR IGNORE INTO cameras (id, brand, model, fullName, category, releaseYear, price, imageUrl, manualUrl, specs, features) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            
            sampleCameras.forEach((camera, index) => {
                stmt.run(
                    camera.id,
                    camera.brand,
                    camera.model,
                    camera.fullName,
                    camera.category,
                    camera.releaseYear,
                    camera.price,
                    camera.imageUrl,
                    camera.manualUrl,
                    JSON.stringify(camera.specs),
                    JSON.stringify(camera.features),
                    (err) => {
                        if (err) console.error(`Error inserting ${camera.model}:`, err);
                        else console.log(`✅ Added ${camera.fullName}`);
                    }
                );
            });
            
            stmt.finalize(() => {
                // Verify data was inserted
                db.get('SELECT COUNT(*) as count FROM cameras', (err, result) => {
                    if (err) {
                        console.error('Error counting cameras:', err);
                    } else {
                        console.log(`\n📊 Database now contains ${result.count} cameras`);
                    }
                    
                    db.close(() => {
                        console.log('\n✨ Database fixed successfully!');
                        console.log('🚀 You can now restart your server with: npm start');
                    });
                });
            });
        });
        
    } catch (error) {
        console.error('❌ Error fixing database:', error);
    }
}

// Run the fix
fixDatabase();
