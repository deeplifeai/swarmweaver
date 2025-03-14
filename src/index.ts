import { SlackService } from './services/slack/SlackService';
import { AIService } from './services/ai/AIService';
import { AgentOrchestrator } from './services/ai/AgentOrchestrator';
import { GitHubService } from './services/github/GitHubService';
import { agents } from './agents/AgentDefinitions';
import { githubFunctions } from './services/github/GitHubFunctions';
import { config, environment } from './config/config';
import { 
  isValidOpenAIKey, 
  isValidGitHubToken, 
  isValidSlackToken,
  maskToken 
} from './utils/SecurityUtils';

// Check if required configuration is available
function validateConfiguration() {
  const missingEnvVars = [];
  const invalidTokens = [];
  
  // Check for missing variables
  if (!config.openai.apiKey) missingEnvVars.push('OPENAI_API_KEY');
  if (!config.slack.botToken) missingEnvVars.push('SLACK_BOT_TOKEN');
  if (!config.slack.signingSecret) missingEnvVars.push('SLACK_SIGNING_SECRET');
  if (!config.slack.appToken) missingEnvVars.push('SLACK_APP_TOKEN');
  if (!config.github.token) missingEnvVars.push('GITHUB_TOKEN');
  if (!config.github.repository) missingEnvVars.push('GITHUB_REPOSITORY');
  
  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(variable => console.error(`  - ${variable}`));
    console.error('Please set these variables in your .env file and restart the application.');
    process.exit(1);
  }
  
  // Validate token formats
  if (config.openai.apiKey && !isValidOpenAIKey(config.openai.apiKey)) {
    invalidTokens.push('OPENAI_API_KEY');
  }
  
  if (config.github.token && !isValidGitHubToken(config.github.token)) {
    invalidTokens.push('GITHUB_TOKEN');
  }
  
  if (config.slack.botToken && !isValidSlackToken(config.slack.botToken, 'bot')) {
    invalidTokens.push('SLACK_BOT_TOKEN');
  }
  
  if (config.slack.signingSecret && !isValidSlackToken(config.slack.signingSecret, 'signing')) {
    invalidTokens.push('SLACK_SIGNING_SECRET');
  }
  
  if (config.slack.appToken && !isValidSlackToken(config.slack.appToken, 'app')) {
    invalidTokens.push('SLACK_APP_TOKEN');
  }
  
  if (invalidTokens.length > 0) {
    console.error('❌ Invalid token formats detected:');
    invalidTokens.forEach(token => console.error(`  - ${token}`));
    console.error('Please check these tokens in your .env file and ensure they follow the correct format.');
    process.exit(1);
  }
  
  // Validate GitHub repository format
  if (config.github.repository && !config.github.repository.includes('/')) {
    console.error('❌ Invalid GitHub repository format:');
    console.error('  Repository should be in the format "owner/repo"');
    process.exit(1);
  }
}

// Log configuration (with masked tokens for security)
function logConfiguration() {
  console.log('📊 Configuration:');
  console.log(`  Environment: ${environment}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  OpenAI API Key: ${maskToken(config.openai.apiKey)}`);
  console.log(`  OpenAI Model: ${config.openai.models.default}`);
  console.log(`  GitHub Token: ${maskToken(config.github.token)}`);
  console.log(`  GitHub Repository: ${config.github.repository}`);
  console.log(`  Slack Bot Token: ${maskToken(config.slack.botToken)}`);
  console.log(`  Slack App Token: ${maskToken(config.slack.appToken)}`);
  console.log(`  Slack Signing Secret: ${maskToken(config.slack.signingSecret)}`);
}

// Initialize and start the application
async function startApplication() {
  console.log('🚀 Starting SwarmWeaver...');
  
  // Validate configuration
  validateConfiguration();
  
  try {
    // Log masked configuration
    logConfiguration();
    
    console.log(`\n===== ENVIRONMENT: ${environment} =====`);
    
    // Initialize services
    console.log('⚙️ Initializing services...');
    const slackService = new SlackService();
    const aiService = new AIService();
    const agentOrchestrator = new AgentOrchestrator(slackService, aiService);
    
    // Register GitHub functions with AI service
    console.log('🔧 Registering GitHub functions...');
    githubFunctions.forEach(func => {
      aiService.registerFunction(func);
    });
    
    // Register agents with orchestrator
    console.log('🤖 Registering agents...');
    agents.forEach(agent => {
      agentOrchestrator.registerAgent(agent);
      console.log(`  - ${agent.name} (ID: ${agent.id}): ${agent.description}`);
    });
    
    // Log all available agents for debugging
    console.log('Available agent IDs in the system:');
    agents.forEach(agent => {
      console.log(`  - ${agent.id}: ${agent.name} (${agent.role})`);
    });
    
    // Start Slack service
    console.log('💬 Starting Slack service...');
    slackService.start();
    
    console.log('✅ SwarmWeaver is running!');
    console.log(`📊 Agents registered: ${agents.length}`);
    console.log(`🔗 Connected to GitHub repository: ${config.github.repository}`);
    
    // Set up graceful shutdown
    setupGracefulShutdown();
    
  } catch (error) {
    console.error('❌ Error starting SwarmWeaver:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
function setupGracefulShutdown() {
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down SwarmWeaver...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down SwarmWeaver...');
    process.exit(0);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
  });
}

// Start the application
startApplication().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 