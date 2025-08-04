// automation-routes.js
// Add these routes to your server.js file

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Import the automation system
let automation;
try {
  automation = require('./cmv-automation');
} catch (error) {
  console.log('CMV Automation not initialized');
}

// Get automation status
router.get('/api/automation/status', async (req, res) => {
  try {
    // Read the latest report
    const reportPath = './data/automation-report.json';
    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
    
    if (!reportExists) {
      return res.json({
        status: 'inactive',
        message: 'No automation report found',
        stats: {
          camerasAdded: 0,
          totalCameras: 0,
          imagesDownloaded: 0,
          successRate: 0,
          processingSpeed: 0,
          dbSize: 0,
          lastBackup: null
        }
      });
    }
    
    const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    
    // Get database stats
    const db = req.app.locals.db;
    const dbStats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as totalCameras,
          COUNT(DISTINCT brand) as totalBrands,
          COUNT(image_path) as camerasWithImages
         FROM cameras`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // Get database file size
    const dbPath = './data/camera-vault.db';
    const dbStat = await fs.stat(dbPath);
    const dbSizeMB = (dbStat.size / (1024 * 1024)).toFixed(1);
    
    // Calculate success rate
    const successRate = report.stats.errors.length > 0 
      ? Math.round(((report.stats.camerasAdded) / (report.stats.camerasAdded + report.stats.errors.length)) * 100)
      : 100;
    
    // Calculate processing speed (cameras per hour)
    const processingSpeed = report.stats.lastRun 
      ? Math.round(report.stats.camerasAdded / ((Date.now() - new Date(report.stats.lastRun)) / 3600000))
      : 0;
    
    res.json({
      status: 'active',
      nextRun: report.nextRun,
      stats: {
        camerasAdded: report.stats.camerasAdded,
        totalCameras: dbStats.totalCameras,
        totalBrands: dbStats.totalBrands,
        imagesDownloaded: report.stats.imagesDownloaded,
        camerasWithImages: dbStats.camerasWithImages,
        successRate,
        processingSpeed,
        dbSize: dbSizeMB,
        lastBackup: await getLastBackupTime(),
        errors: report.stats.errors
      },
      lastRun: report.timestamp
    });
  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({ error: 'Failed to get automation status' });
  }
});

// Start automation manually
router.post('/api/automation/start', async (req, res) => {
  try {
    if (automation && automation.scrapeAllCameras) {
      // Run scraping in background
      automation.scrapeAllCameras().catch(console.error);
      res.json({ message: 'Scraping started', status: 'running' });
    } else {
      res.status(400).json({ error: 'Automation system not initialized' });
    }
  } catch (error) {
    console.error('Error starting automation:', error);
    res.status(500).json({ error: 'Failed to start automation' });
  }
});

// Stop automation
router.post('/api/automation/stop', async (req, res) => {
  try {
    if (automation && automation.shutdown) {
      await automation.shutdown();
      res.json({ message: 'Automation stopped', status: 'stopped' });
    } else {
      res.status(400).json({ error: 'Automation system not initialized' });
    }
  } catch (error) {
    console.error('Error stopping automation:', error);
    res.status(500).json({ error: 'Failed to stop automation' });
  }
});

// Get activity log
router.get('/api/automation/logs', async (req, res) => {
  try {
    const logsPath = './data/automation-logs.json';
    const logsExist = await fs.access(logsPath).then(() => true).catch(() => false);
    
    if (!logsExist) {
      return res.json({ logs: [] });
    }
    
    const logs = JSON.parse(await fs.readFile(logsPath, 'utf8'));
    
    // Return last 100 log entries
    res.json({
      logs: logs.slice(-100).reverse()
    });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Trigger backup manually
router.post('/api/automation/backup', async (req, res) => {
  try {
    if (automation && automation.backupDatabase) {
      await automation.backupDatabase();
      res.json({ message: 'Backup completed', timestamp: new Date().toISOString() });
    } else {
      // Manual backup if automation not running
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `./data/backups/camera-vault-${timestamp}.db`;
      
      await fs.mkdir('./data/backups', { recursive: true });
      await fs.copyFile('./data/camera-vault.db', backupPath);
      
      res.json({ message: 'Manual backup completed', path: backupPath });
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Get scraping queue
router.get('/api/automation/queue', async (req, res) => {
  try {
    const queuePath = './data/scraping-queue.json';
    const queueExists = await fs.access(queuePath).then(() => true).catch(() => false);
    
    if (!queueExists) {
      return res.json({ 
        queue: [],
        processed: 0,
        total: 0,
        percentComplete: 0
      });
    }
    
    const queue = JSON.parse(await fs.readFile(queuePath, 'utf8'));
    
    res.json({
      queue: queue.pending || [],
      processed: queue.processed || 0,
      total: queue.total || 0,
      percentComplete: queue.total > 0 ? Math.round((queue.processed / queue.total) * 100) : 0
    });
  } catch (error) {
    console.error('Error getting queue:', error);
    res.status(500).json({ error: 'Failed to get queue' });
  }
});

// Helper function to get last backup time
async function getLastBackupTime() {
  try {
    const backupDir = './data/backups';
    const files = await fs.readdir(backupDir);
    const backups = files
      .filter(f => f.startsWith('camera-vault-') && f.endsWith('.db'))
      .sort()
      .reverse();
    
    if (backups.length > 0) {
      const stat = await fs.stat(path.join(backupDir, backups[0]));
      return stat.mtime.toISOString();
    }
  } catch (error) {
    // No backups directory or no backups
  }
  return null;
}

// Add to server.js:
// app.use(require('./automation-routes'));

module.exports = router;