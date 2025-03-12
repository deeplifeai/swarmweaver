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
exports.AgentOrchestrator = void 0;
var EventBus_1 = require("@/utils/EventBus");
var Agent_1 = require("@/types/agents/Agent");
var SlackService_1 = require("../slack/SlackService");
var GitHubFunctions_1 = require("../github/GitHubFunctions");
var AgentOrchestrator = /** @class */ (function () {
    function AgentOrchestrator(slackService, aiService) {
        this.agents = {};
        this.conversationStates = {};
        this.conversations = {};
        this.slackService = slackService;
        this.aiService = aiService;
        // Set up event listeners
        this.setupEventListeners();
    }
    AgentOrchestrator.prototype.setupEventListeners = function () {
        var _this = this;
        // Subscribe to agent messages from Slack via EventBus
        EventBus_1.eventBus.on(EventBus_1.EventType.AGENT_MESSAGE, function (message) {
            _this.handleMessage(message).catch(function (error) {
                console.error('Error handling agent message:', error);
                EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, {
                    source: 'AgentOrchestrator',
                    error: error,
                    message: 'Failed to handle agent message'
                });
            });
        });
        // Subscribe to error events for logging
        EventBus_1.eventBus.on(EventBus_1.EventType.ERROR, function (error) {
            console.error("[".concat(error.source, "] Error:"), error.message || error.error);
        });
    };
    AgentOrchestrator.prototype.registerAgent = function (agent) {
        this.agents[agent.id] = agent;
        console.log("Agent registered: ".concat(agent.name, " (").concat(agent.role, ")"));
    };
    AgentOrchestrator.prototype.handleMessage = function (message) {
        return __awaiter(this, void 0, void 0, function () {
            var selectedAgent, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        // Determine which agent should handle this message
                        selectedAgent = this.determineAgentFromContent(message.content);
                        if (!selectedAgent) {
                            console.log("No specific agent could be determined for message: " + message.id);
                            return [2 /*return*/];
                        }
                        
                        console.log(`Selected agent for message: ${selectedAgent.name} (${selectedAgent.role})`);
                        return [4 /*yield*/, this.processAgentRequest(selectedAgent, message)];
                    case 1:
                        _b.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        console.error('Error handling message:', error_1);
                        EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, {
                            source: 'AgentOrchestrator',
                            error: error_1,
                            message: 'Failed to handle message'
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // New method to determine which agent should handle a message based on content
    AgentOrchestrator.prototype.determineAgentFromContent = function (content) {
        console.log('Determining agent from content:', content);
        
        // 1. Check for explicit role references like "As the PROJECT_MANAGER" or "PROJECT_MANAGER,"
        const rolePrefixes = [
            { pattern: /\b(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)\b/i, group: 1 },
            { pattern: /As the (PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)/i, group: 1 },
            { pattern: /(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER),/i, group: 1 },
            { pattern: /@(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)/i, group: 1 },
        ];

        for (const { pattern, group } of rolePrefixes) {
            const match = content.match(pattern);
            if (match) {
                const roleName = match[group].replace(/\s/g, '_').toUpperCase();
                console.log(`Found explicit role mention: ${roleName}`);
                const agent = this.findAgentByRole(roleName);
                if (agent) return agent;
            }
        }

        // 2. Workflow-based patterns
        // Look for phrases that indicate specific handoffs in the development workflow
        if (/create.*issue|assign.*task|plan.*sprint|priorit|backlog|project.*management/i.test(content)) {
            console.log('Content suggests PROJECT_MANAGER based on workflow patterns');
            return this.findAgentByRole(Agent_1.AgentRole.PROJECT_MANAGER);
        }
        
        if (/implement|develop|code|commit|PR|pull.*request|feature|fix.*bug|programming|branch/i.test(content)) {
            console.log('Content suggests DEVELOPER based on workflow patterns');
            return this.findAgentByRole(Agent_1.AgentRole.DEVELOPER);
        }
        
        if (/review.*code|code.*quality|approve.*PR|merge.*PR|feedback|suggestion|code.*standards/i.test(content)) {
            console.log('Content suggests CODE_REVIEWER based on workflow patterns');
            return this.findAgentByRole(Agent_1.AgentRole.CODE_REVIEWER);
        }
        
        if (/test|verify|QA|quality.*assurance|bug.*report|regression|review.*PR|approve.*PR|merge.*PR/i.test(content)) {
            console.log('Content suggests QA_TESTER based on workflow patterns');
            return this.findAgentByRole(Agent_1.AgentRole.QA_TESTER);
        }
        
        if (/document|write|guide|manual|tutorial|API.*reference|README/i.test(content)) {
            console.log('Content suggests TECHNICAL_WRITER based on workflow patterns');
            return this.findAgentByRole(Agent_1.AgentRole.TECHNICAL_WRITER);
        }

        // 3. Default to PROJECT_MANAGER as fallback
        console.log('No specific agent role detected, defaulting to PROJECT_MANAGER');
        return this.findAgentByRole(Agent_1.AgentRole.PROJECT_MANAGER);
    };
    // Helper method to find an agent by role
    AgentOrchestrator.prototype.findAgentByRole = function (role) {
        for (const agentId in this.agents) {
            if (this.agents[agentId].role === role) {
                return this.agents[agentId];
            }
        }
        return null;
    };
    AgentOrchestrator.prototype.processAgentRequest = function (agent, message) {
        return __awaiter(this, void 0, void 0, function () {
            var conversationId, history_1, workflowState, _a, response, functionCalls, functionResults, fullResponse, slackMessage, error_2, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 5]);
                        conversationId = this.getConversationId(message.channel, message.replyToMessageId);
                        history_1 = this.getConversationHistory(conversationId);
                        
                        // Get workflow state for enhanced context
                        workflowState = this.conversationStates[conversationId];
                        if (!workflowState) {
                            workflowState = {
                                currentPhase: 'initial',
                                issueNumber: null,
                                prNumber: null,
                                lastAgent: null,
                                taskDescription: null
                            };
                            this.conversationStates[conversationId] = workflowState;
                        }
                        
                        if (workflowState) {
                            console.log(`Current workflow state: ${JSON.stringify(workflowState)}`);
                        }
                        
                        console.log(`Processing request with agent: ${agent.name} (${agent.role})`);
                        return [4 /*yield*/, this.aiService.generateAgentResponse(agent, message.content, history_1, workflowState)];
                    case 1:
                        _a = _b.sent(), response = _a.response, functionCalls = _a.functionCalls;
                        
                        // Track workflow state based on this interaction
                        this.trackWorkflowState(conversationId, agent, message, functionCalls);
                        
                        fullResponse = response;
                        if (functionCalls && functionCalls.length > 0) {
                            console.log(`Agent ${agent.name} called functions:`, functionCalls.map(fc => fc.name).join(', '));
                            functionResults = this.aiService.extractFunctionResults(functionCalls);
                            
                            // Add clear separator between agent response and function results
                            const separator = "\n\n-------------------------------------------\n";
                            
                            // Add workflow progress indicators
                            let workflowProgress = "";
                            const workflowState = this.conversationStates[conversationId];
                            
                            if (workflowState && workflowState.currentPhase) {
                                if (agent.role === Agent_1.AgentRole.DEVELOPER) {
                                    workflowProgress = "\n\n📋 *Workflow Progress*:\n";
                                    
                                    if (workflowState.currentPhase === 'issue_retrieved') {
                                        workflowProgress += "✅ Repository info obtained\n";
                                        workflowProgress += "✅ Issue details retrieved\n";
                                        workflowProgress += "⬜ Create branch\n";
                                        workflowProgress += "⬜ Commit code changes\n";
                                        workflowProgress += "⬜ Create pull request\n";
                                    }
                                    else if (workflowState.currentPhase === 'branch_created') {
                                        workflowProgress += "✅ Repository info obtained\n";
                                        workflowProgress += "✅ Issue details retrieved\n";
                                        workflowProgress += "✅ Branch created\n";
                                        workflowProgress += "⬜ Commit code changes\n";
                                        workflowProgress += "⬜ Create pull request\n";
                                    }
                                    else if (workflowState.currentPhase === 'commit_created') {
                                        workflowProgress += "✅ Repository info obtained\n";
                                        workflowProgress += "✅ Issue details retrieved\n";
                                        workflowProgress += "✅ Branch created\n";
                                        workflowProgress += "✅ Code changes committed\n";
                                        workflowProgress += "⬜ Create pull request\n";
                                    }
                                    else if (workflowState.currentPhase === 'pr_created') {
                                        workflowProgress += "✅ Repository info obtained\n";
                                        workflowProgress += "✅ Issue details retrieved\n";
                                        workflowProgress += "✅ Branch created\n";
                                        workflowProgress += "✅ Code changes committed\n";
                                        workflowProgress += "✅ Pull request created\n";
                                        workflowProgress += "\n🎉 *Workflow complete!* The implementation is ready for review.";
                                    }
                                }
                            }
                            
                            fullResponse += separator + functionResults + workflowProgress;
                        } else {
                            console.log(`Agent ${agent.name} did not call any functions`);
                        }
                        
                        slackMessage = {
                            channel: message.channel,
                            text: fullResponse,
                            thread_ts: message.replyToMessageId
                        };
                        return [4 /*yield*/, this.slackService.sendMessage(slackMessage)];
                    case 2:
                        _b.sent();
                        // Update conversation history
                        this.updateConversationHistory(conversationId, message.content, fullResponse);
                        return [3 /*break*/, 5];
                    case 3:
                        error_2 = _b.sent();
                        console.error("Error processing request for agent ".concat(agent.name, ":"), error_2);
                        EventBus_1.eventBus.emit(EventBus_1.EventType.ERROR, {
                            source: 'AgentOrchestrator',
                            error: error_2,
                            message: "Failed to process request for agent ".concat(agent.name)
                        });
                        errorMessage = {
                            channel: message.channel,
                            text: "I encountered an error processing your request: ".concat(error_2.message),
                            thread_ts: message.replyToMessageId
                        };
                        return [4 /*yield*/, this.slackService.sendMessage(errorMessage)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AgentOrchestrator.prototype.getAgentById = function (id) {
        return this.agents[id];
    };
    AgentOrchestrator.prototype.getConversationId = function (channel, threadTs) {
        return "".concat(channel, ":").concat(threadTs || 'main');
    };
    AgentOrchestrator.prototype.getConversationHistory = function (conversationId) {
        if (!this.conversations[conversationId]) {
            this.conversations[conversationId] = [];
        }
        return this.conversations[conversationId];
    };
    AgentOrchestrator.prototype.updateConversationHistory = function (conversationId, userMessage, assistantMessage) {
        if (!this.conversations[conversationId]) {
            this.conversations[conversationId] = [];
        }
        this.conversations[conversationId].push({ role: 'user', content: userMessage }, { role: 'assistant', content: assistantMessage });
        // Limit conversation history (last 10 messages)
        if (this.conversations[conversationId].length > 10) {
            this.conversations[conversationId] = this.conversations[conversationId].slice(-10);
        }
    };
    // Track workflow state to maintain context between different agent interactions
    AgentOrchestrator.prototype.trackWorkflowState = function (conversationId, agent, message, functionCalls) {
        if (!this.conversationStates[conversationId]) {
            this.conversationStates[conversationId] = {
                currentPhase: 'initial',
                issueNumber: null,
                prNumber: null,
                lastAgent: null,
                taskDescription: null
            };
        }
        
        const state = this.conversationStates[conversationId];
        state.lastAgent = agent.role;
        
        // Extract issue numbers and PR numbers from function calls
        if (functionCalls && functionCalls.length > 0) {
            functionCalls.forEach(call => {
                if (call.name === 'createIssue' && call.result && call.result.success && call.result.issue_number) {
                    state.issueNumber = call.result.issue_number;
                    state.currentPhase = 'issue_created';
                    state.taskDescription = call.arguments.title;
                    console.log(`Workflow state updated: Issue #${state.issueNumber} created`);
                    
                    // Set the issue number in the GitHubFunctions workflow state
                    (0, GitHubFunctions_1.setCurrentIssueNumber)(state.issueNumber);
                }
                else if (call.name === 'getIssue' && call.result && call.result.success && call.result.number) {
                    state.issueNumber = call.result.number;
                    state.currentPhase = 'issue_retrieved';
                    state.taskDescription = call.result.title;
                    console.log(`Workflow state updated: Issue #${state.issueNumber} retrieved`);
                    
                    // Set the issue number in the GitHubFunctions workflow state
                    (0, GitHubFunctions_1.setCurrentIssueNumber)(state.issueNumber);
                }
                else if (call.name === 'createBranch' && call.result && call.result.success) {
                    state.currentPhase = 'branch_created';
                    console.log(`Workflow state updated: Branch ${call.arguments.name} created`);
                }
                else if (call.name === 'createCommit' && call.result && call.result.success) {
                    state.currentPhase = 'commit_created';
                    console.log(`Workflow state updated: Commit created on branch ${call.arguments.branch}`);
                }
                else if (call.name === 'createPullRequest' && call.result && call.result.success && call.result.pr_number) {
                    state.prNumber = call.result.pr_number;
                    state.currentPhase = 'pr_created';
                    console.log(`Workflow state updated: PR #${state.prNumber} created`);
                }
                else if (call.name === 'createReview' && call.result && call.result.success) {
                    if (call.arguments.event === 'APPROVE') {
                        state.currentPhase = 'pr_approved';
                        console.log(`Workflow state updated: PR #${state.prNumber} approved`);
                    } else if (call.arguments.event === 'REQUEST_CHANGES') {
                        state.currentPhase = 'changes_requested';
                        console.log(`Workflow state updated: Changes requested for PR #${state.prNumber}`);
                    }
                }
            });
        }
        
        // Also try to extract issue/PR numbers from the message content
        const issueMatch = message.content.match(/#(\d+)/);
        if (issueMatch && !state.issueNumber && /issue|task/i.test(message.content)) {
            state.issueNumber = parseInt(issueMatch[1]);
            console.log(`Extracted issue #${state.issueNumber} from message content`);
            
            // Set the extracted issue number in the GitHubFunctions workflow state
            (0, GitHubFunctions_1.setCurrentIssueNumber)(state.issueNumber);
        }
        
        const prMatch = message.content.match(/PR\s*#?(\d+)|pull\s*request\s*#?(\d+)/i);
        if (prMatch && !state.prNumber) {
            state.prNumber = parseInt(prMatch[1] || prMatch[2]);
            console.log(`Extracted PR #${state.prNumber} from message content`);
        }
        
        return state;
    };
    return AgentOrchestrator;
}());
exports.AgentOrchestrator = AgentOrchestrator;
