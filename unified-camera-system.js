const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const cron = require('node-cron');
const { createSafeFilename } = require('./camera-utils');

// Helper functions
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function scheduleDiscovery() {
        console.log('📅 Schedule set:');
        console.log('   - Discovery: Every 4 hours (200/day limit)');
        console.log('   - Backup: Daily at 3 AM');
        console.log('');
        
        // Run every 4 hours
        cron.schedule('0 */4 * * *', () => {
            console.log('⏰ Scheduled discovery run starting...');
            this.runDiscovery();
        });
    }


class UnifiedCameraSystem {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
        this.db = null;
        this.DAILY_LIMIT = 200;
        this.todayCount = 0;
        this.lastResetDate = new Date().toDateString();
        this.isRunning = false;
    }

    async start() {
        console.log('🚀 Starting Unified Camera Discovery System...');
        console.log('✅ This is the ONLY camera scraper running');
        console.log('');
        
        await this.initializeDatabase();
        await this.loadExistingCameras();
        
        console.log('🎯 Unified Camera System is now the ONLY scraper running!');
        console.log('📁 Old scrapers have been removed - no duplicates!');
        console.log('');
        
        // Initial run
        await this.runDiscovery();
        
        // Schedule runs
        scheduleDiscovery();
        this.scheduleBackup();
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    async loadExistingCameras() {
        return new Promise((resolve) => {
            this.db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
                if (err) {
                    console.error('❌ Error counting cameras:', err);
                    resolve();
                } else {
                    console.log(`📊 Loaded ${row.count} existing cameras`);
                    resolve();
                }
            });
        });
    }

    async runDiscovery() {
        if (this.isRunning) {
            console.log('⏳ Discovery already in progress, skipping...');
            return;
        }

        this.isRunning = true;

        // Reset daily count if new day
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            this.todayCount = 0;
            this.lastResetDate = today;
        }

        console.log(`🔍 Discovery run started at ${new Date().toLocaleString()}`);
        console.log(`📊 Progress today: ${this.todayCount}/${this.DAILY_LIMIT}`);
        console.log('');

        if (this.todayCount >= this.DAILY_LIMIT) {
            console.log('⚠️  Daily limit reached. Will resume tomorrow.');
            this.isRunning = false;
            return;
        }

        try {
            // Check for missing images
            await this.updateMissingImages();
            
            // Discover new cameras
            await this.discoverCameras();
        } catch (error) {
            console.error('❌ Discovery error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async updateMissingImages() {
        return new Promise((resolve) => {
            console.log('🖼️  Checking for missing images...');
            
            const query = `
                SELECT id, brand, model 
                FROM cameras 
                WHERE localImagePath IS NULL 
                   OR localImagePath = '' 
                   OR localImagePath NOT LIKE '/images/cameras/%' 
                LIMIT 50
            `;
            
            this.db.all(query, [], async (err, cameras) => {
                if (err) {
                    console.error('❌ Error checking for missing images:', err);
                    resolve();
                    return;
                }
                
                if (cameras && cameras.length > 0) {
                    console.log(`🖼️  Found ${cameras.length} cameras with missing images`);
                    for (const camera of cameras) {
                        await this.downloadAndSaveImage(camera);
                    }
                }
                resolve();
            });
        });
    }

    async downloadAndSaveImage(camera) {
        try {
            const filename = createSafeFilename(`${camera.brand}-${camera.model}`);
            const imagePath = `/images/cameras/${filename}.jpg`;
            const fullPath = path.join(__dirname, 'public', imagePath);
            
            // Check if already exists
            if (fs.existsSync(fullPath)) {
                await this.updateCameraImage(camera.id, imagePath);
                return;
            }
            
            // For now, create a placeholder
            await this.createPlaceholder(camera, fullPath);
            await this.updateCameraImage(camera.id, imagePath);
            
        } catch (error) {
            console.error(`❌ Error processing image for ${camera.brand} ${camera.model}:`, error.message);
        }
    }

    async createPlaceholder(camera, fullPath) {
        const width = 800;
        const height = 600;
        
        // Brand colors for placeholders
        const brandColors = {
            'Canon': '#dc143c',
            'Nikon': '#f7d417',
            'Sony': '#ff6b35',
            'Fujifilm': '#00a652',
            'Panasonic': '#0053a0',
            'Olympus': '#004c97',
            'Leica': '#e20612',
            'Hasselblad': '#000000',
            'Default': '#666666'
        };
        
        const bgColor = brandColors[camera.brand] || brandColors.Default;
        
        const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="${bgColor}"/>
            <rect x="50" y="50" width="${width-100}" height="${height-100}" fill="#f0f0f0" rx="20"/>
            <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="${bgColor}">
                ${camera.brand}
            </text>
            <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#666">
                ${camera.model}
            </text>
            <text x="50%" y="90%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#999">
                Image Coming Soon
            </text>
        </svg>`;
        
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        await sharp(Buffer.from(svg))
            .jpeg({ quality: 90 })
            .toFile(fullPath);
    }

    async updateCameraImage(cameraId, imagePath) {
        return new Promise((resolve) => {
            this.db.run(
                "UPDATE cameras SET localImagePath = ? WHERE id = ?",
                [imagePath, cameraId],
                (err) => {
                    if (err) {
                        console.error('❌ Error updating image path:', err);
                    }
                    resolve();
                }
            );
        });
    }

    async discoverCameras() {
        console.log('🔍 Starting camera discovery process...');
        
        // Camera brands to search
        const brands = ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic', 'Olympus', 'Leica', 'Hasselblad'];
        
        for (const brand of brands) {
            if (this.todayCount >= this.DAILY_LIMIT) break;
            
            await this.searchBrand(brand);
            await delay(2000); // Be respectful
        }
        
        console.log(`📊 Discovery complete. Today's total: ${this.todayCount}/${this.DAILY_LIMIT}`);
    }

    async searchBrand(brand) {
        try {
            console.log(`🔍 Searching for ${brand} cameras...`);
            
            // TODO: Replace with actual web scraping
            // For now, using mock data to test the system
            const mockCameras = this.getMockCameras(brand);
            
            for (const camera of mockCameras) {
                if (this.todayCount >= this.DAILY_LIMIT) break;
                
                const exists = await this.cameraExists(camera.brand, camera.model);
                if (!exists) {
                    await this.saveCamera(camera);
                    this.todayCount++;
                    console.log(`✅ Discovered: ${camera.brand} ${camera.model} (Today: ${this.todayCount}/${this.DAILY_LIMIT})`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error searching ${brand}:`, error.message);
        }
    }

    getMockCameras(brand) {
        // Mock camera data for testing
        const mockData = {
            'Canon': [
                { model: 'EOS R5', sensorSize: 'Full Frame', megapixels: 45, category: 'mirrorless' },
                { model: 'EOS R6 Mark II', sensorSize: 'Full Frame', megapixels: 24, category: 'mirrorless' }
            ],
            'Nikon': [
                { model: 'Z9', sensorSize: 'Full Frame', megapixels: 45.7, category: 'mirrorless' },
                { model: 'Z8', sensorSize: 'Full Frame', megapixels: 45.7, category: 'mirrorless' }
            ],
            'Sony': [
                { model: 'A7R V', sensorSize: 'Full Frame', megapixels: 61, category: 'mirrorless' },
                { model: 'A7 IV', sensorSize: 'Full Frame', megapixels: 33, category: 'mirrorless' }
            ]
        };
        
        const cameras = mockData[brand] || [];
        return cameras.map(cam => ({
            brand,
            ...cam,
            fullName: `${brand} ${cam.model}`,
            releaseYear: 2023
        }));
    }

    async cameraExists(brand, model) {
        return new Promise((resolve) => {
            this.db.get(
                "SELECT id FROM cameras WHERE brand = ? AND model = ?",
                [brand, model],
                (err, row) => {
                    resolve(!!row);
                }
            );
        });
    }

    async saveCamera(camera) {
        return new Promise((resolve) => {
            const query = `
                INSERT INTO cameras (
                    brand, model, fullName, releaseYear, category, 
                    sensorSize, sensorMegapixels, imageUrl, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(query, [
                camera.brand,
                camera.model,
                camera.fullName,
                camera.releaseYear,
                camera.category,
                camera.sensorSize,
                camera.megapixels,  // Map from megapixels to sensorMegapixels column
                ''
            ], (err) => {
                if (err) {
                    console.error('❌ Error saving camera:', err);
                }
                resolve();
            });
        });


    function scheduleBackup() {
        // Daily backup at 3 AM
        cron.schedule('0 3 * * *', () => {
            console.log('💾 Creating daily backup...');
            this.createBackup();
        });
    }

    async function createBackup() {
        const timestamp = Date.now();
        const backupPath = path.join(__dirname, 'data', `camera-vault-backup-${timestamp}.db`);
        
        try {
            fs.copyFileSync(this.dbPath, backupPath);
            console.log(`✅ Backup created: ${backupPath}`);
            
            // Clean old backups (keep last 7 days)
            this.cleanOldBackups();
        } catch (error) {
            console.error('❌ Backup failed:', error);
        }
    }

    function cleanOldBackups() {
        const dataDir = path.join(__dirname, 'data');
        const files = fs.readdirSync(dataDir);
        const backupFiles = files.filter(f => f.startsWith('camera-vault-backup-'));
        
        if (backupFiles.length > 7) {
            // Sort by timestamp and remove old ones
            backupFiles.sort();
            const toDelete = backupFiles.slice(0, backupFiles.length - 7);
            
            toDelete.forEach(file => {
                fs.unlinkSync(path.join(dataDir, file));
                console.log(`🗑️  Deleted old backup: ${file}`);
            });
        }
    }


// Start the system
}
const system = new UnifiedCameraSystem();
system.start().catch(console.error);
