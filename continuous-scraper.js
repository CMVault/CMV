const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ContinuousScraper {
  constructor() {
    this.dbPath = path.join(__dirname, 'data', 'camera-vault.db');
    this.modes = {
      aggressive: { name: 'aggressive', interval: 5 * 60 * 1000, batchSize: 50, concurrent: 10 },
      normal: { name: 'normal', interval: 60 * 60 * 1000, batchSize: 20, concurrent: 5 },
      maintenance: { name: 'maintenance', interval: 6 * 60 * 60 * 1000, batchSize: 10, concurrent: 2 }
    };
    this.currentMode = this.modes.aggressive;
    this.isRunning = false;
  }

  async initialize() {
    this.db = new sqlite3.Database(this.dbPath);
    await this.runQuery(`
      CREATE TABLE IF NOT EXISTS scraping_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        mode TEXT,
        camerasFound INTEGER,
        duration INTEGER,
        errors INTEGER
      )`);
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Starting continuous smart scraping...');
    await this.runScrapingCycle();
    this.scheduleNextRun();
  }

  async runScrapingCycle() {
    const startTime = Date.now();
    console.log(`Running scraping cycle in ${this.currentMode.name} mode`);
    
    try {
      const UltimateScraper = require('./ultimate-scraper');
      const scraper = new UltimateScraper();
      scraper.limit = require('p-limit')(this.currentMode.concurrent);
      scraper.batchSize = this.currentMode.batchSize;
      
      await scraper.initialize();
      const results = await scraper.scrapeAll();
      await scraper.cleanup();
      
      const duration = Date.now() - startTime;
      await this.recordMetrics({
        mode: this.currentMode.name,
        camerasFound: results.newCameras,
        duration: duration,
        errors: results.failed || 0
      });
      
      console.log(`Cycle complete: ${results.newCameras} new cameras in ${Math.round(duration/1000)}s`);
      await this.analyzeAndAdaptMode();
      
    } catch (error) {
      console.error('Scraping cycle error:', error);
    }
  }

  async analyzeAndAdaptMode() {
    const rates = await this.calculateDiscoveryRates();
    console.log(`Discovery rates - Daily: ${rates.daily} cameras/day`);
    
    let newMode;
    if (rates.daily > 1000) newMode = this.modes.aggressive;
    else if (rates.daily > 100) newMode = this.modes.normal;
    else newMode = this.modes.maintenance;
    
    const totalCameras = await this.getTotalCameraCount();
    if (totalCameras < 10000) newMode = this.modes.aggressive;
    else if (totalCameras > 150000 && rates.daily < 50) newMode = this.modes.maintenance;
    
    if (newMode.name !== this.currentMode.name) {
      console.log(`Mode change: ${this.currentMode.name} → ${newMode.name}`);
      this.currentMode = newMode;
    }
  }

  async calculateDiscoveryRates() {
    const recentDiscoveries = await this.getQuery(`
      SELECT 
        SUM(CASE WHEN timestamp > datetime('now', '-1 hour') THEN camerasFound ELSE 0 END) as hourly,
        SUM(CASE WHEN timestamp > datetime('now', '-1 day') THEN camerasFound ELSE 0 END) as daily,
        SUM(CASE WHEN timestamp > datetime('now', '-7 days') THEN camerasFound ELSE 0 END) as weekly
      FROM scraping_metrics`);
    
    return {
      hourly: recentDiscoveries.hourly || 0,
      daily: recentDiscoveries.daily || 0,
      weekly: recentDiscoveries.weekly || 0
    };
  }

  async getTotalCameraCount() {
    const result = await this.getQuery('SELECT COUNT(*) as count FROM cameras');
    return result.count || 0;
  }

  scheduleNextRun() {
    if (!this.isRunning) return;
    const nextRunIn = this.currentMode.interval;
    setTimeout(async () => {
      if (this.isRunning) {
        await this.runScrapingCycle();
        this.scheduleNextRun();
      }
    }, nextRunIn);
  }

  async recordMetrics(metrics) {
    await this.runQuery(
      'INSERT INTO scraping_metrics (mode, camerasFound, duration, errors) VALUES (?, ?, ?, ?)',
      [metrics.mode, metrics.camerasFound, metrics.duration, metrics.errors]
    );
  }

  runQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  getQuery(query, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

if (require.main === module) {
  const scraper = new ContinuousScraper();
  scraper.initialize().then(() => scraper.start());
}

module.exports = ContinuousScraper;
