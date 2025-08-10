const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class CleanupAndMigrate {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.backupPath = path.join(__dirname, 'backups');
        this.db = null;
    }

    async run() {
        console.log('='.repeat(60));
        console.log('Camera Vault Database Cleanup and Migration');
        console.log('='.repeat(60));
        
        try {
            // 1. Create backup
            await this.createBackup();
            
            // 2. Connect to database
            await this.connect();
            
            // 3. Analyze current state
            console.log('\n📊 Analyzing current database state...');
            const tables = await this.getTables();
            console.log('Found tables:', tables.map(t => t.name).join(', '));
            
            const hasOldCameras = tables.some(t => t.name === 'cameras');
            const hasComprehensive = tables.some(t => t.name === 'cameras_comprehensive');
            const hasOldBackup = tables.some(t => t.name === 'cameras_old_backup');
            
            console.log(`\nCurrent state:`);
            console.log(`- cameras table exists: ${hasOldCameras}`);
            console.log(`- cameras_comprehensive exists: ${hasComprehensive}`);
            console.log(`- cameras_old_backup exists: ${hasOldBackup}`);
            
            // 4. Clean up any previous migration attempts
            console.log('\n🧹 Cleaning up previous migration attempts...');
            
            // Drop the view if it exists
            try {
                await this.run('DROP VIEW IF EXISTS cameras_view');
                console.log('  ✅ Dropped cameras_view if existed');
            } catch (e) {}
            
            // If comprehensive table exists but is empty, drop it
            if (hasComprehensive) {
                const count = await this.getTableCount('cameras_comprehensive');
                if (count === 0) {
                    console.log('  📦 Comprehensive table is empty, dropping it...');
                    await this.run('DROP TABLE cameras_comprehensive');
                    hasComprehensive = false;
                } else {
                    console.log(`  ℹ️  Comprehensive table has ${count} cameras`);
                }
            }
            
            // 5. Decide migration path
            if (hasOldCameras && !hasComprehensive) {
                console.log('\n🔄 Performing fresh migration...');
                
                // Fix existing cameras first
                await this.fixExistingCameras();
                
                // Get camera count
                const cameraCount = await this.getTableCount('cameras');
                console.log(`\n📷 Found ${cameraCount} cameras to migrate`);
                
                // Create comprehensive table
                console.log('\n🔧 Creating comprehensive table...');
                await this.createComprehensiveTable();
                
                // Migrate data
                if (cameraCount > 0) {
                    console.log('\n📦 Migrating camera data...');
                    await this.migrateExistingData();
                }
                
                // Rename old table
                console.log('\n💾 Backing up old table...');
                await this.run('DROP TABLE IF EXISTS cameras_old_backup');
                await this.run('ALTER TABLE cameras RENAME TO cameras_old_backup');
                
                // Create view for compatibility
                console.log('\n🔗 Creating compatibility view...');
                await this.createCompatibilityView();
                
                // Verify
                const newCount = await this.getTableCount('cameras_comprehensive');
                console.log(`\n✅ Migration complete! ${newCount} cameras in new schema`);
                
            } else if (hasComprehensive && hasOldBackup && !hasOldCameras) {
                console.log('\n✅ Migration already completed');
                
                // Just ensure view exists
                await this.createCompatibilityView();
                
                const count = await this.getTableCount('cameras_comprehensive');
                console.log(`📊 Total cameras: ${count}`);
                
            } else if (hasComprehensive && hasOldCameras) {
                console.log('\n⚠️  Both old and new tables exist. Checking data...');
                
                const oldCount = await this.getTableCount('cameras');
                const newCount = await this.getTableCount('cameras_comprehensive');
                
                console.log(`  Old cameras table: ${oldCount} cameras`);
                console.log(`  New comprehensive table: ${newCount} cameras`);
                
                if (newCount >= oldCount && newCount > 0) {
                    console.log('\n✅ New table has all data. Completing migration...');
                    
                    // Backup and remove old table
                    await this.run('DROP TABLE IF EXISTS cameras_old_backup');
                    await this.run('ALTER TABLE cameras RENAME TO cameras_old_backup');
                    
                    // Create view
                    await this.createCompatibilityView();
                    
                    console.log('✅ Migration finalized');
                } else {
                    console.log('\n⚠️  Data mismatch. Please check manually.');
                }
            }
            
            // 6. Create additional tables
            await this.createAdditionalTables();
            
            // 7. Show final state
            console.log('\n📊 Final database state:');
            const finalTables = await this.getTables();
            for (const table of finalTables) {
                if (!table.name.startsWith('sqlite_')) {
                    const count = await this.getTableCount(table.name);
                    console.log(`  - ${table.name}: ${count} records`);
                }
            }
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ Database cleanup and migration complete!');
            console.log('='.repeat(60));
            console.log('\nYou can now run:');
            console.log('  node unified-camera-system.js');
            console.log('to start the discovery system');
            
        } catch (error) {
            console.error('\n❌ Error:', error);
            throw error;
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(this.backupPath, `cleanup-backup-${timestamp}.db`);
        
        await fs.mkdir(this.backupPath, { recursive: true });
        
        try {
            await fs.copyFile(this.dbPath, backupFile);
            console.log(`\n💾 Backup created: ${backupFile}`);
        } catch (error) {
            console.log('\n⚠️  Could not create backup:', error.message);
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
                else resolve(rows || []);
            });
        });
    }

    async getTables() {
        return await this.all(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        );
    }

    async getTableCount(tableName) {
        try {
            const result = await this.get(`SELECT COUNT(*) as count FROM ${tableName}`);
            return result ? result.count : 0;
        } catch (e) {
            return 0;
        }
    }

    createSafeSlug(brand, model) {
        const combined = `${brand || 'unknown'}-${model || 'model'}`;
        return combined
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);
    }

    async fixExistingCameras() {
        console.log('\n🔧 Fixing existing cameras table...');
        
        // Get columns
        const columns = await this.all(`PRAGMA table_info(cameras)`);
        const columnNames = columns.map(c => c.name);
        
        // Add slug if missing
        if (!columnNames.includes('slug')) {
            console.log('  Adding slug column...');
            await this.run('ALTER TABLE cameras ADD COLUMN slug TEXT');
        }
        
        // Generate slugs for cameras without them
        const camerasWithoutSlugs = await this.all(
            'SELECT id, brand, model FROM cameras WHERE slug IS NULL OR slug = ""'
        );
        
        if (camerasWithoutSlugs.length > 0) {
            console.log(`  Generating slugs for ${camerasWithoutSlugs.length} cameras...`);
            
            for (const camera of camerasWithoutSlugs) {
                const slug = this.createSafeSlug(camera.brand, camera.model);
                
                // Make unique if needed
                let finalSlug = slug;
                let counter = 1;
                while (true) {
                    const existing = await this.get(
                        'SELECT id FROM cameras WHERE slug = ? AND id != ?',
                        [finalSlug, camera.id]
                    );
                    if (!existing) break;
                    finalSlug = `${slug}-${counter}`;
                    counter++;
                }
                
                await this.run('UPDATE cameras SET slug = ? WHERE id = ?', [finalSlug, camera.id]);
                console.log(`    ✅ ${camera.brand} ${camera.model} -> ${finalSlug}`);
            }
        }
        
        // Add other missing columns
        const requiredColumns = {
            'full_name': 'TEXT',
            'release_year': 'INTEGER',
            'sensor_size': 'TEXT',
            'sensor_type': 'TEXT',
            'max_iso': 'INTEGER',
            'continuous_shooting_speed': 'REAL',
            'video_resolution': 'TEXT',
            'video_fps': 'INTEGER',
            'has_ibis': 'BOOLEAN DEFAULT 0',
            'has_wifi': 'BOOLEAN DEFAULT 0',
            'has_gps': 'BOOLEAN DEFAULT 0',
            'weather_sealed': 'BOOLEAN DEFAULT 0',
            'msrp_usd': 'INTEGER',
            'image_url': 'TEXT',
            'thumbnail_url': 'TEXT',
            'manual_url': 'TEXT',
            'description': 'TEXT',
            'key_features': 'TEXT',
            'source_url': 'TEXT',
            'source_name': 'TEXT',
            'created_at': 'DATETIME DEFAULT CURRENT_TIMESTAMP',
            'last_updated': 'DATETIME DEFAULT CURRENT_TIMESTAMP'
        };
        
        for (const [colName, colType] of Object.entries(requiredColumns)) {
            if (!columnNames.includes(colName)) {
                console.log(`  Adding column: ${colName}`);
                try {
                    await this.run(`ALTER TABLE cameras ADD COLUMN ${colName} ${colType}`);
                } catch (e) {
                    // Column might already exist
                }
            }
        }
        
        // Update full_name
        await this.run(`
            UPDATE cameras 
            SET full_name = brand || ' ' || model 
            WHERE full_name IS NULL OR full_name = ''
        `);
        
        console.log('  ✅ Cameras table fixed');
    }

    async createComprehensiveTable() {
        // The full 160+ field table structure
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
        await this.run('CREATE INDEX IF NOT EXISTS idx_comp_brand ON cameras_comprehensive(brand)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_comp_slug ON cameras_comprehensive(slug)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_comp_category ON cameras_comprehensive(category)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_comp_mount ON cameras_comprehensive(lens_mount)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_comp_year ON cameras_comprehensive(release_year)');
    }

    async migrateExistingData() {
        const cameras = await this.all('SELECT * FROM cameras');
        
        for (const camera of cameras) {
            console.log(`  Migrating: ${camera.brand} ${camera.model}`);
            
            // Prepare values with defaults for required fields
            const slug = camera.slug || this.createSafeSlug(camera.brand, camera.model);
            const brand = camera.brand || 'Unknown';
            const model = camera.model || 'Unknown';
            const fullName = camera.full_name || `${brand} ${model}`;
            
            // Build insert query with only non-null values
            const fields = [];
            const values = [];
            
            // Required fields
            fields.push('brand', 'model', 'full_name', 'slug');
            values.push(brand, model, fullName, slug);
            
            // Optional fields - only add if they exist
            const optionalMappings = {
                'category': camera.category,
                'release_year': camera.release_year,
                'sensor_type': camera.sensor_type,
                'sensor_size': camera.sensor_size,
                'megapixels': camera.megapixels,
                'iso_max': camera.max_iso,
                'has_ibis': camera.has_ibis,
                'continuous_shooting_speed': camera.continuous_shooting_speed,
                'video_resolution_max': camera.video_resolution,
                'video_fps_1080p': camera.video_fps,
                'has_wifi': camera.has_wifi,
                'has_gps': camera.has_gps,
                'weather_sealed': camera.weather_sealed,
                'msrp_usd': camera.msrp_usd,
                'manual_url': camera.manual_url,
                'image_url': camera.image_url,
                'thumbnail_url': camera.thumbnail_url,
                'description': camera.description,
                'key_features': camera.key_features,
                'source_url': camera.source_url,
                'source_name': camera.source_name,
                'created_at': camera.created_at,
                'updated_at': camera.last_updated || camera.created_at
            };
            
            for (const [field, value] of Object.entries(optionalMappings)) {
                if (value !== null && value !== undefined && value !== '') {
                    fields.push(field);
                    values.push(value);
                }
            }
            
            const placeholders = fields.map(() => '?').join(', ');
            const sql = `
                INSERT INTO cameras_comprehensive (${fields.join(', ')})
                VALUES (${placeholders})
            `;
            
            try {
                await this.run(sql, values);
                console.log(`    ✅ Migrated successfully`);
            } catch (error) {
                console.log(`    ❌ Failed: ${error.message}`);
            }
        }
    }

    async createCompatibilityView() {
        // Drop existing view
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
        console.log('\n🔧 Creating additional tables...');
        
        // Discovery log
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
        
        // Image attributions
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
        
        console.log('  ✅ Additional tables created');
    }
}

// Run if called directly
if (require.main === module) {
    const cleaner = new CleanupAndMigrate();
    cleaner.run().catch(console.error);
}

module.exports = CleanupAndMigrate;