/**
 * Example script demonstrating how to use SwarmWeaver agents programmatically
 * 
 * Run with: node examples/agent-usage.js
 */

import { AIService } from '../src/services/ai/AIService';
import { githubFunctions } from '../src/services/github/GitHubFunctions';
import { projectManagerAgent, developerAgent, codeReviewerAgent } from '../src/agents/AgentDefinitions';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize the AI service
const aiService = new AIService();

// Register GitHub functions
githubFunctions.forEach(func => {
  aiService.registerFunction(func);
});

/**
 * Generate a response from an agent
 */
async function generateAgentResponse(agent, userMessage) {
  console.log(`\n🤖 ${agent.name} (${agent.role}):`);
  console.log(`📝 Request: ${userMessage}`);
  
  try {
    const { response, functionCalls } = await aiService.generateAgentResponse(
      agent, 
      userMessage
    );
    
    console.log(`✅ Response: ${response}`);
    
    if (functionCalls.length > 0) {
      console.log(`🛠️ Function Calls (${functionCalls.length}):`);
      functionCalls.forEach(call => {
        console.log(`  - ${call.name}(${JSON.stringify(call.arguments)})`);
        console.log(`    Result: ${JSON.stringify(call.result)}`);
      });
    }
    
    return { response, functionCalls };
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Run example agent interactions
 */
async function runExamples() {
  console.log('🌊 SwarmWeaver Agent Examples');
  
  // Example 1: Project Manager creating an issue
  await generateAgentResponse(
    projectManagerAgent,
    "Create an issue for implementing user authentication with the following requirements: Support login with email/password and OAuth providers, implement JWT tokens for session management, and add appropriate security measures."
  );
  
  // Example 2: Developer creating a pull request
  await generateAgentResponse(
    developerAgent,
    "Create a pull request to merge my feature-auth branch into main with title 'Implement User Authentication' and description explaining the OAuth and JWT implementation."
  );
  
  // Example 3: Code Reviewer reviewing a PR
  await generateAgentResponse(
    codeReviewerAgent,
    "Review pull request #42 and provide feedback on the code quality and security aspects."
  );
}

// Run the examples
runExamples()
  .then(() => console.log('\n✨ Examples completed successfully'))
  .catch(error => console.error('\n❌ Error running examples:', error))
  .finally(() => process.exit(0)); 