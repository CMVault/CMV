// update-camera-images.js
// Simple script to update camera images with the correct column names

const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const db = new sqlite3.Database('./data/camera-vault.db');

async function updateCameraImages() {
    console.log('🚀 Starting camera image update...\n');
    
    // Ensure directories exist
    const imageDir = path.join(__dirname, 'public/images/cameras');
    const thumbDir = path.join(__dirname, 'public/images/cameras/thumbs');
    const attrDir = path.join(__dirname, 'data/attributions');
    
    await fs.mkdir(imageDir, { recursive: true });
    await fs.mkdir(thumbDir, { recursive: true });
    await fs.mkdir(attrDir, { recursive: true });
    
    // Get cameras that need images
    const cameras = await new Promise((resolve, reject) => {
        db.all(`
            SELECT id, brand, model, imageUrl, localImagePath 
            FROM cameras 
            WHERE localImagePath LIKE '%placeholder%' 
               OR localImagePath IS NULL 
               OR imageUrl IS NULL
            ORDER BY brand, model
            LIMIT 50
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    console.log(`Found ${cameras.length} cameras needing images\n`);
    
    let updated = 0;
    
    for (const camera of cameras) {
        console.log(`\n📷 Processing: ${camera.brand} ${camera.model}`);
        
        try {
            // Generate filenames
            const filename = `${camera.brand.toLowerCase()}-${camera.model.toLowerCase().replace(/\s+/g, '-')}.jpg`;
            const imagePath = path.join(imageDir, filename);
            const thumbPath = path.join(thumbDir, filename.replace('.jpg', '-thumb.jpg'));
            
            // For now, create a branded placeholder image
            // In production, this would download real images
            const imageBuffer = await createBrandedPlaceholder(camera);
            
            // Save full size image
            await sharp(imageBuffer)
                .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toFile(imagePath);
            
            // Save thumbnail
            await sharp(imageBuffer)
                .resize(300, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(thumbPath);
            
            // Update database
            await new Promise((resolve, reject) => {
                db.run(`
                    UPDATE cameras 
                    SET localImagePath = ?,
                        imageUrl = ?,
                        imageAttribution = ?,
                        updatedAt = datetime('now')
                    WHERE id = ?
                `, [
                    `/images/cameras/${filename}`,
                    `https://example.com/${filename}`, // Placeholder URL
                    'Image placeholder - real image coming soon',
                    camera.id
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Save attribution
            const attribution = {
                cameraId: camera.id,
                brand: camera.brand,
                model: camera.model,
                filename: filename,
                source: 'placeholder',
                attribution: 'Placeholder image - awaiting real product photo',
                createdAt: new Date().toISOString()
            };
            
            await fs.writeFile(
                path.join(attrDir, `${filename.replace('.jpg', '')}.json`),
                JSON.stringify(attribution, null, 2)
            );
            
            console.log(`✅ Updated: ${filename}`);
            updated++;
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        }
        
        // Small delay between cameras
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n✨ Complete! Updated ${updated} camera images\n`);
    
    // Generate summary report
    const report = {
        timestamp: new Date().toISOString(),
        totalCameras: cameras.length,
        updated: updated,
        failed: cameras.length - updated
    };
    
    await fs.writeFile(
        path.join(attrDir, 'update-report.json'),
        JSON.stringify(report, null, 2)
    );
    
    db.close();
}

async function createBrandedPlaceholder(camera) {
    // Brand colors for placeholders
    const brandColors = {
        'canon': { bg: '#dc143c', fg: '#ffffff' },
        'nikon': { bg: '#f7d417', fg: '#000000' },
        'sony': { bg: '#ff6b35', fg: '#ffffff' },
        'fujifilm': { bg: '#00a652', fg: '#ffffff' },
        'panasonic': { bg: '#0053a0', fg: '#ffffff' },
        'olympus': { bg: '#004c97', fg: '#ffffff' },
        'leica': { bg: '#e20612', fg: '#ffffff' },
        'hasselblad': { bg: '#000000', fg: '#ffffff' },
        'red': { bg: '#ed1c24', fg: '#ffffff' },
        'arri': { bg: '#00a0df', fg: '#ffffff' },
        'blackmagic': { bg: '#ff6900', fg: '#000000' }
    };
    
    const brand = camera.brand.toLowerCase();
    const colors = brandColors[brand] || { bg: '#333333', fg: '#ffffff' };
    
    const width = 1200;
    const height = 800;
    
    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${colors.bg};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colors.bg};stop-opacity:0.7" />
                </linearGradient>
            </defs>
            <rect width="${width}" height="${height}" fill="url(#grad)"/>
            <rect x="${width/2 - 200}" y="${height/2 - 100}" width="400" height="200" fill="${colors.bg}" opacity="0.3" rx="20"/>
            <text x="${width/2}" y="${height/2 - 20}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="${colors.fg}" text-anchor="middle">
                ${camera.brand}
            </text>
            <text x="${width/2}" y="${height/2 + 30}" font-family="Arial, sans-serif" font-size="36" fill="${colors.fg}" text-anchor="middle">
                ${camera.model}
            </text>
            <text x="${width/2}" y="${height - 50}" font-family="Arial, sans-serif" font-size="18" fill="${colors.fg}" opacity="0.7" text-anchor="middle">
                Camera Manual Vault
            </text>
        </svg>
    `;
    
    return Buffer.from(svg);
}

// Run the updater
updateCameraImages().catch(console.error);
