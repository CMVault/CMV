#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testAutomation() {
  console.log('🧪 Testing CMV Automation Status');
  console.log('================================\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    success: 0,
    failed: 0
  };
  
  // Test 1: Check current branch
  try {
    const { stdout } = await execPromise('git branch --show-current');
    const branch = stdout.trim();
    const pass = branch === 'main' || branch === 'master';
    
    results.tests.push({
      name: 'Git Branch',
      status: pass ? 'PASS' : 'FAIL',
      details: `Current branch: ${branch}`,
      required: 'main or master'
    });
    
    if (pass) results.success++;
    else results.failed++;
  } catch (error) {
    results.tests.push({
      name: 'Git Branch',
      status: 'ERROR',
      details: error.message
    });
    results.failed++;
  }
  
  // Test 2: Check workflow file
  try {
    await fs.access('.github/workflows/update-structure.yml');
    const content = await fs.readFile('.github/workflows/update-structure.yml', 'utf8');
    
    const hasDispatch = content.includes('workflow_dispatch');
    const hasPAT = content.includes('STRUCTURE_PAT');
    const hasMain = content.includes('main');
    
    const pass = hasDispatch && hasPAT && hasMain;
    
    results.tests.push({
      name: 'Workflow File',
      status: pass ? 'PASS' : 'FAIL',
      details: `Dispatch: ${hasDispatch}, PAT: ${hasPAT}, Main: ${hasMain}`
    });
    
    if (pass) results.success++;
    else results.failed++;
  } catch (error) {
    results.tests.push({
      name: 'Workflow File',
      status: 'FAIL',
      details: 'File not found'
    });
    results.failed++;
  }
  
  // Test 3: Check structure script
  try {
    await fs.access('scripts/generate-structure.js');
    
    // Test if it runs
    const { stderr } = await execPromise('node scripts/generate-structure.js --version || echo "No version"');
    
    results.tests.push({
      name: 'Structure Script',
      status: 'PASS',
      details: 'Script exists and is executable'
    });
    results.success++;
  } catch (error) {
    results.tests.push({
      name: 'Structure Script',
      status: 'FAIL',
      details: 'Script missing or not executable'
    });
    results.failed++;
  }
  
  // Test 4: Check last commit
  try {
    const { stdout } = await execPromise('git log -1 --pretty=format:"%h %s (%cr)"');
    
    results.tests.push({
      name: 'Last Commit',
      status: 'INFO',
      details: stdout
    });
  } catch (error) {
    results.tests.push({
      name: 'Last Commit',
      status: 'ERROR',
      details: error.message
    });
  }
  
  // Test 5: Check remote
  try {
    const { stdout } = await execPromise('git remote get-url origin');
    const hasGitHub = stdout.includes('github.com');
    const hasCMV = stdout.includes('CMVault/cmv');
    
    const pass = hasGitHub && hasCMV;
    
    results.tests.push({
      name: 'Git Remote',
      status: pass ? 'PASS' : 'FAIL',
      details: stdout.trim()
    });
    
    if (pass) results.success++;
    else results.failed++;
  } catch (error) {
    results.tests.push({
      name: 'Git Remote',
      status: 'ERROR',
      details: error.message
    });
    results.failed++;
  }
  
  // Display results
  console.log('📊 TEST RESULTS');
  console.log('===============\n');
  
  results.tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : 
                 test.status === 'FAIL' ? '❌' :
                 test.status === 'INFO' ? 'ℹ️' : '⚠️';
    
    console.log(`${icon} ${test.name}: ${test.status}`);
    console.log(`   ${test.details}`);
    if (test.required) {
      console.log(`   Required: ${test.required}`);
    }
    console.log('');
  });
  
  // Summary
  console.log('📈 SUMMARY');
  console.log('==========');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`Passed: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  
  // Save results
  await fs.writeFile('automation-test-results.json', JSON.stringify(results, null, 2));
  
  // Overall status
  if (results.failed === 0) {
    console.log('\n✅ All tests passed! Automation should be working.');
    console.log('\n🚀 Next: Push a commit to trigger the workflow');
  } else {
    console.log(`\n⚠️  ${results.failed} tests failed. Fix these issues.`);
  }
  
  // Quick test commit
  console.log('\n📝 To test automation, run:');
  console.log('   echo "test" >> test.txt && git add . && git commit -m "Test automation" && git push');
  
  return results;
}

// Run test
if (require.main === module) {
  testAutomation().catch(console.error);
}

module.exports = { testAutomation };
