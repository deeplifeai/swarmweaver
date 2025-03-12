"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var SlackService_1 = require("./services/slack/SlackService");
var AIService_1 = require("./services/ai/AIService");
var AgentOrchestrator_1 = require("./services/ai/AgentOrchestrator");
var AgentDefinitions_1 = require("./agents/AgentDefinitions");
var GitHubFunctions_1 = require("./services/github/GitHubFunctions");
var config_1 = require("./config/config");
var SecurityUtils_1 = require("./utils/SecurityUtils");
// Check if required configuration is available
function validateConfiguration() {
    var missingEnvVars = [];
    var invalidTokens = [];
    // Check for missing variables
    if (!config_1.config.openai.apiKey)
        missingEnvVars.push('OPENAI_API_KEY');
    if (!config_1.config.slack.botToken)
        missingEnvVars.push('SLACK_BOT_TOKEN');
    if (!config_1.config.slack.signingSecret)
        missingEnvVars.push('SLACK_SIGNING_SECRET');
    if (!config_1.config.slack.appToken)
        missingEnvVars.push('SLACK_APP_TOKEN');
    if (!config_1.config.github.token)
        missingEnvVars.push('GITHUB_TOKEN');
    if (!config_1.config.github.repository)
        missingEnvVars.push('GITHUB_REPOSITORY');
    if (missingEnvVars.length > 0) {
        console.error('❌ Missing required environment variables:');
        missingEnvVars.forEach(function (variable) { return console.error("  - ".concat(variable)); });
        console.error('Please set these variables in your .env file and restart the application.');
        process.exit(1);
    }
    // Validate token formats
    if (config_1.config.openai.apiKey && !(0, SecurityUtils_1.isValidOpenAIKey)(config_1.config.openai.apiKey)) {
        invalidTokens.push('OPENAI_API_KEY');
    }
    if (config_1.config.github.token && !(0, SecurityUtils_1.isValidGitHubToken)(config_1.config.github.token)) {
        invalidTokens.push('GITHUB_TOKEN');
    }
    if (config_1.config.slack.botToken && !(0, SecurityUtils_1.isValidSlackToken)(config_1.config.slack.botToken, 'bot')) {
        invalidTokens.push('SLACK_BOT_TOKEN');
    }
    if (config_1.config.slack.signingSecret && !(0, SecurityUtils_1.isValidSlackToken)(config_1.config.slack.signingSecret, 'signing')) {
        invalidTokens.push('SLACK_SIGNING_SECRET');
    }
    if (config_1.config.slack.appToken && !(0, SecurityUtils_1.isValidSlackToken)(config_1.config.slack.appToken, 'app')) {
        invalidTokens.push('SLACK_APP_TOKEN');
    }
    if (invalidTokens.length > 0) {
        console.error('❌ Invalid token formats detected:');
        invalidTokens.forEach(function (token) { return console.error("  - ".concat(token)); });
        console.error('Please check these tokens in your .env file and ensure they follow the correct format.');
        process.exit(1);
    }
    // Validate GitHub repository format
    if (config_1.config.github.repository && !config_1.config.github.repository.includes('/')) {
        console.error('❌ Invalid GitHub repository format:');
        console.error('  Repository should be in the format "owner/repo"');
        process.exit(1);
    }
}
// Log configuration (with masked tokens for security)
function logConfiguration() {
    console.log('📊 Configuration:');
    console.log("  Environment: ".concat(config_1.config.environment));
    console.log("  Port: ".concat(config_1.config.port));
    console.log("  OpenAI API Key: ".concat((0, SecurityUtils_1.maskToken)(config_1.config.openai.apiKey)));
    console.log("  OpenAI Model: ".concat(config_1.config.openai.model));
    console.log("  GitHub Token: ".concat((0, SecurityUtils_1.maskToken)(config_1.config.github.token)));
    console.log("  GitHub Repository: ".concat(config_1.config.github.repository));
    console.log("  Slack Bot Token: ".concat((0, SecurityUtils_1.maskToken)(config_1.config.slack.botToken)));
    console.log("  Slack App Token: ".concat((0, SecurityUtils_1.maskToken)(config_1.config.slack.appToken)));
    console.log("  Slack Signing Secret: ".concat((0, SecurityUtils_1.maskToken)(config_1.config.slack.signingSecret)));
}
// Initialize and start the application
function startApplication() {
    return __awaiter(this, void 0, void 0, function () {
        var slackService, aiService_1, agentOrchestrator_1;
        return __generator(this, function (_a) {
            console.log('🚀 Starting SwarmWeaver...');
            // Validate configuration
            validateConfiguration();
            try {
                // Log masked configuration
                logConfiguration();
                // Initialize services
                console.log('⚙️ Initializing services...');
                slackService = new SlackService_1.SlackService();
                aiService_1 = new AIService_1.AIService();
                agentOrchestrator_1 = new AgentOrchestrator_1.AgentOrchestrator(slackService, aiService_1);
                // Register GitHub functions with AI service
                console.log('🔧 Registering GitHub functions...');
                GitHubFunctions_1.githubFunctions.forEach(function (func) {
                    aiService_1.registerFunction(func);
                });
                // Register agents with orchestrator
                console.log('🤖 Registering agents...');
                AgentDefinitions_1.agents.forEach(function (agent) {
                    agentOrchestrator_1.registerAgent(agent);
                    console.log("  - ".concat(agent.name, ": ").concat(agent.description));
                });
                // Start Slack service
                console.log('💬 Starting Slack service...');
                slackService.start();
                console.log('✅ SwarmWeaver is running!');
                console.log("\uD83D\uDCCA Agents registered: ".concat(AgentDefinitions_1.agents.length));
                console.log("\uD83D\uDD17 Connected to GitHub repository: ".concat(config_1.config.github.repository));
                // Set up graceful shutdown
                setupGracefulShutdown();
            }
            catch (error) {
                console.error('❌ Error starting SwarmWeaver:', error);
                process.exit(1);
            }
            return [2 /*return*/];
        });
    });
}
// Handle graceful shutdown
function setupGracefulShutdown() {
    process.on('SIGINT', function () {
        console.log('\n🛑 Shutting down SwarmWeaver...');
        process.exit(0);
    });
    process.on('SIGTERM', function () {
        console.log('\n🛑 Shutting down SwarmWeaver...');
        process.exit(0);
    });
    process.on('uncaughtException', function (error) {
        console.error('❌ Uncaught exception:', error);
        process.exit(1);
    });
    process.on('unhandledRejection', function (reason) {
        console.error('❌ Unhandled rejection:', reason);
    });
}
// Start the application
startApplication().catch(function (error) {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});
