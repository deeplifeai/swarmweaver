"use strict";
import { SlackService } from './services/slack/SlackService.js';
import { AIService } from './services/ai/AIService.js';
import { AgentOrchestrator } from './services/ai/AgentOrchestrator.js';
import { agents } from './agents/AgentDefinitions.js';
import { githubFunctions } from './services/github/GitHubFunctions.js';
import { config } from './config/config.js';
import { isValidOpenAIKey, isValidGitHubToken, isValidSlackToken, maskToken } from './utils/SecurityUtils.js';
import { GitHubService } from './services/github/GitHubService.js';

// Check if required configuration is available
function validateConfiguration() {
    const missingEnvVars = [];
    const invalidTokens = [];
    const invalidConfigs = [];
    
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
    
    // Validate GitHub repository format
    if (config.github.repository) {
        const repoRegex = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
        if (!repoRegex.test(config.github.repository)) {
            invalidConfigs.push(`GITHUB_REPOSITORY (${config.github.repository}) - Must be in format 'owner/repo'`);
        }
    }
    
    if (invalidTokens.length > 0) {
        console.error('❌ Invalid token formats:');
        invalidTokens.forEach(token => console.error(`  - ${token}`));
        console.error('Please check the format of these tokens in your .env file.');
        process.exit(1);
    }
    
    if (invalidConfigs.length > 0) {
        console.error('❌ Invalid configuration values:');
        invalidConfigs.forEach(config => console.error(`  - ${config}`));
        console.error('Please correct these configuration values in your .env file.');
        process.exit(1);
    }
}

// Verify GitHub repository access
async function verifyGitHubAccess() {
    console.log('🔍 Verifying GitHub repository access...');
    try {
        const githubService = new GitHubService();
        await githubService.getRepository();
        console.log(`✅ Successfully connected to GitHub repository: ${config.github.repository}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to access GitHub repository: ${config.github.repository}`);
        console.error(`Error: ${error.message}`);
        
        if (error.status === 404) {
            console.error('The repository does not exist or you do not have access to it.');
        } else if (error.status === 401 || error.status === 403) {
            console.error('Invalid GitHub token or insufficient permissions.');
        }
        
        console.error('Please check your GITHUB_TOKEN and GITHUB_REPOSITORY values in the .env file.');
        return false;
    }
}

// Log configuration (with masked tokens for security)
function logConfiguration() {
    console.log('📊 Configuration:');
    console.log(`  Environment: ${config.environment}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  OpenAI API Key: ${maskToken(config.openai.apiKey)}`);
    console.log(`  OpenAI Model: ${config.openai.model}`);
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
        
        // Verify GitHub access
        const githubAccessOk = await verifyGitHubAccess();
        if (!githubAccessOk) {
            console.warn('⚠️ Starting without verified GitHub access - some functionality may be limited');
        }
        
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
            console.log(`  - ${agent.name}: ${agent.description}`);
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
