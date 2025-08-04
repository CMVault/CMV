const express = require('express');
const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const config = require('./config/server.config');
const net = require('net');

// Initialize Express
const app = express();

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'data', 'camera-vault.db'));

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database helper functions
const dbAll = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// API Routes
app.get('/api/cameras', async (req, res) => {
    try {
        const cameras = await dbAll('SELECT * FROM cameras');
        res.json(cameras);
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});

app.get('/api/camera/:id', async (req, res) => {
    try {
        const camera = await dbGet('SELECT * FROM cameras WHERE id = ?', [req.params.id]);
        if (!camera) {
            return res.status(404).json({ error: 'Camera not found' });
        }
        res.json(camera);
    } catch (error) {
        console.error('Error fetching camera:', error);
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, brand, category } = req.query;
        let query = 'SELECT * FROM cameras WHERE 1=1';
        const params = [];
        
        if (q) {
            query += ' AND (model LIKE ? OR brand LIKE ? OR category LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        
        if (brand) {
            query += ' AND brand = ?';
            params.push(brand);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        const cameras = await dbAll(query, params);
        res.json(cameras);
    } catch (error) {
        console.error('Error searching cameras:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const cameraCount = await dbGet('SELECT COUNT(*) as count FROM cameras');
        const manualCount = await dbGet('SELECT COUNT(*) as count FROM cameras WHERE manual_url IS NOT NULL');
        
        res.json({
            cameraCount: cameraCount.count,
            manualCount: manualCount.count
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/homepage', async (req, res) => {
    try {
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as cameraCount,
                COUNT(CASE WHEN manual_url IS NOT NULL THEN 1 END) as manualCount
            FROM cameras
        `);
        
        const recentCameras = await dbAll(`
            SELECT * FROM cameras 
            ORDER BY created_at DESC 
            LIMIT 8
        `);
        
        const featuredCamera = await dbGet(`
            SELECT * FROM cameras 
            WHERE category = 'cinema' 
            ORDER BY RANDOM() 
            LIMIT 1
        `);
        
        res.json({
            stats,
            recentCameras,
            featuredCamera: featuredCamera ? {
                camera: featuredCamera,
                reason: 'Featured for its professional cinema capabilities',
                production: null
            } : null
        });
    } catch (error) {
        console.error('Error fetching homepage data:', error);
        res.status(500).json({ error: 'Failed to fetch homepage data' });
    }
});

app.get('/api/brands', async (req, res) => {
    try {
        const brands = await dbAll('SELECT DISTINCT brand FROM cameras ORDER BY brand');
        res.json(brands.map(b => b.brand));
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

app.post('/api/camera-finder', async (req, res) => {
    try {
        const { budget, category, features } = req.body;
        let query = 'SELECT * FROM cameras WHERE 1=1';
        const params = [];
        
        if (budget) {
            query += ' AND msrp <= ?';
            params.push(budget);
        }
        
        if (category) {
            query += ' AND category = ?';
            params.push(category);
        }
        
        const cameras = await dbAll(query + ' LIMIT 10', params);
        res.json(cameras);
    } catch (error) {
        console.error('Error in camera finder:', error);
        res.status(500).json({ error: 'Camera finder failed' });
    }
});

app.get('/api/networks', async (req, res) => {
    try {
        // Mock data for networks
        const networks = [
            { id: 'netflix', name: 'Netflix', logo: '🎬' },
            { id: 'hbo', name: 'HBO', logo: '📺' },
            { id: 'disney', name: 'Disney+', logo: '🏰' },
            { id: 'amazon', name: 'Amazon Prime', logo: '📦' },
            { id: 'apple', name: 'Apple TV+', logo: '🍎' }
        ];
        res.json(networks);
    } catch (error) {
        console.error('Error fetching networks:', error);
        res.status(500).json({ error: 'Failed to fetch networks' });
    }
});

// Image proxy endpoint (simple version without attribution overlay)
app.get('/api/image-proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).send('URL parameter required');
        }
        
        // For now, just redirect to the placeholder
        res.redirect('/images/camera-placeholder.jpg');
    } catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).send('Image proxy failed');
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

// Port finding utilities
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

async function findAvailablePort(startPort = 3000, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
    }
    throw new Error('No available ports found');
}

// Start server
async function startServer() {
    try {
        const port = await findAvailablePort(config.PORT || 3000);
        
        app.listen(port, () => {
            console.log('=================================');
            console.log('CMV Server (Minimal) Started');
            console.log('=================================');
            console.log(`Server running on port ${port}`);
            console.log(`Open http://localhost:${port}`);
            console.log('');
            console.log('NO AUTOMATION RUNNING');
            console.log('This is the minimal server without automation');
            console.log('=================================');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    db.close();
    process.exit(0);
});

// Start the server
startServer();