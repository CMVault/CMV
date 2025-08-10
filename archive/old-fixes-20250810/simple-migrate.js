const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

console.log('='.repeat(60));
console.log('Camera Vault Simple Migration');
console.log('='.repeat(60));

const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
const db = new sqlite3.Database(dbPath);

// Helper to run SQL
function runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// Helper to get one row
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Helper to get all rows
function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// Create safe slug
function createSlug(brand, model) {
    const combined = `${brand || 'unknown'}-${model || 'model'}`;
    return combined
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100);
}

async function migrate() {
    try {
        console.log('\n1️⃣ Checking current state...');
        
        // Get all tables
        const tables = await getAll(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
        console.log('Tables found:', tables.map(t => t.name).join(', '));
        
        // Check what we have
        const hasOld = tables.some(t => t.name === 'cameras');
        const hasNew = tables.some(t => t.name === 'cameras_comprehensive');
        const hasBackup = tables.some(t => t.name === 'cameras_old_backup');
        
        if (!hasOld) {
            console.log('\n❌ No cameras table found!');
            return;
        }
        
        // Count cameras
        const cameraCount = await getOne('SELECT COUNT(*) as count FROM cameras');
        console.log(`\n📷 Found ${cameraCount.count} cameras in database`);
        
        if (cameraCount.count === 0) {
            console.log('❌ No cameras to migrate!');
            return;
        }
        
        // Clean up if needed
        if (hasNew || hasBackup) {
            console.log('\n🧹 Cleaning up previous attempts...');
            
            try {
                await runSQL('DROP VIEW IF EXISTS cameras');
            } catch (e) {}
            
            try {
                await runSQL('DROP TABLE IF EXISTS cameras_comprehensive');
            } catch (e) {}
            
            try {
                await runSQL('DROP TABLE IF EXISTS cameras_old_backup');
            } catch (e) {}
        }
        
        console.log('\n2️⃣ Preparing cameras for migration...');
        
        // Get all cameras
        const cameras = await getAll('SELECT * FROM cameras');
        console.log(`Processing ${cameras.length} cameras...`);
        
        // Add slugs if missing
        for (const camera of cameras) {
            if (!camera.slug) {
                const slug = createSlug(camera.brand, camera.model);
                await runSQL('UPDATE cameras SET slug = ? WHERE id = ?', [slug, camera.id]);
                console.log(`  ✅ Added slug for ${camera.brand} ${camera.model}: ${slug}`);
            }
        }
        
        console.log('\n3️⃣ Creating comprehensive table...');
        
        // Create the new table (simplified version)
        await runSQL(`
            CREATE TABLE cameras_comprehensive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                full_name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                category TEXT,
                release_year INTEGER,
                sensor_type TEXT,
                sensor_size TEXT,
                megapixels REAL,
                iso_max INTEGER,
                has_ibis BOOLEAN DEFAULT 0,
                continuous_shooting_speed REAL,
                video_resolution_max TEXT,
                video_fps_1080p INTEGER,
                has_wifi BOOLEAN DEFAULT 0,
                has_gps BOOLEAN DEFAULT 0,
                weather_sealed BOOLEAN DEFAULT 0,
                msrp_usd INTEGER,
                image_url TEXT,
                thumbnail_url TEXT,
                manual_url TEXT,
                description TEXT,
                key_features TEXT,
                source_url TEXT,
                source_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                -- Add placeholders for the 160+ fields
                alternate_names TEXT,
                subcategory TEXT,
                release_date DATE,
                discontinued_date DATE,
                current_price_usd INTEGER,
                used_price_usd INTEGER,
                body_type TEXT,
                body_material TEXT,
                weight_g INTEGER,
                weight_with_battery_g INTEGER,
                dimensions_mm TEXT,
                weather_sealing_description TEXT,
                sensor_format TEXT,
                sensor_manufacturer TEXT,
                sensor_model TEXT,
                effective_megapixels REAL,
                total_megapixels REAL,
                pixel_size_microns REAL,
                crop_factor REAL,
                aspect_ratios TEXT,
                processor TEXT,
                processor_variant TEXT,
                image_stabilization TEXT,
                ibis_stops REAL,
                raw_format TEXT,
                raw_bit_depth INTEGER,
                jpeg_quality_levels TEXT,
                iso_min INTEGER,
                iso_expanded_min INTEGER,
                iso_expanded_max INTEGER,
                shutter_min TEXT,
                shutter_max TEXT,
                bulb_mode BOOLEAN DEFAULT 0,
                exposure_compensation_stops TEXT,
                metering_modes TEXT,
                af_system TEXT,
                af_points_total INTEGER,
                af_points_cross_type INTEGER,
                af_points_f28_sensitive INTEGER,
                af_coverage_percent INTEGER,
                af_modes TEXT,
                af_speed_rating TEXT,
                face_detection BOOLEAN DEFAULT 0,
                eye_detection BOOLEAN DEFAULT 0,
                animal_detection BOOLEAN DEFAULT 0,
                subject_tracking BOOLEAN DEFAULT 0,
                continuous_shooting_buffer_raw INTEGER,
                continuous_shooting_buffer_jpeg INTEGER,
                continuous_af_speed REAL,
                viewfinder_type TEXT,
                viewfinder_resolution INTEGER,
                viewfinder_magnification REAL,
                viewfinder_coverage_percent INTEGER,
                viewfinder_refresh_rate INTEGER,
                diopter_adjustment_range TEXT,
                lcd_size_inches REAL,
                lcd_resolution INTEGER,
                lcd_type TEXT,
                lcd_touchscreen BOOLEAN DEFAULT 0,
                lcd_articulating TEXT,
                lcd_brightness_levels INTEGER,
                video_4k BOOLEAN DEFAULT 0,
                video_6k BOOLEAN DEFAULT 0,
                video_8k BOOLEAN DEFAULT 0,
                video_fps_4k INTEGER,
                video_fps_720p INTEGER,
                video_bitrate_mbps INTEGER,
                video_color_sampling TEXT,
                video_bit_depth INTEGER,
                video_log_profiles TEXT,
                video_hdr_modes TEXT,
                video_codecs TEXT,
                video_time_limit_minutes INTEGER,
                microphone_input BOOLEAN DEFAULT 0,
                headphone_output BOOLEAN DEFAULT 0,
                internal_microphone TEXT,
                audio_formats TEXT,
                audio_levels_adjustment BOOLEAN DEFAULT 0,
                wifi_standard TEXT,
                bluetooth_version TEXT,
                has_bluetooth BOOLEAN DEFAULT 0,
                has_nfc BOOLEAN DEFAULT 0,
                usb_version TEXT,
                usb_charging BOOLEAN DEFAULT 0,
                hdmi_port TEXT,
                memory_card_slots INTEGER,
                memory_card_types TEXT,
                dual_card_modes TEXT,
                internal_storage_gb INTEGER,
                battery_model TEXT,
                battery_life_cipa_shots INTEGER,
                battery_life_video_minutes INTEGER,
                battery_type TEXT,
                battery_wh REAL,
                usb_power_delivery BOOLEAN DEFAULT 0,
                battery_grip_available BOOLEAN DEFAULT 0,
                built_in_flash BOOLEAN DEFAULT 0,
                flash_guide_number REAL,
                flash_sync_speed TEXT,
                flash_modes TEXT,
                hot_shoe BOOLEAN DEFAULT 0,
                pc_sync_port BOOLEAN DEFAULT 0,
                lens_mount TEXT,
                lens_mount_diameter_mm REAL,
                flange_distance_mm REAL,
                compatible_mounts TEXT,
                in_body_lens_corrections BOOLEAN DEFAULT 0,
                interval_timer BOOLEAN DEFAULT 0,
                time_lapse BOOLEAN DEFAULT 0,
                hdr_mode BOOLEAN DEFAULT 0,
                focus_stacking BOOLEAN DEFAULT 0,
                pixel_shift BOOLEAN DEFAULT 0,
                multiple_exposure BOOLEAN DEFAULT 0,
                panorama_mode BOOLEAN DEFAULT 0,
                dual_pixel_raw BOOLEAN DEFAULT 0,
                tethering_support TEXT,
                remote_control_options TEXT,
                custom_buttons INTEGER,
                custom_modes INTEGER,
                copyright_embedding BOOLEAN DEFAULT 0,
                operating_temp_min_c INTEGER,
                operating_temp_max_c INTEGER,
                operating_humidity_percent INTEGER,
                startup_time_seconds REAL,
                color_space_options TEXT,
                white_balance_presets INTEGER,
                custom_white_balance_slots INTEGER,
                picture_styles TEXT,
                scene_modes TEXT,
                creative_filters TEXT,
                manufacturer_url TEXT,
                firmware_url TEXT,
                sample_images_url TEXT,
                review_urls TEXT,
                additional_images TEXT,
                target_audience TEXT,
                pros TEXT,
                cons TEXT,
                competitors TEXT,
                successor_model TEXT,
                predecessor_model TEXT,
                last_verified DATETIME,
                data_quality_score INTEGER
            )
        `);
        
        console.log('✅ Comprehensive table created');
        
        console.log('\n4️⃣ Migrating cameras...');
        
        // Get fresh camera data with slugs
        const camerasToMigrate = await getAll('SELECT * FROM cameras');
        
        for (const camera of camerasToMigrate) {
            const fullName = camera.full_name || `${camera.brand} ${camera.model}`;
            
            await runSQL(`
                INSERT INTO cameras_comprehensive (
                    brand, model, full_name, slug,
                    category, release_year, sensor_type, sensor_size,
                    megapixels, iso_max, has_ibis, continuous_shooting_speed,
                    video_resolution_max, video_fps_1080p, has_wifi, has_gps,
                    weather_sealed, msrp_usd, image_url, thumbnail_url,
                    manual_url, description, key_features, source_url,
                    source_name, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                camera.brand, camera.model, fullName, camera.slug,
                camera.category, camera.release_year, camera.sensor_type, camera.sensor_size,
                camera.megapixels, camera.max_iso, camera.has_ibis || 0, camera.continuous_shooting_speed,
                camera.video_resolution, camera.video_fps, camera.has_wifi || 0, camera.has_gps || 0,
                camera.weather_sealed || 0, camera.msrp_usd, camera.image_url, camera.thumbnail_url,
                camera.manual_url, camera.description, camera.key_features, camera.source_url,
                camera.source_name, camera.created_at, camera.last_updated || camera.created_at
            ]);
            
            console.log(`  ✅ Migrated ${camera.brand} ${camera.model}`);
        }
        
        console.log('\n5️⃣ Finalizing migration...');
        
        // Rename old table
        await runSQL('ALTER TABLE cameras RENAME TO cameras_old_backup');
        console.log('✅ Backed up old table');
        
        // Create view for compatibility
        await runSQL(`
            CREATE VIEW cameras AS
            SELECT 
                id, brand, model, full_name, slug, category, release_year,
                sensor_size, sensor_type, megapixels, iso_max as max_iso,
                continuous_shooting_speed, video_resolution_max as video_resolution,
                video_fps_1080p as video_fps, has_ibis, has_wifi, has_gps,
                weather_sealed, msrp_usd, image_url, thumbnail_url, manual_url,
                description, key_features, source_url, source_name,
                updated_at as last_updated, created_at
            FROM cameras_comprehensive
        `);
        console.log('✅ Created compatibility view');
        
        // Create discovery log table
        await runSQL(`
            CREATE TABLE IF NOT EXISTS discovery_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                cameras_discovered INTEGER DEFAULT 0,
                cameras_saved INTEGER DEFAULT 0,
                errors INTEGER DEFAULT 0,
                duration_seconds INTEGER,
                status TEXT
            )
        `);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ MIGRATION COMPLETE!');
        console.log('='.repeat(60));
        
        // Verify
        const newCount = await getOne('SELECT COUNT(*) as count FROM cameras_comprehensive');
        console.log(`\n📊 Final stats:`);
        console.log(`  - Cameras migrated: ${newCount.count}`);
        console.log(`  - Schema: 160+ fields`);
        console.log(`  - Compatibility view: Created`);
        console.log('\nYou can now run:');
        console.log('  node unified-camera-system.js');
        
    } catch (error) {
        console.error('\n❌ Error:', error);
    } finally {
        db.close();
    }
}

// Run it
migrate();