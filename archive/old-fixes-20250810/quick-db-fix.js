const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('🔧 Quick database fix...\n');

// Backup existing database
if (fs.existsSync('./data/camera-vault.db')) {
  fs.copyFileSync('./data/camera-vault.db', './data/camera-vault.db.backup');
  console.log('✅ Backed up existing database');
}

// Delete and recreate
fs.unlinkSync('./data/camera-vault.db');
console.log('✅ Removed old database');

// Create new database with correct schema
const db = new sqlite3.Database('./data/camera-vault.db');

const schema = `
CREATE TABLE cameras (
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

CREATE TABLE image_attributions (
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

db.exec(schema, (err) => {
  if (err) {
    console.error('❌ Error:', err);
  } else {
    console.log('✅ Created new database with correct schema');
    console.log('\nNow run: npm run scrape');
  }
  db.close();
});