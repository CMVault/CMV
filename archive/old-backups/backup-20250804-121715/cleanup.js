#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Console colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanup() {
  log('\n🧹 CAMERA VAULT - CLEANUP SCRIPT\n', 'bright');
  
  // Files to delete
  const filesToDelete = [
    'fix-automation.sh',
    'fix-database.js',
    'quick-check.sh',
    'views/pages/index-full.ejs',
    'scripts/generate-structure.js',
    'setup-and-scrape.js'  // Also remove the old combined script
  ];

  log('📄 Files to delete:', 'yellow');
  filesToDelete.forEach(file => log(`   - ${file}`));
  log('');

  let deletedCount = 0;
  let errorCount = 0;

  for (const file of filesToDelete) {
    try {
      await fs.unlink(file);
      log(`✅ Deleted: ${file}`, 'green');
      deletedCount++;
    } catch (err) {
      if (err.code === 'ENOENT') {
        log(`⏭️  Already gone: ${file}`, 'blue');
      } else {
        log(`❌ Error deleting ${file}: ${err.message}`, 'red');
        errorCount++;
      }
    }
  }

  // Disable failing GitHub workflows
  log('\n🔧 Checking for failing workflows...', 'yellow');
  try {
    const workflowDir = '.github/workflows';
    const files = await fs.readdir(workflowDir);
    
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const filepath = path.join(workflowDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        
        // Check if it references the old scraper
        if (content.includes('continuous-scraper.js') && !content.includes('auto-scraper.js')) {
          const newPath = `${filepath}.disabled`;
          await fs.rename(filepath, newPath);
          log(`✅ Disabled workflow: ${file}`, 'green');
        }
      }
    }
  } catch (err) {
    log('ℹ️  No workflows found or already handled', 'blue');
  }

  // Summary
  log('\n📊 Cleanup Summary:', 'bright');
  log(`   Deleted: ${deletedCount} files`, 'green');
  if (errorCount > 0) {
    log(`   Errors: ${errorCount} files`, 'red');
  }
  
  log('\n✨ Cleanup complete!\n', 'green');
  log('Next step: Run the auto-scraper:', 'yellow');
  log('   npm run scrape', 'blue');
  log('   or', 'yellow');
  log('   node auto-scraper.js\n', 'blue');
}

// Run cleanup
cleanup().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
