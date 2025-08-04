// real-image-scraper.js
// Downloads real camera images from reputable sources
// Replaces placeholder images with actual product photos

const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Reputable camera equipment sites
const IMAGE_SOURCES = {
    bhphoto: {
        name: 'B&H Photo',
        searchUrl: 'https://www.bhphotovideo.com/c/search?q=',
        selector: 'img.product-image',
        attribution: 'Image courtesy of B&H Photo Video'
    },
    adorama: {
        name: 'Adorama',
        searchUrl: 'https://www.adorama.com/searchsite/default.aspx?searchinfo=',
        selector: 'img.product-image',
        attribution: 'Image courtesy of Adorama'
    },
    dpreview: {
        name: 'DPReview',
        searchUrl: 'https://www.dpreview.com/products/search/cameras?search=',
        selector: 'img.product-image',
        attribution: 'Image courtesy of DPReview'
    },
    kenrockwell: {
        name: 'Ken Rockwell',
        baseUrl: 'https://kenrockwell.com/',
        attribution: 'Image courtesy of KenRockwell.com'
    }
};

class RealImageScraper {
    constructor(dbPath = './data/camera-vault.db') {
        this.dbPath = dbPath;
        this.imageDir = path.join(__dirname, 'public/images/cameras');
        this.thumbDir = path.join(__dirname, 'public/images/cameras/thumbs');
        this.attributionDir = path.join(__dirname, 'data/attributions');
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://www.google.com/'
        };
    }

    async init() {
        const sqlite3 = require('sqlite3').verbose();
        this.db = new sqlite3.Database(this.dbPath);
        
        // Ensure directories exist
        await this.ensureDirectories();
    }

    async ensureDirectories() {
        const dirs = [this.imageDir, this.thumbDir, this.attributionDir];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    // Get all cameras from database
    async getCamerasNeedingImages() {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT id, brand, model, imageUrl, imageLocal 
                FROM cameras 
                WHERE imageLocal LIKE '%placeholder%' 
                   OR imageLocal IS NULL 
                   OR imageUrl IS NULL
                ORDER BY brand, model
            `;
            
            this.db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Search for camera image from multiple sources
    async findCameraImage(camera) {
        const searchQuery = `${camera.brand} ${camera.model} camera`;
        console.log(`\n🔍 Searching for images: ${searchQuery}`);

        // Try B&H Photo first (most reliable)
        try {
            const bhResult = await this.searchBHPhoto(searchQuery);
            if (bhResult) {
                console.log('✅ Found on B&H Photo');
                return { ...bhResult, source: 'bhphoto' };
            }
        } catch (error) {
            console.log('❌ B&H Photo search failed:', error.message);
        }

        // Try DPReview
        try {
            const dpResult = await this.searchDPReview(searchQuery);
            if (dpResult) {
                console.log('✅ Found on DPReview');
                return { ...dpResult, source: 'dpreview' };
            }
        } catch (error) {
            console.log('❌ DPReview search failed:', error.message);
        }

        // Try manufacturer website
        try {
            const mfgResult = await this.searchManufacturer(camera);
            if (mfgResult) {
                console.log('✅ Found on manufacturer site');
                return { ...mfgResult, source: 'manufacturer' };
            }
        } catch (error) {
            console.log('❌ Manufacturer search failed:', error.message);
        }

        return null;
    }

    // Search B&H Photo
    async searchBHPhoto(query) {
        const searchUrl = `https://www.bhphotovideo.com/c/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, { headers: this.headers });
        const $ = cheerio.load(response.data);
        
        // Find first product image
        const imageElement = $('img[data-selenium="miniProductImage"]').first();
        if (imageElement.length) {
            let imageUrl = imageElement.attr('src') || imageElement.attr('data-src');
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `https://www.bhphotovideo.com${imageUrl}`;
            }
            
            // Get high-res version
            imageUrl = imageUrl.replace('/images/smallimages/', '/images/images2500x2500/');
            
            return {
                url: imageUrl,
                attribution: IMAGE_SOURCES.bhphoto.attribution,
                productUrl: searchUrl
            };
        }
        
        return null;
    }

    // Search DPReview
    async searchDPReview(query) {
        const searchUrl = `https://www.dpreview.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, { headers: this.headers });
        const $ = cheerio.load(response.data);
        
        // Find product image in search results
        const imageElement = $('.productSearch img').first();
        if (imageElement.length) {
            let imageUrl = imageElement.attr('src');
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `https://www.dpreview.com${imageUrl}`;
            }
            
            return {
                url: imageUrl,
                attribution: IMAGE_SOURCES.dpreview.attribution,
                productUrl: searchUrl
            };
        }
        
        return null;
    }

    // Search manufacturer website
    async searchManufacturer(camera) {
        const manufacturerUrls = {
            'Canon': 'https://www.usa.canon.com',
            'Nikon': 'https://www.nikonusa.com',
            'Sony': 'https://electronics.sony.com',
            'Fujifilm': 'https://fujifilm-x.com',
            'Panasonic': 'https://shop.panasonic.com',
            'Olympus': 'https://www.olympus-imaging.com',
            'Leica': 'https://leicacamerausa.com',
            'Hasselblad': 'https://www.hasselblad.com',
            'RED': 'https://www.red.com',
            'ARRI': 'https://www.arri.com',
            'Blackmagic': 'https://www.blackmagicdesign.com'
        };

        const baseUrl = manufacturerUrls[camera.brand];
        if (!baseUrl) return null;

        // This would need specific logic for each manufacturer
        // For now, return null (would implement manufacturer-specific scrapers)
        return null;
    }

    // Download and save image
    async downloadAndSaveImage(imageData, camera) {
        try {
            const filename = `${camera.brand.toLowerCase()}-${camera.model.toLowerCase().replace(/\s+/g, '-')}.jpg`;
            const imagePath = path.join(this.imageDir, filename);
            const thumbPath = path.join(this.thumbDir, filename.replace('.jpg', '-thumb.jpg'));

            console.log(`📥 Downloading image from: ${imageData.url}`);

            // Download image
            const response = await axios.get(imageData.url, {
                headers: this.headers,
                responseType: 'arraybuffer',
                timeout: 30000
            });

            // Process with Sharp
            const imageBuffer = Buffer.from(response.data);
            
            // Save full size (max 1200px wide)
            await sharp(imageBuffer)
                .resize(1200, null, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 85 })
                .toFile(imagePath);

            // Save thumbnail (300px wide)
            await sharp(imageBuffer)
                .resize(300, null, { 
                    fit: 'inside',
                    withoutEnlargement: true 
                })
                .jpeg({ quality: 80 })
                .toFile(thumbPath);

            // Save attribution
            const attributionData = {
                cameraId: camera.id,
                imageUrl: imageData.url,
                source: imageData.source,
                attribution: imageData.attribution,
                productUrl: imageData.productUrl,
                downloadedAt: new Date().toISOString(),
                filename: filename
            };

            const attrPath = path.join(this.attributionDir, `${filename.replace('.jpg', '')}.json`);
            await fs.writeFile(attrPath, JSON.stringify(attributionData, null, 2));

            console.log(`✅ Saved image and thumbnail: ${filename}`);

            // Update database
            await this.updateCameraImage(camera.id, imageData.url, `/images/cameras/${filename}`);

            return true;
        } catch (error) {
            console.error(`❌ Failed to download/save image: ${error.message}`);
            return false;
        }
    }

    // Update camera record with image info
    async updateCameraImage(cameraId, imageUrl, localPath) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE cameras 
                SET imageUrl = ?, imageLocal = ?, updatedAt = datetime('now')
                WHERE id = ?
            `;
            
            this.db.run(query, [imageUrl, localPath, cameraId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Check if image needs updating
    async checkImageFreshness(camera) {
        try {
            const filename = `${camera.brand.toLowerCase()}-${camera.model.toLowerCase().replace(/\s+/g, '-')}.jpg`;
            const imagePath = path.join(this.imageDir, filename);
            const attrPath = path.join(this.attributionDir, `${filename.replace('.jpg', '')}.json`);

            // Check if files exist
            const imageExists = await fs.access(imagePath).then(() => true).catch(() => false);
            const attrExists = await fs.access(attrPath).then(() => true).catch(() => false);

            if (!imageExists || !attrExists) {
                return false; // Need to download
            }

            // Check age of image (refresh if older than 30 days)
            const stats = await fs.stat(imagePath);
            const ageInDays = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
            
            if (ageInDays > 30) {
                console.log(`🔄 Image for ${camera.brand} ${camera.model} is ${Math.round(ageInDays)} days old, refreshing...`);
                return false;
            }

            return true; // Image is fresh
        } catch (error) {
            return false;
        }
    }

    // Main process
    async scrapeAllImages() {
        console.log('🚀 Starting real image scraper...\n');
        
        const cameras = await this.getCamerasNeedingImages();
        console.log(`Found ${cameras.length} cameras needing real images\n`);

        let successCount = 0;
        let failCount = 0;

        for (const camera of cameras) {
            // Check if we already have a fresh image
            const isFresh = await this.checkImageFreshness(camera);
            if (isFresh) {
                console.log(`✓ ${camera.brand} ${camera.model} - Image is fresh, skipping`);
                continue;
            }

            // Find and download image
            const imageData = await this.findCameraImage(camera);
            
            if (imageData) {
                const success = await this.downloadAndSaveImage(imageData, camera);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                console.log(`❌ No image found for ${camera.brand} ${camera.model}`);
                failCount++;
            }

            // Rate limiting - wait between requests
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
        }

        console.log(`\n✨ Scraping complete!`);
        console.log(`✅ Success: ${successCount} images`);
        console.log(`❌ Failed: ${failCount} images`);

        // Generate attribution report
        await this.generateAttributionReport();
    }

    // Generate attribution report
    async generateAttributionReport() {
        const files = await fs.readdir(this.attributionDir);
        const attributions = {};

        for (const file of files) {
            if (file.endsWith('.json') && file !== 'attribution-report.json') {
                const data = JSON.parse(await fs.readFile(path.join(this.attributionDir, file), 'utf8'));
                const source = data.source || 'unknown';
                
                if (!attributions[source]) {
                    attributions[source] = [];
                }
                
                attributions[source].push({
                    camera: file.replace('.json', ''),
                    attribution: data.attribution,
                    downloadedAt: data.downloadedAt
                });
            }
        }

        const report = {
            generated: new Date().toISOString(),
            totalImages: Object.values(attributions).flat().length,
            sources: attributions
        };

        await fs.writeFile(
            path.join(this.attributionDir, 'attribution-report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n📋 Attribution report generated');
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

// Run if called directly
if (require.main === module) {
    const scraper = new RealImageScraper();
    
    scraper.init()
        .then(() => scraper.scrapeAllImages())
        .then(() => scraper.close())
        .catch(error => {
            console.error('Fatal error:', error);
            scraper.close();
            process.exit(1);
        });
}

module.exports = RealImageScraper;
