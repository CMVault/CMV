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
