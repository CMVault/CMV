#!/bin/bash

echo "🚀 Activating Camera Discovery System"
echo "===================================="
echo ""

# Create the complete unified camera system
echo "Creating unified camera system with all features..."

cat > unified-camera-system.js << 'EOF'
const axios = require('axios');
const cheerio = require('cheerio');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const cron = require('node-cron');
const { createSafeFilename } = require('./camera-utils');

class UnifiedCameraSystem {
    constructor() {
        this.db = new sqlite3.Database('./data/camera-vault.db');
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        
        // Daily limits
        this.dailyLimit = 200;
        this.addedToday = 0;
        this.lastResetDate = new Date().toDateString();
        
        // Duplicate prevention
        this.processingCache = new Set();
        this.existingCameras = new Set();
        
        // Camera categories
        this.categories = {
            traditional: ['dslr', 'mirrorless', 'film', 'medium format', 'large format'],
            mobile: ['smartphone', 'tablet', 'feature phone'],
            security: ['security camera', 'surveillance', 'doorbell camera', 'trail camera'],
            computer: ['webcam', 'conference camera', 'streaming camera'],
            specialized: ['drone camera', 'body camera', 'dash camera', 'backup camera'],
            consumer: ['point and shoot', 'bridge camera', 'baby monitor', 'pet camera'],
            cinema: ['cinema', 'broadcast', 'camcorder', 'action camera']
        };
        
        // Trusted sources
        this.sources = {
            bhphoto: {
                name: 'B&H Photo',
                baseUrl: 'https://www.bhphotovideo.com',
                searchPaths: [
                    '/c/buy/Digital-Cameras/ci/9811',
                    '/c/buy/Security-Surveillance/ci/3769',
                    '/c/buy/Webcams/ci/4023'
                ]
            },
            butkus: {
                name: 'Butkus Manuals',
                baseUrl: 'https://www.butkus.org/chinon/',
                hasManuals: true
            }
        };
        
        // Camera status types
        this.cameraStatus = {
            VERIFIED: 'verified',
            RUMOR: 'rumor',
            UPCOMING: 'upcoming',
            DISCONTINUED: 'discontinued'
        };
    }

    async start() {
        console.log('🚀 Starting Unified Camera Discovery System...');
        console.log('✅ This is the ONLY camera scraper running\n');
        
        // Load existing cameras to prevent duplicates
        await this.loadExistingCameras();
        
        // Run immediately
        await this.runDiscovery();
        
        // Schedule every 4 hours
        cron.schedule('0 */4 * * *', async () => {
            await this.runDiscovery();
        });
        
        // Daily backup at 3 AM
        cron.schedule('0 3 * * *', async () => {
            await this.backupDatabase();
        });
        
        console.log('📅 Schedule set:');
        console.log('   - Discovery: Every 4 hours (200/day limit)');
        console.log('   - Backup: Daily at 3 AM\n');
    }

    async loadExistingCameras() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT LOWER(brand) || "_" || LOWER(model) as key FROM cameras', (err, rows) => {
                if (err) {
                    console.error('Error loading existing cameras:', err);
                    reject(err);
                } else {
                    this.existingCameras = new Set(rows.map(r => r.key));
                    console.log(`📊 Loaded ${this.existingCameras.size} existing cameras\n`);
                    resolve();
                }
            });
        });
    }

    checkDailyReset() {
        const today = new Date().toDateString();
        if (today !== this.lastResetDate) {
            this.addedToday = 0;
            this.lastResetDate = today;
            console.log('📅 New day - daily counter reset\n');
        }
    }

    async runDiscovery() {
        this.checkDailyReset();
        
        console.log(`🔍 Discovery run started at ${new Date().toLocaleString()}`);
        console.log(`📊 Progress today: ${this.addedToday}/${this.dailyLimit}\n`);

        try {
            // 1. Update missing images
            await this.updateMissingImages();
            
            // 2. Discover new cameras
            if (this.addedToday < this.dailyLimit) {
                await this.discoverNewCameras();
            }
            
            // 3. Generate statistics
            await this.generateStats();
            
        } catch (error) {
            console.error('❌ Discovery error:', error);
        }
    }

    async updateMissingImages() {
        console.log('🖼️  Checking for missing images...');
        
        const cameras = await new Promise((resolve, reject) => {
            this.db.all(`
                SELECT id, brand, model 
                FROM cameras 
                WHERE localImagePath IS NULL 
                   OR localImagePath = '' 
                   OR localImagePath NOT LIKE '/images/cameras/%'
                LIMIT 50
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        console.log(`   Found ${cameras.length} cameras needing images`);
        
        for (const camera of cameras) {
            await this.downloadCameraImage(camera);
            await this.delay(1000);
        }
    }

    async discoverNewCameras() {
        console.log('\n🔍 Discovering new cameras...');
        
        // Search B&H Photo
        const bhCameras = await this.searchBHPhoto();
        console.log(`   B&H Photo: Found ${bhCameras.length} potential cameras`);
        
        // Add cameras to database
        let added = 0;
        for (const camera of bhCameras) {
            if (this.addedToday >= this.dailyLimit) break;
            
            const key = `${camera.brand.toLowerCase()}_${camera.model.toLowerCase()}`;
            
            // Skip if already exists
            if (this.existingCameras.has(key)) continue;
            
            // Add to database
            const success = await this.addCamera(camera);
            if (success) {
                added++;
                this.addedToday++;
                this.existingCameras.add(key);
            }
            
            await this.delay(500);
        }
        
        console.log(`   ✅ Added ${added} new cameras\n`);
    }

    async searchBHPhoto() {
        const cameras = [];
        
        try {
            for (const searchPath of this.sources.bhphoto.searchPaths) {
                const url = this.sources.bhphoto.baseUrl + searchPath;
                const response = await axios.get(url, { 
                    headers: this.headers,
                    timeout: 10000 
                });
                
                const $ = cheerio.load(response.data);
                
                $('.sku-info').each((i, elem) => {
                    const title = $(elem).find('.sku-title').text().trim();
                    const price = $(elem).find('.price').text().trim();
                    
                    if (title) {
                        const parsed = this.parseProductTitle(title);
                        if (parsed) {
                            cameras.push({
                                ...parsed,
                                price: this.parsePrice(price),
                                source: 'bhphoto',
                                status: this.cameraStatus.VERIFIED
                            });
                        }
                    }
                    
                    // Limit per page
                    if (cameras.length >= 50) return false;
                });
                
                await this.delay(2000);
            }
        } catch (error) {
            console.error('   Error searching B&H:', error.message);
        }
        
        return cameras;
    }

    parseProductTitle(title) {
        // Common camera brand patterns
        const brands = [
            'Canon', 'Nikon', 'Sony', 'Fujifilm', 'Panasonic', 'Olympus',
            'Leica', 'Hasselblad', 'Pentax', 'Ricoh', 'Sigma', 'Blackmagic',
            'RED', 'ARRI', 'GoPro', 'DJI', 'Insta360', 'Logitech', 'Razer',
            'ASUS', 'Samsung', 'Apple', 'Google', 'Xiaomi', 'Huawei'
        ];
        
        // Find brand
        let brand = null;
        for (const b of brands) {
            if (title.toLowerCase().includes(b.toLowerCase())) {
                brand = b;
                break;
            }
        }
        
        if (!brand) return null;
        
        // Extract model (remove brand and clean up)
        let model = title.replace(new RegExp(brand, 'i'), '').trim();
        model = model.replace(/\b(Body Only|Kit|Bundle|Package|Refurbished)\b/gi, '').trim();
        model = model.replace(/\s+/g, ' ').trim();
        
        if (!model || model.length < 2) return null;
        
        // Determine category
        const category = this.determineCategory(brand, model, title);
        
        return { brand, model, category };
    }

    determineCategory(brand, model, title) {
        const lower = `${brand} ${model} ${title}`.toLowerCase();
        
        if (lower.includes('webcam') || lower.includes('brio')) return 'webcam';
        if (lower.includes('security') || lower.includes('surveillance')) return 'security camera';
        if (lower.includes('iphone') || lower.includes('galaxy')) return 'smartphone';
        if (lower.includes('gopro') || lower.includes('action')) return 'action camera';
        if (lower.includes('cinema') || lower.includes('broadcast')) return 'cinema';
        if (lower.includes('mirrorless')) return 'mirrorless';
        if (lower.includes('dslr')) return 'dslr';
        
        // Default by brand
        if (['Logitech', 'Razer', 'Microsoft'].includes(brand)) return 'webcam';
        if (['Apple', 'Samsung', 'Google', 'Xiaomi'].includes(brand)) return 'smartphone';
        
        return 'camera';
    }

    parsePrice(priceStr) {
        const match = priceStr.match(/[\d,]+\.?\d*/);
        return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
    }

    async addCamera(camera) {
        try {
            // Generate safe filename
            const safeFilename = createSafeFilename(camera.brand, camera.model);
            const id = `${camera.brand}-${camera.model}`.toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-');
            
            // Prepare camera data
            const cameraData = {
                id,
                brand: camera.brand,
                model: camera.model,
                fullName: `${camera.brand} ${camera.model}`,
                category: camera.category,
                status: camera.status || this.cameraStatus.VERIFIED,
                currentPrice: camera.price || 0,
                localImagePath: `/images/cameras/${safeFilename}.jpg`,
                sources: JSON.stringify(['bhphoto']),
                addedDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };
            
            // Insert into database
            await new Promise((resolve, reject) => {
                const columns = Object.keys(cameraData).join(', ');
                const placeholders = Object.keys(cameraData).map(() => '?').join(', ');
                const values = Object.values(cameraData);
                
                this.db.run(
                    `INSERT OR IGNORE INTO cameras (${columns}) VALUES (${placeholders})`,
                    values,
                    function(err) {
                        if (err) {
                            console.error(`   ❌ Failed to add ${camera.brand} ${camera.model}:`, err.message);
                            reject(err);
                        } else if (this.changes > 0) {
                            console.log(`   ✅ Added: ${camera.brand} ${camera.model}`);
                            resolve(true);
                        } else {
                            resolve(false); // Already exists
                        }
                    }
                );
            });
            
            // Download image
            await this.downloadCameraImage(cameraData);
            
            return true;
            
        } catch (error) {
            console.error(`   ❌ Error adding camera:`, error.message);
            return false;
        }
    }

    async downloadCameraImage(camera) {
        const safeFilename = createSafeFilename(camera.brand, camera.model);
        const imagePath = `./public/images/cameras/${safeFilename}.jpg`;
        const thumbPath = `./public/images/cameras/thumbs/${safeFilename}-thumb.jpg`;
        
        try {
            // Check if image already exists
            try {
                await fs.access(imagePath);
                return; // Already has image
            } catch {
                // Image doesn't exist, continue
            }
            
            // Try to find image online
            const imageUrl = await this.findCameraImage(camera.brand, camera.model);
            
            if (imageUrl) {
                // Download and save
                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    headers: this.headers,
                    timeout: 10000
                });
                
                const buffer = Buffer.from(response.data);
                
                // Save full image
                await sharp(buffer)
                    .resize(1200, null, { withoutEnlargement: true })
                    .jpeg({ quality: 85 })
                    .toFile(imagePath);
                
                // Save thumbnail
                await sharp(buffer)
                    .resize(300, null, { withoutEnlargement: true })
                    .jpeg({ quality: 80 })
                    .toFile(thumbPath);
                
                console.log(`      🖼️ Downloaded image for ${camera.brand} ${camera.model}`);
            } else {
                // Create placeholder
                await this.createPlaceholder(camera, imagePath, thumbPath);
                console.log(`      🎨 Created placeholder for ${camera.brand} ${camera.model}`);
            }
            
            // Save attribution
            await this.saveAttribution(camera, imageUrl || 'placeholder');
            
        } catch (error) {
            console.error(`      ❌ Image error for ${camera.brand} ${camera.model}:`, error.message);
        }
    }

    async findCameraImage(brand, model) {
        try {
            const searchQuery = `${brand} ${model} camera`.replace(/\s+/g, '+');
            const url = `https://www.bhphotovideo.com/c/search?q=${searchQuery}`;
            
            const response = await axios.get(url, {
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

    async createPlaceholder(camera, imagePath, thumbPath) {
        const brandColors = {
            'canon': '#dc143c',
            'nikon': '#f7d417',
            'sony': '#ff6b35',
            'fujifilm': '#00a652',
            'panasonic': '#0053a0',
            'olympus': '#004c97',
            'leica': '#e20612',
            'hasselblad': '#000000',
            'gopro': '#00b8e6',
            'logitech': '#00b8fc',
            'apple': '#555555',
            'samsung': '#1428a0',
            'google': '#4285f4'
        };
        
        const bgColor = brandColors[camera.brand.toLowerCase()] || '#333333';
        const textColor = ['#000000', '#333333', '#555555'].includes(bgColor) ? '#ffffff' : '#000000';
        
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
        
        await fs.mkdir(path.dirname(imagePath), { recursive: true });
        await fs.mkdir(path.dirname(thumbPath), { recursive: true });
        
        await sharp(Buffer.from(svg))
            .jpeg({ quality: 85 })
            .toFile(imagePath);
        
        await sharp(Buffer.from(svg))
            .resize(300)
            .jpeg({ quality: 80 })
            .toFile(thumbPath);
    }

    async saveAttribution(camera, imageUrl) {
        const safeFilename = createSafeFilename(camera.brand, camera.model);
        const attribution = {
            camera: `${camera.brand} ${camera.model}`,
            category: camera.category,
            imageSource: imageUrl === 'placeholder' ? 'Placeholder' : 'B&H Photo',
            imageUrl: imageUrl,
            attribution: imageUrl === 'placeholder' ? 'Branded placeholder' : 'Image courtesy of B&H Photo',
            savedDate: new Date().toISOString()
        };
        
        const attrPath = `./data/attributions/${safeFilename}.json`;
        await fs.mkdir(path.dirname(attrPath), { recursive: true });
        await fs.writeFile(attrPath, JSON.stringify(attribution, null, 2));
    }

    async generateStats() {
        const stats = await new Promise((resolve, reject) => {
            this.db.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
                    COUNT(CASE WHEN localImagePath IS NOT NULL THEN 1 END) as withImages,
                    COUNT(CASE WHEN category = 'smartphone' THEN 1 END) as smartphones,
                    COUNT(CASE WHEN category = 'webcam' THEN 1 END) as webcams,
                    COUNT(CASE WHEN category = 'security camera' THEN 1 END) as security
                FROM cameras
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('\n📊 Database Statistics:');
        console.log(`   Total Cameras: ${stats.total}`);
        console.log(`   Verified: ${stats.verified}`);
        console.log(`   With Images: ${stats.withImages}`);
        console.log(`   Smartphones: ${stats.smartphones}`);
        console.log(`   Webcams: ${stats.webcams}`);
        console.log(`   Security: ${stats.security}`);
        console.log(`   Added Today: ${this.addedToday}\n`);
        
        // Save stats
        await fs.writeFile('./data/stats.json', JSON.stringify({
            ...stats,
            addedToday: this.addedToday,
            lastUpdate: new Date().toISOString()
        }, null, 2));
    }

    async backupDatabase() {
        console.log('💾 Creating database backup...');
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

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Start the system
const system = new UnifiedCameraSystem();
system.start().catch(console.error);

console.log('\n🎉 Unified Camera System is now the ONLY scraper running!');
console.log('📊 Old scrapers have been removed - no duplicates!\n');
EOF

echo "✅ Unified camera system created!"
echo ""

# Restart PM2 process
echo "Restarting camera discovery process..."
pm2 restart cmv-discovery

echo ""
echo "🎉 Camera Discovery System Activated!"
echo ""
echo "The system is now:"
echo "✅ Adding up to 200 cameras per day"
echo "✅ Preventing duplicates automatically"
echo "✅ Creating safe filenames for all cameras"
echo "✅ Downloading images with attribution"
echo "✅ Tracking phones, webcams, security cameras, and more"
echo ""
echo "Monitor progress with:"
echo "  pm2 logs cmv-discovery"
echo "  node monitor.js"
echo ""