const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SafeDatabaseChecker {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.db = null;
    }

    async check() {
        console.log('='.repeat(70));
        console.log('Camera Vault Database Status Check (Safe Mode)');
        console.log('='.repeat(70));
        
        try {
            await this.connect();
            
            // Check what tables exist
            console.log('\n📊 DATABASE TABLES:');
            const tables = await this.getTables();
            
            for (const table of tables) {
                try {
                    const count = await this.getTableCount(table.name);
                    const columns = await this.getTableColumns(table.name);
                    
                    console.log(`\n📁 Table: ${table.name}`);
                    console.log(`   Records: ${count}`);
                    console.log(`   Columns: ${columns.length}`);
                    
                    if (table.name === 'cameras' || table.name === 'cameras_comprehensive') {
                        // Show column names
                        console.log(`\n   Available columns:`);
                        const columnNames = columns.map(c => c.name);
                        
                        // Group columns by category for readability
                        const basicCols = columnNames.filter(c => 
                            ['id', 'brand', 'model', 'full_name', 'slug', 'category'].includes(c)
                        );
                        const sensorCols = columnNames.filter(c => 
                            c.includes('sensor') || c.includes('megapixels') || c.includes('iso')
                        );
                        const videoCols = columnNames.filter(c => 
                            c.includes('video')
                        );
                        const featureCols = columnNames.filter(c => 
                            c.startsWith('has_') || c.includes('_sealed') || c.includes('ibis')
                        );
                        const urlCols = columnNames.filter(c => 
                            c.includes('_url')
                        );
                        
                        if (basicCols.length > 0) {
                            console.log(`   Basic: ${basicCols.join(', ')}`);
                        }
                        if (sensorCols.length > 0) {
                            console.log(`   Sensor: ${sensorCols.join(', ')}`);
                        }
                        if (videoCols.length > 0) {
                            console.log(`   Video: ${videoCols.join(', ')}`);
                        }
                        if (featureCols.length > 0) {
                            console.log(`   Features: ${featureCols.join(', ')}`);
                        }
                        if (urlCols.length > 0) {
                            console.log(`   URLs: ${urlCols.join(', ')}`);
                        }
                        
                        // Try to get sample data safely
                        console.log(`\n   Sample data:`);
                        const samples = await this.getSafeCameraData(table.name);
                        if (samples.length > 0) {
                            samples.forEach(cam => {
                                const brand = cam.brand || 'Unknown';
                                const model = cam.model || 'Unknown';
                                const year = cam.release_year || cam.releaseYear || 'N/A';
                                console.log(`   - ${brand} ${model} (${year})`);
                            });
                        } else {
                            console.log(`   No cameras found`);
                        }
                    }
                    
                } catch (error) {
                    console.log(`   ❌ Error reading table: ${error.message}`);
                }
            }
            
            // Safe camera statistics
            console.log('\n' + '='.repeat(70));
            console.log('📷 CAMERA DATA ANALYSIS:');
            
            const mainTable = tables.find(t => t.name === 'cameras_comprehensive') ? 'cameras_comprehensive' : 'cameras';
            
            if (tables.find(t => t.name === mainTable)) {
                try {
                    console.log(`\nUsing table: ${mainTable}`);
                    
                    // Get safe stats
                    const stats = await this.getSafeCameraStats(mainTable);
                    
                    console.log(`Total cameras: ${stats.total}`);
                    
                    if (stats.brands.length > 0) {
                        console.log(`\nBrands (${stats.brands.length}):`);
                        stats.brands.forEach(b => {
                            console.log(`  - ${b.brand}: ${b.count} cameras`);
                        });
                    }
                    
                    if (stats.hasCategories) {
                        console.log(`\nCategories:`);
                        stats.categories.forEach(c => {
                            console.log(`  - ${c.category || 'Unknown'}: ${c.count} cameras`);
                        });
                    }
                    
                    // Check data completeness
                    console.log('\n📊 DATA COMPLETENESS:');
                    const completeness = await this.checkSafeDataCompleteness(mainTable);
                    
                    if (completeness.hasImageUrl) {
                        console.log(`  Images: ${completeness.withImages}/${stats.total} (${Math.round(completeness.withImages/stats.total*100)}%)`);
                    }
                    if (completeness.hasManualUrl) {
                        console.log(`  Manuals: ${completeness.withManuals}/${stats.total} (${Math.round(completeness.withManuals/stats.total*100)}%)`);
                    }
                    if (completeness.hasDescription) {
                        console.log(`  Descriptions: ${completeness.withDescriptions}/${stats.total} (${Math.round(completeness.withDescriptions/stats.total*100)}%)`);
                    }
                    
                } catch (error) {
                    console.log(`\n❌ Error analyzing cameras: ${error.message}`);
                }
            }
            
            // Check discovery logs
            if (tables.find(t => t.name === 'discovery_log')) {
                console.log('\n📋 DISCOVERY HISTORY:');
                try {
                    const logs = await this.getRecentDiscoveryLogs();
                    
                    if (logs.length > 0) {
                        console.log('\nRecent discovery runs:');
                        logs.forEach(log => {
                            console.log(`  - ${log.timestamp}: ${log.cameras_discovered} discovered, ${log.cameras_saved} saved (${log.status})`);
                        });
                    } else {
                        console.log('  No discovery runs found');
                    }
                } catch (error) {
                    console.log(`  ❌ Error reading logs: ${error.message}`);
                }
            }
            
            // Recommendations
            console.log('\n' + '='.repeat(70));
            console.log('📝 RECOMMENDATIONS:');
            
            const cameraColumns = await this.getTableColumns('cameras');
            const columnCount = cameraColumns.length;
            
            if (columnCount < 30) {
                console.log('\n1. Your database has limited fields. Consider upgrading to the comprehensive schema:');
                console.log('   node migrate-to-comprehensive.js');
            } else if (columnCount > 50 && !tables.find(t => t.name === 'cameras_comprehensive')) {
                console.log('\n1. Your cameras table has many columns but may have issues.');
                console.log('   Run the fix script first:');
                console.log('   node safe-database-fix.js');
            }
            
            console.log('\n2. To start discovery system:');
            console.log('   node unified-camera-system.js');
            
            console.log('\n' + '='.repeat(70));
            
        } catch (error) {
            console.error('❌ Fatal error:', error.message);
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
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
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

    getSafeCameraData(tableName) {
        return new Promise((resolve) => {
            // Try with minimal columns first
            this.db.all(
                `SELECT brand, model FROM ${tableName} LIMIT 5`,
                (err, rows) => {
                    if (err) {
                        resolve([]);
                    } else {
                        // Try to get more data for each camera
                        const safeRows = rows || [];
                        resolve(safeRows);
                    }
                }
            );
        });
    }

    getSafeCameraStats(tableName) {
        return new Promise(async (resolve) => {
            const stats = {
                total: 0,
                brands: [],
                categories: [],
                hasCategories: false
            };
            
            try {
                // Get total count
                stats.total = await this.getTableCount(tableName);
                
                // Get brands
                this.db.all(
                    `SELECT brand, COUNT(*) as count FROM ${tableName} WHERE brand IS NOT NULL GROUP BY brand ORDER BY count DESC`,
                    async (err, brandRows) => {
                        if (!err && brandRows) {
                            stats.brands = brandRows;
                        }
                        
                        // Check if category column exists
                        const columns = await this.getTableColumns(tableName);
                        if (columns.some(c => c.name === 'category')) {
                            stats.hasCategories = true;
                            
                            // Get categories
                            this.db.all(
                                `SELECT category, COUNT(*) as count FROM ${tableName} GROUP BY category ORDER BY count DESC`,
                                (err2, catRows) => {
                                    if (!err2 && catRows) {
                                        stats.categories = catRows;
                                    }
                                    resolve(stats);
                                }
                            );
                        } else {
                            resolve(stats);
                        }
                    }
                );
            } catch (error) {
                resolve(stats);
            }
        });
    }

    checkSafeDataCompleteness(tableName) {
        return new Promise(async (resolve) => {
            const result = {
                hasImageUrl: false,
                hasManualUrl: false,
                hasDescription: false,
                withImages: 0,
                withManuals: 0,
                withDescriptions: 0
            };
            
            try {
                // Check which columns exist
                const columns = await this.getTableColumns(tableName);
                const columnNames = columns.map(c => c.name);
                
                result.hasImageUrl = columnNames.includes('image_url');
                result.hasManualUrl = columnNames.includes('manual_url');
                result.hasDescription = columnNames.includes('description');
                
                // Count non-null values for each existing column
                if (result.hasImageUrl) {
                    const imgCount = await new Promise((res) => {
                        this.db.get(
                            `SELECT COUNT(*) as count FROM ${tableName} WHERE image_url IS NOT NULL AND image_url != ''`,
                            (err, row) => res(err ? 0 : row.count)
                        );
                    });
                    result.withImages = imgCount;
                }
                
                if (result.hasManualUrl) {
                    const manualCount = await new Promise((res) => {
                        this.db.get(
                            `SELECT COUNT(*) as count FROM ${tableName} WHERE manual_url IS NOT NULL AND manual_url != ''`,
                            (err, row) => res(err ? 0 : row.count)
                        );
                    });
                    result.withManuals = manualCount;
                }
                
                if (result.hasDescription) {
                    const descCount = await new Promise((res) => {
                        this.db.get(
                            `SELECT COUNT(*) as count FROM ${tableName} WHERE description IS NOT NULL AND description != ''`,
                            (err, row) => res(err ? 0 : row.count)
                        );
                    });
                    result.withDescriptions = descCount;
                }
                
            } catch (error) {
                // Return partial results
            }
            
            resolve(result);
        });
    }

    getRecentDiscoveryLogs() {
        return new Promise((resolve) => {
            this.db.all(
                `SELECT * FROM discovery_log ORDER BY timestamp DESC LIMIT 5`,
                (err, rows) => {
                    if (err) resolve([]);
                    else resolve(rows || []);
                }
            );
        });
    }
}

// Run if called directly
if (require.main === module) {
    const checker = new SafeDatabaseChecker();
    checker.check();
}

module.exports = SafeDatabaseChecker;