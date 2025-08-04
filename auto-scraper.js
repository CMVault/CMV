const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const sharp = require('sharp');
const crypto = require('crypto');

// Safe filename function - handles ALL special characters
function createSafeFilename(brand, model) {
    // Combine brand and model
    const fullName = `${brand}-${model}`.toLowerCase();
    
    // Replace problematic characters with hyphens
    // This handles: /, \, :, *, ?, ", <, >, |, spaces, and multiple hyphens
    const safeName = fullName
        .replace(/[\/\\:*?"<>|\s]+/g, '-')  // Replace special chars with hyphen
        .replace(/\-+/g, '-')               // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, '');           // Remove leading/trailing hyphens
    
    return safeName;
}

class CameraImageScraper {
    constructor() {
        this.db = new sqlite3.Database('./data/camera-vault.db');
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        this.brandColors = {
            'canon': '#dc143c',
            'nikon': '#f7d417', 
            'sony': '#ff6b35',
            'fujifilm': '#00a652',
            'panasonic': '#0053a0',
            'olympus': '#004c97',
            'leica': '#e20612',
            'hasselblad': '#000000',
            'red': '#ed1c24',
            'arri': '#00a0df',
            'blackmagic': '#ff6900'
        };
    }

    async scrapeImages() {
        console.log('🚀 Starting camera image scraping with safe filenames...\n');
        
        try {
            // Ensure directories exist
            await this.ensureDirectories();
            
            // Get cameras needing images
            const cameras = await this.getCamerasNeedingImages();
            console.log(`📷 Found ${cameras.length} cameras needing images\n`);
            
            if (cameras.length === 0) {
                console.log('✅ All cameras already have images!');
                return;
            }
            
            // Process each camera
            for (const camera of cameras) {
                await this.processCameraImage(camera);
                // Add delay to be respectful to servers
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            console.log('\n✅ Image scraping complete!');
            
        } catch (error) {
            console.error('❌ Scraping error:', error);
        } finally {
            this.db.close();
        }
    }

    async ensureDirectories() {
        const dirs = [
            './public/images/cameras',
            './public/images/cameras/thumbs',
            './data/attributions'
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    getCamerasNeedingImages() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, brand, model 
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

    async processCameraImage(camera) {
        console.log(`\n📸 Processing: ${camera.brand} ${camera.model}`);
        
        // Create safe filename
        const safeFilename = createSafeFilename(camera.brand, camera.model);
        const imagePath = `/images/cameras/${safeFilename}.jpg`;
        const fullImagePath = `./public${imagePath}`;
        const thumbPath = `./public/images/cameras/thumbs/${safeFilename}-thumb.jpg`;
        
        console.log(`   Safe filename: ${safeFilename}.jpg`);
        
        try {
            // Try to scrape from B&H Photo
            const imageUrl = await this.scrapeFromBHPhoto(camera.brand, camera.model);
            
            if (imageUrl) {
                // Download and process the image
                await this.downloadAndProcessImage(imageUrl, fullImagePath, thumbPath);
                
                // Save attribution
                await this.saveAttribution(camera, imageUrl, imagePath);
                
                // Update database with safe path
                await this.updateDatabase(camera.id, imagePath, imageUrl);
                
                console.log(`   ✅ Successfully processed image`);
            } else {
                // Create branded placeholder
                console.log(`   ⚠️  No image found, creating branded placeholder`);
                await this.createBrandedPlaceholder(camera, fullImagePath, thumbPath);
                
                // Update database with placeholder path
                await this.updateDatabase(camera.id, imagePath, 'placeholder');
                
                console.log(`   ✅ Created branded placeholder`);
            }
            
        } catch (error) {
            console.error(`   ❌ Error processing ${camera.brand} ${camera.model}:`, error.message);
            
            // Create placeholder on error
            await this.createBrandedPlaceholder(camera, fullImagePath, thumbPath);
            await this.updateDatabase(camera.id, imagePath, 'placeholder');
        }
    }

    async scrapeFromBHPhoto(brand, model) {
        try {
            // Construct search query
            const searchQuery = `${brand} ${model} camera`.replace(/\s+/g, '+');
            const searchUrl = `https://www.bhphotovideo.com/c/search?q=${searchQuery}`;
            
            console.log(`   Searching B&H Photo...`);
            
            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);
            
            // Find first product image
            const imageElement = $('img[data-src]').first();
            let imageUrl = imageElement.attr('data-src') || imageElement.attr('src');
            
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `https:${imageUrl}`;
            }
            
            return imageUrl || null;
            
        } catch (error) {
            console.log(`   Could not scrape from B&H: ${error.message}`);
            return null;
        }
    }

    async downloadAndProcessImage(imageUrl, fullImagePath, thumbPath) {
        // Download image
        const response = await axios.get(imageUrl, { 
            responseType: 'arraybuffer',
            headers: this.headers 
        });
        
        const buffer = Buffer.from(response.data);
        
        // Process and save full image (max 1200px wide)
        await sharp(buffer)
            .resize(1200, null, { 
                withoutEnlargement: true,
                fit: 'inside'
            })
            .jpeg({ quality: 85 })
            .toFile(fullImagePath);
        
        // Create thumbnail (300px wide)
        await sharp(buffer)
            .resize(300, null, { 
                withoutEnlargement: true,
                fit: 'inside'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
    }

    async createBrandedPlaceholder(camera, fullImagePath, thumbPath) {
        const brand = camera.brand.toLowerCase();
        const bgColor = this.brandColors[brand] || '#333333';
        const textColor = ['#000000', '#333333'].includes(bgColor) ? '#ffffff' : '#000000';
        
        // Create full size placeholder
        const svg = `
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="${bgColor}"/>
                <text x="400" y="280" text-anchor="middle" fill="${textColor}" 
                      font-family="Arial, sans-serif" font-size="48" font-weight="bold">
                    ${camera.brand}
                </text>
                <text x="400" y="340" text-anchor="middle" fill="${textColor}" 
                      font-family="Arial, sans-serif" font-size="36">
                    ${camera.model}
                </text>
                <text x="400" y="420" text-anchor="middle" fill="${textColor}" 
                      opacity="0.7" font-family="Arial, sans-serif" font-size="20">
                    Image Coming Soon
                </text>
            </svg>
        `;
        
        // Save full size
        await sharp(Buffer.from(svg))
            .jpeg({ quality: 85 })
            .toFile(fullImagePath);
        
        // Save thumbnail
        await sharp(Buffer.from(svg))
            .resize(300)
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
    }

    async saveAttribution(camera, imageUrl, localPath) {
        const safeFilename = createSafeFilename(camera.brand, camera.model);
        const attribution = {
            camera: `${camera.brand} ${camera.model}`,
            imageSource: imageUrl.includes('bhphoto') ? 'B&H Photo' : 'Unknown',
            imageUrl: imageUrl,
            attribution: `Image courtesy of ${imageUrl.includes('bhphoto') ? 'B&H Photo' : 'retailer'}`,
            fetchedDate: new Date().toISOString(),
            localPath: localPath
        };
        
        const attrPath = `./data/attributions/${safeFilename}.json`;
        await fs.writeFile(attrPath, JSON.stringify(attribution, null, 2));
    }

    updateDatabase(cameraId, localPath, imageUrl) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cameras 
                SET localImagePath = ?, 
                    imageUrl = ?,
                    imageAttribution = ?,
                    lastUpdated = datetime('now')
                WHERE id = ?
            `;
            
            const attribution = imageUrl === 'placeholder' 
                ? 'Branded placeholder' 
                : 'Image courtesy of B&H Photo';
            
            this.db.run(query, [localPath, imageUrl, attribution, cameraId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// Run if called directly
if (require.main === module) {
    const scraper = new CameraImageScraper();
    scraper.scrapeImages().catch(console.error);
}

module.exports = { CameraImageScraper, createSafeFilename };