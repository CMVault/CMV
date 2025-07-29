// auto-convert-to-ejs.js
// This script automatically converts your HTML files to EJS, preserving all content

const fs = require('fs').promises;
const path = require('path');

async function convertHTMLtoEJS() {
    console.log('🚀 Starting automatic HTML to EJS conversion...\n');
    
    // Create directories
    const dirs = ['views', 'views/layouts', 'views/partials', 'views/pages'];
    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
    
    // HTML files to convert
    const htmlFiles = [
        'index.html',
        'cameras.html',
        'camera-detail.html',
        'camera-finder.html',
        'productions.html',
        'camera-blog.html',
        'search.html',
        'login.html',
        'privacy.html',
        'terms.html',
        'dmca.html',
        'attribution.html',
        'legal.html'
    ];
    
    // Convert each file
    for (const file of htmlFiles) {
        await convertFile(file);
    }
    
    console.log('\n✅ Conversion complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Review the generated EJS files');
    console.log('2. Install dependencies: npm install ejs express-ejs-layouts');
    console.log('3. Update your server.js');
    console.log('4. Test each page');
}

async function convertFile(filename) {
    try {
        const htmlPath = path.join('public', filename);
        const html = await fs.readFile(htmlPath, 'utf8');
        
        // Extract title
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch 
            ? titleMatch[1].replace(' - Camera Manual Vault', '').trim()
            : 'Untitled Page';
        
        // Extract main content
        let mainContent = '';
        
        // Method 1: Look for content between </header> and <footer>
        const contentMatch = html.match(/<\/header>([\s\S]*?)<footer/i);
        if (contentMatch) {
            mainContent = contentMatch[1].trim();
        } else {
            // Method 2: Look for <main> tag
            const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            if (mainMatch) {
                mainContent = `<main class="page-content">\n${mainMatch[1]}\n</main>`;
            } else {
                // Method 3: Look for page-content div
                const pageMatch = html.match(/<div class="page-content"[^>]*>([\s\S]*?)<\/div>\s*<footer/i);
                if (pageMatch) {
                    mainContent = `<div class="page-content">\n${pageMatch[1]}\n</div>`;
                }
            }
        }
        
        // Clean up the content
        mainContent = mainContent
            .replace(/^\s+$/gm, '') // Remove empty lines
            .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
            .trim();
        
        // Extract any page-specific scripts
        const scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi);
        let pageScripts = '';
        if (scriptMatches) {
            // Filter out external scripts, keep inline ones
            const inlineScripts = scriptMatches.filter(script => 
                !script.includes('src=') && 
                !script.includes('main.js') // Exclude main.js if it exists
            );
            if (inlineScripts.length > 0) {
                pageScripts = '\n\n' + inlineScripts.join('\n');
            }
        }
        
        // Create EJS content
        const ejsContent = `<%
// Page configuration
locals.title = '${title}';
locals.pageStyles = [];
locals.pageScripts = [];
%>

${mainContent}${pageScripts}`;
        
        // Write EJS file
        const ejsPath = path.join('views/pages', filename.replace('.html', '.ejs'));
        await fs.writeFile(ejsPath, ejsContent);
        
        console.log(`✅ Converted: ${filename} → ${filename.replace('.html', '.ejs')}`);
        console.log(`   Title: "${title}"`);
        console.log(`   Content: ${mainContent.length} characters extracted`);
        
    } catch (error) {
        console.error(`❌ Error converting ${filename}:`, error.message);
    }
}

// Additional helper to create the layout and partial files
async function createLayoutFiles() {
    // Main layout
    const mainLayout = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= typeof title !== 'undefined' ? title + ' - ' : '' %>Camera Manual Vault</title>
    <link rel="stylesheet" href="/css/main.css">
    <% if (typeof pageStyles !== 'undefined' && pageStyles.length > 0) { %>
        <% pageStyles.forEach(style => { %>
            <link rel="stylesheet" href="<%= style %>">
        <% }); %>
    <% } %>
</head>
<body>
    <%- include('../partials/navigation') %>
    
    <%- body %>
    
    <%- include('../partials/footer') %>
    
    <% if (typeof pageScripts !== 'undefined' && pageScripts.length > 0) { %>
        <% pageScripts.forEach(script => { %>
            <script src="<%= script %>"></script>
        <% }); %>
    <% } %>
</body>
</html>`;

    // Navigation partial
    const navigation = `<header class="site-header">
    <div class="container">
        <div class="header-content">
            <div class="logo">
                <a href="/">
                    <span class="logo-icon">📷</span>
                    <span class="logo-text">Camera Manual Vault</span>
                </a>
            </div>
            <nav>
                <ul>
                    <% 
                    const navItems = [
                        { href: '/', text: 'Home' },
                        { href: '/cameras', text: 'Cameras' },
                        { href: '/camera-finder', text: 'Camera Finder' },
                        { href: '/productions', text: 'Productions' },
                        { href: '/camera-blog', text: 'Camera Blog' },
                        { href: '/login', text: 'Login' }
                    ];
                    %>
                    
                    <% navItems.forEach(item => { %>
                        <li><a href="<%= item.href %>" class="<%= currentPath === item.href ? 'active' : '' %>"><%= item.text %></a></li>
                    <% }); %>
                </ul>
            </nav>
        </div>
    </div>
</header>`;

    // Footer partial
    const footer = `<footer class="site-footer">
    <div class="container">
        <p>&copy; <%= new Date().getFullYear() %> Camera Manual Vault</p>
    </div>
</footer>`;

    // Write files
    await fs.writeFile('views/layouts/main.ejs', mainLayout);
    await fs.writeFile('views/partials/navigation.ejs', navigation);
    await fs.writeFile('views/partials/footer.ejs', footer);
    
    console.log('✅ Created layout and partial files');
}

// Run the conversion
async function main() {
    try {
        await createLayoutFiles();
        await convertHTMLtoEJS();
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = { convertHTMLtoEJS, createLayoutFiles };
