#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const axios = require('axios');

class AutomationChecker {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.status = {
      workflow: false,
      secrets: false,
      branch: false,
      permissions: false,
      lastRun: null,
      errors: []
    };
  }

  async run() {
    console.log('🔍 CMV Automation Auto-Checker v1.0');
    console.log('=====================================\n');

    try {
      // 1. Check Git configuration
      await this.checkGitConfig();
      
      // 2. Check current branch
      await this.checkCurrentBranch();
      
      // 3. Check workflow file exists
      await this.checkWorkflowFile();
      
      // 4. Check GitHub connectivity
      await this.checkGitHubConnection();
      
      // 5. Check workflow runs via API
      await this.checkWorkflowRuns();
      
      // 6. Check repository secrets (indirect)
      await this.checkSecrets();
      
      // 7. Test structure generation locally
      await this.testStructureGeneration();
      
      // 8. Check file permissions
      await this.checkFilePermissions();
      
      // 9. Generate diagnostic report
      await this.generateReport();
      
      // 10. Apply automatic fixes
      await this.applyFixes();
      
    } catch (error) {
      console.error('❌ Fatal error during check:', error.message);
    }
  }

  async checkGitConfig() {
    console.log('📋 Checking Git configuration...');
    
    try {
      const { stdout: remote } = await execPromise('git remote -v');
      const { stdout: branch } = await execPromise('git branch --show-current');
      const { stdout: status } = await execPromise('git status --porcelain');
      
      console.log('✅ Git repository found');
      console.log(`   Branch: ${branch.trim()}`);
      console.log(`   Uncommitted changes: ${status ? 'Yes' : 'No'}`);
      
      this.status.branch = branch.trim();
      
      if (status) {
        this.issues.push('Uncommitted changes detected');
        this.fixes.push({
          issue: 'Uncommitted changes',
          command: 'git add . && git commit -m "Auto-commit before automation fix"'
        });
      }
      
    } catch (error) {
      this.issues.push('Git repository not initialized or corrupt');
      console.error('❌ Git check failed:', error.message);
    }
  }

  async checkCurrentBranch() {
    console.log('\n📋 Checking branch configuration...');
    
    try {
      const { stdout } = await execPromise('git branch --show-current');
      const currentBranch = stdout.trim();
      
      if (currentBranch !== 'main' && currentBranch !== 'master') {
        console.log(`⚠️  Current branch '${currentBranch}' won't trigger workflow`);
        this.issues.push(`Wrong branch: ${currentBranch}`);
        this.fixes.push({
          issue: 'Wrong branch',
          command: `git checkout main || git checkout master || git checkout -b main`
        });
      } else {
        console.log('✅ On correct branch:', currentBranch);
      }
      
    } catch (error) {
      console.error('❌ Branch check failed:', error.message);
    }
  }

  async checkWorkflowFile() {
    console.log('\n📋 Checking workflow file...');
    
    const workflowPath = '.github/workflows/update-structure.yml';
    
    try {
      await fs.access(workflowPath);
      console.log('✅ Workflow file exists');
      
      // Check workflow content
      const content = await fs.readFile(workflowPath, 'utf8');
      
      // Check for common issues
      if (!content.includes('STRUCTURE_PAT')) {
        this.issues.push('Workflow missing STRUCTURE_PAT reference');
      }
      
      if (!content.includes('workflow_dispatch')) {
        this.issues.push('Workflow cannot be manually triggered');
        this.fixes.push({
          issue: 'No manual trigger',
          action: 'Add workflow_dispatch to triggers'
        });
      }
      
      this.status.workflow = true;
      
    } catch (error) {
      console.error('❌ Workflow file not found');
      this.issues.push('Missing workflow file');
      this.fixes.push({
        issue: 'Missing workflow',
        action: 'Create workflow file',
        file: workflowPath
      });
    }
  }

  async checkGitHubConnection() {
    console.log('\n📋 Checking GitHub connection...');
    
    try {
      // Get repository info
      const { stdout } = await execPromise('git remote get-url origin');
      const repoUrl = stdout.trim();
      
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com[/:]([^/]+)\/(.+?)(\.git)?$/);
      if (match) {
        this.owner = match[1];
        this.repo = match[2];
        console.log(`✅ Repository: ${this.owner}/${this.repo}`);
      }
      
      // Test GitHub API access
      const response = await axios.get(`https://api.github.com/repos/${this.owner}/${this.repo}`, {
        headers: { 'User-Agent': 'CMV-AutoChecker' },
        timeout: 5000
      });
      
      if (response.status === 200) {
        console.log('✅ GitHub API accessible');
      }
      
    } catch (error) {
      console.error('❌ GitHub connection failed:', error.message);
      this.issues.push('Cannot connect to GitHub');
    }
  }

  async checkWorkflowRuns() {
    console.log('\n📋 Checking workflow runs...');
    
    if (!this.owner || !this.repo) {
      console.log('⚠️  Skipping - no repository info');
      return;
    }
    
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs`,
        {
          headers: { 'User-Agent': 'CMV-AutoChecker' },
          params: { per_page: 10 }
        }
      );
      
      const runs = response.data.workflow_runs;
      const structureRuns = runs.filter(run => 
        run.name === 'Update Project Structure'
      );
      
      if (structureRuns.length > 0) {
        const latestRun = structureRuns[0];
        console.log(`✅ Found ${structureRuns.length} workflow runs`);
        console.log(`   Latest: ${latestRun.status} (${latestRun.conclusion || 'running'})`);
        console.log(`   Date: ${new Date(latestRun.created_at).toLocaleString()}`);
        
        this.status.lastRun = latestRun;
        
        if (latestRun.conclusion === 'failure') {
          this.issues.push('Latest workflow run failed');
          console.log(`   View logs: ${latestRun.html_url}`);
        }
      } else {
        console.log('⚠️  No workflow runs found');
        this.issues.push('Workflow has never run');
      }
      
    } catch (error) {
      console.error('❌ Cannot check workflow runs:', error.message);
    }
  }

  async checkSecrets() {
    console.log('\n📋 Checking for secrets (indirect)...');
    
    // We can't directly check secrets, but we can check for indicators
    try {
      // Check if .env exists
      await fs.access('.env');
      console.log('✅ .env file exists');
      
      // Check for PAT in environment
      if (process.env.STRUCTURE_PAT) {
        console.log('✅ STRUCTURE_PAT found in environment');
      } else {
        console.log('⚠️  STRUCTURE_PAT not in environment');
        this.issues.push('STRUCTURE_PAT not set locally');
      }
      
    } catch (error) {
      console.log('ℹ️  No .env file (okay for GitHub Actions)');
    }
    
    console.log('\n📌 To check repository secrets:');
    console.log(`   Visit: https://github.com/${this.owner}/${this.repo}/settings/secrets/actions`);
    console.log('   Ensure STRUCTURE_PAT exists with repo and workflow scopes');
  }

  async testStructureGeneration() {
    console.log('\n📋 Testing structure generation locally...');
    
    const scriptPath = 'scripts/generate-structure.js';
    
    try {
      await fs.access(scriptPath);
      console.log('✅ Structure generation script exists');
      
      // Test run with temp directory
      const tempDir = path.join(__dirname, 'temp-structure-test');
      await fs.mkdir(tempDir, { recursive: true });
      
      try {
        const { stdout, stderr } = await execPromise(
          `node ${scriptPath} ${tempDir}`,
          { timeout: 30000 }
        );
        
        console.log('✅ Structure generation works locally');
        
        // Check output files
        const files = await fs.readdir(tempDir);
        console.log(`   Generated ${files.length} files`);
        
        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });
        
      } catch (error) {
        console.error('❌ Structure generation failed:', error.message);
        this.issues.push('Structure generation script has errors');
      }
      
    } catch (error) {
      console.error('❌ Structure script not found');
      this.issues.push('Missing generate-structure.js');
    }
  }

  async checkFilePermissions() {
    console.log('\n📋 Checking file permissions...');
    
    const filesToCheck = [
      '.github/workflows/update-structure.yml',
      'scripts/generate-structure.js',
      'package.json'
    ];
    
    for (const file of filesToCheck) {
      try {
        await fs.access(file, fs.constants.R_OK | fs.constants.W_OK);
        console.log(`✅ ${file} - Read/Write OK`);
      } catch (error) {
        console.log(`❌ ${file} - Permission issue`);
        this.issues.push(`Permission issue: ${file}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📊 DIAGNOSTIC REPORT');
    console.log('===================');
    
    const report = {
      timestamp: new Date().toISOString(),
      repository: `${this.owner}/${this.repo}`,
      branch: this.status.branch,
      issues: this.issues,
      fixes: this.fixes,
      recommendations: []
    };
    
    // Generate recommendations
    if (this.issues.includes('STRUCTURE_PAT not set locally')) {
      report.recommendations.push({
        priority: 'HIGH',
        action: 'Create Personal Access Token',
        steps: [
          '1. Go to GitHub → Settings → Developer settings → Personal access tokens',
          '2. Generate new token (classic)',
          '3. Name: STRUCTURE_PAT',
          '4. Scopes: repo (all), workflow',
          '5. Copy token',
          `6. Add to repository secrets at https://github.com/${this.owner}/${this.repo}/settings/secrets/actions`
        ]
      });
    }
    
    if (this.issues.includes('Workflow has never run')) {
      report.recommendations.push({
        priority: 'MEDIUM',
        action: 'Trigger workflow manually',
        steps: [
          `1. Visit https://github.com/${this.owner}/${this.repo}/actions`,
          '2. Click "Update Project Structure"',
          '3. Click "Run workflow"',
          '4. Select branch and run'
        ]
      });
    }
    
    // Save report
    await fs.writeFile(
      'automation-diagnostic-report.json',
      JSON.stringify(report, null, 2)
    );
    
    // Display summary
    console.log(`\n🔍 Issues found: ${this.issues.length}`);
    if (this.issues.length > 0) {
      this.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }
    
    console.log(`\n🔧 Automatic fixes available: ${this.fixes.length}`);
    console.log('\n📄 Full report saved to: automation-diagnostic-report.json');
  }

  async applyFixes() {
    if (this.fixes.length === 0) {
      console.log('\n✅ No automatic fixes needed!');
      return;
    }
    
    console.log('\n🔧 APPLYING AUTOMATIC FIXES');
    console.log('===========================');
    
    for (const fix of this.fixes) {
      console.log(`\n🔧 Fixing: ${fix.issue}`);
      
      if (fix.command) {
        console.log(`   Running: ${fix.command}`);
        try {
          const { stdout, stderr } = await execPromise(fix.command);
          console.log('   ✅ Fixed!');
          if (stdout) console.log(`   Output: ${stdout.trim()}`);
        } catch (error) {
          console.error('   ❌ Fix failed:', error.message);
        }
      }
      
      if (fix.file && fix.action === 'Create workflow file') {
        await this.createWorkflowFile();
      }
    }
  }

  async createWorkflowFile() {
    console.log('\n📝 Creating missing workflow file...');
    
    const workflowContent = `name: Update Project Structure

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

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
        token: \${{ secrets.STRUCTURE_PAT }}
        path: cmv-structure
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Generate structure files
      run: |
        cd cmv
        echo "Running structure generation..."
        node scripts/generate-structure.js ../cmv-structure
        echo "Structure generation complete"
    
    - name: Commit and push structure updates
      run: |
        cd cmv-structure
        
        git config --global user.name "github-actions[bot]"
        git config --global user.email "github-actions[bot]@users.noreply.github.com"
        
        git add -A
        
        if git diff --staged --quiet; then
          echo "No changes to commit"
        else
          echo "Committing changes..."
          git commit -m "🤖 Update project structure - $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
          git push
          echo "Push complete!"
        fi
`;

    const dir = '.github/workflows';
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'update-structure.yml'), workflowContent);
    console.log('✅ Workflow file created!');
  }
}

// Self-test function
async function selfTest() {
  console.log('\n🧪 Running self-test...');
  
  const tests = [
    {
      name: 'Git installed',
      test: async () => {
        const { stdout } = await execPromise('git --version');
        return stdout.includes('git version');
      }
    },
    {
      name: 'Node.js version',
      test: async () => {
        const { stdout } = await execPromise('node --version');
        const version = stdout.trim();
        console.log(`   Node.js ${version}`);
        return true;
      }
    },
    {
      name: 'Internet connection',
      test: async () => {
        const response = await axios.get('https://api.github.com', {
          timeout: 5000
        });
        return response.status === 200;
      }
    }
  ];
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      console.log(`❌ ${test.name} - ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.clear();
  
  // Run self-test first
  await selfTest();
  
  // Run automation checker
  const checker = new AutomationChecker();
  await checker.run();
  
  // Show next steps
  console.log('\n📋 NEXT STEPS');
  console.log('=============');
  console.log('1. Review automation-diagnostic-report.json');
  console.log('2. Create/update STRUCTURE_PAT if needed');
  console.log('3. Push changes to main/master branch');
  console.log('4. Monitor GitHub Actions for success');
  console.log('5. Run this script again to verify fixes');
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { AutomationChecker };
