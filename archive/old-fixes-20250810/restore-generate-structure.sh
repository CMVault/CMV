#!/bin/bash

echo "🔍 Finding and restoring generate-structure.js from Git history..."
echo ""

# First, let's check Git status
echo "📊 Current Git status:"
git status --short
echo ""

# Find when the file was deleted
echo "📜 Looking for generate-structure.js in Git history..."

# Check if the file ever existed in the repo
if git log --all --full-history -- "scripts/generate-structure.js" | grep -q "commit"; then
    echo "✅ Found file in Git history!"
    
    # Get the last commit that had the file
    LAST_COMMIT=$(git rev-list -n 1 HEAD -- scripts/generate-structure.js)
    
    if [ -n "$LAST_COMMIT" ]; then
        echo "📍 Last commit with file: $LAST_COMMIT"
        
        # Show commit info
        echo ""
        echo "📋 Commit details:"
        git log -1 --pretty=format:"%h - %an, %ar : %s" $LAST_COMMIT
        echo ""
        echo ""
        
        # Create scripts directory if it doesn't exist
        mkdir -p scripts
        
        # Restore the file
        echo "🔄 Restoring scripts/generate-structure.js..."
        git checkout $LAST_COMMIT -- scripts/generate-structure.js
        
        if [ -f "scripts/generate-structure.js" ]; then
            echo "✅ File restored successfully!"
            echo ""
            echo "📄 First 30 lines of restored file:"
            echo "================================"
            head -30 scripts/generate-structure.js
            echo "================================"
            echo ""
            
            # Make it executable
            chmod +x scripts/generate-structure.js
            
            # Stage the file
            git add scripts/generate-structure.js
            echo "✅ File staged for commit"
            
            echo ""
            echo "✨ Success! Next steps:"
            echo "1. Review the file: cat scripts/generate-structure.js"
            echo "2. Commit: git commit -m 'Restore generate-structure.js for GitHub Actions workflow'"
            echo "3. Push: git push"
        else
            echo "❌ Failed to restore file"
        fi
    else
        echo "❌ Could not find commit with this file"
    fi
else
    echo "❌ File 'scripts/generate-structure.js' not found in Git history"
    echo ""
    echo "🔍 Searching for similar files..."
    git log --all --full-history --name-only | grep -i "generate.*structure" | sort | uniq
fi

echo ""
echo "📁 Current directory structure:"
ls -la scripts/ 2>/dev/null || echo "scripts/ directory does not exist"
