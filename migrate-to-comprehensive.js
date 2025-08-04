const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseMigrator {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.backupPath = path.join(__dirname, 'backups');
        this.db = null;
    }

    async migrate() {
        console.log('='.repeat(60));
        console.log('Camera Vault Database Migration');
        console.log('Upgrading to 160+ field schema');
        console.log('='.repeat(60));
        
        try {
            // 1. Create backup
            await this.createBackup();
            
            // 2. Connect to database
            await this.connect();
            
            // 3. Check current state
            const hasOldTable = await this.tableExists('cameras');
            const hasNewTable = await this.tableExists('cameras_comprehensive');
            
            console.log(`\nCurrent state:`);
            console.log(`- Old 'cameras' table exists: ${hasOldTable}`);
            console.log(`- New 'cameras_comprehensive' table exists: ${hasNewTable}`);
            
            if (hasOldTable && !hasNewTable) {
                console.log('\n📊 Found old schema, migrating to comprehensive schema...');
                
                // Get count of existing cameras
                const oldCount = await this.getTableCount('cameras');
                console.log(`\n📷 Found ${oldCount} cameras to migrate`);
                
                // Create new comprehensive table
                console.log('\n🔧 Creating comprehensive table structure...');
                await this.createComprehensiveTable();
                
                // Migrate existing data
                if (oldCount > 0) {
                    console.log('\n📦 Migrating existing camera data...');
                    await this.migrateExistingData();
                }
                
                // Rename old table as backup
                console.log('\n💾 Backing up old table...');
                await this.run('ALTER TABLE cameras RENAME TO cameras_old_backup');
                
                // Create view for compatibility
                console.log('\n🔗 Creating compatibility view...');
                await this.createCompatibilityView();
                
                // Verify migration
                const newCount = await this.getTableCount('cameras_comprehensive');
                console.log(`\n✅ Migration complete! Migrated ${newCount} cameras`);
                
            } else if (hasNewTable) {
                console.log('\n✅ Comprehensive schema already exists');
                
                // Just ensure the view exists
                await this.createCompatibilityView();
                
                const count = await this.getTableCount('cameras_comprehensive');
                console.log(`📊 Total cameras in database: ${count}`);
                
            } else {
                console.log('\n📦 No existing data found, creating fresh comprehensive schema...');
                await this.createComprehensiveTable();
                await this.createCompatibilityView();
                console.log('✅ Fresh database created with comprehensive schema');
            }
            
            // Create additional tables if needed
            await this.createAdditionalTables();
            
            console.log('\n' + '='.repeat(60));
            console.log('Migration completed successfully!');
            console.log('='.repeat(60));
            
        } catch (error) {
            console.error('\n❌ Migration failed:', error);
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupPath, `pre-migration-${timestamp}.db`);
        
        await fs.mkdir(this.backupPath, { recursive: true });
        
        try {
            await fs.copyFile(this.dbPath, backupFile);
            console.log(`\n💾 Backup created: ${backupFile}`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            console.log('\n📁 No existing database to backup');
        }
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) reject(err);
                else {
                    console.log('\n🔌 Connected to database');
                    resolve();
                }
            });
        });
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    async tableExists(tableName) {
        const result = await this.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tableName]
        );
        return !!result;
    }

    async getTableCount(tableName) {
        const result = await this.get(`SELECT COUNT(*) as count FROM ${tableName}`);
        return result.count;
    }

    async createComprehensiveTable() {
        await this.run(`
            CREATE TABLE IF NOT EXISTS cameras_comprehensive (
                -- Basic Information
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brand TEXT NOT NULL,
                model TEXT NOT NULL,
                full_name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                alternate_names TEXT,
                category TEXT,
                subcategory TEXT,
                release_date DATE,
                release_year INTEGER,
                discontinued_date DATE,
                msrp_usd INTEGER,
                current_price_usd INTEGER,
                used_price_usd INTEGER,
                
                -- Body Specifications
                body_type TEXT,
                body_material TEXT,
                weight_g INTEGER,
                weight_with_battery_g INTEGER,
                dimensions_mm TEXT,
                weather_sealed BOOLEAN DEFAULT 0,
                weather_sealing_description TEXT,
                
                -- Sensor Information
                sensor_type TEXT,
                sensor_size TEXT,
                sensor_format TEXT,
                sensor_manufacturer TEXT,
                sensor_model TEXT,
                megapixels REAL,
                effective_megapixels REAL,
                total_megapixels REAL,
                pixel_size_microns REAL,
                crop_factor REAL,
                aspect_ratios TEXT,
                
                -- Image Processing
                processor TEXT,
                processor_variant TEXT,
                image_stabilization TEXT,
                ibis_stops REAL,
                has_ibis BOOLEAN DEFAULT 0,
                raw_format TEXT,
                raw_bit_depth INTEGER,
                jpeg_quality_levels TEXT,
                
                -- ISO and Exposure
                iso_min INTEGER,
                iso_max INTEGER,
                iso_expanded_min INTEGER,
                iso_expanded_max INTEGER,
                shutter_min TEXT,
                shutter_max TEXT,
                bulb_mode BOOLEAN DEFAULT 0,
                exposure_compensation_stops TEXT,
                metering_modes TEXT,
                
                -- Autofocus System
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
                
                -- Continuous Shooting
                continuous_shooting_speed REAL,
                continuous_shooting_buffer_raw INTEGER,
                continuous_shooting_buffer_jpeg INTEGER,
                continuous_af_speed REAL,
                
                -- Viewfinder
                viewfinder_type TEXT,
                viewfinder_resolution INTEGER,
                viewfinder_magnification REAL,
                viewfinder_coverage_percent INTEGER,
                viewfinder_refresh_rate INTEGER,
                diopter_adjustment_range TEXT,
                
                -- LCD Screen
                lcd_size_inches REAL,
                lcd_resolution INTEGER,
                lcd_type TEXT,
                lcd_touchscreen BOOLEAN DEFAULT 0,
                lcd_articulating TEXT,
                lcd_brightness_levels INTEGER,
                
                -- Video Capabilities
                video_resolution_max TEXT,
                video_4k BOOLEAN DEFAULT 0,
                video_6k BOOLEAN DEFAULT 0,
                video_8k BOOLEAN DEFAULT 0,
                video_fps_4k INTEGER,
                video_fps_1080p INTEGER,
                video_fps_720p INTEGER,
                video_bitrate_mbps INTEGER,
                video_color_sampling TEXT,
                video_bit_depth INTEGER,
                video_log_profiles TEXT,
                video_hdr_modes TEXT,
                video_codecs TEXT,
                video_time_limit_minutes INTEGER,
                
                -- Audio
                microphone_input BOOLEAN DEFAULT 0,
                headphone_output BOOLEAN DEFAULT 0,
                internal_microphone TEXT,
                audio_formats TEXT,
                audio_levels_adjustment BOOLEAN DEFAULT 0,
                
                -- Connectivity
                wifi_standard TEXT,
                has_wifi BOOLEAN DEFAULT 0,
                bluetooth_version TEXT,
                has_bluetooth BOOLEAN DEFAULT 0,
                has_gps BOOLEAN DEFAULT 0,
                has_nfc BOOLEAN DEFAULT 0,
                usb_version TEXT,
                usb_charging BOOLEAN DEFAULT 0,
                hdmi_port TEXT,
                
                -- Storage
                memory_card_slots INTEGER,
                memory_card_types TEXT,
                dual_card_modes TEXT,
                internal_storage_gb INTEGER,
                
                -- Battery
                battery_model TEXT,
                battery_life_cipa_shots INTEGER,
                battery_life_video_minutes INTEGER,
                battery_type TEXT,
                battery_wh REAL,
                usb_power_delivery BOOLEAN DEFAULT 0,
                battery_grip_available BOOLEAN DEFAULT 0,
                
                -- Flash
                built_in_flash BOOLEAN DEFAULT 0,
                flash_guide_number REAL,
                flash_sync_speed TEXT,
                flash_modes TEXT,
                hot_shoe BOOLEAN DEFAULT 0,
                pc_sync_port BOOLEAN DEFAULT 0,
                
                -- Lens Mount
                lens_mount TEXT,
                lens_mount_diameter_mm REAL,
                flange_distance_mm REAL,
                compatible_mounts TEXT,
                in_body_lens_corrections BOOLEAN DEFAULT 0,
                
                -- Special Features
                interval_timer BOOLEAN DEFAULT 0,
                time_lapse BOOLEAN DEFAULT 0,
                hdr_mode BOOLEAN DEFAULT 0,
                focus_stacking BOOLEAN DEFAULT 0,
                pixel_shift BOOLEAN DEFAULT 0,
                multiple_exposure BOOLEAN DEFAULT 0,
                panorama_mode BOOLEAN DEFAULT 0,
                
                -- Professional Features
                dual_pixel_raw BOOLEAN DEFAULT 0,
                tethering_support TEXT,
                remote_control_options TEXT,
                custom_buttons INTEGER,
                custom_modes INTEGER,
                copyright_embedding BOOLEAN DEFAULT 0,
                
                -- Environmental
                operating_temp_min_c INTEGER,
                operating_temp_max_c INTEGER,
                operating_humidity_percent INTEGER,
                
                -- Additional Specs
                startup_time_seconds REAL,
                color_space_options TEXT,
                white_balance_presets INTEGER,
                custom_white_balance_slots INTEGER,
                picture_styles TEXT,
                scene_modes TEXT,
                creative_filters TEXT,
                
                -- URLs and References
                manufacturer_url TEXT,
                manual_url TEXT,
                firmware_url TEXT,
                sample_images_url TEXT,
                review_urls TEXT,
                
                -- Images
                image_url TEXT,
                thumbnail_url TEXT,
                additional_images TEXT,
                
                -- Metadata
                description TEXT,
                key_features TEXT,
                target_audience TEXT,
                pros TEXT,
                cons TEXT,
                competitors TEXT,
                successor_model TEXT,
                predecessor_model TEXT,
                
                -- Source Information
                source_url TEXT,
                source_name TEXT,
                last_verified DATETIME,
                data_quality_score INTEGER,
                
                -- Timestamps
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes
        await this.run('CREATE INDEX IF NOT EXISTS idx_cameras_brand ON cameras_comprehensive(brand)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_cameras_slug ON cameras_comprehensive(slug)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras_comprehensive(category)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_cameras_mount ON cameras_comprehensive(lens_mount)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_cameras_year ON cameras_comprehensive(release_year)');
    }

    async migrateExistingData() {
        // Get all existing cameras
        const oldCameras = await this.all('SELECT * FROM cameras');
        
        for (const oldCamera of oldCameras) {
            console.log(`  Migrating: ${oldCamera.brand} ${oldCamera.model}`);
            
            // Map old fields to new comprehensive schema
            const params = [
                // Basic Information
                oldCamera.brand,
                oldCamera.model,
                oldCamera.full_name || `${oldCamera.brand} ${oldCamera.model}`,
                oldCamera.slug,
                oldCamera.category,
                oldCamera.release_year,
                oldCamera.msrp_usd,
                
                // Sensor Information
                oldCamera.sensor_type,
                oldCamera.sensor_size,
                oldCamera.megapixels,
                
                // ISO
                oldCamera.max_iso,
                
                // Features from old schema
                oldCamera.has_ibis,
                oldCamera.continuous_shooting_speed,
                oldCamera.video_resolution,
                oldCamera.video_fps,
                oldCamera.has_wifi,
                oldCamera.has_gps,
                oldCamera.weather_sealed,
                
                // URLs
                oldCamera.manual_url,
                oldCamera.image_url,
                oldCamera.thumbnail_url,
                
                // Metadata
                oldCamera.description,
                oldCamera.key_features,
                
                // Source
                oldCamera.source_url,
                oldCamera.source_name,
                
                // Timestamps
                oldCamera.created_at,
                oldCamera.last_updated || oldCamera.created_at
            ];
            
            // Insert into new table with mapped fields
            await this.run(`
                INSERT INTO cameras_comprehensive (
                    brand, model, full_name, slug, category, release_year, msrp_usd,
                    sensor_type, sensor_size, megapixels,
                    iso_max,
                    has_ibis, continuous_shooting_speed, video_resolution_max, video_fps_1080p,
                    has_wifi, has_gps, weather_sealed,
                    manual_url, image_url, thumbnail_url,
                    description, key_features,
                    source_url, source_name,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, params);
        }
    }

    async createCompatibilityView() {
        // Drop existing view if it exists
        await this.run('DROP VIEW IF EXISTS cameras');
        
        // Create view that maps comprehensive table to old schema
        await this.run(`
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
        
        console.log('✅ Compatibility view created');
    }

    async createAdditionalTables() {
        // Discovery log table
        await this.run(`
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
        
        // Image attributions table
        await this.run(`
            CREATE TABLE IF NOT EXISTS image_attributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                image_url TEXT,
                source_name TEXT,
                source_url TEXT,
                photographer TEXT,
                license TEXT,
                attribution_required BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (camera_id) REFERENCES cameras_comprehensive(id)
            )
        `);
        
        // Camera specifications audit log
        await this.run(`
            CREATE TABLE IF NOT EXISTS camera_specs_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                field_name TEXT,
                old_value TEXT,
                new_value TEXT,
                change_source TEXT,
                changed_by TEXT,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (camera_id) REFERENCES cameras_comprehensive(id)
            )
        `);
        
        // Price history table
        await this.run(`
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                price_usd INTEGER,
                price_type TEXT, -- 'retail', 'used', 'sale'
                retailer TEXT,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (camera_id) REFERENCES cameras_comprehensive(id)
            )
        `);
        
        console.log('✅ Additional tables created');
    }
}

// Run migration if called directly
if (require.main === module) {
    const migrator = new DatabaseMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = DatabaseMigrator;