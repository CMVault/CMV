const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔍 Diagnosing database issues...\n');

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
const db = new sqlite3.Database(dbPath);

// Test camera data that matches what the automation would insert
const testCamera = {
    brand: 'Canon',
    model: 'EOS R5',
    fullName: 'Canon EOS R5',
    slug: 'canon-eos-r5',
    category: 'mirrorless',
    releaseYear: 2020,
    discontinued: false,
    sensorSize: 'Full Frame',
    sensorType: 'CMOS',
    sensorMegapixels: 45,
    sensorNotes: 'Dual Pixel CMOS AF II',
    isoMin: 100,
    isoMax: 51200,
    shutterSpeedMin: '30s',
    shutterSpeedMax: '1/8000s',
    continuousShooting: 20,
    videoMaxResolution: '8K',
    videoMaxFrameRate: 30,
    videoFormats: 'H.265, H.264',
    hdmi: true,
    headphoneJack: true,
    microphoneJack: true,
    wireless: 'Wi-Fi, Bluetooth',
    gps: false,
    batteryLife: 320,
    batteryType: 'LP-E6NH',
    weatherSealed: true,
    weight: 738,
    dimensionsWidth: 138.5,
    dimensionsHeight: 97.5,
    dimensionsDepth: 88,
    price: 3899,
    manualUrl: null,
    imageUrl: '/images/placeholder.jpg',
    imageId: 'test-123',
    thumbUrl: '/images/placeholder-thumb.jpg',
    imageAttribution: 'Placeholder',
    ibis: true,
    lensMount: 'Canon RF',
    builtInFlash: false,
    hotShoe: true,
    viewfinderType: 'Electronic',
    viewfinderCoverage: 100,
    viewfinderMagnification: 0.76,
    dualCardSlots: true,
    cardSlot1Type: 'CFexpress',
    cardSlot2Type: 'SD UHS-II',
    connectivity: 'USB-C, Wi-Fi, Bluetooth'
};

db.serialize(() => {
    // 1. Check table structure
    console.log('1️⃣ Checking table structure...');
    db.all("PRAGMA table_info(cameras)", (err, columns) => {
        if (err) {
            console.error('❌ Error getting table info:', err);
            return;
        }
        console.log(`✅ Table has ${columns.length} columns`);
        console.log('Columns:', columns.map(c => c.name).join(', '));
        console.log('');

        // 2. Try to insert a test camera
        console.log('2️⃣ Testing insert operation...');
        
        const insertSQL = `
            INSERT INTO cameras (
                brand, model, fullName, slug, category, releaseYear, discontinued,
                sensorSize, sensorType, sensorMegapixels, sensorNotes,
                isoMin, isoMax, shutterSpeedMin, shutterSpeedMax, continuousShooting,
                videoMaxResolution, videoMaxFrameRate, videoFormats,
                hdmi, headphoneJack, microphoneJack, wireless, gps,
                batteryLife, batteryType, weatherSealed, weight,
                dimensionsWidth, dimensionsHeight, dimensionsDepth, price,
                manualUrl, imageUrl, imageId, thumbUrl, imageAttribution,
                ibis, lensMount, builtInFlash, hotShoe,
                viewfinderType, viewfinderCoverage, viewfinderMagnification,
                dualCardSlots, cardSlot1Type, cardSlot2Type, connectivity
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            testCamera.brand, testCamera.model, testCamera.fullName, testCamera.slug,
            testCamera.category, testCamera.releaseYear, testCamera.discontinued ? 1 : 0,
            testCamera.sensorSize, testCamera.sensorType, testCamera.sensorMegapixels, testCamera.sensorNotes,
            testCamera.isoMin, testCamera.isoMax, testCamera.shutterSpeedMin, testCamera.shutterSpeedMax,
            testCamera.continuousShooting, testCamera.videoMaxResolution, testCamera.videoMaxFrameRate,
            testCamera.videoFormats, testCamera.hdmi ? 1 : 0, testCamera.headphoneJack ? 1 : 0,
            testCamera.microphoneJack ? 1 : 0, testCamera.wireless, testCamera.gps ? 1 : 0,
            testCamera.batteryLife, testCamera.batteryType, testCamera.weatherSealed ? 1 : 0,
            testCamera.weight, testCamera.dimensionsWidth, testCamera.dimensionsHeight,
            testCamera.dimensionsDepth, testCamera.price, testCamera.manualUrl,
            testCamera.imageUrl, testCamera.imageId, testCamera.thumbUrl,
            testCamera.imageAttribution, testCamera.ibis ? 1 : 0, testCamera.lensMount,
            testCamera.builtInFlash ? 1 : 0, testCamera.hotShoe ? 1 : 0, testCamera.viewfinderType,
            testCamera.viewfinderCoverage, testCamera.viewfinderMagnification,
            testCamera.dualCardSlots ? 1 : 0, testCamera.cardSlot1Type,
            testCamera.cardSlot2Type, testCamera.connectivity
        ];

        console.log(`Inserting ${values.length} values...`);

        db.run(insertSQL, values, function(err) {
            if (err) {
                console.error('❌ Insert failed:', err.message);
                console.error('SQL:', insertSQL);
                console.error('Values count:', values.length);
            } else {
                console.log('✅ Test camera inserted successfully!');
                console.log(`   Inserted with ID: ${this.lastID}`);
            }

            // 3. Check current camera count
            console.log('\n3️⃣ Checking camera count...');
            db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
                if (err) {
                    console.error('❌ Error counting cameras:', err);
                } else {
                    console.log(`📊 Total cameras in database: ${row.count}`);
                }

                // 4. Try to read back our test camera
                if (this.lastID) {
                    db.get("SELECT * FROM cameras WHERE id = ?", [this.lastID], (err, camera) => {
                        if (err) {
                            console.error('❌ Error reading camera back:', err);
                        } else if (camera) {
                            console.log('\n✅ Successfully verified camera in database:');
                            console.log(`   ${camera.brand} ${camera.model} (ID: ${camera.id})`);
                        }

                        // 5. Check for any errors in the automation log
                        console.log('\n4️⃣ Checking automation report...');
                        const fs = require('fs');
                        const reportPath = path.join(__dirname, 'data', 'automation-report.json');
                        
                        try {
                            if (fs.existsSync(reportPath)) {
                                const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                                console.log('📊 Automation Report Summary:');
                                console.log(`   Cameras Processed: ${report.camerasProcessed || 0}`);
                                console.log(`   Cameras Added: ${report.camerasAdded || 0}`);
                                console.log(`   Errors: ${report.errors?.length || 0}`);
                                
                                if (report.errors && report.errors.length > 0) {
                                    console.log('\n⚠️  Errors found:');
                                    report.errors.slice(0, 3).forEach(err => {
                                        console.log(`   - ${err.camera}: ${err.error}`);
                                    });
                                }
                            }
                        } catch (e) {
                            console.log('⚠️  Could not read automation report');
                        }

                        db.close(() => {
                            console.log('\n✅ Diagnosis complete!');
                            
                            if (row && row.count === 0) {
                                console.log('\n🔍 DIAGNOSIS: The database table exists but no cameras are being saved.');
                                console.log('   This suggests the automation has a bug in the save logic.');
                                console.log('   The test insert worked, so the database schema is correct.');
                            }
                        });
                    });
                } else {
                    db.close();
                }
            });
        });
    });
});