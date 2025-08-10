// fix-all-missing-functions.js
// Finds and fixes ALL missing 'function' keywords

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔧 Comprehensive Function Syntax Fix');
console.log('=====================================\n');

try {
    // Read file
    const content = fs.readFileSync('unified-camera-system.js', 'utf8');
    const lines = content.split('\n');
    
    // Backup
    const backupName = `unified-camera-system.js.backup-${Date.now()}`;
    fs.writeFileSync(backupName, content);
    console.log(`✅ Backup saved: ${backupName}\n`);
    
    // Pattern to find function declarations missing 'function' keyword
    // Matches: functionName() { at start of line (with optional whitespace)
    const functionPattern = /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\(\)\s*{/;
    
    let fixCount = 0;
    const fixes = [];
    
    // Check each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(functionPattern);
        
        if (match && !line.includes('function') && !line.includes('=>')) {
            // Skip if it's inside an object (has : before it on same or previous line)
            let isObjectMethod = false;
            
            // Check if previous line has a comma or object syntax
            if (i > 0) {
                const prevLine = lines[i-1].trim();
                if (prevLine.endsWith(',') || prevLine.includes(': {')) {
                    isObjectMethod = true;
                }
            }
            
            // Check current line for object method syntax
            if (line.includes(':') && line.indexOf(':') < line.indexOf('(')) {
                isObjectMethod = true;
            }
            
            if (!isObjectMethod) {
                // Fix it by adding 'function'
                const whitespace = match[1];
                const functionName = match[2];
                lines[i] = `${whitespace}function ${functionName}() {`;
                fixes.push({
                    line: i + 1,
                    name: functionName,
                    original: line.trim(),
                    fixed: lines[i].trim()
                });
                fixCount++;
            }
        }
    }
    
    if (fixCount > 0) {
        console.log(`📝 Found ${fixCount} functions to fix:\n`);
        fixes.forEach(fix => {
            console.log(`  Line ${fix.line}: ${fix.name}()`);
            console.log(`    Before: ${fix.original}`);
            console.log(`    After:  ${fix.fixed}\n`);
        });
        
        // Write fixed content
        fs.writeFileSync('unified-camera-system.js', lines.join('\n'));
        console.log('✅ All fixes applied!\n');
    } else {
        console.log('✅ No missing function keywords found!\n');
    }
    
    // Test syntax
    console.log('🧪 Testing syntax...');
    try {
        execSync('node -c unified-camera-system.js', { stdio: 'pipe' });
        console.log('✅ Syntax is valid!\n');
        
        console.log('🚀 Next steps:');
        console.log('1. npx pm2 restart cmv-discovery');
        console.log('2. npx pm2 logs cmv-discovery --lines 30');
        console.log('3. npx pm2 list (check for 0 restarts)');
    } catch (error) {
        console.log('❌ Still has syntax errors:\n');
        console.log(error.stdout?.toString() || error.message);
        
        // Show the error location
        const errorMatch = error.message.match(/:(\d+)/);
        if (errorMatch) {
            const errorLine = parseInt(errorMatch[1]);
            console.log(`\n📍 Error at line ${errorLine}:`);
            for (let i = Math.max(0, errorLine - 3); i < Math.min(errorLine + 2, lines.length); i++) {
                console.log(`${i + 1}: ${lines[i]}${i === errorLine - 1 ? ' <-- ERROR' : ''}`);
            }
        }
    }
    
} catch (error) {
    console.error('❌ Script error:', error.message);
}
