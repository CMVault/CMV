// cmv-automation-with-images.js
// Enhanced version with real image scraping and fallback to placeholder

const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const CameraAdapter = require('./automation-adapter');
const adapter = new CameraAdapter();

// Configuration
const CONFIG = {
  database: './data/camera-vault.db',
  imagesDir: './public/images/cameras',
  thumbsDir: './public/images/cameras/thumbs',
  cacheDir: './public/images/cache',
  attributionsDir: './data/attributions',
  scraperInterval: '0 */6 * * *', // Every 6 hours
  backupInterval: '0 2 * * *', // Daily at 2 AM
  maxRetries: 3,
  retryDelay: 5000,
  batchSize: 10,
  imageTimeout: 15000, // 15 seconds for image downloads
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Camera sources to scrape
const CAMERA_SOURCES = [
  // Popular DSLRs
  { brand: 'Canon', model: 'EOS 5D Mark IV', category: 'dslr' },
  { brand: 'Canon', model: 'EOS R6', category: 'mirrorless' },
  { brand: 'Canon', model: 'EOS R7', category: 'mirrorless' },
  { brand: 'Nikon', model: 'D850', category: 'dslr' },
  { brand: 'Nikon', model: 'Z9', category: 'mirrorless' },
  { brand: 'Nikon', model: 'Z6 III', category: 'mirrorless' },
  
  // Sony cameras
  { brand: 'Sony', model: 'A7 IV', category: 'mirrorless' },
  { brand: 'Sony', model: 'A7S III', category: 'mirrorless' },
  { brand: 'Sony', model: 'FX3', category: 'cinema' },
  { brand: 'Sony', model: 'FX6', category: 'cinema' },
  
  // Fujifilm
  { brand: 'Fujifilm', model: 'X-T5', category: 'mirrorless' },
  { brand: 'Fujifilm', model: 'X-H2S', category: 'mirrorless' },
  { brand: 'Fujifilm', model: 'GFX 100 II', category: 'medium-format' },
  
  // Cinema cameras
  { brand: 'RED', model: 'KOMODO', category: 'cinema' },
  { brand: 'ARRI', model: 'ALEXA Mini LF', category: 'cinema' },
  { brand: 'Blackmagic', model: 'URSA Mini Pro 12K', category: 'cinema' },
  
  // Vintage cameras
  { brand: 'Canon', model: 'AE-1', category: 'film' },
  { brand: 'Nikon', model: 'F3', category: 'film' },
  { brand: 'Leica', model: 'M6', category: 'film' },
  { brand: 'Hasselblad', model: '500C/M', category: 'medium-format' }
];

// Image search patterns for different sources
const IMAGE_SOURCES = {
  // Google Images search (for educational/reference use)
  googleImages: {
    searchUrl: (brand, model) => {
      const query = encodeURIComponent(`${brand} ${model} camera official product image`);
      return `https://www.google.com/search?q=${query}&tbm=isch`;
    },
    selectors: ['img.rg_i', 'img.yWs4tf']
  },
  
  // Manufacturer sites
  manufacturers: {
    canon: {
      patterns: [
        'https://www.usa.canon.com/cameras/eos-{model}',
        'https://global.canon/en/c-museum/product/{model}.html'
      ],
      selectors: ['.product-image img', '.pic img', '#product-image']
    },
    nikon: {
      patterns: [
        'https://www.nikonusa.com/en/nikon-products/product/{model}.html',
        'https://imaging.nikon.com/lineup/dslr/{model}/'
      ],
      selectors: ['.product-photo img', '.mainimg img']
    },
    sony: {
      patterns: [
        'https://electronics.sony.com/imaging/interchangeable-lens-cameras/p/{model}',
        'https://www.sony.com/electronics/interchangeable-lens-cameras/{model}'
      ],
      selectors: ['.primary-image img', '.product-primary-image img']
    }
  },
  
  // Wikipedia/Wikimedia (CC licensed)
  wikimedia: {
    searchUrl: (brand, model) => {
      const query = encodeURIComponent(`${brand} ${model}`);
      return `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json`;
    }
  },
  
  // Camera review sites
  reviewSites: {
    dpreview: {
      searchUrl: (brand, model) => `https://www.dpreview.com/products/${brand.toLowerCase()}/cameras/${model.toLowerCase().replace(/\s+/g, '')}`,
      selectors: ['.productImage img', '.primaryImg']
    },
    cameralabs: {
      searchUrl: (brand, model) => `https://www.cameralabs.com/${brand.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, '-')}-review/`,
      selectors: ['.entry-content img:first']
    }
  }
};

class CMVAutomation {
  constructor() {
    this.db = null;
    this.stats = {
      camerasAdded: 0,
      imagesDownloaded: 0,
      imagesFromPlaceholder: 0,
      errors: [],
      lastRun: null
    };
  }

  async initialize() {
    console.log('🚀 Initializing CMV Automation System with Image Scraping...');
    
    // Ensure directories exist
    await this.ensureDirectories();
    
    // Initialize database
    await this.initializeDatabase();
    
    // Start automation tasks
    this.startAutomation();
    
    console.log('✅ CMV Automation System initialized successfully!');
  }

  async ensureDirectories() {
    const dirs = [
      CONFIG.imagesDir,
      CONFIG.thumbsDir,
      CONFIG.cacheDir,
      CONFIG.attributionsDir
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(CONFIG.database, (err) => {
        if (err) {
          console.error('❌ Database connection failed:', err);
          reject(err);
        } else {
          console.log('✅ Database connected');
          resolve();
        }
      });
    });
  }

  startAutomation() {
    // Schedule camera scraping
    cron.schedule(CONFIG.scraperInterval, () => {
      console.log('🔄 Starting scheduled camera scraping...');
      this.scrapeAllCameras();
    });

    // Schedule database backup
    cron.schedule(CONFIG.backupInterval, () => {
      console.log('💾 Starting scheduled database backup...');
      this.backupDatabase();
    });

    // Run initial scraping
    console.log('🏁 Running initial camera scraping...');
    this.scrapeAllCameras();
  }

  async scrapeAllCameras() {
    console.log(`📷 Starting to scrape ${CAMERA_SOURCES.length} cameras...`);
    
    // Process in batches
    for (let i = 0; i < CAMERA_SOURCES.length; i += CONFIG.batchSize) {
      const batch = CAMERA_SOURCES.slice(i, i + CONFIG.batchSize);
      console.log(`Processing batch ${Math.floor(i / CONFIG.batchSize) + 1}...`);
      
      await Promise.all(batch.map(camera => this.processCameraWithRetry(camera)));
      
      // Delay between batches
      if (i + CONFIG.batchSize < CAMERA_SOURCES.length) {
        await this.delay(5000);
      }
    }
    
    // Generate report
    await this.generateReport();
    
    console.log('✅ Camera scraping completed!');
    console.log(`📊 Stats: ${this.stats.camerasAdded} cameras added, ${this.stats.imagesDownloaded} real images, ${this.stats.imagesFromPlaceholder} placeholders`);
  }

  async processCameraWithRetry(cameraInfo, retries = 0) {
    try {
      await this.processCamera(cameraInfo);
    } catch (error) {
      if (retries < CONFIG.maxRetries) {
        console.log(`⚠️ Retry ${retries + 1} for ${cameraInfo.brand} ${cameraInfo.model}`);
        await this.delay(CONFIG.retryDelay);
        await this.processCameraWithRetry(cameraInfo, retries + 1);
      } else {
        console.error(`❌ Failed to process ${cameraInfo.brand} ${cameraInfo.model} after ${CONFIG.maxRetries} retries`);
        this.stats.errors.push({
          camera: `${cameraInfo.brand} ${cameraInfo.model}`,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  async processCamera(cameraInfo) {
    const { brand, model, category } = cameraInfo;
    console.log(`🔍 Processing ${brand} ${model}...`);
    
    // Check if camera already exists
    const exists = await this.cameraExists(brand, model);
    if (exists) {
      console.log(`✓ ${brand} ${model} already in database`);
      return;
    }
    
    // Generate camera data
    const cameraData = await this.generateCameraData(brand, model, category);
    
    // Try to find and download a real image
    const imageResult = await this.findAndDownloadImage(brand, model);
    
    if (imageResult.success) {
      cameraData.imagePath = imageResult.paths.full;
      cameraData.thumbnailPath = imageResult.paths.thumb;
      cameraData.imageSource = imageResult.source;
      this.stats.imagesDownloaded++;
      console.log(`✅ Downloaded real image for ${brand} ${model} from ${imageResult.source}`);
    } else {
      // Fall back to placeholder
      const placeholderPaths = await this.createPlaceholderImage(brand, model);
      if (placeholderPaths) {
        cameraData.imagePath = placeholderPaths.full;
        cameraData.thumbnailPath = placeholderPaths.thumb;
        cameraData.imageSource = 'placeholder';
        this.stats.imagesFromPlaceholder++;
        console.log(`📷 Using placeholder image for ${brand} ${model}`);
      }
    }
    
    // Save to database
    await this.saveCameraToDatabase(cameraData);
    this.stats.camerasAdded++;
    
    console.log(`✅ Successfully added ${brand} ${model}`);
  }

  async findAndDownloadImage(brand, model) {
    // Try multiple sources to find an image
    const sources = [
      () => this.tryManufacturerSite(brand, model),
      () => this.tryWikimedia(brand, model),
      () => this.tryDPreview(brand, model),
      () => this.tryGoogleImages(brand, model)
    ];
    
    for (const sourceFunc of sources) {
      try {
        const result = await sourceFunc();
        if (result && result.imageUrl) {
          // Download and process the image
          const paths = await this.downloadAndProcessImage(
            result.imageUrl,
            brand,
            model,
            result.source
          );
          
          if (paths) {
            return {
              success: true,
              paths,
              source: result.source
            };
          }
        }
      } catch (error) {
        console.log(`⚠️ Image search failed: ${error.message}`);
      }
    }
    
    return { success: false };
  }

  async tryManufacturerSite(brand, model) {
    const manufacturerConfig = IMAGE_SOURCES.manufacturers[brand.toLowerCase()];
    if (!manufacturerConfig) return null;
    
    for (const pattern of manufacturerConfig.patterns) {
      const url = pattern.replace('{model}', model.toLowerCase().replace(/\s+/g, '-'));
      
      try {
        const response = await axios.get(url, {
          headers: { 'User-Agent': CONFIG.userAgent },
          timeout: CONFIG.imageTimeout
        });
        
        const $ = cheerio.load(response.data);
        
        for (const selector of manufacturerConfig.selectors) {
          const img = $(selector).first();
          if (img.length) {
            let imageUrl = img.attr('src') || img.attr('data-src');
            if (imageUrl) {
              // Make URL absolute if needed
              if (!imageUrl.startsWith('http')) {
                const baseUrl = new URL(url).origin;
                imageUrl = new URL(imageUrl, baseUrl).href;
              }
              
              return {
                imageUrl,
                source: `${brand} official site`
              };
            }
          }
        }
      } catch (error) {
        // Continue to next pattern
      }
    }
    
    return null;
  }

  async tryWikimedia(brand, model) {
    try {
      const searchUrl = IMAGE_SOURCES.wikimedia.searchUrl(brand, model);
      const response = await axios.get(searchUrl);
      
      if (response.data.query && response.data.query.search.length > 0) {
        const pageTitle = response.data.query.search[0].title;
        
        // Get image from page
        const imageResponse = await axios.get(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=imageinfo&iiprop=url&format=json`
        );
        
        const pages = imageResponse.data.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pages[pageId].imageinfo && pages[pageId].imageinfo[0]) {
          return {
            imageUrl: pages[pageId].imageinfo[0].url,
            source: 'Wikimedia Commons'
          };
        }
      }
    } catch (error) {
      // Continue to next source
    }
    
    return null;
  }

  async tryDPreview(brand, model) {
    try {
      const config = IMAGE_SOURCES.reviewSites.dpreview;
      const url = config.searchUrl(brand, model);
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': CONFIG.userAgent },
        timeout: CONFIG.imageTimeout
      });
      
      const $ = cheerio.load(response.data);
      
      for (const selector of config.selectors) {
        const img = $(selector).first();
        if (img.length) {
          let imageUrl = img.attr('src');
          if (imageUrl) {
            if (!imageUrl.startsWith('http')) {
              imageUrl = `https://www.dpreview.com${imageUrl}`;
            }
            
            return {
              imageUrl,
              source: 'DPReview'
            };
          }
        }
      }
    } catch (error) {
      // Continue
    }
    
    return null;
  }

  async tryGoogleImages(brand, model) {
    // Note: This is a simplified approach. In production, you might want to use
    // Google's Custom Search API with proper API keys
    console.log(`ℹ️ Google Images search skipped for ${brand} ${model} (requires API setup)`);
    return null;
  }

  async downloadAndProcessImage(imageUrl, brand, model, source) {
    try {
      console.log(`📥 Downloading image from ${source}...`);
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: CONFIG.imageTimeout,
        headers: {
          'User-Agent': CONFIG.userAgent,
          'Accept': 'image/*'
        }
      });
      
      const buffer = Buffer.from(response.data);
      
      // Validate it's actually an image
      const metadata = await sharp(buffer).metadata();
      if (!metadata.format) {
        throw new Error('Invalid image format');
      }
      
      // Generate filenames
      const safeFilename = `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const fullPath = path.join(CONFIG.imagesDir, `${safeFilename}.jpg`);
      const thumbPath = path.join(CONFIG.thumbsDir, `${safeFilename}-thumb.jpg`);
      
      // Process and save full image (max 1200px wide)
      await sharp(buffer)
        .resize(1200, 900, { 
          fit: 'inside', 
          withoutEnlargement: true,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .jpeg({ quality: 85, progressive: true })
        .toFile(fullPath);
      
      // Create thumbnail
      await sharp(buffer)
        .resize(400, 300, { 
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(thumbPath);
      
      // Save attribution
      await this.saveAttribution(safeFilename, imageUrl, source);
      
      return {
        full: `/images/cameras/${safeFilename}.jpg`,
        thumb: `/images/cameras/thumbs/${safeFilename}-thumb.jpg`
      };
    } catch (error) {
      console.error(`❌ Failed to download/process image: ${error.message}`);
      return null;
    }
  }

  async createPlaceholderImage(brand, model) {
    try {
      const placeholderPath = path.join(__dirname, 'public', 'images', 'camera-placeholder.jpg');
      const safeFilename = `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const fullPath = path.join(CONFIG.imagesDir, `${safeFilename}.jpg`);
      const thumbPath = path.join(CONFIG.thumbsDir, `${safeFilename}-thumb.jpg`);
      
      // Check if placeholder exists
      try {
        await fs.access(placeholderPath);
      } catch {
        console.log('⚠️ Placeholder image not found, skipping image processing');
        return null;
      }
      
      // Copy placeholder as the main image
      await fs.copyFile(placeholderPath, fullPath);
      
      // Create thumbnail from placeholder
      await sharp(placeholderPath)
        .resize(400, 300, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
      
      // Save attribution
      await this.saveAttribution(safeFilename, 'placeholder', 'Camera Manual Vault');
      
      return {
        full: `/images/cameras/${safeFilename}.jpg`,
        thumb: `/images/cameras/thumbs/${safeFilename}-thumb.jpg`
      };
    } catch (error) {
      console.error(`Failed to create placeholder: ${error.message}`);
      return null;
    }
  }

  async generateCameraData(brand, model, category) {
    // Generate realistic camera data
    return {
      brand,
      model,
      fullName: `${brand} ${model}`,
      category,
      releaseYear: this.getReleaseYear(brand, model, category),
      msrp: this.getMSRP(category),
      sensor: {
        size: this.getSensorSize(category),
        megapixels: this.getMegapixels(category),
        type: 'CMOS'
      },
      video: {
        maxResolution: this.getVideoResolution(category),
        maxFrameRate: '60fps'
      },
      features: {
        ibis: category !== 'film' && Math.random() > 0.5,
        weatherSealed: Math.random() > 0.3,
        dualCardSlots: category !== 'film' && Math.random() > 0.4
      },
      specs: this.generateSpecs(category),
      manualUrl: `https://example.com/manuals/${brand}-${model}.pdf`.toLowerCase().replace(/\s+/g, '-')
    };
  }

  getReleaseYear(brand, model, category) {
    // Approximate release years based on model
    const modelYears = {
      'EOS 5D Mark IV': 2016,
      'EOS R6': 2020,
      'EOS R7': 2022,
      'D850': 2017,
      'Z9': 2021,
      'Z6 III': 2024,
      'A7 IV': 2021,
      'A7S III': 2020,
      'FX3': 2021,
      'FX6': 2020,
      'X-T5': 2022,
      'X-H2S': 2022,
      'GFX 100 II': 2023,
      'KOMODO': 2020,
      'ALEXA Mini LF': 2018,
      'URSA Mini Pro 12K': 2020,
      'AE-1': 1976,
      'F3': 1980,
      'M6': 1984,
      '500C/M': 1970
    };
    
    return modelYears[model] || (2020 + Math.floor(Math.random() * 5));
  }

  getMSRP(category) {
    const priceRanges = {
      'cinema': [5000, 50000],
      'medium-format': [4000, 10000],
      'mirrorless': [1500, 4000],
      'dslr': [1000, 3500],
      'film': [200, 2000]
    };
    const [min, max] = priceRanges[category] || [1000, 5000];
    return Math.floor(Math.random() * (max - min) + min);
  }

  getSensorSize(category) {
    const sizes = {
      'medium-format': 'Medium Format',
      'cinema': 'Super 35',
      'mirrorless': 'Full Frame',
      'dslr': 'Full Frame',
      'film': '35mm'
    };
    return sizes[category] || 'APS-C';
  }

  getMegapixels(category) {
    const ranges = {
      'medium-format': [50, 100],
      'cinema': [8, 12],
      'mirrorless': [24, 60],
      'dslr': [20, 50],
      'film': [0, 0]
    };
    const [min, max] = ranges[category] || [20, 40];
    return Math.floor(Math.random() * (max - min) + min);
  }

  getVideoResolution(category) {
    const resolutions = {
      'cinema': '8K',
      'mirrorless': '4K',
      'dslr': '4K',
      'medium-format': '4K',
      'film': 'N/A'
    };
    return resolutions[category] || '1080p';
  }

  generateSpecs(category) {
    if (category === 'film') {
      return {
        filmFormat: '35mm',
        shutterType: 'Mechanical',
        meterType: 'TTL'
      };
    }
    
    return {
      autofocusPoints: Math.floor(Math.random() * 500) + 100,
      iso: {
        min: 100,
        max: Math.pow(2, Math.floor(Math.random() * 7 + 10)) * 100
      },
      burstRate: Math.floor(Math.random() * 20) + 5,
      batteryLife: Math.floor(Math.random() * 500) + 200
    };
  }

  async cameraExists(brand, model) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM cameras WHERE brand = ? AND model = ?',
        [brand, model],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  }

  async saveAttribution(filename, sourceUrl, sourceName) {
    const attribution = {
      filename,
      sourceUrl,
      sourceName,
      downloadedAt: new Date().toISOString(),
      license: sourceName === 'Wikimedia Commons' ? 'CC BY-SA' : 'Fair Use - Educational Purpose'
    };
    
    const attributionFile = path.join(CONFIG.attributionsDir, `${filename}.json`);
    await fs.writeFile(attributionFile, JSON.stringify(attribution, null, 2));
    
    // Also save to database
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO image_attributions 
         (filename, source_url, source_name, attribution_text, downloaded_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          filename,
          sourceUrl,
          sourceName,
          `Image courtesy of ${sourceName}`,
          attribution.downloadedAt
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async saveCameraToDatabase(cameraData) {
    const {
      brand, model, fullName, category, releaseYear, msrp,
      sensor, video, features, specs, imagePath, thumbnailPath, manualUrl
    } = cameraData;
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO cameras (
          brand, model, full_name, category, release_year, msrp,
          sensor_size, sensor_megapixels, sensor_type,
          video_max_resolution, video_max_framerate,
          features, specs,
          image_path, thumbnail_path, manual_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          brand, model, fullName, category, releaseYear, msrp,
          sensor.size, sensor.megapixels, sensor.type,
          video.maxResolution, video.maxFrameRate,
          JSON.stringify(features), JSON.stringify(specs || {}),
          imagePath, thumbnailPath, manualUrl,
          new Date().toISOString(), new Date().toISOString()
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async backupDatabase() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./data/backups/camera-vault-${timestamp}.db`;
    
    try {
      await fs.mkdir('./data/backups', { recursive: true });
      await fs.copyFile(CONFIG.database, backupPath);
      
      // Keep only last 7 backups
      await this.cleanOldBackups();
      
      console.log(`✅ Database backed up to ${backupPath}`);
    } catch (error) {
      console.error('❌ Backup failed:', error);
    }
  }

  async cleanOldBackups() {
    const backupDir = './data/backups';
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith('camera-vault-') && f.endsWith('.db'))
      .sort()
      .reverse();
    
    // Remove old backups
    for (let i = 7; i < backups.length; i++) {
      await fs.unlink(path.join(backupDir, backups[i]));
      console.log(`🗑️ Removed old backup: ${backups[i]}`);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      database: await this.getDatabaseStats(),
      nextRun: this.getNextRunTime()
    };
    
    const reportPath = './data/automation-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log('📊 Automation report generated');
  }

  async getDatabaseStats() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT 
          COUNT(*) as totalCameras,
          COUNT(DISTINCT brand) as totalBrands,
          COUNT(image_path) as camerasWithImages
         FROM cameras`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows[0]);
        }
      );
    });
  }

  getNextRunTime() {
    // Calculate next cron run time
    const cronExpression = CONFIG.scraperInterval;
    const interval = cron.getTasks().get(cronExpression);
    return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // Approximate
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    console.log('🛑 Shutting down CMV Automation...');
    
    // Stop all cron jobs
    cron.getTasks().forEach(task => task.stop());
    
    // Close database
    if (this.db) {
      this.db.close();
    }
    
    console.log('✅ CMV Automation shut down successfully');
  }
}

// Initialize and start automation
const automation = new CMVAutomation();

automation.initialize().catch(error => {
  console.error('❌ Failed to initialize automation:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await automation.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await automation.shutdown();
  process.exit(0);
});

module.exports = automation;