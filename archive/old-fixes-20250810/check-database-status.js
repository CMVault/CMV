const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.db = null;
    }

    async check() {
        console.log('='.repeat(70));
        console.log('Camera Vault Database Status Check');
        console.log('='.repeat(70));
        
        try {
            await this.connect();
            
            // Check what tables exist
            console.log('\n📊 DATABASE TABLES:');
            const tables = await this.getTables();
            
            for (const table of tables) {
                const count = await this.getTableCount(table.name);
                const columns = await this.getTableColumns(table.name);
                
                console.log(`\n📁 Table: ${table.name}`);
                console.log(`   Records: ${count}`);
                console.log(`   Columns: ${columns.length}`);
                
                if (table.name === 'cameras' || table.name === 'cameras_comprehensive') {
                    // Show sample data
                    const samples = await this.getSampleCameras(table.name);
                    if (samples.length > 0) {
                        console.log(`\n   Sample cameras:`);
                        samples.forEach(cam => {
                            console.log(`   - ${cam.brand} ${cam.model} (${cam.release_year || 'N/A'})`);
                        });
                    }
                    
                    // Show column details for camera tables
                    console.log(`\n   Column details:`);
                    columns.forEach(col => {
                        console.log(`   - ${col.name} (${col.type})`);
                    });
                }
            }
            
            // Check for specific camera data
            console.log('\n' + '='.repeat(70));
            console.log('📷 CAMERA DATA ANALYSIS:');
            
            const mainTable = tables.find(t => t.name === 'cameras_comprehensive') ? 'cameras_comprehensive' : 'cameras';
            
            if (tables.find(t => t.name === mainTable)) {
                const stats = await this.getCameraStats(mainTable);
                
                console.log(`\nUsing table: ${mainTable}`);
                console.log(`Total cameras: ${stats.total}`);
                console.log(`\nBrands (${stats.brands.length}):`);
                stats.brands.forEach(b => {
                    console.log(`  - ${b.brand}: ${b.count} cameras`);
                });
                
                console.log(`\nCategories:`);
                stats.categories.forEach(c => {
                    console.log(`  - ${c.category || 'Unknown'}: ${c.count} cameras`);
                });
                
                console.log(`\nYear range: ${stats.yearRange.min || 'N/A'} - ${stats.yearRange.max || 'N/A'}`);
                
                // Check data completeness
                console.log('\n📊 DATA COMPLETENESS:');
                const completeness = await this.checkDataCompleteness(mainTable);
                
                console.log(`  Images: ${completeness.withImages}/${stats.total} (${Math.round(completeness.withImages/stats.total*100)}%)`);
                console.log(`  Manuals: ${completeness.withManuals}/${stats.total} (${Math.round(completeness.withManuals/stats.total*100)}%)`);
                console.log(`  Descriptions: ${completeness.withDescriptions}/${stats.total} (${Math.round(completeness.withDescriptions/stats.total*100)}%)`);
                
                if (mainTable === 'cameras_comprehensive') {
                    console.log(`\n📈 ENHANCED FIELDS (160+ fields schema):`);
                    const enhancedStats = await this.getEnhancedFieldStats();
                    
                    console.log(`  Cameras with video specs: ${enhancedStats.withVideo}`);
                    console.log(`  Cameras with AF details: ${enhancedStats.withAF}`);
                    console.log(`  Cameras with battery info: ${enhancedStats.withBattery}`);
                    console.log(`  Cameras with lens mount data: ${enhancedStats.withLensMount}`);
                }
            }
            
            // Check discovery logs
            if (tables.find(t => t.name === 'discovery_log')) {
                console.log('\n📋 DISCOVERY HISTORY:');
                const logs = await this.getRecentDiscoveryLogs();
                
                if (logs.length > 0) {
                    console.log('\nRecent discovery runs:');
                    logs.forEach(log => {
                        console.log(`  - ${log.timestamp}: ${log.cameras_discovered} discovered, ${log.cameras_saved} saved (${log.status})`);
                    });
                }
            }
            
            console.log('\n' + '='.repeat(70));
            
        } catch (error) {
            console.error('❌ Error:', error.message);
        } finally {
            if (this.db) {
                this.db.close();
            }
        }
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(new Error(`Cannot open database: ${err.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    getTables() {
        return new Promise((resolve, reject) => {
            this.db.all(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
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
                    else resolve(row.count);
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
                    else resolve(rows);
                }
            );
        });
    }

    getSampleCameras(tableName) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT brand, model, release_year FROM ${tableName} LIMIT 5`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    getCameraStats(tableName) {
        return new Promise(async (resolve, reject) => {
            try {
                const total = await this.getTableCount(tableName);
                
                const brands = await new Promise((res, rej) => {
                    this.db.all(
                        `SELECT brand, COUNT(*) as count FROM ${tableName} GROUP BY brand ORDER BY count DESC`,
                        (err, rows) => err ? rej(err) : res(rows)
                    );
                });
                
                const categories = await new Promise((res, rej) => {
                    this.db.all(
                        `SELECT category, COUNT(*) as count FROM ${tableName} GROUP BY category ORDER BY count DESC`,
                        (err, rows) => err ? rej(err) : res(rows)
                    );
                });
                
                const yearRange = await new Promise((res, rej) => {
                    this.db.get(
                        `SELECT MIN(release_year) as min, MAX(release_year) as max FROM ${tableName}`,
                        (err, row) => err ? rej(err) : res(row)
                    );
                });
                
                resolve({ total, brands, categories, yearRange });
            } catch (error) {
                reject(error);
            }
        });
    }

    checkDataCompleteness(tableName) {
        return new Promise(async (resolve, reject) => {
            try {
                const withImages = await new Promise((res, rej) => {
                    this.db.get(
                        `SELECT COUNT(*) as count FROM ${tableName} WHERE image_url IS NOT NULL AND image_url != ''`,
                        (err, row) => err ? rej(err) : res(row.count)
                    );
                });
                
                const withManuals = await new Promise((res, rej) => {
                    this.db.get(
                        `SELECT COUNT(*) as count FROM ${tableName} WHERE manual_url IS NOT NULL AND manual_url != ''`,
                        (err, row) => err ? rej(err) : res(row.count)
                    );
                });
                
                const withDescriptions = await new Promise((res, rej) => {
                    this.db.get(
                        `SELECT COUNT(*) as count FROM ${tableName} WHERE description IS NOT NULL AND description != ''`,
                        (err, row) => err ? rej(err) : res(row.count)
                    );
                });
                
                resolve({ withImages, withManuals, withDescriptions });
            } catch (error) {
                reject(error);
            }
        });
    }

    getEnhancedFieldStats() {
        return new Promise(async (resolve, reject) => {
            try {
                const stats = {};
                
                // Check various enhanced fields
                const fields = [
                    { name: 'withVideo', column: 'video_resolution_max' },
                    { name: 'withAF', column: 'af_points_total' },
                    { name: 'withBattery', column: 'battery_model' },
                    { name: 'withLensMount', column: 'lens_mount' }
                ];
                
                for (const field of fields) {
                    stats[field.name] = await new Promise((res, rej) => {
                        this.db.get(
                            `SELECT COUNT(*) as count FROM cameras_comprehensive WHERE ${field.column} IS NOT NULL AND ${field.column} != ''`,
                            (err, row) => err ? rej(err) : res(row ? row.count : 0)
                        );
                    });
                }
                
                resolve(stats);
            } catch (error) {
                reject(error);
            }
        });
    }

    getRecentDiscoveryLogs() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM discovery_log ORDER BY timestamp DESC LIMIT 5`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }
}

// Run if called directly
if (require.main === module) {
    const checker = new DatabaseChecker();
    checker.check();
}

module.exports = DatabaseChecker;