const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database('./data/camera-vault.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Helper functions
const dbAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbGet = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// API Routes
app.get('/api/cameras', async (req, res) => {
    try {
        const cameras = await dbAll('SELECT * FROM cameras ORDER BY brand, model');
        res.json(cameras);
    } catch (error) {
        console.error('Error fetching cameras:', error);
        res.status(500).json({ error: 'Failed to fetch cameras' });
    }
});

app.get('/api/camera/:id', async (req, res) => {
    try {
        const camera = await dbGet('SELECT * FROM cameras WHERE id = ? OR slug = ?', 
            [req.params.id, req.params.id]);
        if (camera) {
            res.json(camera);
        } else {
            res.status(404).json({ error: 'Camera not found' });
        }
    } catch (error) {
        console.error('Error fetching camera:', error);
        res.status(500).json({ error: 'Failed to fetch camera' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await dbGet(`
            SELECT 
                COUNT(*) as cameraCount,
                COUNT(DISTINCT brand) as brandCount,
                COUNT(manual_url) as manualCount
            FROM cameras
        `);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/brands', async (req, res) => {
    try {
        const brands = await dbAll('SELECT DISTINCT brand FROM cameras ORDER BY brand');
        res.json(brands);
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({ error: 'Failed to fetch brands' });
    }
});

// HTML Routes
app.get('/cameras', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cameras.html'));
});

app.get('/camera/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera-detail.html'));
});

// 404 handler
app.use((req, res) => {
    const file404 = path.join(__dirname, 'public', '404.html');
    if (require('fs').existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send('404 - Page not found');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════╗
    ║      Camera Manual Vault Server              ║
    ╠══════════════════════════════════════════════╣
    ║  Server:    http://localhost:${PORT}         ║
    ║  Database:  camera-vault.db                  ║
    ║  Mode:      development                      ║
    ║  Status:    ✅ Running                       ║
    ╚══════════════════════════════════════════════╝
    
    Press Ctrl+C to stop the server
    `);
});