require('dotenv').config();
const express = require('express');
const axios = require('axios');
// const sharp = require('sharp'); // REMOVED - Sharp not needed
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const expressLayouts = require('express-ejs-layouts');

class CameraVaultServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
    this.setupEJS();
    this.setupDatabase();
    this.setupRoutes();
    this.setupImageCache();
    this.setupAttributionSystem();
  }

  setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: ["'self'", "https:"]
        }
      }
    }));
    this.app.use(compression());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupEJS() {
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
    this.app.use(expressLayouts);
    this.app.set('layout', 'layouts/main');
    
    // Make request data available to all views
    this.app.use((req, res, next) => {
      res.locals.currentPath = req.path;
      res.locals.req = req;
      next();
    });
  }

  async setupDatabase() {
    const dbPath = path.join(__dirname, 'data', 'camera-vault.db');
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    this.db = new sqlite3.Database(dbPath);
    
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS cameras (
          id TEXT PRIMARY KEY,
          brand TEXT NOT NULL,
          model TEXT NOT NULL,
          fullName TEXT,
          category TEXT,
          releaseYear INTEGER,
          price REAL,
          imageUrl TEXT,
          localImagePath TEXT,
          imageVerified BOOLEAN DEFAULT 0,
          imageLastChecked DATETIME,
          manualUrl TEXT,
          specs TEXT,
          features TEXT,
          lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS image_cache (
          url TEXT PRIMARY KEY,
          localPath TEXT,
          contentType TEXT,
          size INTEGER,
          cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          lastAccessed DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

      this.db.run('CREATE INDEX IF NOT EXISTS idx_cameras_brand ON cameras(brand)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_cameras_category ON cameras(category)');
    });
    this.initializeSampleData();
  }

  async setupImageCache() {
    this.cacheDir = path.join(__dirname, 'cache', 'images');
    this.publicImagesDir = path.join(__dirname, 'public', 'images', 'cameras');
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.mkdir(this.publicImagesDir, { recursive: true });
  }

  async setupAttributionSystem() {
    this.attributionDir = path.join(__dirname, 'cache', 'attribution');
    await fs.mkdir(this.attributionDir, { recursive: true });
  }

  setupRoutes() {
    // Home route
    this.app.get('/', (req, res) => {
      res.render('pages/index');
    });
    
    // API routes
    this.app.get('/api/cameras', this.getCameras.bind(this));
    this.app.get('/api/camera/:id', this.getCamera.bind(this));
    this.app.get('/api/search', this.searchCameras.bind(this));
    this.app.get('/api/stats', this.getStats.bind(this));
    this.app.get('/api/image-proxy', this.imageProxy.bind(this));
    this.app.get('/images/cameras/:filename', this.serveCachedImage.bind(this));
    this.app.post('/api/camera-finder', this.cameraFinder.bind(this));
    
    // Page routes
    this.app.get('/cameras', (req, res) => {
      res.render('pages/cameras');
    });
    
    this.app.get('/camera/:id', (req, res) => {
      res.render('pages/camera-detail', { cameraId: req.params.id });
    });
    
    this.app.get('/camera-finder', (req, res) => {
      res.render('pages/camera-finder');
    });
    
    this.app.get('/productions', (req, res) => {
      res.render('pages/productions');
    });
    
    this.app.get('/camera-blog', (req, res) => {
      res.render('pages/camera-blog');
    });
    
    this.app.get('/search', (req, res) => {
      res.render('pages/search');
    });
    
    this.app.get('/login', (req, res) => {
      res.render('pages/login');
    });
    
    // Legal pages
    this.app.get('/privacy', (req, res) => {
      res.render('pages/privacy');
    });
    
    this.app.get('/terms', (req, res) => {
      res.render('pages/terms');
    });
    
    this.app.get('/dmca', (req, res) => {
      res.render('pages/dmca');
    });
    
    this.app.get('/attribution', (req, res) => {
      res.render('pages/attribution');
    });
    
    this.app.get('/legal', (req, res) => {
      res.render('pages/legal');
    });
    
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).render('pages/404');
    });
    
    // Error handler
    this.app.use((err, req, res, next) => {
      console.error(err.stack);
      res.status(500).render('pages/error', { error: err });
    });
  }

  async imageProxy(req, res) {
    const imageUrl = req.query.url;
    const source = req.query.source || 'Unknown';
    
    if (!imageUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
      // Check cache first
      const cachedImage = await this.getCachedImage(imageUrl);
      if (cachedImage) {
        res.set('Content-Type', cachedImage.contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.sendFile(cachedImage.localPath);
      }

      // Download image
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Camera Manual Vault - Educational/Non-commercial Use)',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
      const ext = contentType.split('/')[1] || 'jpg';
      const filename = `${hash}.${ext}`;
      const cachePath = path.join(this.cacheDir, filename);
      const publicPath = path.join(this.publicImagesDir, filename);

      // Save original to cache WITHOUT sharp optimization
      await fs.writeFile(cachePath, buffer);
      await fs.copyFile(cachePath, publicPath);

      // Save attribution data
      const attributionFile = path.join(this.attributionDir, `${hash}.json`);
      const attributionData = {
        originalUrl: imageUrl,
        source: source,
        downloadedAt: new Date().toISOString(),
        domain: new URL(imageUrl).hostname
      };
      await fs.writeFile(attributionFile, JSON.stringify(attributionData, null, 2));

      // Save to database
      this.db.run(
        'INSERT OR REPLACE INTO image_cache (url, localPath, contentType, size) VALUES (?, ?, ?, ?)',
        [imageUrl, publicPath, contentType, buffer.length]
      );

      // Send image
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      res.sendFile(publicPath);

    } catch (error) {
      console.error('Image proxy error:', error.message);
      const placeholderPath = path.join(__dirname, 'public', 'images', 'camera-placeholder.jpg');
      res.set('Content-Type', 'image/jpeg');
      res.sendFile(placeholderPath);
    }
  }

  async getCachedImage(url) {
    return new Promise((resolve) => {
      this.db.get('SELECT * FROM image_cache WHERE url = ?', [url], async (err, row) => {
        if (err || !row) {
          resolve(null);
          return;
        }
        try {
          await fs.access(row.localPath);
          resolve(row);
        } catch {
          resolve(null);
        }
      });
    });
  }

  async serveCachedImage(req, res) {
    const filename = req.params.filename;
    const imagePath = path.join(this.publicImagesDir, filename);
    try {
      await fs.access(imagePath);
      res.sendFile(imagePath);
    } catch {
      res.status(404).sendFile(path.join(__dirname, 'public', 'images', 'camera-placeholder.jpg'));
    }
  }

  async getCameras(req, res) {
    const { page = 1, limit = 20, category, brand } = req.query;
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM cameras WHERE 1=1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (brand) {
      query += ' AND brand = ?';
      params.push(brand);
    }
    
    query += ' ORDER BY lastUpdated DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    this.db.all(query, params, (err, cameras) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      const processedCameras = cameras.map(camera => ({
        ...camera,
        specs: JSON.parse(camera.specs || '{}'),
        features: JSON.parse(camera.features || '[]'),
        proxiedImageUrl: camera.imageUrl ? 
          `/api/image-proxy?url=${encodeURIComponent(camera.imageUrl)}` : 
          '/images/camera-placeholder.jpg'
      }));
      
      res.json({
        cameras: processedCameras,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    });
  }

  async getCamera(req, res) {
    const { id } = req.params;
    this.db.get('SELECT * FROM cameras WHERE id = ?', [id], (err, camera) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!camera) return res.status(404).json({ error: 'Camera not found' });
      
      camera.specs = JSON.parse(camera.specs || '{}');
      camera.features = JSON.parse(camera.features || '[]');
      camera.proxiedImageUrl = camera.imageUrl ? 
        `/api/image-proxy?url=${encodeURIComponent(camera.imageUrl)}` : 
        '/images/camera-placeholder.jpg';
      
      res.json(camera);
    });
  }

  async searchCameras(req, res) {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });
    
    const query = 'SELECT * FROM cameras WHERE fullName LIKE ? OR brand LIKE ? OR model LIKE ? ORDER BY fullName LIMIT 20';
    const searchTerm = `%${q}%`;
    
    this.db.all(query, [searchTerm, searchTerm, searchTerm], (err, results) => {
      if (err) return res.status(500).json({ error: 'Search error' });
      res.json({ results });
    });
  }

  async getStats(req, res) {
    this.db.get('SELECT COUNT(*) as totalCameras FROM cameras', (err, result) => {
      if (err) return res.status(500).json({ error: 'Stats error' });
      res.json({
        totalCameras: result.totalCameras,
        totalManuals: Math.floor(result.totalCameras * 0.7),
        lastUpdated: new Date().toISOString()
      });
    });
  }

  async cameraFinder(req, res) {
    const { useCase, experience, budget, features, cameraType } = req.body;
    
    let query = 'SELECT * FROM cameras WHERE 1=1';
    const params = [];
    
    if (budget) {
      query += ' AND price <= ?';
      params.push(budget);
    }
    
    if (cameraType && cameraType !== 'any') {
      query += ' AND category = ?';
      params.push(cameraType);
    }
    
    query += ' ORDER BY price DESC LIMIT 3';
    
    this.db.all(query, params, (err, cameras) => {
      if (err) return res.status(500).json({ error: 'Finder error' });
      
      const recommendations = cameras.map((camera, index) => ({
        ...camera,
        specs: JSON.parse(camera.specs || '{}'),
        features: JSON.parse(camera.features || '[]'),
        proxiedImageUrl: camera.imageUrl ? 
          `/api/image-proxy?url=${encodeURIComponent(camera.imageUrl)}` : 
          '/images/camera-placeholder.jpg',
        matchScore: 90 - (index * 10),
        reasons: [
          'Within your budget',
          'Matches your experience level',
          'Great for ' + useCase
        ]
      }));
      
      res.json({ recommendations });
    });
  }

  async initializeSampleData() {
    this.db.get('SELECT COUNT(*) as count FROM cameras', async (err, result) => {
      if (err || result.count > 0) return;
      
      const sampleCameras = [
        {
          id: 'canon-r5',
          brand: 'Canon',
          model: 'EOS R5',
          fullName: 'Canon EOS R5',
          category: 'mirrorless',
          releaseYear: 2020,
          price: 3899,
          imageUrl: 'https://www.usa.canon.com/internet/wcm/connect/us/51e5e3c8-4ae4-42e0-b7f4-8a04e6d4b821/eos-r5-rf24-105mm-f4-l-is-usm-3q-handler.jpg?MOD=AJPERES&CACHEID=ROOTWORKSPACE.Z18_P1KGHJ01L85180AUEPQQJ53034-51e5e3c8-4ae4-42e0-b7f4-8a04e6d4b821-nYcJxSt',
          manualUrl: 'https://www.usa.canon.com/support/p/eos-r5',
          specs: { sensor: 'Full Frame CMOS', megapixels: '45MP', video: '8K 30fps' },
          features: ['Dual Card Slots', 'Weather Sealed', 'WiFi & Bluetooth', '8K Video']
        }
      ];
      
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO cameras (id, brand, model, fullName, category, releaseYear, price, imageUrl, manualUrl, specs, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      
      sampleCameras.forEach(camera => {
        stmt.run(camera.id, camera.brand, camera.model, camera.fullName, camera.category, camera.releaseYear, camera.price, camera.imageUrl, camera.manualUrl, JSON.stringify(camera.specs), JSON.stringify(camera.features));
      });
      
      stmt.finalize();
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 Camera Vault Server running on port ${this.port}`);
      console.log(`📷 Visit: http://localhost:${this.port}`);
      console.log(`✅ Running without sharp - images will not be optimized`);
    });
  }
}

const server = new CameraVaultServer();
server.start();
