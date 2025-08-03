const fs = require('fs');

console.log('🔧 Fixing auto-scraper.js line 183...\n');

// Read the file
let content = fs.readFileSync('auto-scraper.js', 'utf8');

// The correct line that should be at line 183
const correctLine = "        description: 'Professional full-frame mirrorless camera with 45MP sensor and 8K video.',";

// Find and replace any variation of this line
const patterns = [
  /description:\s*['"`''‛❛]Professional full-frame mirrorless camera with 45MP sensor and 8K video\.['"`''‛❛],?/g,
  /description:\s*["']Professional full-frame mirrorless camera with 45MP sensor and 8K video\.["'],?/g,
  /description:\s*.Professional full-frame mirrorless camera with 45MP sensor and 8K video\../g
];

let fixed = false;
for (const pattern of patterns) {
  if (content.match(pattern)) {
    content = content.replace(pattern, correctLine.trim() + ',');
    fixed = true;
    break;
  }
}

// If not found by pattern, try line by line
if (!fixed) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Professional full-frame mirrorless camera with 45MP sensor and 8K video')) {
      lines[i] = correctLine;
      content = lines.join('\n');
      fixed = true;
      console.log(`✅ Fixed line ${i + 1}`);
      break;
    }
  }
}

if (fixed) {
  // Write the fixed content
  fs.writeFileSync('auto-scraper.js', content);
  console.log('✅ Fixed the description line!');
} else {
  console.log('❌ Could not find the line to fix');
}

console.log('\nNow run: npm run scrape');
