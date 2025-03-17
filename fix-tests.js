import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// List of files to fix
const filesToFix = [
  '__tests__/slack-github-integration.test.ts',
  '__tests__/developer-task-handling.test.ts',
  '__tests__/agent-slack-id-management.test.ts',
  '__tests__/agent-mention-detection.test.ts',
  '__tests__/agent-communication.test.ts',
  '__tests__/github-workflow-integration.test.ts'
];

// Add import if needed and make fix to mock functions
for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add WorkflowState import if missing
    if (!content.includes('import { WorkflowState }')) {
      content = content.replace(
        /import.*from.*;\n/,
        match => match + 'import { WorkflowState } from \'../src/services/state/WorkflowStateManager\';\n'
      );
    }
    
    // Fix HandoffMediator import if needed
    if (content.includes('import { HandoffMediator } from \'../src/types/handoffMediator\'')) {
      content = content.replace(
        'import { HandoffMediator } from \'../src/types/handoffMediator\'',
        'import { HandoffMediator } from \'../src/services/agents/HandoffMediator\''
      );
    }
    
    // Fix mock objects by using createMockHandoffMediator
    if (file.includes('agent-mention-detection.test.ts')) {
      // Add import for createMockHandoffMediator
      if (!content.includes('import { createMockHandoffMediator }')) {
        content = content.replace(
          /import.*from.*;\n/,
          match => match + 'import { createMockHandoffMediator } from \'./utils/MockHandoffMediator\';\n'
        );
      }
      
      // Replace the mock HandoffMediator with createMockHandoffMediator
      content = content.replace(
        /const mockHandoffMediator = \{[^}]*\} as unknown as HandoffMediator;/s,
        'const mockHandoffMediator = createMockHandoffMediator();'
      );
    }
    
    // Fix mock objects in other files
    if (file.includes('slack-github-integration.test.ts') || 
        file.includes('developer-task-handling.test.ts') || 
        file.includes('agent-slack-id-management.test.ts') || 
        file.includes('agent-communication.test.ts') || 
        file.includes('github-workflow-integration.test.ts')) {
      
      // Replace stateManager with a properly typed mock
      content = content.replace(
        /stateManager:\s*\{\s*getState:\s*jest\.fn\(\)\.mockResolvedValue\(\{\s*stage:\s*['"]([^'"]+)['"]\s*,\s*issueNumber:\s*(\d+)\s*\}[^)]*\)/g,
        'stateManager: { getState: jest.fn().mockImplementation(() => Promise.resolve({ stage: \'$1\', issueNumber: $2 } as WorkflowState))'
      );
      
      // Replace null getState with a properly typed mock
      content = content.replace(
        /getState:\s*jest\.fn\(\)\.mockResolvedValue\(null[^)]*\)/g,
        'getState: jest.fn().mockImplementation(() => Promise.resolve(null))'
      );
    }
    
    // Write the modified content back to the file
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
}

console.log('Fix completed!'); 