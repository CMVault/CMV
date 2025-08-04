// Save this as cmv-automation-fixed.js
// This is a modified version that uses the adapter for saving

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Import our adapter
const CameraAdapter = require('./automation-adapter');

// Configuration
const CONFIG = {
    dbPath: path.join(__dirname, 'data', 'camera-vault.db'),
    imagesDir: path.join(__dirname, 'public', 'images', 'cameras'),
    thumbsDir: path.join(__dirname, 'public', 'images', 'cameras', 'thumbs'),
    placeholderImage: path.join(__dirname, 'public', 'images', 'camera-placeholder.jpg'),
    attributionsDir: path.join(__dirname, 'data', 'attributions'),
    maxRetries: 3,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    }
};

// Camera list to process
const CAMERA_LIST = [
    // DSLRs
    { brand: 'Canon', model: 'EOS 5D Mark IV', category: 'dslr' },
    { brand: 'Nikon', model: 'D850', category: 'dslr' },
    { brand: 'Nikon', model: 'D780', category: 'dslr' },
    
    // Mirrorless
    { brand: 'Sony', model: 'A7R V', category: 'mirrorless' },
    { brand: 'Sony', model: 'A7 IV', category: 'mirrorless' },
    { brand: 'Sony', model: 'A7S III', category: 'mirrorless' },
    { brand: 'Canon', model: 'EOS R5', category: 'mirrorless' },
    { brand: 'Canon', model: 'EOS R6', category: 'mirrorless' },
    { brand: 'Canon', model: 'EOS R7', category: 'mirrorless' },
    { brand: 'Nikon', model: 'Z9', category: 'mirrorless' },
    { brand: 'Nikon', model: 'Z6 III', category: 'mirrorless' },
    { brand: 'Fujifilm', model: 'X-T5', category: 'mirrorless' },
    { brand: 'Fujifilm', model: 'X-H2S', category: 'mirrorless' },
    { brand: 'Fujifilm', model: 'GFX 100 II', category: 'medium format' },
    
    // Cinema
    { brand: 'Sony', model: 'FX6', category: 'cinema' },
    { brand: 'Sony', model: 'FX3', category: 'cinema' },
    { brand: 'RED', model: 'KOMODO', category: 'cinema' },
    { brand: 'ARRI', model: 'ALEXA Mini LF', category: 'cinema' },
    { brand: 'Blackmagic', model: 'URSA Mini Pro 12K', category: 'cinema' },
    
    // Film Cameras
    { brand: 'Hasselblad', model: '500C/M', category: 'film' },
    { brand: 'Leica', model: 'M6', category: 'film' },
    { brand: 'Nikon', model: 'F3', category: 'film' },
    { brand: 'Canon', model: 'AE-1', category: 'film' }
];

class CameraAutomation {
    constructor() {
        this.adapter = new CameraAdapter(CONFIG.dbPath);
        this.stats = {
            processed: 0,
            saved: 0,
            errors: [],
            realImages: 0,
            placeholders: 0
        };
    }

    async initialize() {
        // Ensure directories exist
        await fs.mkdir(CONFIG.imagesDir, { recursive: true });
        await fs.mkdir(CONFIG.thumbsDir, { recursive: true });
        await fs.mkdir(CONFIG.attributionsDir, { recursive: true });
        
        console.log('✅ Automation initialized\n');
    }

    generateImageId(brand, model) {
        return crypto.createHash('md5')
            .update(`${brand}-${model}-${Date.now()}`)
            .digest('hex')
            .substring(0, 8);
    }

    async downloadImage(url, filepath) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: CONFIG.headers,
                timeout: 10000
            });
            
            await fs.writeFile(filepath, response.data);
            return true;
        } catch (error) {
            console.error(`❌ Failed to download image: ${error.message}`);
            return false;
        }
    }

    async createThumbnail(inputPath, outputPath) {
        try {
            await sharp(inputPath)
                .resize(400, 300, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 85 })
                .toFile(outputPath);
            return true;
        } catch (error) {
            console.error(`❌ Failed to create thumbnail: ${error.message}`);
            return false;
        }
    }

    async usePlaceholder(camera) {
        const imageId = this.generateImageId(camera.brand, camera.model);
        const filename = `${camera.brand.toLowerCase()}-${camera.model.toLowerCase().replace(/\s+/g, '-')}.jpg`;
        const imagePath = path.join(CONFIG.imagesDir, filename);
        const thumbPath = path.join(CONFIG.thumbsDir, filename.replace('.jpg', '-thumb.jpg'));
        
        try {
            // Copy placeholder
            await fs.copyFile(CONFIG.placeholderImage, imagePath);
            await this.createThumbnail(imagePath, thumbPath);
            
            this.stats.placeholders++;
            
            return {
                imageUrl: `/images/cameras/${filename}`,
                thumbUrl: `/images/cameras/thumbs/${filename.replace('.jpg', '-thumb.jpg')}`,
                imageId: imageId,
                attribution: 'Placeholder Image'
            };
        } catch (error) {
            console.error(`❌ Failed to use placeholder: ${error.message}`);
            return null;
        }
    }

    async processCamera(camera, retryCount = 0) {
        console.log(`\n🔍 Processing ${camera.brand} ${camera.model}...`);
        
        try {
            // Build camera data object
            const cameraData = {
                brand: camera.brand,
                model: camera.model,
                fullName: `${camera.brand} ${camera.model}`,
                category: camera.category,
                releaseYear: this.guessReleaseYear(camera),
                
                // Add some mock data for testing
                // In real implementation, this would be scraped
                sensorSize: camera.category === 'medium format' ? 'Medium Format' : 'Full Frame',
                sensorType: 'CMOS',
                sensorMegapixels: camera.category === 'cinema' ? 12 : 24,
                
                videoMaxResolution: camera.category === 'cinema' ? '8K' : '4K',
                videoMaxFrameRate: camera.category === 'cinema' ? 120 : 60,
                
                price: camera.category === 'cinema' ? 15000 : 3000,
                
                ibis: camera.category !== 'film',
                weatherSealed: true,
                
                lensMount: this.guessLensMount(camera),
                
                // For now, skip image scraping and use placeholder
                // In real implementation, this would scrape actual images
                imageUrl: null,
                imageId: null,
                thumbUrl: null,
                imageAttribution: null
            };
            
            // Try to get images (skipping actual scraping for now)
            console.log('ℹ️  Google Images search skipped (requires API setup)');
            
            // Use placeholder
            console.log('📷 Using placeholder image');
            const imageData = await this.usePlaceholder(camera);
            
            if (imageData) {
                cameraData.imageUrl = imageData.imageUrl;
                cameraData.thumbUrl = imageData.thumbUrl;
                cameraData.imageId = imageData.imageId;
                cameraData.imageAttribution = imageData.attribution;
            }
            
            // Save to database using adapter
            try {
                const cameraId = await this.adapter.saveCamera(cameraData);
                this.stats.saved++;
                console.log(`✅ Saved ${camera.brand} ${camera.model} to database`);
                
                // Save attribution if needed
                if (imageData && imageData.attribution !== 'Placeholder Image') {
                    await this.adapter.saveAttribution(cameraId, {
                        imageUrl: imageData.imageUrl,
                        sourceName: 'Web Search',
                        sourceUrl: '',
                        photographer: '',
                        license: 'Fair Use'
                    });
                }
                
                return true;
            } catch (dbError) {
                console.error(`❌ Database error: ${dbError.message}`);
                throw dbError;
            }
            
        } catch (error) {
            console.error(`❌ Failed to process ${camera.brand} ${camera.model}: ${error.message}`);
            
            if (retryCount < CONFIG.maxRetries) {
                console.log(`⚠️  Retry ${retryCount + 1} for ${camera.brand} ${camera.model}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.processCamera(camera, retryCount + 1);
            }
            
            this.stats.errors.push({
                camera: `${camera.brand} ${camera.model}`,
                error: error.message
            });
            return false;
        } finally {
            this.stats.processed++;
        }
    }

    guessReleaseYear(camera) {
        // Simple logic to guess release year
        const years = {
            'A7R V': 2022,
            'A7 IV': 2021,
            'A7S III': 2020,
            'EOS R5': 2020,
            'Z9': 2021,
            'FX6': 2020,
            'KOMODO': 2021,
            '5D Mark IV': 2016,
            'D850': 2017,
            'X-T5': 2022
        };
        
        return years[camera.model] || 2020;
    }

    guessLensMount(camera) {
        const mounts = {
            'Canon': camera.model.includes('EOS R') ? 'Canon RF' : 'Canon EF',
            'Nikon': camera.model.startsWith('Z') ? 'Nikon Z' : 'Nikon F',
            'Sony': 'Sony E',
            'Fujifilm': camera.model.includes('GFX') ? 'Fujifilm G' : 'Fujifilm X',
            'Leica': 'Leica M',
            'Hasselblad': 'Hasselblad V',
            'RED': 'RED RF',
            'ARRI': 'ARRI LPL',
            'Blackmagic': 'Canon EF'
        };
        
        return mounts[camera.brand] || 'Unknown';
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            camerasProcessed: this.stats.processed,
            camerasSaved: this.stats.saved,
            realImages: this.stats.realImages,
            placeholders: this.stats.placeholders,
            errors: this.stats.errors,
            successRate: ((this.stats.saved / this.stats.processed) * 100).toFixed(2) + '%'
        };
        
        await fs.writeFile(
            path.join(__dirname, 'data', 'automation-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n📊 Automation report generated');
        return report;
    }

    async run() {
        console.log('🤖 Starting Camera Manual Vault Automation');
        console.log(`📋 Processing ${CAMERA_LIST.length} cameras\n`);
        
        await this.initialize();
        
        // Process cameras
        for (const camera of CAMERA_LIST) {
            await this.processCamera(camera);
        }
        
        // Generate report
        const report = await this.generateReport();
        
        // Close database
        this.adapter.close();
        
        // Print summary
        console.log('\n✅ Camera scraping completed!');
        console.log(`📊 Stats: ${this.stats.saved} cameras saved, ${this.stats.realImages} real images, ${this.stats.placeholders} placeholders`);
        console.log(`❌ Errors: ${this.stats.errors.length}`);
        
        if (this.stats.errors.length > 0) {
            console.log('\n⚠️  Errors encountered:');
            this.stats.errors.forEach(err => {
                console.log(`   - ${err.camera}: ${err.error}`);
            });
        }
    }
}

// Run automation
if (require.main === module) {
    const automation = new CameraAutomation();
    automation.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = CameraAutomation;