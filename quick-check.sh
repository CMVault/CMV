#!/bin/bash

# Quick CMV Automation Checker
# Run with: bash quick-check.sh

echo "🔍 CMV Quick Automation Check"
echo "============================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check current branch
echo "📋 Checking current branch..."
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" ]] || [[ "$BRANCH" == "master" ]]; then
    echo -e "${GREEN}✅ On correct branch: $BRANCH${NC}"
else
    echo -e "${YELLOW}⚠️  Wrong branch: $BRANCH (workflow needs main/master)${NC}"
    echo "   Fix: git checkout main || git checkout master"
fi
echo ""

# Check for uncommitted changes
echo "📋 Checking git status..."
if [[ -z $(git status --porcelain) ]]; then
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
else
    echo -e "${YELLOW}⚠️  Uncommitted changes found${NC}"
    echo "   Fix: git add . && git commit -m 'Update before automation fix'"
fi
echo ""

# Check workflow file
echo "📋 Checking workflow file..."
if [ -f ".github/workflows/update-structure.yml" ]; then
    echo -e "${GREEN}✅ Workflow file exists${NC}"
    
    # Check for PAT reference
    if grep -q "STRUCTURE_PAT" .github/workflows/update-structure.yml; then
        echo -e "${GREEN}✅ STRUCTURE_PAT referenced in workflow${NC}"
    else
        echo -e "${RED}❌ STRUCTURE_PAT not found in workflow${NC}"
    fi
else
    echo -e "${RED}❌ Workflow file missing${NC}"
fi
echo ""

# Check repository info
echo "📋 Checking repository info..."
REMOTE=$(git remote get-url origin 2>/dev/null)
if [[ $REMOTE == *"github.com"* ]]; then
    echo -e "${GREEN}✅ GitHub remote found${NC}"
    echo "   Repository: $REMOTE"
    
    # Extract owner and repo
    if [[ $REMOTE =~ github\.com[:/]([^/]+)/(.+?)(\.git)?$ ]]; then
        OWNER="${BASH_REMATCH[1]}"
        REPO="${BASH_REMATCH[2]}"
        REPO="${REPO%.git}"  # Remove .git if present
        echo "   Owner: $OWNER"
        echo "   Repo: $REPO"
    fi
else
    echo -e "${RED}❌ No GitHub remote found${NC}"
fi
echo ""

# Check structure generation script
echo "📋 Checking structure generation script..."
if [ -f "scripts/generate-structure.js" ]; then
    echo -e "${GREEN}✅ generate-structure.js exists${NC}"
else
    echo -e "${RED}❌ generate-structure.js missing${NC}"
fi
echo ""

# Check last commit
echo "📋 Checking last commit..."
LAST_COMMIT=$(git log -1 --pretty=format:"%h - %s (%cr)")
echo "   Last commit: $LAST_COMMIT"
echo ""

# Quick Actions
echo "🚀 QUICK ACTIONS"
echo "================"
echo ""
echo "1. View workflow runs:"
echo "   ${YELLOW}https://github.com/$OWNER/$REPO/actions${NC}"
echo ""
echo "2. Check repository secrets:"
echo "   ${YELLOW}https://github.com/$OWNER/$REPO/settings/secrets/actions${NC}"
echo ""
echo "3. Manually trigger workflow:"
echo "   - Go to Actions tab"
echo "   - Click 'Update Project Structure'"
echo "   - Click 'Run workflow'"
echo ""
echo "4. Create PAT token:"
echo "   ${YELLOW}https://github.com/settings/tokens/new${NC}"
echo "   - Name: STRUCTURE_PAT"
echo "   - Scopes: repo (all), workflow"
echo ""

# Test structure generation locally
echo "📋 Testing structure generation..."
if [ -f "scripts/generate-structure.js" ]; then
    echo "   Running test..."
    mkdir -p temp-test
    if timeout 10s node scripts/generate-structure.js temp-test > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Structure generation works locally${NC}"
        rm -rf temp-test
    else
        echo -e "${RED}❌ Structure generation failed${NC}"
        echo "   Check: node scripts/generate-structure.js"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot test - script missing${NC}"
fi
echo ""

# Summary
echo "📊 SUMMARY"
echo "=========="
ISSUES=0

if [[ "$BRANCH" != "main" ]] && [[ "$BRANCH" != "master" ]]; then
    echo -e "${RED}❌ Wrong branch${NC}"
    ((ISSUES++))
fi

if [[ -n $(git status --porcelain) ]]; then
    echo -e "${YELLOW}⚠️  Uncommitted changes${NC}"
    ((ISSUES++))
fi

if [ ! -f ".github/workflows/update-structure.yml" ]; then
    echo -e "${RED}❌ Missing workflow file${NC}"
    ((ISSUES++))
fi

if [ ! -f "scripts/generate-structure.js" ]; then
    echo -e "${RED}❌ Missing structure script${NC}"
    ((ISSUES++))
fi

if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Push to trigger workflow.${NC}"
else
    echo -e "${YELLOW}⚠️  $ISSUES issues found. Fix them and run again.${NC}"
fi
echo ""

# Create fix script
echo "📝 Creating fix script..."
cat > fix-automation.sh << 'EOF'
#!/bin/bash
echo "🔧 Fixing CMV Automation..."

# 1. Switch to main branch
echo "Switching to main branch..."
git checkout main || git checkout master || git checkout -b main

# 2. Commit any changes
if [[ -n $(git status --porcelain) ]]; then
    echo "Committing changes..."
    git add .
    git commit -m "🔧 Fix automation setup"
fi

# 3. Create workflow if missing
if [ ! -f ".github/workflows/update-structure.yml" ]; then
    echo "Creating workflow file..."
    mkdir -p .github/workflows
    cat > .github/workflows/update-structure.yml << 'WORKFLOW'
name: Update Project Structure

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  update-structure:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout CMV repo
      uses: actions/checkout@v4
      with:
        path: cmv
    
    - name: Checkout structure repo
      uses: actions/checkout@v4
      with:
        repository: CMVault/cmv-structure
        token: ${{ secrets.STRUCTURE_PAT }}
        path: cmv-structure
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Generate structure files
      run: |
        cd cmv
        node scripts/generate-structure.js ../cmv-structure
    
    - name: Commit and push
      run: |
        cd cmv-structure
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add -A
        if git diff --staged --quiet; then
          echo "No changes"
        else
          git commit -m "🤖 Update structure - $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
          git push
        fi
WORKFLOW
fi

# 4. Push to trigger
echo "Pushing to GitHub..."
git push origin main || git push origin master

echo "✅ Done! Check https://github.com/CMVault/cmv/actions"
EOF

chmod +x fix-automation.sh
echo -e "${GREEN}✅ Created fix-automation.sh - Run it to auto-fix issues${NC}"
