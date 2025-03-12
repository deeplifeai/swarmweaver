// Simple test script to verify our improvements

// 1. Test the issue number detection regex
function extractIssueNumbers(text) {
  const issueRegex = /\bissue\s*#?(\d+)\b|\b#(\d+)\b/gi;
  const matches = Array.from(text.matchAll(issueRegex));
  
  return matches
    .map(match => parseInt(match[1] || match[2], 10))
    .filter(num => !isNaN(num));
}

// Test cases
const testCases = [
  { input: 'Please implement #42 and #123', expected: [42, 123] },
  { input: 'Please implement issue 42 and issue #123', expected: [42, 123] },
  { input: 'Please implement issue 42, #123, and issue #456', expected: [42, 123, 456] },
  { input: 'Please implement this feature', expected: [] },
  { input: 'Please implement Issue 42 and ISSUE #123', expected: [42, 123] },
  { input: 'Add 42 items and set timeout to 123 seconds', expected: [] },
  { input: 'Let\'s work on issue #42.', expected: [42] },
  { input: 'Issues: #42, #123; also issue 456!', expected: [42, 123, 456] }
];

// Run tests
console.log('=== Testing Issue Number Detection ===');
let allPassed = true;

testCases.forEach((testCase, index) => {
  const result = extractIssueNumbers(testCase.input);
  const passed = JSON.stringify(result) === JSON.stringify(testCase.expected);
  
  console.log(`Test ${index + 1}: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Input: "${testCase.input}"`);
  console.log(`  Expected: [${testCase.expected}]`);
  console.log(`  Actual: [${result}]`);
  
  if (!passed) {
    allPassed = false;
  }
});

console.log('\nOverall Result:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');

// 2. Simulate the workflow behavior with issue detection
function enhanceMessage(message) {
  const issueNumbers = extractIssueNumbers(message);
  if (issueNumbers.length > 0) {
    return `${message}\n\nIMPORTANT: The message mentions issue #${issueNumbers[0]}. Remember to first call getIssue({number: ${issueNumbers[0]}}) to get details about this issue before implementation.`;
  }
  return message;
}

// Test the message enhancement
console.log('\n\n=== Testing Message Enhancement ===');

const messageTestCases = [
  { 
    input: 'Hey @Developer, please implement issue #42', 
    expectEnhanced: true 
  },
  { 
    input: 'Please fix the bug in the login form', 
    expectEnhanced: false 
  },
  { 
    input: 'I need help with #123, can you implement it?', 
    expectEnhanced: true 
  }
];

messageTestCases.forEach((testCase, index) => {
  const enhanced = enhanceMessage(testCase.input);
  const wasEnhanced = enhanced !== testCase.input;
  const passed = wasEnhanced === testCase.expectEnhanced;
  
  console.log(`Message Test ${index + 1}: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Input: "${testCase.input}"`);
  console.log(`  Expected enhancement: ${testCase.expectEnhanced}`);
  console.log(`  Actual enhancement: ${wasEnhanced}`);
  
  if (wasEnhanced) {
    console.log(`  Enhanced message: "${enhanced}"`);
  }
});

// 3. Test the branch-first workflow enforcement
function simulateGitHubWorkflow(steps) {
  const results = [];
  let branchCreated = false;
  
  for (const step of steps) {
    if (step === 'getRepositoryInfo') {
      results.push({ success: true, message: 'Repository info retrieved' });
    } 
    else if (step === 'getIssue') {
      results.push({ success: true, message: 'Issue details retrieved' });
    }
    else if (step === 'createBranch') {
      branchCreated = true;
      results.push({ success: true, message: 'Branch created successfully' });
    }
    else if (step === 'createCommit') {
      if (!branchCreated) {
        results.push({ 
          success: false, 
          error: '⚠️ CRITICAL WORKFLOW ERROR: You must create a branch before committing to it. Please call createBranch first, then retry your commit.' 
        });
      } else {
        results.push({ success: true, message: 'Commit created successfully' });
      }
    }
    else if (step === 'createPullRequest') {
      if (!branchCreated) {
        results.push({ 
          success: false, 
          error: '⚠️ CRITICAL WORKFLOW ERROR: Branch doesn\'t exist. You MUST follow this exact workflow: 1. First create a branch with createBranch, 2. Then commit your changes, 3. Only then create a PR' 
        });
      } else {
        results.push({ success: true, message: 'Pull request created successfully' });
      }
    }
  }
  
  return results;
}

// Test correct and incorrect workflows
console.log('\n\n=== Testing GitHub Workflow Enforcement ===');

const workflowTestCases = [
  {
    name: 'Correct workflow with branch first',
    steps: ['getRepositoryInfo', 'getIssue', 'createBranch', 'createCommit', 'createPullRequest'],
    expectAllSuccess: true
  },
  {
    name: 'Incorrect workflow - missing branch creation',
    steps: ['getRepositoryInfo', 'getIssue', 'createCommit', 'createPullRequest'],
    expectAllSuccess: false
  },
  {
    name: 'Incorrect workflow - missing issue retrieval',
    steps: ['getRepositoryInfo', 'createBranch', 'createCommit', 'createPullRequest'],
    expectAllSuccess: true // This should still work, just missing issue details
  }
];

workflowTestCases.forEach((testCase) => {
  console.log(`\nWorkflow Test: ${testCase.name}`);
  const results = simulateGitHubWorkflow(testCase.steps);
  
  const allSuccess = results.every(result => result.success);
  const passed = allSuccess === testCase.expectAllSuccess;
  
  console.log(`  Overall result: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`  Expected all success: ${testCase.expectAllSuccess}`);
  console.log(`  Actual all success: ${allSuccess}`);
  
  console.log('  Step results:');
  results.forEach((result, index) => {
    console.log(`    Step ${index + 1} (${testCase.steps[index]}): ${result.success ? 'SUCCESS' : 'ERROR'}`);
    if (!result.success) {
      console.log(`      Error: ${result.error}`);
    }
  });
}); 