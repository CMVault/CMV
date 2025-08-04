const fs = require('fs');

console.log('🔧 Fixing extra closing braces in unified-camera-system.js...\n');

// Read the file
let content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Split into lines
let lines = content.split('\n');

// Find the problematic area around line 321
console.log('Looking for extra braces around line 321...');

// Remove the duplicate closing braces
// Based on the sed output, we have:
// });
// });
// });  <-- extra
// });  <-- extra
// }    <-- extra

let fixed = false;
for (let i = 310; i < 330 && i < lines.length; i++) {
    // Look for the pattern of multiple closing braces
    if (lines[i].trim() === '});' && 
        lines[i+1] && lines[i+1].trim() === '});' &&
        lines[i+2] && lines[i+2].trim() === '});' &&
        lines[i+3] && lines[i+3].trim() === '});') {
        
        console.log(`Found extra braces at line ${i+1}`);
        // Keep the first two, remove the extra ones
        lines.splice(i+2, 3); // Remove 3 lines starting at i+2
        fixed = true;
        break;
    }
}

if (!fixed) {
    // Alternative approach - look for the saveCamera function end
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Error saving camera')) {
            // Found the error line, now look for the proper closing
            let j = i;
            let braceCount = 0;
            while (j < lines.length && j < i + 20) {
                if (lines[j].includes('});')) braceCount++;
                j++;
            }
            
            if (braceCount > 2) {
                console.log(`Found ${braceCount} closing braces after error handler - should be 2`);
                // Remove extra ones
                let removed = 0;
                for (let k = i; k < j && removed < braceCount - 2; k++) {
                    if (lines[k].trim() === '});' && removed < braceCount - 2) {
                        lines.splice(k, 1);
                        k--; // Adjust index after removal
                        removed++;
                    }
                }
                fixed = true;
                break;
            }
        }
    }
}

// Rebuild content
content = lines.join('\n');

// Save the fixed file
fs.writeFileSync('unified-camera-system.js', content);

console.log(fixed ? '✅ Fixed extra closing braces!' : '⚠️  Could not find exact pattern, trying alternative fix...');

console.log('\n🔄 Now restart the service:');
console.log('   npx pm2 restart cmv-discovery');
console.log('   npx pm2 logs cmv-discovery --lines 50');
console.log('\n📊 Check if cameras are being saved:');
console.log('   sqlite3 data/camera-vault.db "SELECT COUNT(*) FROM cameras;"');
