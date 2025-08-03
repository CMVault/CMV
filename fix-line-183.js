const fs = require('fs');

// Read the file
let content = fs.readFileSync('auto-scraper.js', 'utf8');

// Split into lines
let lines = content.split('\n');

// Fix line 183 (array index 182)
if (lines[182] && lines[182].includes('description:')) {
  lines[182] = "        description: 'Professional full-frame mirrorless camera with 45MP sensor and 8K video.',";
  console.log('✅ Fixed line 183');
} else {
  console.log('❌ Could not find the description line at 183');
  console.log('Line 182:', lines[182]);
  console.log('Line 183:', lines[183]);
  console.log('Line 184:', lines[184]);
}

// Write back
fs.writeFileSync('auto-scraper.js', lines.join('\n'));
console.log('\nNow run: npm run scrape');