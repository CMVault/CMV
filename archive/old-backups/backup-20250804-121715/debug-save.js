const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data/camera-vault.db');

// Test data matching what the automation tries to save
const testCamera = {
  brand: 'Test',
  model: 'Camera',
  fullName: 'Test Camera',
  category: 'mirrorless',
  releaseYear: 2023,
  msrp: 2000,
  sensorSize: 'Full Frame',
  sensorMegapixels: 24,
  sensorType: 'CMOS',
  videoMaxResolution: '4K',
  videoMaxFramerate: '60fps',
  features: JSON.stringify({ ibis: true }),
  specs: JSON.stringify({}),
  imagePath: '/images/cameras/test.jpg',
  thumbnailPath: '/images/cameras/thumbs/test-thumb.jpg',
  manualUrl: 'https://example.com/test.pdf',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

console.log('Testing camera insert...\n');

// Get column names
db.all("PRAGMA table_info(cameras)", (err, columns) => {
  console.log('Camera table columns:');
  columns.forEach(col => console.log(`  ${col.name} (${col.type})`));
  
  // Try to insert
  const columnNames = Object.keys(testCamera).filter(key => {
    const colName = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    return columns.some(col => col.name === colName || col.name === key);
  });
  
  console.log('\nAttempting insert with columns:', columnNames);
  
  db.close();
});
