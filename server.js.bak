// Load environment variables
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const config = require('./config/server.config');
const automationRoutes = require('./automation-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Database path
const dbPath = path.join(__dirname, 'data', 'camera-vault.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Make database accessible to routes
app.locals.db = db;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
        },
    },
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views', 'pages'));

// Helper function to run database queries
function dbAll(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbGet(query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

// API Routes

// Get all cameras
app.get('/api/cameras', async (req, res) => {
    try {
        const { brand, category, sort, limit = 50, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM cameras WHERE 1=1';
        const params = [];
        
        if (brand) {
            query += ' AND brand = ?';
            params.push(brand);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        // Sorting
        switch (sort) {
            case 'newest':
                query += ' ORDER BY releaseYear DESC';
                break;
            case 'oldest':
                query += ' ORDER BY releaseYear ASC';
                break;
            case 'name':
                query += ' ORDER BY fullName ASC';
                break;
            case 'price-high':
                query += ' ORDER BY price DESC';
                break;
            case 'price-low':
                query += ' ORDER BY price ASC';
                break;
            default:
                query += ' ORDER BY id DESC';
        }
        
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const cameras = await dbAll(query, params);
        
        // Parse JSON fields
        cameras.forEach(camera => {
            if (camera.specs) camera.specs = JSON.parse(camera.specs);
            if (camera.features) camera.features = JSON.parse(camera.features);
        });
        
        res.json(cameras);
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});

// Get single camera by ID
app.get('/api/camera/:id', async (req, res) => {
    try {
        const camera = await dbGet('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        
        if (!camera) {
            return res.status(404).json({ error: 'Camera not found' });
        }
        
        // Parse JSON fields
        if (camera.specs) camera.specs = JSON.parse(camera.specs);
        if (camera.features) camera.features = JSON.parse(camera.features);
        
        res.json(camera);
    } catch (error) {
        console.error('Error fetching camera:', error);
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
});

// Search cameras
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.json([]);
        }
        
        const query = `
            SELECT * FROM cameras 
            WHERE fullName LIKE ? OR brand LIKE ? OR model LIKE ?
            ORDER BY fullName ASC
            LIMIT 20
        `;
        
        const searchTerm = `%${q}%`;
        const cameras = await dbAll(query, [searchTerm, searchTerm, searchTerm]);
        
        // Parse JSON fields
        cameras.forEach(camera => {
            if (camera.specs) camera.specs = JSON.parse(camera.specs);
            if (camera.features) camera.features = JSON.parse(camera.features);
        });
        
        res.json(cameras);
    } catch (error) {
        console.error('Error searching cameras:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get stats
app.get('/api/stats', async (req, res) => {
    try {
        const cameraCount = await dbGet('SELECT COUNT(*) as count FROM cameras');
        const manualCount = await dbGet('SELECT COUNT(*) as count FROM cameras WHERE manualUrl IS NOT NULL');
        const brandCount = await dbGet('SELECT COUNT(DISTINCT brand) as count FROM cameras');
        
        res.json({
            cameraCount: cameraCount.count,
            manualCount: manualCount.count,
            brandCount: brandCount.count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Get homepage data
app.get('/api/homepage', async (req, res) => {
    try {
        // Get stats
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as cameraCount,
                COUNT(CASE WHEN manualUrl IS NOT NULL THEN 1 END) as manualCount
            FROM cameras
        `);
        
        // Get recent cameras
        const recentCameras = await dbAll(`
            SELECT * FROM cameras 
            ORDER BY id DESC 
            LIMIT 12
        `);
        
        // Parse JSON fields for recent cameras
        recentCameras.forEach(camera => {
            if (camera.specs) camera.specs = JSON.parse(camera.specs);
            if (camera.features) camera.features = JSON.parse(camera.features);
            
            // Build proper image object
            camera.image = {
                url: camera.localImagePath || camera.imageUrl || '/images/camera-placeholder.jpg'
            };
        });
        
        // Get featured camera (random selection from cameras with images)
        const featuredCamera = await dbGet(`
            SELECT * FROM cameras 
            WHERE localImagePath IS NOT NULL 
            ORDER BY RANDOM() 
            LIMIT 1
        `);
        
        let featured = null;
        if (featuredCamera) {
            // Parse JSON fields
            if (featuredCamera.specs) featuredCamera.specs = JSON.parse(featuredCamera.specs);
            if (featuredCamera.features) featuredCamera.features = JSON.parse(featuredCamera.features);
            
            // Build proper image object
            featuredCamera.image = {
                url: featuredCamera.localImagePath || featuredCamera.imageUrl || '/images/camera-placeholder.jpg'
            };
            
            // Create featured object with proper structure
            featured = {
                camera: {
                    ...featuredCamera,
                    sensor: featuredCamera.specs?.sensor || { size: 'Full Frame', megapixels: 45 },
                    video: featuredCamera.specs?.video || { maxResolution: '8K' }
                },
                reason: `Trending today: ${featuredCamera.fullName} - A ${featuredCamera.category || 'professional'} camera with exceptional features`,
                production: null // Could be linked to productions table in future
            };
        }
        
        res.json({
            stats,
            recentCameras,
            featuredCamera: featured
        });
    } catch (error) {
        console.error('Error fetching homepage data:', error);
        res.status(500).json({ error: 'Failed to fetch homepage data' });
    }
});

// Get brands list
app.get('/api/brands', async (req, res) => {
    try {
        const brands = await dbAll(`
            SELECT DISTINCT brand, COUNT(*) as count 
            FROM cameras 
            GROUP BY brand 
            ORDER BY brand ASC
        `);
        
        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

// Camera finder endpoint
app.post('/api/camera-finder', async (req, res) => {
    try {
        const { budget, primaryUse, experience } = req.body;
        
        let query = 'SELECT * FROM cameras WHERE 1=1';
        const params = [];
        
        // Filter by budget
        if (budget && budget !== 'any') {
            const budgetRanges = {
                'under-500': [0, 500],
                '500-1000': [500, 1000],
                '1000-2000': [1000, 2000],
                '2000-5000': [2000, 5000],
                'over-5000': [5000, 999999]
            };
            
            if (budgetRanges[budget]) {
                query += ' AND price >= ? AND price <= ?';
                params.push(budgetRanges[budget][0], budgetRanges[budget][1]);
            }
        }
        
        // Filter by use case
        if (primaryUse && primaryUse !== 'general') {
            // This is simplified - in real app would have more sophisticated matching
            if (primaryUse === 'video') {
                query += ' AND category = ?';
                params.push('cinema');
            }
        }
        
        query += ' ORDER BY releaseYear DESC LIMIT 10';
        
        const cameras = await dbAll(query, params);
        
        // Parse JSON fields
        cameras.forEach(camera => {
            if (camera.specs) camera.specs = JSON.parse(camera.specs);
            if (camera.features) camera.features = JSON.parse(camera.features);
        });
        
        res.json(cameras);
    } catch (error) {
        console.error('Error in camera finder:', error);
        res.status(500).json({ error: 'Camera finder failed' });
    }
});

// Mock networks endpoint (for homepage)
app.get('/api/networks', async (req, res) => {
    // This would eventually connect to a productions/networks table
    const networks = [
        { id: 'netflix', name: 'Netflix', logo: '🎬' },
        { id: 'hbo', name: 'HBO', logo: '📺' },
        { id: 'disney', name: 'Disney+', logo: '🏰' },
        { id: 'amazon', name: 'Amazon', logo: '📦' },
        { id: 'apple', name: 'Apple TV+', logo: '🍎' }
    ];
    
    res.json(networks);
});

// Image proxy endpoint
app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).send('URL parameter required');
        }
        
        // Check if we have this image cached
        const cached = await dbGet('SELECT * FROM image_cache WHERE url = ?', [url]);
        
        if (cached && cached.localPath && fsSync.existsSync(cached.localPath)) {
            // Update last accessed time
            await dbRun('UPDATE image_cache SET lastAccessed = CURRENT_TIMESTAMP WHERE url = ?', [url]);
            
            // Serve cached image
            res.type(cached.contentType || 'image/jpeg');
            return res.sendFile(path.resolve(cached.localPath));
        }
        
        // Fetch and cache the image
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CameraVault/1.0)'
            }
        });
        
        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || 'image/jpeg';
        
        // Generate unique filename
        const hash = crypto.createHash('md5').update(url).digest('hex');
        const ext = contentType.split('/')[1] || 'jpg';
        const filename = `proxy-${hash}.${ext}`;
        const filepath = path.join(__dirname, 'public', 'images', 'cache', filename);
        
        // Ensure cache directory exists
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        
        // Process and save image
        await sharp(buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(filepath);
        
        // Store in cache database
        await dbRun(`
            INSERT OR REPLACE INTO image_cache (url, localPath, contentType, size, cachedAt, lastAccessed)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [url, filepath, contentType, buffer.length]);
        
        // Send the image
        res.type(contentType);
        res.sendFile(path.resolve(filepath));
        
    } catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).send('Failed to fetch image');
    }
});

// Page routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cameras', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cameras.html'));
});

app.get('/camera/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera-detail.html'));
});

app.get('/camera-finder', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera-finder.html'));
});

app.get('/productions', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'productions.html'));
});

app.get('/camera-blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera-blog.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Legal pages
app.get('/privacy', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/dmca', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dmca.html'));
});

app.get('/attribution', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'attribution.html'));
});

app.get('/legal', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'legal.html'));
});

// Automation routes
app.use(automationRoutes);

// Serve automation monitor
app.get('/automation-monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'automation-monitor.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

// Start server
// Function to find an available port
async function findAvailablePort(startPort, alternativePorts) {
    const net = require('net');
    
    async function isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    }
    
    // Try the preferred port first
    if (await isPortAvailable(startPort)) {
        return startPort;
    }
    
    // Try alternative ports
    for (const port of alternativePorts) {
        if (await isPortAvailable(port)) {
            console.log(`Port ${startPort} was busy, using port ${port} instead`);
            return port;
        }
    }
    
    throw new Error('No available ports found');
}

// Start server with automatic port finding
async function startServer() {
    try {
        const availablePort = await findAvailablePort(config.port, config.alternativePorts);
        
        const server = app.listen(availablePort, () => {
            console.log('╔════════════════════════════════════════════╗');
            console.log('║       Camera Manual Vault Server           ║');
            console.log('╠════════════════════════════════════════════╣');
            console.log(`║ Server:   http://localhost:${availablePort}${' '.repeat(16 - availablePort.toString().length)}║`);
            console.log(`║ Database: ${path.basename(dbPath)}${' '.repeat(25 - path.basename(dbPath).length)}║`);
            console.log(`║ Mode:     ${config.server.environment}${' '.repeat(29 - config.server.environment.length)}║`);
            console.log('║ Status:   ✅ Running                       ║');
            console.log('╚════════════════════════════════════════════╝');
            console.log('\nPress Ctrl+C to stop the server\n');
        });
        
        // Store server reference for graceful shutdown
        process.server = server;
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
    console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
    
    if (process.server) {
        process.server.close(() => {
            console.log('✅ HTTP server closed');
            
            db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err);
                } else {
                    console.log('✅ Database connection closed');
                }
                
                console.log('👋 Goodbye!');
                process.exit(0);
            });
        });
        
        // Force shutdown after 10 seconds
        setTimeout(() => {
            console.error('⚠️  Forced shutdown after 10 seconds');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();