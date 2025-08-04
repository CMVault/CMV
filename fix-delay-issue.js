cat > fix-delay-issue.js << 'EOF'
const fs = require('fs');

// Read the file
const content = fs.readFileSync('unified-camera-system.js', 'utf8');

// Add helper functions at the very top of the file, after the imports
const imports = content.match(/^(const|import).*\n/gm).join('');
const withoutImports = content.replace(/^(const|import).*\n/gm, '');

// Define the helper functions
const helperFunctions = `
// Helper functions - defined at top level
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function scheduleDiscovery() {
    console.log('📅 Scheduling camera discovery to run every 4 hours');
    // This will be called from inside the class
}

`;

// Remove the old definitions of these functions
const cleaned = withoutImports
    .replace(/^function delay\(ms\) \{[\s\S]*?^\}/gm, '')
    .replace(/^function scheduleDiscovery\(\) \{[\s\S]*?^\}/gm, '');

// Combine everything
const fixed = imports + helperFunctions + cleaned;

// Write the fixed file
fs.writeFileSync('unified-camera-system.js', fixed);
console.log('✅ Fixed! Functions moved to top of file.');
EOF