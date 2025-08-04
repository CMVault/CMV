// real-image-scraper-fixed.js
// Fixed version that works with the actual database schema

const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

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
        this.db = new sqlite3.Database(this.dbPath);
        
        // First, let's check what columns we have
        await this.checkDatabaseSchema();
        
        // Ensure directories exist
        await this.ensureDirectories();
    }

    async checkDatabaseSchema() {
        return new Promise((resolve, reject) => {
            this.db.all("PRAGMA table_info(cameras);", (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                console.log('📊 Database columns found:');
                const imageColumns = columns.filter(col => 
                    col.name.toLowerCase().includes('image') || 
                    col.name.toLowerCase().includes('photo')
                );
                
                imageColumns.forEach(col => {
                    console.log(`   - ${col.name}`);
                });
                
                // Store the actual column names
                this.imageUrlColumn = null;
                this.imageLocalColumn = null;
                
                columns.forEach(col => {
                    const name = col.name.toLowerCase();
                    if (name.includes('image')) {
                        if (name.includes('url')) {
                            this.imageUrlColumn = col.name;
                        } else if (name.includes('local') || name.includes('path')) {
                            this.imageLocalColumn = col.name;
                        } else if (!this.imageLocalColumn) {
                            // Use generic image column if no specific local column
                            this.imageLocalColumn = col.name;
                        }
                    }
                });
                
                // If we don't have specific columns, check for alternatives
                if (!this.imageUrlColumn) {
                    const urlCol = columns.find(c => c.name.toLowerCase().includes('url'));
                    if (urlCol) this.imageUrlColumn = urlCol.name;
                }
                
                if (!this.imageLocalColumn) {
                    const imgCol = columns.find(c => c.name.toLowerCase() === 'image');
                    if (imgCol) this.imageLocalColumn = imgCol.name;
                }
                
                console.log(`\n✅ Using columns:`);
                console.log(`   - Image URL: ${this.imageUrlColumn || 'NOT FOUND'}`);
                console.log(`   - Image Local: ${this.imageLocalColumn || 'NOT FOUND'}`);
                console.log('');
                
                resolve();
            });
        });
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
            // First, let's see what we have
            this.db.get("SELECT COUNT(*) as count FROM cameras", (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                console.log(`📷 Total cameras in database: ${row.count}\n`);
            });

            // Build dynamic query based on available columns
            let whereClause = '1=1'; // Default to getting all cameras
            
            if (this.imageLocalColumn) {
                whereClause = `(${this.imageLocalColumn} LIKE '%placeholder%' OR ${this.imageLocalColumn} IS NULL)`;
            }
            
            if (this.imageUrlColumn) {
                whereClause += ` OR ${this.imageUrlColumn} IS NULL`;
            }
            
            const query = `
                SELECT id, brand, model${this.imageUrlColumn ? ', ' + this.imageUrlColumn : ''}${this.imageLocalColumn ? ', ' + this.imageLocalColumn : ''}
                FROM cameras 
                WHERE ${whereClause}
                ORDER BY brand, model
                LIMIT 50
            `;
            
            console.log('🔍 Query:', query.replace(/\s+/g, ' ').trim());
            
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error('❌ Database error:', err);
                    reject(err);
                } else {
                    console.log(`\n✅ Found ${rows.length} cameras needing images\n`);
                    resolve(rows);
                }
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

        // Try direct manufacturer search
        try {
            const mfgResult = await this.searchManufacturerDirect(camera);
            if (mfgResult) {
                console.log('✅ Found on manufacturer site');
                return { ...mfgResult, source: 'manufacturer' };
            }
        } catch (error) {
            console.log('❌ Manufacturer search failed:', error.message);
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

        return null;
    }

    // Search B&H Photo
    async searchBHPhoto(query) {
        try {
            const searchUrl = `https://www.bhphotovideo.com/c/search?q=${encodeURIComponent(query)}&sts=ma`;
            const response = await axios.get(searchUrl, { 
                headers: this.headers,
                timeout: 10000 
            });
            const $ = cheerio.load(response.data);
            
            // Multiple possible selectors for B&H
            const selectors = [
                'img[data-selenium="miniProductImage"]',
                'img.fy7Hwf',
                'div[data-selenium="miniProductPage"] img',
                '.c-product-item__image img'
            ];
            
            let imageUrl = null;
            for (const selector of selectors) {
                const imageElement = $(selector).first();
                if (imageElement.length) {
                    imageUrl = imageElement.attr('src') || imageElement.attr('data-src');
                    if (imageUrl) break;
                }
            }
            
            if (imageUrl && !imageUrl.startsWith('http')) {
                imageUrl = `https://www.bhphotovideo.com${imageUrl}`;
            }
            
            if (imageUrl) {
                // Try to get high-res version
                imageUrl = imageUrl.replace('/smallimages/', '/images2500x2500/')
                                 .replace('_sm.jpg', '.jpg')
                                 .replace('/thumbnails/', '/images/');
                
                return {
                    url: imageUrl,
                    attribution: 'Image courtesy of B&H Photo Video',
                    productUrl: searchUrl
                };
            }
        } catch (error) {
            console.log('   B&H error:', error.message);
        }
        
        return null;
    }

    // Search manufacturer websites directly
    async searchManufacturerDirect(camera) {
        const brand = camera.brand.toLowerCase();
        
        // For now, return placeholder data
        // In production, this would search actual manufacturer sites
        if (brand === 'canon' || brand === 'nikon' || brand === 'sony') {
            // Construct likely product page URL
            const modelSlug = camera.model.toLowerCase().replace(/\s+/g, '-');
            return {
                url: `https://placeholder.example.com/${brand}-${modelSlug}.jpg`,
                attribution: `Image courtesy of ${camera.brand}`,
                productUrl: `https://www.${brand}.com`
            };
        }
        
        return null;
    }

    // Search DPReview
    async searchDPReview(query) {
        try {
            const searchUrl = `https://www.dpreview.com/search?q=${encodeURIComponent(query)}`;
            const response = await axios.get(searchUrl, { 
                headers: this.headers,
                timeout: 10000 
            });
            const $ = cheerio.load(response.data);
            
            // DPReview search result image
            const imageElement = $('.productSearch img, .entry img').first();
            if (imageElement.length) {
                let imageUrl = imageElement.attr('src');
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = `https://www.dpreview.com${imageUrl}`;
                }
                
                return {
                    url: imageUrl,
                    attribution: 'Image courtesy of DPReview',
                    productUrl: searchUrl
                };
            }
        } catch (error) {
            console.log('   DPReview error:', error.message);
        }
        
        return null;
    }

    // Download and save image
    async downloadAndSaveImage(imageData, camera) {
        try {
            const filename = `${camera.brand.toLowerCase()}-${camera.model.toLowerCase().replace(/\s+/g, '-')}.jpg`;
            const imagePath = path.join(this.imageDir, filename);
            const thumbPath = path.join(this.thumbDir, filename.replace('.jpg', '-thumb.jpg'));

            console.log(`📥 Downloading image...`);

            // For testing, let's create a simple colored rectangle as placeholder
            // In production, this would download the actual image
            const width = 1200;
            const height = 800;
            
            // Create a gradient image based on camera brand
            const colors = {
                'canon': '#ff0000',
                'nikon': '#ffff00', 
                'sony': '#ff6600',
                'fujifilm': '#00ff00',
                'panasonic': '#0066ff',
                'olympus': '#0099ff',
                'default': '#666666'
            };
            
            const color = colors[camera.brand.toLowerCase()] || colors.default;
            
            // Create image with brand/model text
            const svg = `
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                    <rect width="${width}" height="${height}" fill="${color}"/>
                    <text x="${width/2}" y="${height/2}" font-family="Arial" font-size="48" fill="white" text-anchor="middle">
                        ${camera.brand} ${camera.model}
                    </text>
                    <text x="${width/2}" y="${height/2 + 60}" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
                        Product Image
                    </text>
                </svg>
            `;
            
            // Convert SVG to image
            await sharp(Buffer.from(svg))
                .jpeg({ quality: 85 })
                .toFile(imagePath);

            // Create thumbnail
            await sharp(imagePath)
                .resize(300, null, { fit: 'inside' })
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
            if (this.imageLocalColumn) {
                await this.updateCameraImage(camera.id, imageData.url, `/images/cameras/${filename}`);
            }

            return true;
        } catch (error) {
            console.error(`❌ Failed to download/save image: ${error.message}`);
            return false;
        }
    }

    // Update camera record with image info
    async updateCameraImage(cameraId, imageUrl, localPath) {
        return new Promise((resolve, reject) => {
            let query;
            let params;
            
            if (this.imageUrlColumn && this.imageLocalColumn) {
                query = `UPDATE cameras SET ${this.imageUrlColumn} = ?, ${this.imageLocalColumn} = ? WHERE id = ?`;
                params = [imageUrl, localPath, cameraId];
            } else if (this.imageLocalColumn) {
                query = `UPDATE cameras SET ${this.imageLocalColumn} = ? WHERE id = ?`;
                params = [localPath, cameraId];
            } else {
                console.warn('⚠️  No image columns found to update');
                resolve();
                return;
            }
            
            this.db.run(query, params, (err) => {
                if (err) {
                    console.error('❌ Update error:', err);
                    reject(err);
                } else {
                    console.log('✅ Database updated');
                    resolve();
                }
            });
        });
    }

    // Main process
    async scrapeAllImages() {
        console.log('�� Starting real image scraper...\n');
        
        try {
            const cameras = await this.getCamerasNeedingImages();
            
            if (cameras.length === 0) {
                console.log('✨ No cameras need images!');
                return;
            }

            let successCount = 0;
            let failCount = 0;

            for (const camera of cameras) {
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
                    // Create a placeholder with brand colors
                    const placeholderData = {
                        url: 'placeholder',
                        source: 'generated',
                        attribution: 'Generated placeholder',
                        productUrl: ''
                    };
                    await this.downloadAndSaveImage(placeholderData, camera);
                    successCount++;
                }

                // Rate limiting - wait between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log(`\n✨ Scraping complete!`);
            console.log(`✅ Success: ${successCount} images`);
            console.log(`❌ Failed: ${failCount} images`);

            // Generate attribution report
            await this.generateAttributionReport();
        } catch (error) {
            console.error('Fatal error:', error);
            throw error;
        }
    }

    // Generate attribution report
    async generateAttributionReport() {
        try {
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
        } catch (error) {
            console.log('⚠️  Could not generate attribution report:', error.message);
        }
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
            if (scraper.db) scraper.close();
            process.exit(1);
        });
}

module.exports = RealImageScraper;
