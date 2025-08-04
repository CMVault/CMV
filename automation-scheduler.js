const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const AUTOMATION_SCRIPT = './cmv-automation-fixed.js';
const SCHEDULE = '0 */6 * * *'; // Every 6 hours
const LOG_FILE = path.join(__dirname, 'data', 'automation.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Logging function
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage);
}

// Run automation function
function runAutomation() {
    log('Starting CMV automation...');
    
    const automationProcess = spawn('node', [AUTOMATION_SCRIPT], {
        stdio: ['inherit', 'pipe', 'pipe']
    });
    
    automationProcess.stdout.on('data', (data) => {
        log(`AUTOMATION: ${data.toString().trim()}`);
    });
    
    automationProcess.stderr.on('data', (data) => {
        log(`AUTOMATION ERROR: ${data.toString().trim()}`);
    });
    
    automationProcess.on('close', (code) => {
        if (code === 0) {
            log('Automation completed successfully');
        } else {
            log(`Automation exited with code ${code}`);
        }
    });
    
    automationProcess.on('error', (err) => {
        log(`Failed to start automation: ${err.message}`);
    });
}

// Main scheduler
log('=================================');
log('CMV Automation Scheduler Started');
log('=================================');
log(`Schedule: ${SCHEDULE} (every 6 hours)`);
log(`Automation script: ${AUTOMATION_SCRIPT}`);
log('');

// Run immediately on startup
log('Running initial automation...');
runAutomation();

// Schedule for every 6 hours
cron.schedule(SCHEDULE, () => {
    log('Scheduled automation triggered');
    runAutomation();
});

// Keep the process running
process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down scheduler...');
    process.exit(0);
});

process.on('SIGINT', () => {
    log('SIGINT received, shutting down scheduler...');
    process.exit(0);
});

log('Scheduler is running. Press Ctrl+C to stop.');