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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
var openai_1 = __importDefault(require("openai"));
var config_1 = require("@/config/config");
var AIService = /** @class */ (function () {
    function AIService() {
        this.functionRegistry = {};
        this.openai = new openai_1.default({
            apiKey: config_1.config.openai.apiKey
        });
    }
    AIService.prototype.registerFunction = function (func) {
        this.functionRegistry[func.name] = func;
    };
    AIService.prototype.generateAgentResponse = function (agent_1, userMessage_1) {
        return __awaiter(this, arguments, void 0, function (agent, userMessage, conversationHistory, workflowState) {
            var systemMessageContent, systemMessage, userOpenAIMessage, messages, tools, response, responseMessage, functionCalls, error_1;
            var _this = this;
            if (conversationHistory === void 0) { conversationHistory = []; }
            if (workflowState === void 0) { workflowState = null; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        
                        // Build enhanced system message with workflow context if available
                        systemMessageContent = agent.systemPrompt;
                        
                        // Add workflow context if available
                        if (workflowState) {
                            let workflowContext = "\n\nCurrent workflow context:";
                            
                            if (workflowState.issueNumber) {
                                workflowContext += `\n- Working on issue #${workflowState.issueNumber}`;
                                if (workflowState.taskDescription) {
                                    workflowContext += `: ${workflowState.taskDescription}`;
                                }
                            }
                            
                            // Add workflow phase information
                            if (workflowState.currentPhase === 'issue_retrieved') {
                                workflowContext += `\n- Issue details have been successfully retrieved`;
                                workflowContext += `\n- Next steps: Create a branch, then commit code, then create a PR`;
                            }
                            else if (workflowState.currentPhase === 'branch_created') {
                                workflowContext += `\n- A branch has been created for this task`;
                                workflowContext += `\n- Next steps: Commit code changes, then create a PR`;
                            }
                            else if (workflowState.currentPhase === 'commit_created') {
                                workflowContext += `\n- Code changes have been committed`;
                                workflowContext += `\n- Next step: Create a PR to merge these changes`;
                            }
                            
                            if (workflowState.prNumber) {
                                workflowContext += `\n- Pull request #${workflowState.prNumber} has been created`;
                                
                                if (workflowState.currentPhase === 'changes_requested') {
                                    workflowContext += `\n- Changes have been requested on PR #${workflowState.prNumber}`;
                                } else if (workflowState.currentPhase === 'pr_approved') {
                                    workflowContext += `\n- PR #${workflowState.prNumber} has been approved`;
                                }
                            }
                            
                            if (workflowState.lastAgent && workflowState.lastAgent !== agent.role) {
                                workflowContext += `\n- Last interaction was with the ${workflowState.lastAgent} agent`;
                            }
                            
                            systemMessageContent += workflowContext;
                        }
                        
                        systemMessage = {
                            role: 'system',
                            content: systemMessageContent
                        };
                        
                        userOpenAIMessage = {
                            role: 'user',
                            content: userMessage
                        };
                        messages = __spreadArray(__spreadArray([
                            systemMessage
                        ], conversationHistory, true), [
                            userOpenAIMessage
                        ], false);
                        tools = agent.functions.map(function (func) { return ({
                            type: 'function',
                            function: func
                        }); });
                        return [4 /*yield*/, this.openai.chat.completions.create({
                                model: config_1.config.openai.model,
                                messages: messages,
                                tools: tools.length > 0 ? tools : undefined,
                                tool_choice: tools.length > 0 ? 'auto' : undefined
                            })];
                    case 1:
                        response = _a.sent();
                        responseMessage = response.choices[0].message;
                        functionCalls = [];
                        if (!(responseMessage.tool_calls && responseMessage.tool_calls.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, Promise.all(responseMessage.tool_calls.map(function (toolCall) { return __awaiter(_this, void 0, void 0, function () {
                                var functionName, functionArgs, result;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!(toolCall.type === 'function')) return [3 /*break*/, 2];
                                            functionName = toolCall.function.name;
                                            functionArgs = JSON.parse(toolCall.function.arguments);
                                            if (!this.functionRegistry[functionName]) return [3 /*break*/, 2];
                                            return [4 /*yield*/, this.functionRegistry[functionName].handler(functionArgs, agent.id)];
                                        case 1:
                                            result = _a.sent();
                                            return [2 /*return*/, {
                                                    name: functionName,
                                                    arguments: functionArgs,
                                                    result: result
                                                }];
                                        case 2: return [2 /*return*/, null];
                                    }
                                });
                            }); }))];
                    case 2:
                        functionCalls = _a.sent();
                        // Filter out null results
                        functionCalls = functionCalls.filter(function (call) { return call !== null; });
                        _a.label = 3;
                    case 3: return [2 /*return*/, {
                            response: responseMessage.content || '',
                            functionCalls: functionCalls
                        }];
                    case 4:
                        error_1 = _a.sent();
                        console.error('Error generating agent response:', error_1);
                        throw error_1;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    AIService.prototype.extractFunctionResults = function (functionCalls) {
        return functionCalls
            .map(function (call) {
                // Check for errors first to handle them consistently across all functions
                if (call.result && !call.result.success) {
                    // Format error messages in a user-friendly way
                    var errorMessage = call.result.error || 'Unknown error';
                    
                    // Clean up error messages from GitHub API
                    if (errorMessage.includes('https://docs.github.com')) {
                        errorMessage = errorMessage.split(' - ')[0];
                    }
                    
                    return "\u274C Function `".concat(call.name, "` failed: ").concat(errorMessage, "\n\n\u26A0\uFE0F Remember to follow the exact workflow steps: 1) getRepositoryInfo, 2) getIssue, 3) createBranch, 4) createCommit, 5) createPullRequest");
                }
                
                // Format GitHub function results in a user-friendly way
                if (call.name === 'createIssue' && call.result.success) {
                    return "\u2705 Created GitHub issue #".concat(call.result.issue_number, ": \"").concat(call.arguments.title, "\"\n\uD83D\uDCCE ").concat(call.result.url);
                }
                else if (call.name === 'getIssue' && call.result.success) {
                    return "\uD83D\uDCCB GitHub issue #".concat(call.result.number, ": \"").concat(call.result.title, "\"\n\n").concat(call.result.body, "\n\n\uD83D\uDCCE ").concat(call.result.html_url, "\n\n\u2139\uFE0F Next step: Create a branch using createBranch({name: \"feature-issue-").concat(call.result.number, "\"})");
                }
                else if (call.name === 'getIssue' && !call.result.success) {
                    // Enhanced error handling for getIssue failures
                    let errorMessage = "\u274C Failed to retrieve issue #".concat(call.arguments.number, ": ").concat(call.result.error);
                    
                    // Add available issues if provided
                    if (call.result.available_issues) {
                        errorMessage += "\n\n\uD83D\uDCC4 " + call.result.available_issues;
                    }
                    
                    // Add workflow hint if available
                    if (call.result.workflow_hint) {
                        errorMessage += "\n\n\u2139\uFE0F " + call.result.workflow_hint;
                    }
                    
                    return errorMessage;
                }
                else if (call.name === 'listIssues' && call.result.success) {
                    let issuesOutput = "\uD83D\uDCC1 GitHub Issues (Total: ".concat(call.result.total_count, "):\n");
                    
                    if (call.result.issues && call.result.issues.length > 0) {
                        call.result.issues.forEach(issue => {
                            issuesOutput += "\n• #".concat(issue.number, ": ").concat(issue.title);
                        });
                        issuesOutput += "\n\n\u2139\uFE0F Now you can get details of a specific issue using getIssue({number: N})";
                    } else {
                        issuesOutput += "\nNo issues found in the repository.";
                    }
                    
                    return issuesOutput;
                }
                else if (call.name === 'createPullRequest' && call.result.success) {
                    return "\u2705 Created GitHub pull request #".concat(call.result.pr_number, ": \"").concat(call.arguments.title, "\"\n\uD83D\uDCCE ").concat(call.result.url, "\n\n\uD83C\uDF89 Workflow complete! The implementation is ready for review.");
                }
                else if (call.name === 'createCommit' && call.result.success) {
                    // Check if branch was automatically created during commit
                    if (call.result.message && call.result.message.includes('Branch') && call.result.message.includes('was created')) {
                        var branchName = call.arguments.branch || 'main';
                        return "\uD83D\uDD04 Branch `".concat(branchName, "` was automatically created\n\u2705 Committed changes: \"").concat(call.arguments.message, "\"\n\n\u2139\uFE0F Next step: Create a pull request using createPullRequest()");
                    }
                    return "\u2705 Created GitHub commit ".concat(call.result.commit_sha.substring(0, 7), ": \"").concat(call.arguments.message, "\"\n\n\u2139\uFE0F Next step: Create a pull request using createPullRequest({title: \"...\", body: \"...\", head: \"").concat(call.arguments.branch, "\", base: \"main\"})");
                }
                else if (call.name === 'createBranch' && call.result.success) {
                    return "\u2705 Created GitHub branch `".concat(call.arguments.name, "` from `").concat(call.arguments.source || 'main', "`\n\n\u2139\uFE0F Next step: Make code changes and commit them using createCommit({message: \"...\", files: [...], branch: \"").concat(call.arguments.name, "\"})");
                }
                else if (call.name === 'createReview' && call.result.success) {
                    return "\u2705 Created GitHub review on PR #".concat(call.arguments.pull_number, " with status: ").concat(call.arguments.event);
                }
                else if (call.name === 'getRepositoryInfo' && call.result.success) {
                    var repo = call.result.repository;
                    return "\uD83D\uDCC1 GitHub repository info:\n\u2022 Name: ".concat(repo.full_name, "\n\u2022 Description: ").concat(repo.description || 'N/A', "\n\u2022 Default branch: ").concat(repo.default_branch, "\n\u2022 Open issues: ").concat(repo.open_issues_count, "\n\u2022 URL: ").concat(repo.url, "\n\n\u2139\uFE0F Next step: Get issue details using getIssue({number: <issue_number>})");
                }
                else if (call.name === 'debug' && call.result.success) {
                    return "\uD83D\uDCA1 Debug Info: ".concat(call.result.message, "\n\n\u2139\uFE0F Workflow Reminder: ").concat(call.result.workflow_reminder, "\n\uD83D\uDCC5 Timestamp: ").concat(call.result.timestamp);
                }
                // Success message for other functions
                else if (call.result.success) {
                    return "\u2705 Function `".concat(call.name, "` completed successfully");
                }
                // Default format - should rarely be used due to error and success handling above
                else {
                    return "Function `".concat(call.name, "` was called");
                }
            })
            .join('\n\n');
    };
    return AIService;
}());
exports.AIService = AIService;
