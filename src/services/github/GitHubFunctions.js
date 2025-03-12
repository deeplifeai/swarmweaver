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
exports.githubFunctionDefinitions = exports.githubFunctions = exports.debugFunction = exports.listIssuesFunction = exports.getIssueFunction = exports.createBranchFunction = exports.getRepositoryInfoFunction = exports.createReviewFunction = exports.createCommitFunction = exports.createPullRequestFunction = exports.createIssueFunction = void 0;
var GitHubService_1 = require("./GitHubService");
// Initialize the GitHub service
var githubService = new GitHubService_1.GitHubService();
// Create Issue Function
exports.createIssueFunction = {
    name: 'createIssue',
    description: 'Creates a new issue in the GitHub repository',
    parameters: {
        title: { type: 'string', description: 'The title of the issue' },
        body: { type: 'string', description: 'The detailed description of the issue' },
        assignees: { 
            type: 'array', 
            description: 'Optional list of GitHub usernames to assign to the issue',
            items: { type: 'string' } 
        },
        labels: { 
            type: 'array', 
            description: 'Optional list of labels to apply to the issue',
            items: { type: 'string' } 
        }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    // Filter out agent role names from assignees that might not be valid GitHub usernames
                    // This includes common role names used within SwarmWeaver
                    var assignees = params.assignees;
                    var agentRoleNames = ['Developer', 'ProjectManager', 'CodeReviewer', 'QATester', 'TechnicalWriter'];
                    
                    // If all assignees are agent role names, set to undefined to avoid GitHub API validation errors
                    if (assignees && assignees.length > 0) {
                        var validAssignees = assignees.filter(function(name) {
                            return !agentRoleNames.includes(name);
                        });
                        
                        // If we've filtered out all assignees, set to undefined
                        assignees = validAssignees.length > 0 ? validAssignees : undefined;
                    }
                    
                    return [4 /*yield*/, githubService.createIssue({
                            title: params.title,
                            body: params.body,
                            assignees: assignees,
                            labels: params.labels
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            issue_number: result.number,
                            url: result.html_url,
                            message: "Issue #".concat(result.number, " created successfully")
                        }];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error creating issue:', error_1);
                    return [2 /*return*/, {
                            success: false,
                            error: error_1.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Create Pull Request Function
exports.createPullRequestFunction = {
    name: 'createPullRequest',
    description: 'Creates a new pull request in the GitHub repository',
    parameters: {
        title: { type: 'string', description: 'The title of the pull request' },
        body: { type: 'string', description: 'The detailed description of the pull request' },
        head: { type: 'string', description: 'The name of the branch where your changes are implemented' },
        base: { type: 'string', description: 'The name of the branch you want the changes pulled into' },
        draft: { type: 'boolean', description: 'Optional flag to indicate if the pull request is a draft' }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, githubService.createPullRequest({
                            title: params.title,
                            body: params.body,
                            head: params.head,
                            base: params.base,
                            draft: params.draft
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            pr_number: result.number,
                            url: result.html_url,
                            message: "Pull request #".concat(result.number, " created successfully")
                        }];
                case 2:
                    error_2 = _a.sent();
                    console.error('Error creating pull request:', error_2);
                    return [2 /*return*/, {
                            success: false,
                            error: error_2.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Create Commit Function
exports.createCommitFunction = {
    name: 'createCommit',
    description: 'Creates a new commit with one or more file changes in the GitHub repository',
    parameters: {
        message: { type: 'string', description: 'The commit message' },
        files: {
            type: 'array',
            description: 'Array of file objects with path and content properties to be committed',
            items: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The file path relative to the repository root' },
                    content: { type: 'string', description: 'The file content to commit' }
                },
                required: ['path', 'content']
            }
        },
        branch: { type: 'string', description: 'Optional branch name to commit to (defaults to main)' }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("Agent ".concat(agentId, " is creating a commit with message: ").concat(params.message));
                    return [4 /*yield*/, githubService.createCommit({
                            message: params.message,
                            files: params.files.map(function (file) { return ({
                                path: file.path,
                                content: file.content
                            }); }),
                            branch: params.branch
                        })];
                case 1:
                    result = _a.sent();
                    console.log("Commit created successfully: ".concat(result.sha.substring(0, 7)));
                    return [2 /*return*/, {
                            success: true,
                            commit_sha: result.sha,
                            message: "Commit ".concat(result.sha.substring(0, 7), " created successfully")
                        }];
                case 2:
                    error_3 = _a.sent();
                    console.error('Error creating commit:', error_3);
                    // Check if the error message indicates an empty repository
                    if (error_3.message && error_3.message.includes('Git Repository is empty')) {
                        console.log('Repository is empty. This should be handled automatically by GitHubService.');
                    }
                    return [2 /*return*/, {
                            success: false,
                            error: error_3.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Create Review Function
exports.createReviewFunction = {
    name: 'createReview',
    description: 'Creates a review on a pull request in the GitHub repository',
    parameters: {
        pull_number: { type: 'number', description: 'The number of the pull request to review' },
        body: { type: 'string', description: 'The body text of the review' },
        event: {
            type: 'string',
            description: 'The review action to perform: APPROVE, REQUEST_CHANGES, or COMMENT',
            enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT']
        },
        comments: {
            type: 'array',
            description: 'Optional array of comments to make on the pull request',
            items: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'The relative file path to comment on' },
                    position: { type: 'number', description: 'The line position in the file to comment on' },
                    body: { type: 'string', description: 'The text of the comment' }
                },
                required: ['path', 'position', 'body']
            }
        }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, githubService.createReview(params.pull_number, {
                            body: params.body,
                            event: params.event,
                            comments: params.comments
                        })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            review_id: result.id,
                            message: "Review created successfully with status: ".concat(params.event)
                        }];
                case 2:
                    error_4 = _a.sent();
                    console.error('Error creating review:', error_4);
                    return [2 /*return*/, {
                            success: false,
                            error: error_4.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Get Repository Info Function
exports.getRepositoryInfoFunction = {
    name: 'getRepositoryInfo',
    description: 'Gets information about the GitHub repository',
    parameters: {},
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, githubService.getRepository()];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            repository: {
                                name: result.name,
                                full_name: result.full_name,
                                description: result.description,
                                url: result.html_url,
                                default_branch: result.default_branch,
                                open_issues_count: result.open_issues_count,
                                forks_count: result.forks_count,
                                stars_count: result.stargazers_count,
                                created_at: result.created_at,
                                updated_at: result.updated_at
                            }
                        }];
                case 2:
                    error_5 = _a.sent();
                    console.error('Error getting repository info:', error_5);
                    return [2 /*return*/, {
                            success: false,
                            error: error_5.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Create Branch Function
exports.createBranchFunction = {
    name: 'createBranch',
    description: 'Creates a new branch in the GitHub repository',
    parameters: {
        name: { type: 'string', description: 'The name of the new branch' },
        source: { type: 'string', description: 'Optional source branch to create from (defaults to main)' }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    console.log("Agent ".concat(agentId, " is creating branch: ").concat(params.name));
                    return [4 /*yield*/, githubService.createBranch(
                        params.name,
                        params.source || 'main'
                    )];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            ref: result.ref,
                            sha: result.object.sha,
                            message: "Branch ".concat(params.name, " created successfully")
                        }];
                case 2:
                    error_1 = _a.sent();
                    console.error('Error creating branch:', error_1);
                    return [2 /*return*/, {
                            success: false,
                            error: error_1.message
                        }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Get Issue Function
exports.getIssueFunction = {
    name: 'getIssue',
    description: 'Gets information about a specific GitHub issue by number',
    parameters: {
        number: { type: 'number', description: 'The issue number to retrieve' }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var result, issuesList, validIssues, issueListStr, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 4]);
                    console.log("Agent ".concat(agentId, " is retrieving issue #").concat(params.number));
                    
                    // Validate issue number
                    if (!params.number || isNaN(params.number) || params.number < 1) {
                        return [2 /*return*/, {
                            success: false,
                            error: "Invalid issue number: " + params.number + ". Issue numbers must be positive integers.",
                            workflow_hint: "You must first call getRepositoryInfo() before getting issue details."
                        }];
                    }
                    
                    return [4 /*yield*/, githubService.getIssue(params.number)];
                case 1:
                    result = _a.sent();
                    console.log("Successfully retrieved issue #".concat(params.number, ": ").concat(result.title));
                    return [2 /*return*/, {
                            success: true,
                            number: result.number,
                            title: result.title,
                            body: result.body,
                            html_url: result.html_url,
                            state: result.state,
                            assignees: result.assignees,
                            labels: result.labels,
                            workflow_hint: "Next step: Create a branch using createBranch({name: \"feature-issue-".concat(result.number, "\"})")
                        }];
                case 2:
                    error_2 = _a.sent();
                    console.error("Error getting issue #".concat(params.number, ":"), error_2);
                    // Try to list available issues to help the agent
                    return [4 /*yield*/, githubService.listIssues({ state: 'all', per_page: 5 })
                        .then(function(issues) {
                            validIssues = issues.map(function(issue) {
                                return "#" + issue.number + ": " + issue.title;
                            });
                            issueListStr = validIssues.length > 0 
                                ? "Available issues: " + validIssues.join(", ")
                                : "No issues found in this repository.";
                            return issueListStr;
                        })
                        .catch(function(err) {
                            return "Unable to list available issues: " + err.message;
                        })];
                case 3:
                    issuesList = _a.sent();
                    return [2 /*return*/, {
                            success: false,
                            error: error_2.message,
                            available_issues: issuesList,
                            workflow_hint: "First make sure the issue exists. Try using listIssues() to see available issues. Remember to follow the exact workflow: 1) getRepositoryInfo, 2) getIssue, 3) createBranch, 4) createCommit, 5) createPullRequest"
                        }];
                case 4: return [2 /*return*/];
            }
        });
    }); }
};
// List Issues Function
exports.listIssuesFunction = {
    name: 'listIssues',
    description: 'Lists open issues in the GitHub repository',
    parameters: {
        state: { 
            type: 'string', 
            description: 'The state of issues to list: open, closed, or all', 
            enum: ['open', 'closed', 'all'],
            default: 'open'
        },
        limit: { 
            type: 'number', 
            description: 'Maximum number of issues to return', 
            default: 10 
        }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        var state, limit, result, issues, error_list;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    state = params.state || 'open';
                    limit = params.limit || 10;
                    console.log("Agent ".concat(agentId, " is listing ").concat(state, " issues (max: ").concat(limit, ")"));
                    return [4 /*yield*/, githubService.listIssues({ 
                        state: state,
                        per_page: limit
                    })];
                case 1:
                    result = _a.sent();
                    issues = result.map(function (issue) { return ({
                        number: issue.number,
                        title: issue.title,
                        state: issue.state,
                        created_at: issue.created_at,
                        html_url: issue.html_url
                    }); });
                    return [2 /*return*/, {
                        success: true,
                        total_count: issues.length,
                        issues: issues,
                        message: "Found ".concat(issues.length, " ").concat(state, " issues")
                    }];
                case 2:
                    error_list = _a.sent();
                    console.error("Error listing issues:", error_list);
                    return [2 /*return*/, {
                        success: false,
                        error: error_list.message
                    }];
                case 3: return [2 /*return*/];
            }
        });
    }); }
};
// Debug function to help diagnose function call issues
exports.debugFunction = {
    name: 'debug',
    description: 'Provides debugging information about the current workflow state',
    parameters: {
        message: { type: 'string', description: 'Optional debug message' }
    },
    handler: function (params, agentId) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            console.log("Debug function called by agent ".concat(agentId, ": ").concat(params.message || 'No message provided'));
            
            return [2 /*return*/, {
                success: true,
                message: params.message || 'Debug function called',
                workflow_reminder: 'Remember to follow the exact workflow: 1) getRepositoryInfo, 2) getIssue, 3) createBranch, 4) createCommit, 5) createPullRequest',
                timestamp: new Date().toISOString()
            }];
        });
    }); }
};
// Export all GitHub functions
exports.githubFunctions = [
    exports.createIssueFunction,
    exports.createPullRequestFunction,
    exports.createCommitFunction,
    exports.createReviewFunction,
    exports.getRepositoryInfoFunction,
    exports.createBranchFunction,
    exports.getIssueFunction,
    exports.listIssuesFunction
];
// Add debug function to the exported functions
exports.githubFunctions.push(exports.debugFunction);
// Make sure all elements in the array are defined
exports.githubFunctions = exports.githubFunctions.filter(function(func) {
    return func !== undefined && func !== null;
});
// Export function definitions for OpenAI
exports.githubFunctionDefinitions = exports.githubFunctions.map(function (func) { 
    // Make sure func is defined before accessing its properties
    if (!func) {
        console.error("Undefined function found in githubFunctions array");
        return {
            name: "undefined_function",
            description: "Error: This function was undefined",
            parameters: { type: 'object', properties: {} }
        };
    }
    
    return {
        name: func.name,
        description: func.description,
        parameters: {
            type: 'object',
            properties: func.parameters || {},
            required: func.parameters ? Object.keys(func.parameters).filter(function (key) {
                return !['draft', 'assignees', 'labels', 'branch', 'comments', 'source', 'state', 'limit', 'message'].includes(key);
            }) : []
        }
    };
});

// Define the workflow state at the top of the file
var workflowState = {
  repositoryInfo: null,
  getRepositoryInfoCalled: false,
  currentIssueNumber: null,
  currentBranch: null,
  autoProgressWorkflow: true
};

// Define these functions before they're used in exports
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

// PATCHED EXPORTS - Added for CommonJS compatibility
exports.setCurrentIssueNumber = setCurrentIssueNumber;
exports.setIssueNumber = setIssueNumber;
exports.resetWorkflowState = resetWorkflowState;
