const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing SQL query in unified-camera-system.js...\n');

// Read the unified-camera-system.js file
const filePath = path.join(__dirname, 'unified-camera-system.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the problematic updateMissingImages function
// The error shows the query is malformed with extra quotes and \n characters

// Look for the updateMissingImages function and fix it
const oldPattern = /async updateMissingImages\(\) {[\s\S]*?SELECT id, brand, model[\s\S]*?LIMIT 50[^`]*/;

// Replace with a clean version
const newFunction = `async updateMissingImages() {
        const query = \`
            SELECT id, brand, model 
            FROM cameras 
            WHERE localImagePath IS NULL 
               OR localImagePath = '' 
               OR localImagePath NOT LIKE '/images/cameras/%' 
            LIMIT 50
        \`;
        
        this.db.all(query, [], async (err, cameras) => {
            if (err) {
                console.error('❌ Error checking for missing images:', err);
                return;
            }
            
            if (cameras && cameras.length > 0) {
                console.log(\`🖼️  Found \${cameras.length} cameras with missing images\`);
                for (const camera of cameras) {
                    await this.downloadAndSaveImage(camera);
                }
            }
        });
    }`;

// First, let's check if the function exists
if (content.includes('updateMissingImages')) {
    console.log('Found updateMissingImages function, attempting to fix...');
    
    // Try to replace the entire function
    const functionMatch = content.match(/async updateMissingImages\(\)\s*{[^}]*(?:{[^}]*}[^}]*)*}/);
    
    if (functionMatch) {
        const oldFunction = functionMatch[0];
        console.log('Original function found, replacing...');
        content = content.replace(oldFunction, newFunction);
    } else {
        console.log('Could not match function pattern, trying alternative fix...');
        
        // Alternative: Just fix the SQL query string
        // Look for the malformed query
        const malformedQuery = /SELECT id, brand, model[\s\\n]+FROM cameras[\s\\n]+WHERE localImagePath[^`]+LIMIT 50/g;
        const cleanQuery = `SELECT id, brand, model FROM cameras WHERE localImagePath IS NULL OR localImagePath = '' OR localImagePath NOT LIKE '/images/cameras/%' LIMIT 50`;
        
        content = content.replace(malformedQuery, cleanQuery);
    }
    
    // Also ensure the column name is correct throughout
    content = content.replace(/localimagepath/g, 'localImagePath');
    
    // Write the file back
    fs.writeFileSync(filePath, content);
    
    console.log('✅ Fixed SQL query in unified-camera-system.js');
} else {
    console.log('❌ Could not find updateMissingImages function!');
    console.log('The file might be corrupted. Consider restoring from backup.');
}

console.log('\n📝 Next steps:');
console.log('1. Restart the discovery service:');
console.log('   npx pm2 restart cmv-discovery');
console.log('\n2. Check the logs:');
console.log('   npx pm2 logs cmv-discovery --lines 50');
console.log('\n✨ The SQLITE_ERROR should be fixed now!');
