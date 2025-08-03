const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing smart quotes in all JavaScript files...\n');

// Files to check and fix
const filesToFix = [
  'auto-scraper.js',
  'cleanup.js',
  'continuous-auto-scraper.js',
  'server.js',
  'package.json'
];

let totalFixed = 0;

filesToFix.forEach(file => {
  try {
    if (!fs.existsSync(file)) {
      console.log(`⏭️  Skipping ${file} (doesn't exist)`);
      return;
    }

    // Read the file
    let content = fs.readFileSync(file, 'utf8');
    const originalContent = content;

    // Replace all types of smart quotes with regular quotes
    content = content
      .replace(/'/g, "'")  // Left single quote
      .replace(/'/g, "'")  // Right single quote
      .replace(/"/g, '"')  // Left double quote
      .replace(/"/g, '"')  // Right double quote
      .replace(/„/g, '"')  // German quote
      .replace(/"/g, '"')  // Another type of smart quote
      .replace(/«/g, '"')  // French quote
      .replace(/»/g, '"')  // French quote
      .replace(/‚/g, "'")  // Single low quote
      .replace(/'/g, "'")  // Another single quote variant
      .replace(/‛/g, "'")  // Another single quote variant
      .replace(/❛/g, "'")  // Heavy single quote
      .replace(/❜/g, "'")  // Heavy single quote
      .replace(/❝/g, '"')  // Heavy double quote
      .replace(/❞/g, '"')  // Heavy double quote

    // Check if anything changed
    if (content !== originalContent) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ Fixed quotes in: ${file}`);
      totalFixed++;
    } else {
      console.log(`✓  No smart quotes found in: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}: ${error.message}`);
  }
});

console.log(`\n✨ Fixed ${totalFixed} files!`);
console.log('\nNow run: npm run scrape');