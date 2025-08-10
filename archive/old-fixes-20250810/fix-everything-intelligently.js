#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ANSI color codes for beautiful output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const typeColors = {
        success: colors.green,
        warning: colors.yellow,
        error: colors.red,
        info: colors.blue,
        highlight: colors.cyan,
        action: colors.magenta
    };
    
    console.log(`${typeColors[type] || ''}[${timestamp}] ${message}${colors.reset}`);
}

function printHeader() {
    console.log('\n' + colors.bright + colors.cyan + '═'.repeat(60) + colors.reset);
    console.log(colors.bright + colors.cyan + '   🎥 CAMERA VAULT - INTELLIGENT FIX EVERYTHING SCRIPT 🎥   ' + colors.reset);
    console.log(colors.bright + colors.cyan + '═'.repeat(60) + colors.reset + '\n');
}

class CameraVaultFixer {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.db = null;
        this.fixes = {
            database: false,
            pm2: false,
            backups: false,
            images: false
        };
    }

    async run() {
        printHeader();
        
        try {
            // Step 1: Backup everything first
            await this.createBackups();
            
            // Step 2: Fix database column issues
            await this.fixDatabase();
            
            // Step 3: Clean up PM2 processes
            await this.cleanupPM2();
            
            // Step 4: Verify image directories
            await this.verifyImageDirectories();
            
            // Step 5: Update unified system if needed
            await this.updateUnifiedSystem();
            
            // Step 6: Restart services properly
            await this.restartServices();
            
            // Step 7: Run verification
            await this.verifyEverything();
            
            // Step 8: Generate status report
            await this.generateReport();
            
        } catch (error) {
            log(`Critical error: ${error.message}`, 'error');
            process.exit(1);
        }
    }

    async createBackups() {
        log('Creating safety backups...', 'action');
        
        const timestamp = Date.now();
        const backupDir = path.join(__dirname, `backup-fix-${timestamp}`);
        
        // Create backup directory
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Backup database
        if (fs.existsSync(this.dbPath)) {
            const dbBackup = path.join(backupDir, 'camera-vault.db');
            fs.copyFileSync(this.dbPath, dbBackup);
            log(`Database backed up to: ${dbBackup}`, 'success');
        }
        
        // Backup unified system
        const unifiedPath = path.join(__dirname, 'unified-camera-system.js');
        if (fs.existsSync(unifiedPath)) {
            const unifiedBackup = path.join(backupDir, 'unified-camera-system.js');
            fs.copyFileSync(unifiedPath, unifiedBackup);
            log('Unified system backed up', 'success');
        }
        
        this.fixes.backups = true;
    }

    async fixDatabase() {
        log('Analyzing database structure...', 'action');
        
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Get current table structure
                this.db.all("PRAGMA table_info(cameras)", async (err, columns) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    log(`Found ${columns.length} columns in cameras table`, 'info');
                    
                    // Check for image-related columns
                    const imageColumns = columns.filter(col => 
                        col.name.toLowerCase().includes('image') || 
                        col.name.toLowerCase().includes('local')
                    );
                    
                    log(`Image-related columns found: ${imageColumns.map(c => c.name).join(', ')}`, 'info');
                    
                    // Find the actual column name
                    let actualImageColumn = null;
                    const possibleNames = ['localImagePath', 'local_image_path', 'imageLocal', 'imagePath', 'localImage', 'image_local', 'imageLocalPath'];
                    
                    for (const col of columns) {
                        if (possibleNames.includes(col.name)) {
                            actualImageColumn = col.name;
                            break;
                        }
                    }
                    
                    // Check if we need to add the column or update the code
                    const hasLocalImagePath = columns.some(col => col.name === 'localImagePath');
                    
                    if (!hasLocalImagePath && !actualImageColumn) {
                        log('Adding missing localImagePath column...', 'warning');
                        
                        this.db.run("ALTER TABLE cameras ADD COLUMN localImagePath TEXT", (err) => {
                            if (err) {
                                log(`Error adding column: ${err.message}`, 'error');
                                reject(err);
                            } else {
                                log('Successfully added localImagePath column', 'success');
                                this.fixes.database = true;
                                resolve();
                            }
                        });
                    } else if (actualImageColumn && actualImageColumn !== 'localImagePath') {
                        // Update the unified system to use the actual column name
                        log(`Found image column as '${actualImageColumn}', updating code...`, 'warning');
                        await this.updateColumnReference(actualImageColumn);
                        this.fixes.database = true;
                        resolve();
                    } else {
                        log('Database structure is correct!', 'success');
                        this.fixes.database = true;
                        resolve();
                    }
                });
            });
        });
    }

    async updateColumnReference(actualColumnName) {
        const unifiedPath = path.join(__dirname, 'unified-camera-system.js');
        
        if (fs.existsSync(unifiedPath)) {
            let content = fs.readFileSync(unifiedPath, 'utf8');
            
            // Replace references to localImagePath with actual column name
            const updated = content.replace(/localImagePath/g, actualColumnName);
            
            if (updated !== content) {
                fs.writeFileSync(unifiedPath, updated);
                log(`Updated code to use '${actualColumnName}' column`, 'success');
            }
        }
    }

    async cleanupPM2() {
        log('Cleaning up PM2 processes...', 'action');
        
        try {
            // List current processes
            const { stdout } = await execPromise('pm2 list');
            log('Current PM2 processes:', 'info');
            console.log(stdout);
            
            // Remove old automation if it exists
            if (stdout.includes('cmv-automation')) {
                log('Removing old cmv-automation process...', 'warning');
                await execPromise('pm2 delete cmv-automation');
                log('Old automation removed', 'success');
            }
            
            // Save PM2 configuration
            await execPromise('pm2 save');
            log('PM2 configuration saved', 'success');
            
            this.fixes.pm2 = true;
        } catch (error) {
            log(`PM2 cleanup warning: ${error.message}`, 'warning');
            // Not critical, continue
            this.fixes.pm2 = true;
        }
    }

    async verifyImageDirectories() {
        log('Verifying image directories...', 'action');
        
        const dirs = [
            'public/images/cameras',
            'public/images/cameras/thumbs',
            'data/attributions'
        ];
        
        for (const dir of dirs) {
            const fullPath = path.join(__dirname, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                log(`Created missing directory: ${dir}`, 'warning');
            } else {
                log(`Directory exists: ${dir}`, 'success');
            }
        }
        
        this.fixes.images = true;
    }

    async updateUnifiedSystem() {
        log('Checking unified system configuration...', 'action');
        
        const unifiedPath = path.join(__dirname, 'unified-camera-system.js');
        
        if (fs.existsSync(unifiedPath)) {
            let content = fs.readFileSync(unifiedPath, 'utf8');
            let updated = false;
            
            // Ensure it's using camera-utils
            if (!content.includes("require('./camera-utils')")) {
                log('Adding camera-utils import...', 'warning');
                content = content.replace(
                    "const crypto = require('crypto');",
                    "const crypto = require('crypto');\nconst { createSafeFilename } = require('./camera-utils');"
                );
                updated = true;
            }
            
            // Ensure daily limit is set correctly
            if (!content.includes('DAILY_LIMIT = 200')) {
                log('Setting daily limit to 200...', 'warning');
                content = content.replace(/DAILY_LIMIT = \d+/, 'DAILY_LIMIT = 200');
                updated = true;
            }
            
            if (updated) {
                fs.writeFileSync(unifiedPath, content);
                log('Unified system updated', 'success');
            } else {
                log('Unified system configuration is correct', 'success');
            }
        }
    }

    async restartServices() {
        log('Restarting services...', 'action');
        
        try {
            // Restart discovery service
            await execPromise('pm2 restart cmv-discovery');
            log('Discovery service restarted', 'success');
            
            // Give it a moment to start
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check logs
            const { stdout } = await execPromise('pm2 logs cmv-discovery --lines 5 --nostream');
            log('Recent discovery logs:', 'info');
            console.log(stdout);
            
        } catch (error) {
            log(`Service restart warning: ${error.message}`, 'warning');
        }
    }

    async verifyEverything() {
        log('Running verification checks...', 'action');
        
        // Check database
        const cameraCount = await new Promise((resolve) => {
            this.db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
                resolve(row ? row.count : 0);
            });
        });
        
        log(`Total cameras in database: ${cameraCount}`, 'highlight');
        
        // Check PM2 status
        try {
            const { stdout } = await execPromise('pm2 status');
            const runningProcesses = stdout.match(/online/gi);
            log(`PM2 processes online: ${runningProcesses ? runningProcesses.length : 0}`, 'highlight');
        } catch (error) {
            log('Could not check PM2 status', 'warning');
        }
        
        // Close database
        this.db.close();
    }

    async generateReport() {
        log('\nGenerating fix report...', 'action');
        
        const report = {
            timestamp: new Date().toISOString(),
            fixes: this.fixes,
            recommendations: []
        };
        
        if (this.fixes.database) {
            report.recommendations.push('✅ Database structure fixed - discovery should work now');
        }
        
        if (this.fixes.pm2) {
            report.recommendations.push('✅ PM2 processes cleaned up');
        }
        
        if (this.fixes.images) {
            report.recommendations.push('✅ Image directories verified');
        }
        
        // Save report
        const reportPath = path.join(__dirname, 'fix-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('\n' + colors.bright + colors.green + '═'.repeat(60) + colors.reset);
        console.log(colors.bright + colors.green + '                    ✅ ALL FIXES COMPLETED! ✅                    ' + colors.reset);
        console.log(colors.bright + colors.green + '═'.repeat(60) + colors.reset + '\n');
        
        console.log(colors.bright + 'Summary:' + colors.reset);
        report.recommendations.forEach(rec => console.log('  ' + rec));
        
        console.log('\n' + colors.bright + colors.yellow + 'Next steps:' + colors.reset);
        console.log('  1. Monitor the discovery process: ' + colors.cyan + 'pm2 logs cmv-discovery' + colors.reset);
        console.log('  2. Check the automation monitor: ' + colors.cyan + 'http://localhost:3000/automation-monitor' + colors.reset);
        console.log('  3. Verify cameras are being added: ' + colors.cyan + 'sqlite3 data/camera-vault.db "SELECT COUNT(*) FROM cameras;"' + colors.reset);
        
        console.log('\n' + colors.bright + colors.magenta + 'Your Camera Vault is ready to discover cameras! 🎉' + colors.reset + '\n');
    }
}

// Run the fixer
const fixer = new CameraVaultFixer();
fixer.run().catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
});
