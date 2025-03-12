import { MockSlackService } from '../mock-services/MockSlackService';
import { MockGitHubService } from '../mock-services/MockGitHubService';
import eventBus, { EVENTS } from '../utils/EventBus';
import chalk from 'chalk';

/**
 * SwarmWeaver Sandbox CLI
 * A testing environment for the SwarmWeaver system that doesn't require
 * actual Slack and GitHub connections.
 */

console.log(chalk.blue('======================================='));
console.log(chalk.blue('🧠 SwarmWeaver Sandbox Environment 🧠'));
console.log(chalk.blue('======================================='));
console.log(chalk.gray('A testing environment for SwarmWeaver'));
console.log(chalk.gray('Version: 1.0.0'));
console.log('\n');

// Initialize services
const slackService = new MockSlackService();
const githubService = new MockGitHubService();

// Set up event listeners
setupEventListeners();

/**
 * Set up event listeners to simulate the SwarmWeaver system
 */
function setupEventListeners() {
  // Listen for Slack messages
  eventBus.subscribe(EVENTS.SLACK_MESSAGE, (message) => {
    console.log(chalk.yellow('Event received: SLACK_MESSAGE'));
    console.log(chalk.gray(`Message: "${message.text}"`));
    console.log(chalk.gray(`Target Agents: ${message.mentions?.join(', ')}`));
    
    // Here we would normally handle the message with the AI service
    // For this sandbox, we can simulate simple responses
    simulateAgentResponse(message);
  });
  
  // Listen for GitHub events
  eventBus.subscribe(EVENTS.GITHUB_ISSUE_CREATED, (issue) => {
    console.log(chalk.yellow('Event received: GITHUB_ISSUE_CREATED'));
    console.log(chalk.gray(`Issue #${issue.number}: ${issue.title}`));
  });
  
  eventBus.subscribe(EVENTS.GITHUB_PR_CREATED, (pr) => {
    console.log(chalk.yellow('Event received: GITHUB_PR_CREATED'));
    console.log(chalk.gray(`PR #${pr.number}: ${pr.title}`));
  });
  
  eventBus.subscribe(EVENTS.FUNCTION_CALLED, (functionCall, message) => {
    console.log(chalk.yellow('Event received: FUNCTION_CALLED'));
    console.log(chalk.gray(`Function: ${functionCall.name}`));
    
    // Handle function calls to GitHub
    handleFunctionCall(functionCall, message);
  });
}

/**
 * Simulate agent responses to messages
 */
function simulateAgentResponse(message: any) {
  if (!message.mentions || message.mentions.length === 0) return;
  
  // Process each mentioned agent
  message.mentions.forEach((agentName: string) => {
    // Simulate processing time
    setTimeout(() => {
      // For messages to multiple agents, pass the original clean text to each agent
      const response = generateSimulatedResponse(agentName, message.text);
      
      if (response) {
        // Process the response through the Slack service
        slackService.processAgentResponse(agentName, response, message);
      }
    }, 500 + Math.random() * 1000); // Random delay between 500-1500ms
  });
}

/**
 * Generate a simulated response from an agent
 * This is a placeholder - in a real system, this would call the AI service
 */
function generateSimulatedResponse(agentName: string, messageText: string) {
  // Clean only the specific agent's mention to keep other agent mentions in context
  const cleanText = messageText.replace(new RegExp(`@${agentName}[,]?\\s*`, 'g'), '').trim();
  
  let response: any = {
    role: 'assistant',
    content: '',
    function_calls: []
  };
  
  // Simple pattern matching for demo purposes
  if (cleanText.match(/create (an |a )?issue/i)) {
    response.content = `I'll create an issue for you!`;
    response.function_calls = [
      {
        name: 'createIssue',
        arguments: {
          title: `Issue from sandbox request`,
          body: `This issue was created from the sandbox environment based on: "${cleanText}"`,
          labels: ['sandbox']
        }
      }
    ];
  } else if (cleanText.match(/create (a |)pull request/i)) {
    response.content = `I'll create a pull request for that!`;
    response.function_calls = [
      {
        name: 'createPullRequest',
        arguments: {
          title: `PR from sandbox request`,
          body: `This PR was created from the sandbox environment based on: "${cleanText}"`,
          head: 'feature-branch',
          base: 'main'
        }
      }
    ];
  } else if (cleanText.match(/review (the |)pull request/i)) {
    response.content = `I'll review that pull request for you!`;
    response.function_calls = [
      {
        name: 'createReview',
        arguments: {
          pr: 1,
          body: `This is a review from the sandbox environment based on: "${cleanText}"`,
          event: 'APPROVE'
        }
      }
    ];
  } else if (cleanText.match(/@([a-zA-Z_]+)/i)) {
    // Handle case where there's mention of another agent in the message
    const otherAgentMatch = cleanText.match(/@([a-zA-Z_]+)/i);
    const otherAgent = otherAgentMatch ? otherAgentMatch[1] : 'someone';
    response.content = `I noticed you mentioned ${otherAgent}. I'll handle this myself. Regarding: "${cleanText.replace(/@([a-zA-Z_]+)/g, otherAgent)}"`;
  } else {
    response.content = `I received your message: "${cleanText}". How can I help you with GitHub tasks?`;
  }
  
  return response;
}

/**
 * Handle function calls to GitHub
 */
async function handleFunctionCall(functionCall: any, message: any) {
  try {
    let result;
    
    // Handle different GitHub function calls
    switch (functionCall.name) {
      case 'createIssue':
        result = await githubService.createIssue(functionCall.arguments);
        eventBus.publish(EVENTS.GITHUB_ISSUE_CREATED, result);
        break;
        
      case 'createPullRequest':
        result = await githubService.createPullRequest(functionCall.arguments);
        eventBus.publish(EVENTS.GITHUB_PR_CREATED, result);
        break;
        
      case 'createReview':
        result = await githubService.createReview(
          functionCall.arguments.pr,
          {
            body: functionCall.arguments.body,
            event: functionCall.arguments.event
          }
        );
        eventBus.publish(EVENTS.GITHUB_PR_REVIEWED, result);
        break;
        
      default:
        console.log(chalk.red(`Unknown function call: ${functionCall.name}`));
        return;
    }
    
    // Send the result back to the Slack channel
    if (result) {
      const resultMessage = `Function result for ${functionCall.name}: ${JSON.stringify(result, null, 2)}`;
      slackService.sendMessage(message.channel, resultMessage, message.ts);
    }
  } catch (error) {
    console.error(chalk.red('Error executing function call:'), error);
  }
} 