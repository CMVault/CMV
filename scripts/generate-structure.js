const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class StructureGenerator {
  constructor(outputDir) {
    this.outputDir = outputDir;
    this.rootDir = process.cwd();
    this.structure = {
      timestamp: new Date().toISOString(),
      files: {},
      directories: {},
      metrics: {
        totalFiles: 0,
        totalDirectories: 0,
        totalLines: 0,
        filesByType: {},
        largestFiles: []
      },
      cssAnalysis: {},
      apiRoutes: [],
      databaseSchema: {},
      gitChanges: []
    };
  }

  async generate() {
    console.log('🔍 Scanning project structure...');
    
    try {
      // 1. Scan file structure
      await this.scanDirectory(this.rootDir);
      
      // 2. Analyze CSS files
      await this.analyzeCSSFiles();
      
      // 3. Extract API routes
      await this.extractAPIRoutes();
      
      // 4. Map database schema
      await this.mapDatabaseSchema();
      
      // 5. Get git changes
      await this.getGitChanges();
      
      // 6. Update PROJECT_STATUS.md
      await this.updateProjectStatus();
      
      // 7. Generate output files
      await this.generateOutputFiles();
      
      console.log('✅ Structure generation complete!');
    } catch (error) {
      console.error('❌ Error generating structure:', error);
      throw error;
    }
  }

  async scanDirectory(dir, relativePath = '') {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      // Skip unwanted directories
      if (this.shouldSkip(item)) continue;
      
      const fullPath = path.join(dir, item);
      const relPath = path.join(relativePath, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        this.structure.directories[relPath] = {
          name: item,
          path: relPath,
          fileCount: 0
        };
        this.structure.metrics.totalDirectories++;
        
        await this.scanDirectory(fullPath, relPath);
      } else {
        const fileInfo = await this.analyzeFile(fullPath, relPath);
        this.structure.files[relPath] = fileInfo;
        this.structure.metrics.totalFiles++;
        
        // Update file type counts
        const ext = path.extname(item).toLowerCase();
        this.structure.metrics.filesByType[ext] = (this.structure.metrics.filesByType[ext] || 0) + 1;
        
        // Track largest files
        this.structure.metrics.largestFiles.push({
          path: relPath,
          size: fileInfo.size
        });
      }
    }
    
    // Keep only top 20 largest files
    this.structure.metrics.largestFiles.sort((a, b) => b.size - a.size);
    this.structure.metrics.largestFiles = this.structure.metrics.largestFiles.slice(0, 20);
  }

  shouldSkip(name) {
    const skipDirs = ['node_modules', '.git', 'cache', 'test', 'coverage', '.next', 'dist', 'build'];
    const skipFiles = ['.DS_Store', 'Thumbs.db', '.env'];
    
    return skipDirs.includes(name) || skipFiles.includes(name) || name.startsWith('.');
  }

  async analyzeFile(fullPath, relPath) {
    const stats = await fs.stat(fullPath);
    const ext = path.extname(relPath).toLowerCase();
    const content = await this.readFileContent(fullPath, ext);
    
    const fileInfo = {
      name: path.basename(relPath),
      path: relPath,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      extension: ext,
      lines: content ? content.split('\n').length : 0
    };
    
    this.structure.metrics.totalLines += fileInfo.lines;
    
    // Extract specific information based on file type
    if (ext === '.js' || ext === '.ts') {
      fileInfo.functions = this.extractFunctions(content);
      fileInfo.imports = this.extractImports(content);
    } else if (ext === '.css') {
      fileInfo.cssInfo = await this.extractCSSInfo(content, relPath);
    } else if (ext === '.html') {
      fileInfo.pageInfo = this.extractHTMLInfo(content);
    }
    
    return fileInfo;
  }

  async readFileContent(filePath, ext) {
    const textExtensions = ['.js', '.ts', '.jsx', '.tsx', '.css', '.html', '.json', '.md', '.txt', '.yml', '.yaml'];
    
    if (!textExtensions.includes(ext)) {
      return null;
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.warn(`Could not read file ${filePath}:`, error.message);
      return null;
    }
  }

  extractFunctions(content) {
    if (!content) return [];
    
    const functionPatterns = [
      /function\s+(\w+)\s*\(/g,
      /const\s+(\w+)\s*=\s*\(.*?\)\s*=>/g,
      /const\s+(\w+)\s*=\s*async\s*\(.*?\)\s*=>/g,
      /(\w+)\s*:\s*function\s*\(/g,
      /(\w+)\s*:\s*async\s*function\s*\(/g
    ];
    
    const functions = new Set();
    
    functionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        functions.add(match[1]);
      }
    });
    
    return Array.from(functions);
  }

  extractImports(content) {
    if (!content) return [];
    
    const imports = [];
    const importRegex = /import\s+(?:(?:\{[^}]*\})|(?:\w+)|(?:\*\s+as\s+\w+))\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return [...new Set(imports)];
  }

  async extractCSSInfo(content, filePath) {
    if (!content) return {};
    
    const info = {
      variables: [],
      classes: [],
      ids: [],
      keyframes: [],
      mediaQueries: [],
      sections: {}
    };
    
    // Extract CSS variables
    const varRegex = /--([\w-]+):\s*([^;]+);/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      info.variables.push({
        name: match[1],
        value: match[2].trim()
      });
    }
    
    // Extract classes
    const classRegex = /\.([\w-]+)\s*\{/g;
    while ((match = classRegex.exec(content)) !== null) {
      info.classes.push(match[1]);
    }
    
    // Extract IDs
    const idRegex = /#([\w-]+)\s*\{/g;
    while ((match = idRegex.exec(content)) !== null) {
      info.ids.push(match[1]);
    }
    
    // Extract sections based on comments
    const sectionRegex = /\/\*\s*===\s*(.+?)\s*START\s*===\s*\*\//g;
    const lines = content.split('\n');
    let lineNumber = 0;
    
    lines.forEach((line, index) => {
      lineNumber = index + 1;
      const sectionMatch = line.match(/\/\*\s*===\s*(.+?)\s*START\s*===\s*\*\//);
      if (sectionMatch) {
        const sectionName = sectionMatch[1].trim();
        info.sections[sectionName] = {
          name: sectionName,
          startLine: lineNumber,
          endLine: null
        };
      }
      
      const endMatch = line.match(/\/\*\s*===\s*(.+?)\s*END\s*===\s*\*\//);
      if (endMatch) {
        const sectionName = endMatch[1].trim();
        if (info.sections[sectionName]) {
          info.sections[sectionName].endLine = lineNumber;
        }
      }
    });
    
    // Store in global CSS analysis
    this.structure.cssAnalysis[filePath] = info;
    
    return info;
  }

  extractHTMLInfo(content) {
    if (!content) return {};
    
    const info = {
      title: '',
      scripts: [],
      stylesheets: [],
      hasForm: false,
      navigation: []
    };
    
    // Extract title
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      info.title = titleMatch[1];
    }
    
    // Extract scripts
    const scriptRegex = /<script[^>]*src=['"]([^'"]+)['"]/gi;
    let match;
    while ((match = scriptRegex.exec(content)) !== null) {
      info.scripts.push(match[1]);
    }
    
    // Extract stylesheets
    const linkRegex = /<link[^>]*href=['"]([^'"]+\.css)['"]/gi;
    while ((match = linkRegex.exec(content)) !== null) {
      info.stylesheets.push(match[1]);
    }
    
    // Check for forms
    info.hasForm = /<form/i.test(content);
    
    // Extract navigation links
    const navRegex = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
    const navMatch = navRegex.exec(content);
    if (navMatch) {
      const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)</gi;
      while ((match = linkRegex.exec(navMatch[1])) !== null) {
        info.navigation.push({
          href: match[1],
          text: match[2].trim()
        });
      }
    }
    
    return info;
  }

  async analyzeCSSFiles() {
    console.log('🎨 Analyzing CSS files...');
    
    // Analyze main.css specifically
    const mainCSSPath = 'public/css/main.css';
    if (this.structure.files[mainCSSPath]) {
      const content = await fs.readFile(path.join(this.rootDir, mainCSSPath), 'utf8');
      const detailedAnalysis = await this.extractCSSInfo(content, mainCSSPath);
      
      // Count total selectors
      detailedAnalysis.totalSelectors = 
        detailedAnalysis.classes.length + 
        detailedAnalysis.ids.length;
      
      this.structure.cssAnalysis.mainCSS = detailedAnalysis;
    }
  }

  async extractAPIRoutes() {
    console.log('🌐 Extracting API routes...');
    
    const serverFile = this.structure.files['server.js'];
    if (serverFile) {
      const content = await fs.readFile(path.join(this.rootDir, 'server.js'), 'utf8');
      
      // Extract Express routes
      const routePatterns = [
        /app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g,
        /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g
      ];
      
      routePatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          this.structure.apiRoutes.push({
            method: match[1].toUpperCase(),
            path: match[2],
            file: 'server.js'
          });
        }
      });
    }
  }

  async mapDatabaseSchema() {
    console.log('🗄️ Mapping database schema...');
    
    const serverFile = this.structure.files['server.js'];
    if (serverFile) {
      const content = await fs.readFile(path.join(this.rootDir, 'server.js'), 'utf8');
      
      // Extract CREATE TABLE statements
      const tableRegex = /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([^)]+)\)/gi;
      let match;
      
      while ((match = tableRegex.exec(content)) !== null) {
        const tableName = match[1];
        const columns = match[2].split(',').map(col => {
          const parts = col.trim().split(/\s+/);
          return {
            name: parts[0],
            type: parts[1] || 'TEXT',
            constraints: parts.slice(2).join(' ')
          };
        });
        
        this.structure.databaseSchema[tableName] = {
          name: tableName,
          columns: columns
        };
      }
    }
  }

  async getGitChanges() {
    console.log('📝 Getting recent git changes...');
    
    try {
      // Get last 10 commits
      const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
      const commits = gitLog.trim().split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash: hash,
          message: messageParts.join(' ')
        };
      });
      
      // Get changed files in last commit
      const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(f => f);
      
      this.structure.gitChanges = {
        recentCommits: commits,
        lastCommitFiles: changedFiles
      };
    } catch (error) {
      console.warn('Could not get git information:', error.message);
      this.structure.gitChanges = {
        recentCommits: [],
        lastCommitFiles: []
      };
    }
  }

  async updateProjectStatus() {
    console.log('📄 Updating PROJECT_STATUS.md...');
    
    const statusPath = path.join(this.outputDir, 'PROJECT_STATUS.md');
    let content = '';
    
    // Try to read existing content
    try {
      const sourceStatus = path.join(this.rootDir, 'PROJECT_STATUS.md');
      content = await fs.readFile(sourceStatus, 'utf8');
    } catch (error) {
      // If no existing file, use template
      content = `# PROJECT STATUS - Camera Manual Vault

## Last Updated: ${new Date().toLocaleString()}

## 🎯 Current Task:
- 

## ✅ Completed Today:
- 

## 🔄 In Progress:
- 

## ❌ Still Need:
- 

## 🐛 Active Issues:
- 

## 📁 Files Changed:
- 

## 💡 Next Session:
Start with: 

## 🚀 New Ideas to Explore:
- 

## 📝 Important Notes:
- 
`;
    }
    
    // Update the auto-generated sections
    const sections = content.split(/\n(?=##)/);
    const updatedSections = sections.map(section => {
      // Update Last Updated
      if (section.includes('## Last Updated:')) {
        return `## Last Updated: ${new Date().toLocaleString('en-US', { 
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        })} PST`;
      }
      
      // Update Architecture Status (add if not exists)
      if (section.includes('## 🏗️ Architecture Status:') || section.includes('## Architecture Status:')) {
        return `## 🏗️ Architecture Status:
- Total Files: ${this.structure.metrics.totalFiles}
- Total Directories: ${this.structure.metrics.totalDirectories}
- Total Lines of Code: ${this.structure.metrics.totalLines.toLocaleString()}
- Main File Types: ${Object.entries(this.structure.metrics.filesByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([ext, count]) => `${ext || 'no ext'} (${count})`)
  .join(', ')}
- API Routes: ${this.structure.apiRoutes.length}
- Database Tables: ${Object.keys(this.structure.databaseSchema).length}
- CSS Classes: ${this.structure.cssAnalysis.mainCSS?.classes.length || 0}
- Structure System: IMPLEMENTED ✅`;
      }
      
      // Update Files Changed with git info
      if (section.includes('## 📁 Files Changed:') && this.structure.gitChanges.lastCommitFiles.length > 0) {
        return `## 📁 Files Changed:
${this.structure.gitChanges.lastCommitFiles.map(f => `- ${f}`).join('\n')}`;
      }
      
      return section;
    });
    
    // If Architecture Status doesn't exist, add it
    if (!content.includes('Architecture Status')) {
      updatedSections.push(`## 🏗️ Architecture Status:
- Total Files: ${this.structure.metrics.totalFiles}
- Total Directories: ${this.structure.metrics.totalDirectories}
- Total Lines of Code: ${this.structure.metrics.totalLines.toLocaleString()}
- Main File Types: ${Object.entries(this.structure.metrics.filesByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([ext, count]) => `${ext || 'no ext'} (${count})`)
  .join(', ')}
- API Routes: ${this.structure.apiRoutes.length}
- Database Tables: ${Object.keys(this.structure.databaseSchema).length}
- CSS Classes: ${this.structure.cssAnalysis.mainCSS?.classes.length || 0}
- Structure System: IMPLEMENTED ✅`);
    }
    
    // Write updated content
    await fs.writeFile(statusPath, updatedSections.join('\n\n'));
  }

  async generateOutputFiles() {
    console.log('📁 Generating output files...');
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // 1. Generate STRUCTURE.json
    await fs.writeFile(
      path.join(this.outputDir, 'STRUCTURE.json'),
      JSON.stringify(this.structure, null, 2)
    );
    
    // 2. Generate FILE_MAP.md
    await this.generateFileMap();
    
    // 3. Generate CSS_GUIDE.md
    await this.generateCSSGuide();
    
    // 4. Generate API_ROUTES.md
    await this.generateAPIRoutes();
    
    // 5. Generate QUICK_REFERENCE.md
    await this.generateQuickReference();
  }

  async generateFileMap() {
    let content = `# FILE MAP - Camera Manual Vault
Generated: ${new Date().toLocaleString()}

## Directory Structure

\`\`\`
${this.generateTreeView()}
\`\`\`

## File Details

`;

    // Group files by directory
    const filesByDir = {};
    Object.entries(this.structure.files).forEach(([path, file]) => {
      const dir = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : 'root';
      if (!filesByDir[dir]) filesByDir[dir] = [];
      filesByDir[dir].push(file);
    });

    // Generate details for each directory
    Object.entries(filesByDir).sort().forEach(([dir, files]) => {
      content += `### ${dir === 'root' ? '/' : '/' + dir}\n\n`;
      
      files.sort((a, b) => a.name.localeCompare(b.name)).forEach(file => {
        content += `#### ${file.name}\n`;
        content += `- Size: ${this.formatFileSize(file.size)}\n`;
        content += `- Lines: ${file.lines}\n`;
        content += `- Modified: ${new Date(file.modified).toLocaleDateString()}\n`;
        
        if (file.functions && file.functions.length > 0) {
          content += `- Functions: ${file.functions.slice(0, 5).join(', ')}${file.functions.length > 5 ? '...' : ''}\n`;
        }
        
        if (file.pageInfo && file.pageInfo.title) {
          content += `- Page Title: ${file.pageInfo.title}\n`;
        }
        
        content += '\n';
      });
    });

    await fs.writeFile(path.join(this.outputDir, 'FILE_MAP.md'), content);
  }

  generateTreeView() {
    const tree = {};
    
    // Build tree structure
    Object.keys(this.structure.files).forEach(filePath => {
      const parts = filePath.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          current[part] = null;
        } else {
          // It's a directory
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    
    // Generate text representation
    return this.renderTree(tree);
  }

  renderTree(node, prefix = '', isLast = true) {
    let result = '';
    const entries = Object.entries(node);
    
    entries.forEach(([name, children], index) => {
      const isLastEntry = index === entries.length - 1;
      result += prefix + (isLastEntry ? '└── ' : '├── ') + name + '\n';
      
      if (children !== null) {
        // It's a directory
        result += this.renderTree(
          children,
          prefix + (isLastEntry ? '    ' : '│   '),
          isLastEntry
        );
      }
    });
    
    return result;
  }

  async generateCSSGuide() {
    const mainCSS = this.structure.cssAnalysis.mainCSS || {};
    
    let content = `# CSS GUIDE - Camera Manual Vault
Generated: ${new Date().toLocaleString()}

## Main CSS File Analysis

### Statistics
- Total Variables: ${mainCSS.variables?.length || 0}
- Total Classes: ${mainCSS.classes?.length || 0}
- Total IDs: ${mainCSS.ids?.length || 0}

### CSS Variables
${mainCSS.variables?.slice(0, 20).map(v => `- --${v.name}: ${v.value}`).join('\n') || 'No variables found'}

### Section Map
${Object.entries(mainCSS.sections || {}).map(([name, section]) => 
  `- **${name}**: Lines ${section.startLine}-${section.endLine || '?'}`
).join('\n') || 'No sections found'}

### Common Classes
${mainCSS.classes?.slice(0, 30).map(c => `- .${c}`).join('\n') || 'No classes found'}

## Quick Style Reference

### Colors
- Primary: var(--primary-color)
- Secondary: var(--secondary-color)
- Dark Background: var(--dark-bg)
- Text Primary: var(--text-primary)

### Spacing
- Small: var(--spacing-sm)
- Medium: var(--spacing-md)
- Large: var(--spacing-lg)

### Components
- Cards: .card, .card-bg
- Buttons: .btn, .btn-primary, .btn-secondary
- Forms: .form-input, .form-group
`;

    await fs.writeFile(path.join(this.outputDir, 'CSS_GUIDE.md'), content);
  }

  async generateAPIRoutes() {
    let content = `# API ROUTES - Camera Manual Vault
Generated: ${new Date().toLocaleString()}

## Available Endpoints

`;

    // Group routes by method
    const routesByMethod = {};
    this.structure.apiRoutes.forEach(route => {
      if (!routesByMethod[route.method]) routesByMethod[route.method] = [];
      routesByMethod[route.method].push(route);
    });

    // Generate documentation
    Object.entries(routesByMethod).forEach(([method, routes]) => {
      content += `### ${method} Requests\n\n`;
      
      routes.forEach(route => {
        content += `#### \`${method} ${route.path}\`\n`;
        content += `- File: ${route.file}\n`;
        
        // Add common descriptions based on path
        if (route.path.includes('/api/cameras')) {
          content += `- Description: Camera-related endpoint\n`;
        } else if (route.path.includes('/api/image')) {
          content += `- Description: Image processing endpoint\n`;
        }
        
        content += '\n';
      });
    });

    // Add database schema
    content += `## Database Schema\n\n`;
    
    Object.entries(this.structure.databaseSchema).forEach(([tableName, table]) => {
      content += `### Table: ${tableName}\n\n`;
      content += '| Column | Type | Constraints |\n';
      content += '|--------|------|-------------|\n';
      
      table.columns.forEach(col => {
        content += `| ${col.name} | ${col.type} | ${col.constraints} |\n`;
      });
      
      content += '\n';
    });

    await fs.writeFile(path.join(this.outputDir, 'API_ROUTES.md'), content);
  }

  async generateQuickReference() {
    let content = `# QUICK REFERENCE - Camera Manual Vault
Generated: ${new Date().toLocaleString()}

## Project Overview
- **Total Files**: ${this.structure.metrics.totalFiles}
- **Total Lines**: ${this.structure.metrics.totalLines.toLocaleString()}
- **Primary Language**: JavaScript
- **Framework**: Express.js + SQLite

## Key Files & Locations

### Frontend Pages
${Object.entries(this.structure.files)
  .filter(([path]) => path.endsWith('.html') && path.startsWith('public/'))
  .map(([path, file]) => `- **${file.name}**: /${path}`)
  .join('\n')}

### Core Scripts
- **Server**: /server.js
- **Scrapers**: /continuous-scraper.js, /ultimate-scraper.js
- **Package Config**: /package.json

### Styling
- **Main CSS**: /public/css/main.css (${this.structure.files['public/css/main.css']?.lines || 0} lines)
- **CSS Variables**: ${this.structure.cssAnalysis.mainCSS?.variables?.length || 0} defined

### API Endpoints Summary
${this.structure.apiRoutes.map(r => `- ${r.method} ${r.path}`).join('\n')}

## Recent Changes
${this.structure.gitChanges.recentCommits?.slice(0, 5).map(c => `- ${c.hash} ${c.message}`).join('\n') || 'No recent commits'}

## Quick Commands
\`\`\`bash
# Start server
npm start

# Run scraper
node continuous-scraper.js

# Generate structure
node scripts/generate-structure.js ../cmv-structure
\`\`\`

## File Type Distribution
${Object.entries(this.structure.metrics.filesByType)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([ext, count]) => `- ${ext || 'no extension'}: ${count} files`)
  .join('\n')}

## Largest Files
${this.structure.metrics.largestFiles.slice(0, 10).map(f => 
  `- ${f.path}: ${this.formatFileSize(f.size)}`
).join('\n')}
`;

    await fs.writeFile(path.join(this.outputDir, 'QUICK_REFERENCE.md'), content);
  }

  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

// Main execution
async function main() {
  const outputDir = process.argv[2] || './structure-output';
  
  console.log('🚀 Camera Manual Vault - Structure Generator');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('================================\n');
  
  const generator = new StructureGenerator(outputDir);
  await generator.generate();
  
  console.log('\n================================');
  console.log('✨ All files generated successfully!');
  console.log(`📂 Check the ${outputDir} directory for results`);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = StructureGenerator;
