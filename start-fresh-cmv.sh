#!/bin/bash

# FRESH CMV START SCRIPT
# Start with clean database and proper automation

echo "================================================"
echo "   CAMERA VAULT - FRESH START"
echo "   Starting clean with working components"
echo "================================================"

# Step 1: Backup current database (just in case)
echo ""
echo "📦 Backing up current database..."
mkdir -p data/db-backups
cp data/camera-vault.db "data/db-backups/camera-vault-$(date +%Y%m%d-%H%M%S).db" 2>/dev/null

# Step 2: Export existing cameras to JSON
echo "💾 Exporting existing cameras..."
sqlite3 data/camera-vault.db <<EOF
.mode json
.once data/cameras-export-$(date +%Y%m%d).json
SELECT * FROM cameras;
EOF

# Step 3: Create fresh database with simple schema
echo "🔨 Creating fresh database..."
mv data/camera-vault.db data/camera-vault-old.db 2>/dev/null

# Create new database with working schema
sqlite3 data/camera-vault.db <<'EOF'
-- Simple working camera table (start small, expand later)
CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    slug TEXT UNIQUE,
    full_name TEXT,
    release_year INTEGER,
    category TEXT DEFAULT 'mirrorless',
    sensor_size TEXT,
    megapixels REAL,
    max_video_resolution TEXT,
    image_url TEXT,
    image_local_path TEXT,
    manual_url TEXT,
    description TEXT,
    price_usd REAL,
    is_discontinued BOOLEAN DEFAULT 0,
    popularity_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Image cache table
CREATE TABLE IF NOT EXISTS image_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id INTEGER,
    url TEXT,
    local_path TEXT,
    attribution TEXT,
    source_domain TEXT,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
);

-- Automation log
CREATE TABLE IF NOT EXISTS automation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    status TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_cameras_brand ON cameras(brand);
CREATE INDEX idx_cameras_slug ON cameras(slug);
CREATE INDEX idx_cameras_year ON cameras(release_year);
EOF

echo "✅ Database created successfully!"

# Step 4: Re-import the 6 existing cameras
echo "📥 Re-importing existing cameras..."
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/camera-vault.db');

const cameras = [
    {
        brand: 'Canon',
        model: 'EOS R5',
        slug: 'canon-eos-r5',
        full_name: 'Canon EOS R5',
        release_year: 2020,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 45,
        max_video_resolution: '8K',
        price_usd: 3899
    },
    {
        brand: 'Canon',
        model: 'EOS R6 Mark II',
        slug: 'canon-eos-r6-mark-ii',
        full_name: 'Canon EOS R6 Mark II',
        release_year: 2022,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 24,
        max_video_resolution: '4K',
        price_usd: 2499
    },
    {
        brand: 'Nikon',
        model: 'Z9',
        slug: 'nikon-z9',
        full_name: 'Nikon Z9',
        release_year: 2021,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 45.7,
        max_video_resolution: '8K',
        price_usd: 5496
    },
    {
        brand: 'Nikon',
        model: 'Z8',
        slug: 'nikon-z8',
        full_name: 'Nikon Z8',
        release_year: 2023,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 45.7,
        max_video_resolution: '8K',
        price_usd: 3996
    },
    {
        brand: 'Sony',
        model: 'A7R V',
        slug: 'sony-a7r-v',
        full_name: 'Sony A7R V',
        release_year: 2022,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 61,
        max_video_resolution: '8K',
        price_usd: 3898
    },
    {
        brand: 'Sony',
        model: 'A7 IV',
        slug: 'sony-a7-iv',
        full_name: 'Sony A7 IV',
        release_year: 2021,
        category: 'mirrorless',
        sensor_size: 'Full Frame',
        megapixels: 33,
        max_video_resolution: '4K',
        price_usd: 2498
    }
];

cameras.forEach(camera => {
    const stmt = db.prepare(\`
        INSERT INTO cameras (brand, model, slug, full_name, release_year, category, 
                           sensor_size, megapixels, max_video_resolution, price_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`);
    
    stmt.run(
        camera.brand, camera.model, camera.slug, camera.full_name,
        camera.release_year, camera.category, camera.sensor_size,
        camera.megapixels, camera.max_video_resolution, camera.price_usd
    );
    
    stmt.finalize();
});

db.close(() => {
    console.log('✅ Cameras imported successfully!');
});
"

# Step 5: Check PM2 and stop old processes
echo ""
echo "🔄 Checking PM2 processes..."
npx pm2 list
npx pm2 delete all 2>/dev/null

# Step 6: Start services
echo ""
echo "🚀 Starting CMV services..."
echo ""

# Start server
npx pm2 start server.js --name "cmv-server" --watch false

# Start automation (discovery system)
npx pm2 start unified-camera-system.js --name "cmv-automation" --watch false

# Save PM2 configuration
npx pm2 save

echo ""
echo "================================================"
echo "   FRESH START COMPLETE!"
echo "================================================"
echo ""
echo "✅ Services running:"
npx pm2 list
echo ""
echo "📊 Database status:"
sqlite3 data/camera-vault.db "SELECT COUNT(*) as count FROM cameras;"
echo ""
echo "🌐 Access your site at: http://localhost:3000"
echo ""
echo "📝 Next steps:"
echo "1. Run './cleanup-cmv.sh' to archive old files"
echo "2. Test the site at http://localhost:3000"
echo "3. Monitor automation: npx pm2 logs cmv-automation"
echo "4. Check server logs: npx pm2 logs cmv-server"
echo ""
