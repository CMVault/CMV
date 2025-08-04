const cron = require('node-cron');
const AutoCameraScraper = require('./auto-scraper');

console.log('\n⏰ CONTINUOUS AUTO-SCRAPER');
console.log('==========================\n');

// Configuration
const SCHEDULE = '0 */6 * * *'; // Every 6 hours

console.log(`📅 Schedule: ${SCHEDULE}`);
console.log('⏳ Running initial scrape...\n');

// Run immediately on start
runScraper();

// Schedule future runs
cron.schedule(SCHEDULE, () => {
  console.log(`\n⏰ Scheduled run started at ${new Date().toISOString()}\n`);
  runScraper();
});

async function runScraper() {
  const scraper = new AutoCameraScraper();
  
  try {
    await scraper.init();
    await scraper.scrapeCameras();
    
    console.log(`✅ Scraping completed at ${new Date().toISOString()}\n`);
  } catch (error) {
    console.error(`❌ Scraping failed: ${error.message}\n`);
  } finally {
    scraper.close();
  }
}

console.log('🤖 Continuous scraper is running...');
console.log('   Press Ctrl+C to stop\n');

// Keep the process running
process.stdin.resume();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down continuous scraper...');
  process.exit(0);
});
