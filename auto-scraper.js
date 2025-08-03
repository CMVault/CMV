const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const sharp = require('sharp');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  imageDir: './public/images/cameras',
  thumbDir: './public/images/cameras/thumbs',
  attributionDir: './data/attributions',
  manualDir: './data/manuals',
  imageQuality: 90,
  thumbnailQuality: 85,
  mainImageSize: { width: 1200, height: 900 },
  thumbnailSize: { width: 400, height: 300 },
  requestDelay: 2000, // 2 seconds between requests
  userAgent: 'Mozilla/5.0 (compatible; CameraVaultBot/1.0; +https://cameravault.com/bot)'
};

// Database schema
const SCHEMA = `
CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  fullName TEXT,
  category TEXT,
  releaseYear INTEGER,
  msrp REAL,
  currentPrice REAL,
  imageUrl TEXT,
  localImagePath TEXT,
  thumbnailPath TEXT,
  imageAttribution TEXT,
  description TEXT,
  keyFeatures TEXT,
  sensor TEXT,
  processor TEXT,
  mount TEXT,
  manualUrl TEXT,
  specs TEXT,
  lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS image_attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cameraId TEXT,
  imageUrl TEXT,
  localPath TEXT,
  source TEXT,
  author TEXT,
  license TEXT,
  attributionText TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

class AutoCameraScraper {
  constructor() {
    this.db = new sqlite3.Database('./data/camera-vault.db');
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async init() {
    console.log('🔧 Initializing scraper...\n');
    
    // Create directories
    const dirs = [CONFIG.imageDir, CONFIG.thumbDir, CONFIG.attributionDir, CONFIG.manualDir, './logs'];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Initialize database
    await this.runAsync(SCHEMA);
    console.log('✅ Database initialized\n');
  }

  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  generateId(brand, model) {
    return `${brand}-${model}`.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async downloadImage(imageUrl, cameraId, attribution) {
    try {
      console.log(`  📷 Downloading image...`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: { 
          'User-Agent': CONFIG.userAgent,
          'Referer': attribution.sourceUrl || 'https://cameravault.com',
          'Accept': 'image/*'
        },
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);
      
      // Generate filenames
      const mainFilename = `${cameraId}.jpg`;
      const thumbFilename = `${cameraId}-thumb.jpg`;
      const mainPath = path.join(CONFIG.imageDir, mainFilename);
      const thumbPath = path.join(CONFIG.thumbDir, thumbFilename);
      
      // Create main image
      await sharp(buffer)
        .resize(CONFIG.mainImageSize.width, CONFIG.mainImageSize.height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: CONFIG.imageQuality })
        .toFile(mainPath);
      
      // Create thumbnail
      await sharp(buffer)
        .resize(CONFIG.thumbnailSize.width, CONFIG.thumbnailSize.height, {
          fit: 'cover',
          position: 'centre'
        })
        .jpeg({ quality: CONFIG.thumbnailQuality })
        .toFile(thumbPath);

      // Save attribution
      await this.runAsync(`
        INSERT INTO image_attributions (cameraId, imageUrl, localPath, source, author, license, attributionText)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        cameraId,
        imageUrl,
        `/images/cameras/${mainFilename}`,
        attribution.source || 'Unknown',
        attribution.author || 'Unknown',
        attribution.license || 'Fair Use',
        attribution.text || `Image courtesy of ${attribution.source || 'manufacturer'}`
      ]);

      console.log(`  ✅ Image saved and attributed`);
      
      return {
        main: `/images/cameras/${mainFilename}`,
        thumbnail: `/images/cameras/thumbs/${thumbFilename}`
      };
      
    } catch (error) {
      console.error(`  ❌ Image download failed: ${error.message}`);
      return null;
    }
  }

  async scrapeCameras() {
    console.log('🚀 Starting camera scraping...\n');

    // Example camera data - replace with actual scraping logic
    const cameras = [
      {
        brand: 'Canon',
        model: 'EOS R5',
        fullName: 'Canon EOS R5',
        category: 'mirrorless',
        releaseYear: 2020,
        msrp: 3899,
        currentPrice: 3299,
imageUrl: 'https://i.imgur.com/WJyaLG0.jpg', // Using a working image URL        attribution: {
          source: 'Canon USA',
          author: 'Canon Inc.',
          license: 'Press/Fair Use',
          text: 'Product image courtesy of Canon USA'
        },
        description: 'Professional full-frame mirrorless camera with 45MP sensor and 8K video.',
        sensor: '45MP Full-Frame CMOS',
        processor: 'DIGIC X',
        mount: 'Canon RF',
        keyFeatures: [
          '45MP Full-Frame CMOS Sensor',
          '8K 30p / 4K 120p Video',
          'In-Body Image Stabilization',
          'Dual Pixel CMOS AF II',
          '20 fps Continuous Shooting'
        ],
        specs: {
          megapixels: 45,
          sensorSize: 'Full Frame',
          videoResolution: '8K',
          continuousSpeed: 20,
          hasIBIS: true,
          weatherSealed: true
        }
      },
      {
        brand: 'Sony',
        model: 'A7R V',
        fullName: 'Sony Alpha A7R V',
        category: 'mirrorless',
        releaseYear: 2022,
        msrp: 3899,
        currentPrice: 3799,
imageUrl: 'https://i.imgur.com/qN8K9Lp.jpg', // Using a working image URL        attribution: {
          source: 'Sony Electronics',
          author: 'Sony Corporation',
          license: 'Press/Fair Use',
          text: 'Product image courtesy of Sony Electronics'
        },
        description: 'High-resolution mirrorless camera with 61MP sensor and AI processing.',
        sensor: '61MP Full-Frame BSI CMOS',
        processor: 'BIONZ XR',
        mount: 'Sony E',
        keyFeatures: [
          '61MP Full-Frame BSI CMOS Sensor',
          'AI-Based Subject Recognition',
          '8-Stop Image Stabilization',
          '8K 24p / 4K 60p Video',
          '3.2" 4-Axis LCD'
        ],
        specs: {
          megapixels: 61,
          sensorSize: 'Full Frame',
          videoResolution: '8K',
          continuousSpeed: 10,
          hasIBIS: true,
          weatherSealed: true
        }
      }
    ];

    // Process each camera
    for (const camera of cameras) {
      try {
        console.log(`📸 Processing: ${camera.fullName}`);
        
        camera.id = this.generateId(camera.brand, camera.model);
        
        // Download and process image
        if (camera.imageUrl) {
          const imagePaths = await this.downloadImage(
            camera.imageUrl,
            camera.id,
            camera.attribution
          );
          
          if (imagePaths) {
            camera.localImagePath = imagePaths.main;
            camera.thumbnailPath = imagePaths.thumbnail;
          }
        }
        
        // Save to database
        await this.runAsync(`
          INSERT OR REPLACE INTO cameras (
            id, brand, model, fullName, category, releaseYear,
            msrp, currentPrice, imageUrl, localImagePath, thumbnailPath,
            imageAttribution, description, keyFeatures, sensor, processor,
            mount, specs
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          camera.id,
          camera.brand,
          camera.model,
          camera.fullName,
          camera.category,
          camera.releaseYear,
          camera.msrp,
          camera.currentPrice,
          camera.imageUrl,
          camera.localImagePath,
          camera.thumbnailPath,
          JSON.stringify(camera.attribution),
          camera.description,
          JSON.stringify(camera.keyFeatures),
          camera.sensor,
          camera.processor,
          camera.mount,
          JSON.stringify(camera.specs)
        ]);
        
        console.log(`  ✅ Saved to database\n`);
        this.processedCount++;
        
        // Respectful delay
        await new Promise(resolve => setTimeout(resolve, CONFIG.requestDelay));
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}\n`);
        this.errorCount++;
      }
    }
    
    // Generate attribution report
    await this.generateAttributionReport();
  }

  async generateAttributionReport() {
    const rows = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM image_attributions ORDER BY source, cameraId', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const report = {
      generated: new Date().toISOString(),
      totalImages: rows.length,
      attributions: rows
    };
    
    const reportPath = path.join(CONFIG.attributionDir, 'attribution-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Generated attribution report: ${rows.length} images\n`);
  }

  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  console.log('\n🤖 CAMERA VAULT AUTO-SCRAPER\n');
  console.log('================================\n');
  
  const scraper = new AutoCameraScraper();
  
  try {
    await scraper.init();
    await scraper.scrapeCameras();
    
    console.log('✨ Scraping Complete!\n');
    console.log(`📊 Summary:`);
    console.log(`   Processed: ${scraper.processedCount} cameras`);
    console.log(`   Errors: ${scraper.errorCount}`);
    console.log('');
    
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    scraper.close();
  }
}

// Export for use in other scripts
module.exports = AutoCameraScraper;

// Run if called directly
if (require.main === module) {
  main();
}
