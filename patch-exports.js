#!/usr/bin/env node

// This script patches the exported functions for better CommonJS compatibility

const fs = require('fs');
const path = require('path');

console.log('Patching GitHubFunctions exports for CommonJS compatibility...');

// Figure out where the file might be
const possiblePaths = [
  path.join(__dirname, 'src', 'services', 'github', 'GitHubFunctions.js'),
  path.join(__dirname, 'dist', 'services', 'github', 'GitHubFunctions.js'),
  path.join(__dirname, 'services', 'github', 'GitHubFunctions.js'),
  path.join(__dirname, 'GitHubFunctions.js')
];

let targetFile = null;
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    targetFile = filePath;
    break;
  }
}

if (!targetFile) {
  console.error('Error: Could not find GitHubFunctions.js in any expected location');
  process.exit(1);
}

console.log(`Found target file at: ${targetFile}`);

try {
  // Read the current file content
  let content = fs.readFileSync(targetFile, 'utf8');
  
  // Check if already patched
  if (content.includes('// PATCHED EXPORTS') || 
      (content.includes('exports.setCurrentIssueNumber') && content.includes('exports.setIssueNumber'))) {
    console.log('File already appears to be patched. No changes made.');
    process.exit(0);
  }
  
  // Add the exports
  content += `
// PATCHED EXPORTS - Added for CommonJS compatibility
exports.setCurrentIssueNumber = setCurrentIssueNumber;
exports.setIssueNumber = setIssueNumber || setCurrentIssueNumber;
exports.resetWorkflowState = resetWorkflowState;

// Create a fallback function if setIssueNumber doesn't exist
if (typeof setIssueNumber === 'undefined') {
  exports.setIssueNumber = function setIssueNumber(issueNumber) {
    console.log('Using fallback setIssueNumber function');
    if (typeof setCurrentIssueNumber === 'function') {
      return setCurrentIssueNumber(issueNumber);
    } else if (typeof workflowState !== 'undefined') {
      workflowState.currentIssueNumber = issueNumber;
    } else {
      console.error('Unable to set issue number: workflowState is not defined');
    }
  };
}
`;
  
  // Write the updated content back to the file
  fs.writeFileSync(targetFile, content);
  console.log('Successfully patched GitHubFunctions exports!');
} catch (error) {
  console.error(`Error patching file: ${error.message}`);
  process.exit(1);
} 