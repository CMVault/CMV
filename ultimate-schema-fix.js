const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

console.log('🔧 Creating Ultimate Camera Database Schema\n');
console.log('📋 This will include EVERY useful camera specification!\n');

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
const backupPath = path.join(__dirname, 'data', 'camera-vault-backup-' + Date.now() + '.db');

// First, make a backup
console.log('1️⃣ Creating backup of current database...');
try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup created: ${backupPath}\n`);
} catch (err) {
    console.error('❌ Failed to create backup:', err);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Save existing camera data
    console.log('2️⃣ Preserving existing camera data...');
    db.all("SELECT * FROM cameras", (err, existingCameras) => {
        if (err) {
            console.log('⚠️  No existing cameras to preserve');
            existingCameras = [];
        } else {
            console.log(`📊 Found ${existingCameras.length} existing cameras to preserve\n`);
        }

        // Drop old tables
        console.log('3️⃣ Dropping old tables...');
        db.exec(`
            DROP TABLE IF EXISTS cameras;
            DROP TABLE IF EXISTS image_attributions;
            DROP INDEX IF EXISTS idx_cameras_brand;
            DROP INDEX IF EXISTS idx_cameras_slug;
            DROP INDEX IF EXISTS idx_cameras_category;
            DROP INDEX IF EXISTS idx_cameras_releaseYear;
        `, (err) => {
            if (err) {
                console.error('❌ Error dropping tables:', err);
                return;
            }

            console.log('✅ Old tables dropped\n');

            // Create comprehensive schema
            console.log('4️⃣ Creating comprehensive camera schema...');
            const createCamerasTable = `
            CREATE TABLE cameras (
                -- Basic Information
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                fullName TEXT,
                slug TEXT UNIQUE,
                category TEXT, -- mirrorless, dslr, cinema, compact, medium format, film
                subcategory TEXT, -- professional, enthusiast, entry-level
                releaseYear INTEGER,
                releaseDate TEXT,
                discontinued BOOLEAN DEFAULT 0,
                discontinuedDate TEXT,
                successor TEXT, -- model that replaced this one
                predecessor TEXT, -- model this replaced
                
                -- Pricing
                msrp REAL, -- original price
                currentPrice REAL, -- current market price
                usedPrice REAL, -- typical used price
                currency TEXT DEFAULT 'USD',
                
                -- Sensor Specifications
                sensorSize TEXT, -- Full Frame, APS-C, Micro 4/3, etc.
                sensorType TEXT, -- CMOS, CCD, BSI-CMOS, Stacked CMOS
                sensorModel TEXT, -- specific sensor model if known
                sensorMegapixels REAL,
                effectiveMegapixels REAL,
                totalMegapixels REAL,
                sensorWidth REAL, -- mm
                sensorHeight REAL, -- mm
                cropFactor REAL,
                pixelPitch REAL, -- micrometers
                sensorNotes TEXT,
                
                -- ISO Performance
                isoMin INTEGER,
                isoMax INTEGER,
                isoExpandedMin INTEGER,
                isoExpandedMax INTEGER,
                
                -- Shutter
                shutterSpeedMin TEXT, -- e.g., "30s"
                shutterSpeedMax TEXT, -- e.g., "1/8000s"
                shutterType TEXT, -- mechanical, electronic, hybrid
                flashSyncSpeed TEXT, -- e.g., "1/250s"
                
                -- Autofocus System
                afSystem TEXT, -- Phase Detection, Contrast, Hybrid
                afPoints INTEGER,
                afCrossType INTEGER,
                afCoverage INTEGER, -- percentage
                afSensitivity TEXT, -- e.g., "-6 EV"
                eyeAF BOOLEAN DEFAULT 0,
                animalAF BOOLEAN DEFAULT 0,
                trackingAF BOOLEAN DEFAULT 0,
                
                -- Continuous Shooting
                continuousShooting REAL, -- fps
                continuousShootingMechanical REAL,
                continuousShootingElectronic REAL,
                bufferSizeRAW INTEGER,
                bufferSizeJPEG INTEGER,
                
                -- Video Specifications
                videoMaxResolution TEXT, -- 8K, 4K, 1080p
                videoMaxFrameRate INTEGER,
                video4K BOOLEAN DEFAULT 0,
                video4KFrameRate INTEGER,
                video8K BOOLEAN DEFAULT 0,
                video8KFrameRate INTEGER,
                videoBitDepth INTEGER, -- 8, 10, 12
                videoBitrate INTEGER, -- Mbps
                videoFormats TEXT, -- H.264, H.265, ProRes, etc.
                videoColorProfiles TEXT, -- S-Log, V-Log, etc.
                videoTimeLimit TEXT, -- recording time limit
                
                -- Video Features
                hdmi BOOLEAN DEFAULT 0,
                hdmiType TEXT, -- Type A, Type C, Type D
                hdmiOutput TEXT, -- Clean, 4K, etc.
                headphoneJack BOOLEAN DEFAULT 0,
                microphoneJack BOOLEAN DEFAULT 0,
                xlrAdapter BOOLEAN DEFAULT 0,
                
                -- Viewfinder & Display
                viewfinderType TEXT, -- Electronic, Optical, Hybrid, None
                viewfinderResolution INTEGER, -- dots
                viewfinderMagnification REAL,
                viewfinderCoverage INTEGER, -- percentage
                viewfinderRefreshRate INTEGER, -- Hz
                
                -- LCD Screen
                lcdSize REAL, -- inches
                lcdResolution INTEGER, -- dots
                lcdType TEXT, -- Fixed, Tilting, Articulating, etc.
                touchscreen BOOLEAN DEFAULT 0,
                
                -- Stabilization
                ibis BOOLEAN DEFAULT 0,
                ibisStops REAL, -- stops of stabilization
                ibisType TEXT, -- 5-axis, 3-axis, etc.
                digitalStabilization BOOLEAN DEFAULT 0,
                
                -- Lens System
                lensMount TEXT,
                lensMountDiameter REAL, -- mm
                flangeFocalDistance REAL, -- mm
                compatibleMounts TEXT, -- via adapters
                
                -- Flash
                builtInFlash BOOLEAN DEFAULT 0,
                flashGN REAL, -- guide number
                hotShoe BOOLEAN DEFAULT 0,
                flashModes TEXT,
                
                -- Storage
                dualCardSlots BOOLEAN DEFAULT 0,
                cardSlots INTEGER DEFAULT 1,
                cardSlot1Type TEXT, -- SD, CFexpress, etc.
                cardSlot2Type TEXT,
                cardSlot3Type TEXT,
                internalStorage INTEGER, -- GB
                
                -- Connectivity
                wireless TEXT, -- Wi-Fi specs
                bluetooth TEXT, -- Bluetooth version
                gps BOOLEAN DEFAULT 0,
                nfc BOOLEAN DEFAULT 0,
                usb TEXT, -- USB-C, Micro USB, etc.
                usbVersion TEXT, -- USB 3.2, etc.
                connectivity TEXT, -- other connections
                
                -- Battery & Power
                batteryLife INTEGER, -- CIPA rated shots
                batteryLifeVideo INTEGER, -- minutes
                batteryType TEXT,
                batteryGrip BOOLEAN DEFAULT 0,
                usbCharging BOOLEAN DEFAULT 0,
                usbPowerDelivery BOOLEAN DEFAULT 0,
                
                -- Build & Design
                weatherSealed BOOLEAN DEFAULT 0,
                weatherSealingRating TEXT,
                bodyMaterial TEXT, -- Magnesium alloy, Polycarbonate, etc.
                weight REAL, -- grams, body only
                weightWithBattery REAL, -- grams
                dimensionsWidth REAL, -- mm
                dimensionsHeight REAL, -- mm
                dimensionsDepth REAL, -- mm
                
                -- Special Features
                pixelShift BOOLEAN DEFAULT 0,
                focusStacking BOOLEAN DEFAULT 0,
                focusBracketing BOOLEAN DEFAULT 0,
                intervalometer BOOLEAN DEFAULT 0,
                multipleExposure BOOLEAN DEFAULT 0,
                hdr BOOLEAN DEFAULT 0,
                panorama BOOLEAN DEFAULT 0,
                
                -- Processing
                processor TEXT, -- DIGIC X, EXPEED 6, etc.
                processorCount INTEGER DEFAULT 1,
                bitDepth INTEGER, -- 12, 14, 16
                rawFormat TEXT, -- CR3, NEF, ARW, etc.
                
                -- Files & Formats
                imageFormats TEXT, -- JPEG, HEIF, RAW, etc.
                maxImageSize TEXT, -- e.g., "6000x4000"
                aspectRatios TEXT, -- 3:2, 4:3, 16:9, 1:1
                colorSpace TEXT, -- sRGB, Adobe RGB
                
                -- Pro Features
                dualNativeISO BOOLEAN DEFAULT 0,
                dualNativeISOValues TEXT,
                waveformMonitor BOOLEAN DEFAULT 0,
                vectorScope BOOLEAN DEFAULT 0,
                zebras BOOLEAN DEFAULT 0,
                focusPeaking BOOLEAN DEFAULT 0,
                falseColor BOOLEAN DEFAULT 0,
                
                -- Ratings & Awards
                dxoScore INTEGER,
                dpreviewScore REAL,
                awards TEXT,
                
                -- Resources
                manualUrl TEXT,
                firmwareUrl TEXT,
                supportUrl TEXT,
                
                -- Images
                imageUrl TEXT,
                localImagePath TEXT,
                thumbnailPath TEXT,
                imageId TEXT,
                thumbUrl TEXT,
                imageAttribution TEXT,
                additionalImages TEXT, -- JSON array of additional image URLs
                
                -- Metadata
                description TEXT,
                keyFeatures TEXT,
                pros TEXT,
                cons TEXT,
                bestFor TEXT, -- target audience
                notRecommendedFor TEXT,
                competitors TEXT, -- similar models
                accessories TEXT, -- recommended accessories
                notes TEXT,
                specs TEXT, -- JSON for any additional specs
                
                -- System
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
                dataSource TEXT,
                verified BOOLEAN DEFAULT 0
            )`;

            db.run(createCamerasTable, (err) => {
                if (err) {
                    console.error('❌ Failed to create cameras table:', err);
                    process.exit(1);
                }
                console.log('✅ Created comprehensive cameras table with 130+ fields!\n');

                // Create related tables
                console.log('5️⃣ Creating related tables...');
                
                const relatedTables = [
                    // Image attributions
                    `CREATE TABLE image_attributions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id INTEGER,
                        image_url TEXT,
                        source_name TEXT,
                        source_url TEXT,
                        photographer TEXT,
                        license TEXT,
                        attribution_required BOOLEAN DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (camera_id) REFERENCES cameras(id)
                    )`,
                    
                    // Camera productions (movies/shows that used this camera)
                    `CREATE TABLE camera_productions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id INTEGER,
                        production_name TEXT,
                        production_type TEXT, -- movie, tv, documentary, etc.
                        production_year INTEGER,
                        cinematographer TEXT,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (camera_id) REFERENCES cameras(id)
                    )`,
                    
                    // User reviews
                    `CREATE TABLE camera_reviews (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id INTEGER,
                        user_id INTEGER,
                        rating INTEGER,
                        title TEXT,
                        review TEXT,
                        pros TEXT,
                        cons TEXT,
                        verified_purchase BOOLEAN DEFAULT 0,
                        helpful_count INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (camera_id) REFERENCES cameras(id)
                    )`,
                    
                    // Sample images taken with camera
                    `CREATE TABLE camera_samples (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id INTEGER,
                        image_url TEXT,
                        thumbnail_url TEXT,
                        title TEXT,
                        photographer TEXT,
                        settings TEXT, -- JSON with ISO, aperture, shutter speed, etc.
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (camera_id) REFERENCES cameras(id)
                    )`,
                    
                    // Firmware history
                    `CREATE TABLE camera_firmware (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id INTEGER,
                        version TEXT,
                        release_date TEXT,
                        download_url TEXT,
                        changes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (camera_id) REFERENCES cameras(id)
                    )`
                ];

                let tableCount = 0;
                relatedTables.forEach(sql => {
                    db.run(sql, (err) => {
                        tableCount++;
                        if (err) console.error('⚠️  Warning:', err.message);
                        
                        if (tableCount === relatedTables.length) {
                            console.log('✅ Created all related tables\n');
                            
                            // Create indexes
                            console.log('6️⃣ Creating indexes for performance...');
                            const indexes = [
                                "CREATE INDEX idx_cameras_brand ON cameras(brand)",
                                "CREATE INDEX idx_cameras_slug ON cameras(slug)",
                                "CREATE INDEX idx_cameras_category ON cameras(category)",
                                "CREATE INDEX idx_cameras_releaseYear ON cameras(releaseYear)",
                                "CREATE INDEX idx_cameras_sensorSize ON cameras(sensorSize)",
                                "CREATE INDEX idx_cameras_price ON cameras(currentPrice)",
                                "CREATE INDEX idx_cameras_mount ON cameras(lensMount)",
                                "CREATE INDEX idx_cameras_megapixels ON cameras(sensorMegapixels)",
                                "CREATE INDEX idx_productions_camera ON camera_productions(camera_id)",
                                "CREATE INDEX idx_reviews_camera ON camera_reviews(camera_id)",
                                "CREATE INDEX idx_samples_camera ON camera_samples(camera_id)"
                            ];

                            let indexCount = 0;
                            indexes.forEach(sql => {
                                db.run(sql, (err) => {
                                    indexCount++;
                                    if (indexCount === indexes.length) {
                                        console.log('✅ Created all indexes\n');
                                        
                                        // Migrate existing data
                                        if (existingCameras.length > 0) {
                                            console.log('7️⃣ Migrating existing cameras...');
                                            let migrated = 0;
                                            
                                            existingCameras.forEach((cam, i) => {
                                                const slug = `${cam.brand}-${cam.model}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                                                
                                                const sql = `INSERT INTO cameras (
                                                    brand, model, fullName, slug, category, releaseYear,
                                                    msrp, currentPrice, imageUrl, localImagePath,
                                                    thumbnailPath, imageAttribution, description,
                                                    keyFeatures, manualUrl
                                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                                                
                                                db.run(sql, [
                                                    cam.brand, cam.model, cam.fullName, slug,
                                                    cam.category, cam.releaseYear, cam.msrp,
                                                    cam.currentPrice, cam.imageUrl, cam.localImagePath,
                                                    cam.thumbnailPath, cam.imageAttribution,
                                                    cam.description, cam.keyFeatures, cam.manualUrl
                                                ], (err) => {
                                                    if (!err) migrated++;
                                                    if (i === existingCameras.length - 1) {
                                                        console.log(`✅ Migrated ${migrated} cameras\n`);
                                                        finishSetup();
                                                    }
                                                });
                                            });
                                        } else {
                                            finishSetup();
                                        }
                                    }
                                });
                            });
                        }
                    });
                });
            });
        });

        function finishSetup() {
            // List all columns
            db.all("PRAGMA table_info(cameras)", (err, columns) => {
                if (!err) {
                    console.log('📋 Database Schema Summary:');
                    console.log(`   Total columns: ${columns.length}`);
                    console.log(`   Key categories:`);
                    console.log(`   - Basic info & pricing`);
                    console.log(`   - Sensor specifications`);
                    console.log(`   - Autofocus system`);
                    console.log(`   - Video capabilities`);
                    console.log(`   - Viewfinder & display`);
                    console.log(`   - Connectivity & power`);
                    console.log(`   - Pro features`);
                    console.log(`   - Build quality`);
                    console.log(`   - And much more!\n`);
                }

                db.close(() => {
                    console.log('✅ Database setup complete!\n');
                    console.log('🎉 Your camera database now supports:');
                    console.log('   • 130+ camera specifications');
                    console.log('   • Production tracking (movies/TV)');
                    console.log('   • User reviews and ratings');
                    console.log('   • Sample image galleries');
                    console.log('   • Firmware update history');
                    console.log('   • Complete attribution system\n');
                    console.log('👉 Next: Run the automation to populate with cameras!');
                });
            });
        }
    });
});