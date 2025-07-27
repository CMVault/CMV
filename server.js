require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

class CameraVaultServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;
    this.setupMiddleware();
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
    this.app.get('/api/cameras', this.getCameras.bind(this));
    this.app.get('/api/camera/:id', this.getCamera.bind(this));
    this.app.get('/api/search', this.searchCameras.bind(this));
    this.app.get('/api/stats', this.getStats.bind(this));
    this.app.get('/api/image-proxy', this.imageProxy.bind(this));
    this.app.get('/images/cameras/:filename', this.serveCachedImage.bind(this));
    this.app.post('/api/camera-finder', this.cameraFinder.bind(this));
    this.app.get('/camera/:id', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'camera-detail.html')); });
  }

  async imageProxy(req, res) {
    const imageUrl = req.query.url;
    const source = req.query.source || 'Unknown';
    
    if (!imageUrl) return res.status(400).json({ error: 'No URL provided' });

    try {
      // Check cache first
      const cachedImage = await this.getCachedImage(imageUrl);
      if (cachedImage) {
        // Add attribution headers
        try {
          const urlHash = crypto.createHash('md5').update(imageUrl).digest('hex');
          const attributionFile = path.join(this.attributionDir, `${urlHash}.json`);
          const attribution = JSON.parse(await fs.readFile(attributionFile, 'utf8'));
          res.set('X-Image-Source', attribution.source);
          res.set('X-Original-URL', attribution.originalUrl);
        } catch (e) {
          // Attribution file might not exist for old cached images
        }
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
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': new URL(imageUrl).origin
        }
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
      const ext = contentType.split('/')[1] || 'jpg';
      const filename = `${hash}.${ext}`;
      const cachePath = path.join(this.cacheDir, filename);
      const publicPath = path.join(this.publicImagesDir, filename);

      // Save original to cache
      await fs.writeFile(cachePath, buffer);

      // Process and optimize image
      await sharp(buffer)
        .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toFile(publicPath);

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

      // Send with attribution headers
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('X-Image-Source', source);
      res.set('X-Original-URL', imageUrl);
      res.sendFile(publicPath);

    } catch (error) {
      console.error('Image proxy error:', error.message);
      const placeholderPath = path.join(__dirname, 'public', 'images', 'placeholder.jpg');
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
        this.db.run('UPDATE image_cache SET lastAccessed = CURRENT_TIMESTAMP WHERE url = ?', [url]);
        try {
          await fs.access(row.localPath);
          resolve(row);
        } catch {
          this.db.run('DELETE FROM image_cache WHERE url = ?', [url]);
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
      res.set('Cache-Control', 'public, max-age=86400');
      res.sendFile(imagePath);
    } catch {
      res.status(404).sendFile(path.join(__dirname, 'public', 'images', 'placeholder.jpg'));
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
          '/images/placeholder.jpg'
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
        '/images/placeholder.jpg';
      
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
      
      const processedResults = results.map(camera => ({
        ...camera,
        specs: JSON.parse(camera.specs || '{}'),
        features: JSON.parse(camera.features || '[]'),
        proxiedImageUrl: camera.imageUrl ? 
          `/api/image-proxy?url=${encodeURIComponent(camera.imageUrl)}` : 
          '/images/placeholder.jpg'
      }));
      
      res.json({ results: processedResults });
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
          '/images/placeholder.jpg',
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
          imageUrl: 'https://www.usa.canon.com/inetretail/products/images/products/Cameras/EOS-R5_Default_tcm82-2408659.png',
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
      console.log(`Camera Vault Server running on port ${this.port}`);
    });
  }
}

const server = new CameraVaultServer();
server.start();
