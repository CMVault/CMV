const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import the safe filename function
const { createSafeFilename } = require('./auto-scraper');

class CMVAutomation {
    constructor() {
        this.db = new sqlite3.Database('./data/camera-vault.db');
        this.isRunning = false;
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
    }

    async start() {
        console.log('🤖 CMV Automation Starting...\n');
        
        // Run immediately on start
        await this.runAutomation();
        
        // Schedule for every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            await this.runAutomation();
        });
        
        console.log('📅 Automation scheduled - runs every 6 hours\n');
    }

    async runAutomation() {
        if (this.isRunning) {
            console.log('⏳ Automation already running, skipping...\n');
            return;
        }

        this.isRunning = true;
        const startTime = new Date();
        console.log(`\n🚀 Starting automation run at ${startTime.toLocaleString()}\n`);

        try {
            // 1. Database backup
            await this.backupDatabase();
            
            // 2. Check for missing images
            await this.checkAndUpdateImages();
            
            // 3. Update camera information
            await this.updateCameraInfo();
            
            // 4. Generate reports
            await this.generateReports();
            
            const endTime = new Date();
            const duration = Math.round((endTime - startTime) / 1000);
            console.log(`\n✅ Automation complete! Duration: ${duration} seconds\n`);
            
        } catch (error) {
            console.error('❌ Automation error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async backupDatabase() {
        console.log('💾 Backing up database...');
        const timestamp = Date.now();
        const backupPath = `./data/camera-vault-backup-${timestamp}.db`;
        
        try {
            const data = await fs.readFile('./data/camera-vault.db');
            await fs.writeFile(backupPath, data);
            console.log(`   ✅ Backup saved: ${backupPath}\n`);
        } catch (error) {
            console.error('   ❌ Backup failed:', error.message);
        }
    }

    async checkAndUpdateImages() {
        console.log('🖼️  Checking for missing images...');
        
        const cameras = await this.getCamerasNeedingImages();
        console.log(`   Found ${cameras.length} cameras needing images`);
        
        for (const camera of cameras) {
            await this.updateCameraImage(camera);
            // Respectful delay
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
        
        console.log('   ✅ Image check complete\n');
    }

    getCamerasNeedingImages() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, brand, model, localImagePath 
                FROM cameras 
                WHERE localImagePath IS NULL 
                   OR localImagePath = '' 
                   OR localImagePath NOT LIKE '/images/cameras/%'
            `;
            
            this.db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    async updateCameraImage(camera) {
        console.log(`   📸 Processing: ${camera.brand} ${camera.model}`);
        
        // Use safe filename function
        const safeFilename = createSafeFilename(camera.brand, camera.model);
        const imagePath = `/images/cameras/${safeFilename}.jpg`;
        const fullImagePath = `./public${imagePath}`;
        const thumbPath = `./public/images/cameras/thumbs/${safeFilename}-thumb.jpg`;
        
        // Check if file already exists
        try {
            await fs.access(fullImagePath);
            console.log(`      ✓ Image already exists: ${safeFilename}.jpg`);
            
            // Update database to point to existing file
            await this.updateDatabasePath(camera.id, imagePath);
            return;
        } catch {
            // File doesn't exist, need to create/download
        }
        
        try {
            // Try to find and download image
            const imageUrl = await this.findCameraImage(camera.brand, camera.model);
            
            if (imageUrl) {
                await this.downloadAndSaveImage(imageUrl, fullImagePath, thumbPath);
                await this.updateDatabasePath(camera.id, imagePath, imageUrl);
                console.log(`      ✅ Downloaded and saved image`);
            } else {
                // Create placeholder with safe filename
                await this.createPlaceholder(camera, fullImagePath, thumbPath);
                await this.updateDatabasePath(camera.id, imagePath, 'placeholder');
                console.log(`      ✅ Created placeholder`);
            }
            
        } catch (error) {
            console.error(`      ❌ Error: ${error.message}`);
        }
    }

    async findCameraImage(brand, model) {
        // Simplified image search - you can expand this
        try {
            const searchQuery = `${brand} ${model} camera`.replace(/\s+/g, '+');
            const searchUrl = `https://www.bhphotovideo.com/c/search?q=${searchQuery}`;
            
            const response = await axios.get(searchUrl, { 
                headers: this.headers,
                timeout: 10000 
            });
            
            const $ = cheerio.load(response.data);
            const imageUrl = $('img[data-src]').first().attr('data-src');
            
            return imageUrl ? `https:${imageUrl}` : null;
        } catch {
            return null;
        }
    }

    async downloadAndSaveImage(imageUrl, fullPath, thumbPath) {
        const response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            headers: this.headers 
        });
        
        const buffer = Buffer.from(response.data);
        
        // Ensure directories exist
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.mkdir(path.dirname(thumbPath), { recursive: true });
        
        // Save full image
        await sharp(buffer)
            .resize(1200, null, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(fullPath);
        
        // Save thumbnail
        await sharp(buffer)
            .resize(300, null, { withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
    }

    async createPlaceholder(camera, fullPath, thumbPath) {
        const svg = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f0f0f0"/>
                <text x="400" y="280" text-anchor="middle" fill="#333" 
                      font-family="Arial" font-size="48" font-weight="bold">
                    ${camera.brand}
                </text>
                <text x="400" y="340" text-anchor="middle" fill="#333" 
                      font-family="Arial" font-size="36">
                    ${camera.model}
                </text>
                <text x="400" y="420" text-anchor="middle" fill="#999" 
                      font-family="Arial" font-size="20">
                    Image Coming Soon
                </text>
            </svg>
        `;
        
        // Ensure directories exist
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.mkdir(path.dirname(thumbPath), { recursive: true });
        
        const buffer = Buffer.from(svg);
        
        await sharp(buffer)
            .jpeg({ quality: 85 })
            .toFile(fullPath);
        
        await sharp(buffer)
            .resize(300)
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
    }

    updateDatabasePath(cameraId, localPath, imageUrl = null) {
        return new Promise((resolve, reject) => {
            const query = imageUrl 
                ? `UPDATE cameras SET localImagePath = ?, imageUrl = ? WHERE id = ?`
                : `UPDATE cameras SET localImagePath = ? WHERE id = ?`;
            
            const params = imageUrl 
                ? [localPath, imageUrl, cameraId]
                : [localPath, cameraId];
            
            this.db.run(query, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async updateCameraInfo() {
        console.log('📊 Updating camera information...');
        // Add any additional camera info updates here
        console.log('   ✅ Camera info update complete\n');
    }

    async generateReports() {
        console.log('📈 Generating reports...');
        
        const stats = await this.getDatabaseStats();
        const report = {
            timestamp: new Date().toISOString(),
            totalCameras: stats.total,
            camerasWithImages: stats.withImages,
            camerasWithoutImages: stats.withoutImages,
            lastRun: new Date().toLocaleString()
        };
        
        await fs.writeFile(
            './data/automation-report.json', 
            JSON.stringify(report, null, 2)
        );
        
        console.log('   ✅ Reports generated\n');
    }

    getDatabaseStats() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN localImagePath IS NOT NULL AND localImagePath != '' THEN 1 END) as withImages,
                    COUNT(CASE WHEN localImagePath IS NULL OR localImagePath = '' THEN 1 END) as withoutImages
                FROM cameras
            `;
            
            this.db.get(query, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
}

// Export for use in other modules
module.exports = CMVAutomation;

// Run if called directly
if (require.main === module) {
    const automation = new CMVAutomation();
    automation.start().catch(console.error);
}