# 🤖 CLAUDE AUTOMATION SYSTEM - CAMERA MANUAL VAULT

## WHEN USER SAYS: "start cmv automation"

I will:

### 1. CHECK BOTH REPOSITORIES
- **Main Repository**: https://github.com/CMVault/cmv (66% capacity)
- **Structure Repository**: https://github.com/CMVault/cmv-structure (<1% capacity)
- List all files and folders I can see
- Check file contents when needed
- Identify what's missing or needs updates

### 2. USE STRUCTURE REPOSITORY FIRST
Since the main repo is at 66% capacity, I will:
- Check `cmv-structure` repo for latest project map
- Read STRUCTURE.json for complete file listing
- Use FILE_MAP.md to understand project layout
- Reference CSS_GUIDE.md for exact line numbers
- Check API_ROUTES.md for endpoint details

### 3. VERIFY PROJECT STATE
Check for these required files across both repos:
- ✅/❌ CLAUDE_AUTOMATION.md
- ✅/❌ PROJECT_STATUS.md (auto-updated!)
- ✅/❌ public/search.html
- ✅/❌ public/camera-detail.html
- ✅/❌ server.js (with camera route)
- ✅/❌ .github/workflows/scraper.yml
- ✅/❌ .github/workflows/update-structure.yml
- ✅/❌ public/images/placeholder.jpg
- ✅/❌ scripts/generate-structure.js

### 4. MAKE PRECISE CHANGES
With structure repository, I can:
- Know exact line numbers in CSS files
- Target specific functions in JavaScript
- Update only what's needed
- Avoid viewing entire large files

### 5. AUTO-PROVIDE FIXES
For any missing or incorrect files:

🔧 MISSING: [filename]
Click here to create: https://github.com/CMVault/cmv/new/main?filename=[path]

PASTE THIS CONTENT:
[I provide the complete file content]

### 6. TRACK EVERYTHING
- PROJECT_STATUS.md auto-updates on every push
- Structure repository syncs automatically
- All changes tracked in both repos
- Metrics update automatically

## HOW STRUCTURE INTEGRATION WORKS

1. **Every Push to Main Repo**:
   - GitHub Action triggers
   - generate-structure.js runs
   - Creates/updates structure repo
   - PROJECT_STATUS.md gets new timestamp & metrics
   - Changes committed automatically

2. **Structure Repository Contains**:
   - `STRUCTURE.json` - Complete file tree with metadata
   - `FILE_MAP.md` - Human-readable project map
   - `CSS_GUIDE.md` - CSS sections with line numbers
   - `API_ROUTES.md` - All endpoints documented
   - `QUICK_REFERENCE.md` - Key info at a glance
   - `PROJECT_STATUS.md` - Auto-updated status

3. **Benefits**:
   - View project without hitting capacity limits
   - Make surgical edits to specific lines
   - Track all changes automatically
   - Know exact structure without scanning

## ENHANCED COMMANDS

- **"start cmv automation"** - Check both repos and begin
- **"scan structure"** - Re-check structure repository
- **"check [filename]"** - Verify specific file using structure
- **"find css line [class]"** - Get exact line number from CSS_GUIDE
- **"list api routes"** - Show all endpoints from API_ROUTES
- **"show metrics"** - Display latest project metrics
- **"precise edit [file] [line]"** - Make targeted change
- **"structure status"** - Check if structure is up to date

## AUTOMATION FEATURES

- Detects new files automatically via structure
- Checks file content using line numbers
- Ensures dark theme on all pages
- Verifies API routes exist
- Tracks file modifications with timestamps
- Maintains project history
- **Auto-updates PROJECT_STATUS.md**
- **Syncs structure on every push**

## USING LINE NUMBERS

When CSS_GUIDE.md shows:
```
### Section Map
- **VARIABLES**: Lines 10-55
- **BUTTON STYLES**: Lines 120-180
```

I can say:
"Edit main.css lines 120-180 to update button styles"

## THIS REALLY WORKS

Claude can:
- Access both https://github.com/CMVault/cmv AND https://github.com/CMVault/cmv-structure
- Use structure repo to navigate without capacity issues
- Make precise edits using exact line numbers
- Track all changes automatically
- See real-time project metrics

## STRUCTURE FRESHNESS

The structure updates:
- ✅ On every push to main branch
- ✅ When GitHub Action runs
- ✅ PROJECT_STATUS.md timestamp shows last update
- ✅ Can manually trigger workflow

Say "start cmv automation" and watch the enhanced system work!
