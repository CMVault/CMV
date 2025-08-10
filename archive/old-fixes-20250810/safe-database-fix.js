const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class SafeDatabaseFix {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.db = null;
    }

    async fix() {
        console.log('='.repeat(60));
        console.log('Camera Vault Database Safe Fix');
        console.log('='.repeat(60));
        
        try {
            // 1. Create backup first
            await this.createBackup();
            
            // 2. Connect to database
            await this.connect();
            
            // 3. Analyze current state
            console.log('\n📊 Analyzing database structure...');
            const tables = await this.getTables();
            console.log(`Found ${tables.length} tables:`, tables.map(t => t.name).join(', '));
            
            // 4. Check cameras table structure
            const camerasColumns = await this.getTableColumns('cameras');
            console.log(`\n📷 Cameras table has ${camerasColumns.length} columns`);
            
            // Check which columns are missing
            const expectedBasicColumns = [
                'id', 'brand', 'model', 'full_name', 'slug', 'category', 
                'release_year', 'sensor_size', 'sensor_type', 'megapixels',
                'max_iso', 'continuous_shooting_speed', 'video_resolution',
                'video_fps', 'has_ibis', 'has_wifi', 'has_gps', 'weather_sealed',
                'msrp_usd', 'image_url', 'thumbnail_url', 'manual_url',
                'description', 'key_features', 'source_url', 'source_name',
                'last_updated', 'created_at'
            ];
            
            const existingColumns = camerasColumns.map(c => c.name);
            const missingColumns = expectedBasicColumns.filter(col => !existingColumns.includes(col));
            
            if (missingColumns.length > 0) {
                console.log('\n⚠️  Missing columns:', missingColumns.join(', '));
                
                // Add missing columns safely
                for (const column of missingColumns) {
                    await this.addColumnSafely('cameras', column);
                }
            } else {
                console.log('✅ All expected columns present');
            }
            
            // 5. Get camera data safely
            console.log('\n📊 Checking camera data...');
            const cameraCount = await this.getTableCount('cameras');
            console.log(`Found ${cameraCount} cameras`);
            
            if (cameraCount > 0) {
                const cameras = await this.getCamerasData();
                console.log('\nSample cameras:');
                cameras.slice(0, 5).forEach(cam => {
                    console.log(`  - ${cam.brand || 'Unknown'} ${cam.model || 'Unknown'}`);
                });
            }
            
            // 6. Check if we need comprehensive migration
            const hasComprehensive = tables.some(t => t.name === 'cameras_comprehensive');
            
            if (!hasComprehensive && cameraCount > 0) {
                console.log('\n🔄 Preparing for comprehensive schema migration...');
                console.log('Run "node migrate-to-comprehensive.js" to upgrade to 160+ fields');
            } else if (hasComprehensive) {
                console.log('\n✅ Comprehensive schema already exists');
            }
            
            // 7. Create missing tables
            await this.createMissingTables();
            
            console.log('\n' + '='.repeat(60));
            console.log('✅ Database fix completed successfully!');
            console.log('='.repeat(60));
            
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
        const backupDir = path.join(__dirname, 'backups');
        const backupFile = path.join(backupDir, `pre-fix-${timestamp}.db`);
        
        await fs.mkdir(backupDir, { recursive: true });
        
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
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }

    getTables() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    getTableColumns(tableName) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `PRAGMA table_info(${tableName})`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    getTableCount(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM ${tableName}`,
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.count : 0);
                }
            );
        });
    }

    async addColumnSafely(tableName, columnName) {
        console.log(`  Adding column: ${columnName}`);
        
        // Determine appropriate data type and default value
        let columnDef = '';
        
        switch(columnName) {
            case 'release_year':
            case 'max_iso':
            case 'video_fps':
            case 'msrp_usd':
                columnDef = `${columnName} INTEGER`;
                break;
            case 'megapixels':
            case 'continuous_shooting_speed':
                columnDef = `${columnName} REAL`;
                break;
            case 'has_ibis':
            case 'has_wifi':
            case 'has_gps':
            case 'weather_sealed':
                columnDef = `${columnName} BOOLEAN DEFAULT 0`;
                break;
            case 'created_at':
            case 'last_updated':
                columnDef = `${columnName} DATETIME DEFAULT CURRENT_TIMESTAMP`;
                break;
            default:
                columnDef = `${columnName} TEXT`;
        }
        
        try {
            await this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
            console.log(`    ✅ Added ${columnName}`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`    ℹ️  Column ${columnName} already exists`);
            } else {
                throw error;
            }
        }
    }

    getCamerasData() {
        return new Promise((resolve, reject) => {
            // Use safe column selection to avoid errors
            this.db.all(
                `SELECT * FROM cameras LIMIT 10`,
                (err, rows) => {
                    if (err) {
                        // If error, try with specific columns
                        this.db.all(
                            `SELECT id, brand, model FROM cameras LIMIT 10`,
                            (err2, rows2) => {
                                if (err2) reject(err2);
                                else resolve(rows2 || []);
                            }
                        );
                    } else {
                        resolve(rows || []);
                    }
                }
            );
        });
    }

    async createMissingTables() {
        console.log('\n🔧 Checking for missing tables...');
        
        // Discovery log table
        await this.createTableIfNotExists('discovery_log', `
            CREATE TABLE discovery_log (
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
        await this.createTableIfNotExists('image_attributions', `
            CREATE TABLE image_attributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER,
                image_url TEXT,
                source_name TEXT,
                source_url TEXT,
                photographer TEXT,
                license TEXT,
                attribution_required BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async createTableIfNotExists(tableName, createSQL) {
        const exists = await this.tableExists(tableName);
        if (!exists) {
            await this.run(createSQL);
            console.log(`  ✅ Created table: ${tableName}`);
        } else {
            console.log(`  ℹ️  Table already exists: ${tableName}`);
        }
    }

    tableExists(tableName) {
        return new Promise((resolve, reject) => {
            this.db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [tableName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
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
}

// Run if called directly
if (require.main === module) {
    const fixer = new SafeDatabaseFix();
    fixer.fix().catch(console.error);
}

module.exports = SafeDatabaseFix;