#!/usr/bin/env node

// This script fixes the issues with GitHubFunctions.js

const fs = require('fs');
const path = require('path');

console.log('Fixing GitHubFunctions.js...');

const targetFile = path.join(__dirname, 'src', 'services', 'github', 'GitHubFunctions.js');

if (!fs.existsSync(targetFile)) {
  console.error(`Error: Could not find GitHubFunctions.js at ${targetFile}`);
  process.exit(1);
}

try {
  // Read the current file content
  let content = fs.readFileSync(targetFile, 'utf8');
  
  // First, let's find the location of the functions we need to fix
  const resetWorkflowStateDeclaration = content.match(/function resetWorkflowState\(\)/);
  const setCurrentIssueNumberDeclaration = content.match(/function setCurrentIssueNumber\(issueNumber\)/);
  
  if (!resetWorkflowStateDeclaration && !setCurrentIssueNumberDeclaration) {
    console.log('Could not find the function declarations, creating them...');
    
    // Find a good place to add our function declarations - before the githubFunctionDefinitions export
    const functionDefinitionsIndex = content.indexOf('var githubFunctionDefinitions');
    
    if (functionDefinitionsIndex === -1) {
      console.error('Error: Could not find a good insertion point');
      process.exit(1);
    }
    
    // Define the functions we need to add
    const functionsToAdd = `
// Recreated functions
var workflowState = {
  repositoryInfo: null,
  getRepositoryInfoCalled: false,
  currentIssueNumber: null,
  currentBranch: null,
  autoProgressWorkflow: true
};

function resetWorkflowState() {
  workflowState.repositoryInfo = null;
  workflowState.getRepositoryInfoCalled = false;
  workflowState.currentIssueNumber = null;
  workflowState.currentBranch = null;
  workflowState.autoProgressWorkflow = true;
}

function setCurrentIssueNumber(issueNumber) {
  console.log('Setting current issue number to:', issueNumber);
  workflowState.currentIssueNumber = issueNumber;
}

function setIssueNumber(issueNumber) {
  console.log('Setting issue number via setIssueNumber to:', issueNumber);
  workflowState.currentIssueNumber = issueNumber;
}

`;
    
    // Insert the functions at the appropriate location
    content = content.slice(0, functionDefinitionsIndex) + functionsToAdd + content.slice(functionDefinitionsIndex);
  }
  
  // Now let's fix the exports section
  if (content.includes('// PATCHED EXPORTS')) {
    // Remove the previous patched exports section to avoid duplication
    const patchedExportsIndex = content.indexOf('// PATCHED EXPORTS');
    const endPatchedExports = content.indexOf('}\n', patchedExportsIndex);
    
    if (endPatchedExports !== -1) {
      content = content.slice(0, patchedExportsIndex) + content.slice(endPatchedExports + 2);
    }
  }
  
  // Add our clean exports to the end
  content += `
// Fixed exports
exports.resetWorkflowState = resetWorkflowState;
exports.setCurrentIssueNumber = setCurrentIssueNumber;
exports.setIssueNumber = setIssueNumber;
`;
  
  // Write the updated content back to the file
  fs.writeFileSync(targetFile, content);
  console.log(`Successfully updated ${targetFile}`);
} catch (error) {
  console.error(`Error updating file: ${error.message}`);
  process.exit(1);
} 