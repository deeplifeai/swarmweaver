#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper function to execute shell commands and log output
function executeCommand(command, options = {}) {
  console.log(`${colors.blue}Executing:${colors.reset} ${colors.bright}${command}${colors.reset}`);
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    console.error(`${colors.red}Command failed:${colors.reset} ${error.message}`);
    return false;
  }
}

// Check if TypeScript is installed
function checkDependencies() {
  console.log(`${colors.cyan}Checking dependencies...${colors.reset}`);
  try {
    execSync('tsc --version', { stdio: 'pipe' });
    console.log(`${colors.green}✓ TypeScript is installed${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ TypeScript is not installed. Please run 'npm install typescript --save-dev'${colors.reset}`);
    return false;
  }
}

// Process JS files to add path resolver requires
function processJsFiles() {
  console.log(`${colors.cyan}Processing JS files to handle @/ imports...${colors.reset}`);
  
  const outputDir = path.join(__dirname, 'dist');
  const processDir = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        processDir(fullPath);
      } else if (entry.name.endsWith('.js')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        
        // If file imports from @/, add the path-resolver require
        if (content.includes('@/')) {
          const pathToResolver = path.relative(path.dirname(fullPath), path.join(outputDir, 'utils')).replace(/\\/g, '/');
          const requirePath = pathToResolver ? `${pathToResolver}/path-resolver` : './utils/path-resolver';
          
          // Add the require statement if not already present
          if (!content.includes('require') || !content.includes('path-resolver')) {
            content = `require("${requirePath}");\n${content}`;
            fs.writeFileSync(fullPath, content);
            console.log(`${colors.green}✓ Added path resolver to ${fullPath}${colors.reset}`);
          }
        }
      }
    }
  };
  
  processDir(outputDir);
}

// Verify and fix GitHubFunctions exports
function verifyGitHubFunctions() {
  console.log(`${colors.cyan}Verifying GitHubFunctions exports...${colors.reset}`);
  
  const filePath = path.join(__dirname, 'dist', 'services', 'github', 'GitHubFunctions.js');
  
  if (!fs.existsSync(filePath)) {
    console.log(`${colors.yellow}! GitHubFunctions.js not found at ${filePath}, skipping verification${colors.reset}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check for workflow state and required functions
  if (!content.includes('var workflowState') && !content.includes('let workflowState')) {
    console.log(`${colors.yellow}! Adding workflowState to GitHubFunctions.js${colors.reset}`);
    
    // Add before the exports declarations
    let insertPosition = content.indexOf('exports.githubFunctionDefinitions');
    if (insertPosition === -1) {
      insertPosition = content.indexOf('exports.githubFunctions');
    }
    
    if (insertPosition === -1) {
      insertPosition = content.length;
    }
    
    const workflowStateCode = `
// Define the workflow state
var workflowState = {
  repositoryInfo: null,
  getRepositoryInfoCalled: false,
  currentIssueNumber: null,
  currentBranch: null,
  autoProgressWorkflow: true
};

// Helper functions for state management
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
    
    content = content.slice(0, insertPosition) + workflowStateCode + content.slice(insertPosition);
    modified = true;
  }
  
  // Check for explicit exports
  if (!content.includes('exports.setCurrentIssueNumber = setCurrentIssueNumber')) {
    console.log(`${colors.yellow}! Adding missing exports to GitHubFunctions.js${colors.reset}`);
    
    const exportsCode = `
// Export state management functions
exports.resetWorkflowState = resetWorkflowState;
exports.setCurrentIssueNumber = setCurrentIssueNumber;
exports.setIssueNumber = setIssueNumber;
`;
    
    content = content + exportsCode;
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`${colors.green}✓ Updated GitHubFunctions.js with required functions and exports${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ GitHubFunctions.js already has required functions and exports${colors.reset}`);
  }
}

// Main build process
async function build() {
  console.log(`${colors.bright}${colors.magenta}Starting server-side build...${colors.reset}\n`);
  
  // Check dependencies
  if (!checkDependencies()) {
    process.exit(1);
  }
  
  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create utils directory for path resolver if it doesn't exist
  const utilsDir = path.join(outputDir, 'utils');
  if (!fs.existsSync(utilsDir)) {
    fs.mkdirSync(utilsDir, { recursive: true });
  }
  
  // Compile TypeScript files
  console.log(`\n${colors.cyan}Compiling TypeScript files...${colors.reset}`);
  if (!executeCommand('tsc -p tsconfig-build.json')) {
    console.error(`${colors.red}Failed to compile TypeScript files${colors.reset}`);
    process.exit(1);
  }
  
  // Process JS files to add path resolver
  processJsFiles();
  
  // Verify and fix GitHubFunctions exports
  verifyGitHubFunctions();
  
  console.log(`\n${colors.bright}${colors.green}Build completed successfully!${colors.reset}\n`);
}

// Run the build
build().catch(error => {
  console.error(`\n${colors.bright}${colors.red}Build failed:${colors.reset}`, error);
  process.exit(1);
}); 