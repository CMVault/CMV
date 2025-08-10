const fs = require('fs');

console.log('🔧 Fixing database column mappings in unified-camera-system.js...\n');

// Read the file
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Fix 1: Update the INSERT query to use correct column names
const findInsertQuery = /INSERT INTO cameras[\s\S]*?VALUES[\s\S]*?\)/g;

// Replace with the correct column names from your database
const newInsertQuery = `INSERT INTO cameras (
                    brand, model, fullName, releaseYear, category, 
                    sensorSize, sensorMegapixels, imageUrl, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

// Find and replace the saveCamera function
const saveCameraStart = content.indexOf('async saveCamera(camera)');
const saveCameraEnd = content.indexOf('}', content.indexOf('resolve();', saveCameraStart));

if (saveCameraStart !== -1) {
    const oldFunction = content.substring(saveCameraStart, saveCameraEnd + 1);
    
    const newFunction = `async saveCamera(camera) {
        return new Promise((resolve) => {
            const query = \`
                INSERT INTO cameras (
                    brand, model, fullName, releaseYear, category, 
                    sensorSize, sensorMegapixels, imageUrl, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            \`;
            
            this.db.run(query, [
                camera.brand,
                camera.model,
                camera.fullName,
                camera.releaseYear,
                camera.category,
                camera.sensorSize,
                camera.megapixels,  // Map from megapixels to sensorMegapixels column
                ''
            ], (err) => {
                if (err) {
                    console.error('❌ Error saving camera:', err);
                }
                resolve();
            });
        });
    }`;
    
    content = content.substring(0, saveCameraStart) + newFunction + content.substring(saveCameraEnd + 1);
    
    console.log('✅ Updated saveCamera function');
}

// Fix 2: Ensure mock data still works
// The mock data can keep using 'megapixels' as property name, 
// we just map it to sensorMegapixels in the INSERT

// Save the fixed file
fs.writeFileSync('unified-camera-system.js', content);

console.log('✅ Fixed database column mappings');
console.log('\n📝 Column mappings:');
console.log('   - megapixels → sensorMegapixels');
console.log('   - created_at → createdAt');
console.log('   - Using CURRENT_TIMESTAMP for createdAt');
console.log('\n🔄 Now restart the service:');
console.log('   npx pm2 restart cmv-discovery');
console.log('   npx pm2 logs cmv-discovery --lines 50');
console.log('\n✨ Cameras should save without errors now!');
