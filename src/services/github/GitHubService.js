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
exports.GitHubService = void 0;
var rest_1 = require("@octokit/rest");
var config_1 = require("@/config/config");
var GitHubService = /** @class */ (function () {
    function GitHubService(token, defaultRepo) {
        this.octokit = new rest_1.Octokit({
            auth: token || config_1.config.github.token
        });
        if (defaultRepo) {
            this.defaultRepo = defaultRepo;
        }
        else {
            var repoPath = config_1.config.github.repository || '';
            repoPath = repoPath.replace(/\.git$/, '');
            var _a = repoPath.split('/'), owner = _a[0], repo = _a[1];
            this.defaultRepo = { owner: owner, repo: repo };
        }
    }
    // Issues
    GitHubService.prototype.createIssue = function (issue, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.issues.create({
                                owner: owner,
                                repo: repo,
                                title: issue.title,
                                body: issue.body,
                                assignees: issue.assignees,
                                labels: issue.labels,
                                milestone: issue.milestone
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_1 = _b.sent();
                        console.error('Error creating issue:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GitHubService.prototype.listIssues = function (options, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, state, per_page, response, error_list;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        state = (options && options.state) || 'open';
                        per_page = (options && options.per_page) || 10;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.issues.listForRepo({
                                owner: owner,
                                repo: repo,
                                state: state,
                                per_page: per_page
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_list = _b.sent();
                        console.error('Error listing issues:', error_list);
                        throw error_list;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GitHubService.prototype.getIssue = function (issueNumber, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.issues.get({
                                owner: owner,
                                repo: repo,
                                issue_number: issueNumber
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_2 = _b.sent();
                        console.error("Error getting issue #".concat(issueNumber, ":"), error_2);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Pull Requests
    GitHubService.prototype.createPullRequest = function (pr, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.pulls.create({
                                owner: owner,
                                repo: repo,
                                title: pr.title,
                                body: pr.body,
                                head: pr.head,
                                base: pr.base,
                                draft: pr.draft,
                                maintainer_can_modify: pr.maintainer_can_modify
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_3 = _b.sent();
                        console.error('Error creating pull request:', error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GitHubService.prototype.getPullRequest = function (prNumber, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.pulls.get({
                                owner: owner,
                                repo: repo,
                                pull_number: prNumber
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_4 = _b.sent();
                        console.error("Error getting PR #".concat(prNumber, ":"), error_4);
                        throw error_4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GitHubService.prototype.createReview = function (prNumber, review, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.pulls.createReview({
                                owner: owner,
                                repo: repo,
                                pull_number: prNumber,
                                body: review.body,
                                event: review.event,
                                comments: review.comments
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_5 = _b.sent();
                        console.error("Error creating review for PR #".concat(prNumber, ":"), error_5);
                        throw error_5;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Commits
    GitHubService.prototype.createCommit = function (commit, repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, branch, refResponse, latestCommitSha, commitResponse, treeSha, newTreeItems, newTreeResponse, newCommitResponse, error_6, error_7;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        branch = commit.branch || 'main';
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 13, , 14]);
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 9, , 12]);
                        return [4 /*yield*/, this.octokit.git.getRef({
                                owner: owner,
                                repo: repo,
                                ref: "heads/".concat(branch)
                            })];
                    case 3:
                        refResponse = _b.sent();
                        latestCommitSha = refResponse.data.object.sha;
                        return [4 /*yield*/, this.octokit.git.getCommit({
                                owner: owner,
                                repo: repo,
                                commit_sha: latestCommitSha
                            })];
                    case 4:
                        commitResponse = _b.sent();
                        treeSha = commitResponse.data.tree.sha;
                        return [4 /*yield*/, Promise.all(commit.files.map(function (file) { return __awaiter(_this, void 0, void 0, function () {
                                var blobResponse;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.octokit.git.createBlob({
                                                owner: owner,
                                                repo: repo,
                                                content: file.content,
                                                encoding: 'utf-8'
                                            })];
                                        case 1:
                                            blobResponse = _a.sent();
                                            return [2 /*return*/, {
                                                    path: file.path,
                                                    mode: '100644', // Standard file mode
                                                    type: 'blob',
                                                    sha: blobResponse.data.sha
                                                }];
                                    }
                                });
                            }); }))];
                    case 5:
                        newTreeItems = _b.sent();
                        return [4 /*yield*/, this.octokit.git.createTree({
                                owner: owner,
                                repo: repo,
                                base_tree: treeSha,
                                tree: newTreeItems
                            })];
                    case 6:
                        newTreeResponse = _b.sent();
                        return [4 /*yield*/, this.octokit.git.createCommit({
                                owner: owner,
                                repo: repo,
                                message: commit.message,
                                tree: newTreeResponse.data.sha,
                                parents: [latestCommitSha]
                            })];
                    case 7:
                        newCommitResponse = _b.sent();
                        // Update the reference to point to the new commit
                        return [4 /*yield*/, this.octokit.git.updateRef({
                                owner: owner,
                                repo: repo,
                                ref: "heads/".concat(branch),
                                sha: newCommitResponse.data.sha
                            })];
                    case 8:
                        // Update the reference to point to the new commit
                        _b.sent();
                        return [2 /*return*/, newCommitResponse.data];
                    case 9:
                        error_6 = _b.sent();
                        // Check if the error is because the repository is empty
                        if (error_6.message && error_6.message.includes('Git Repository is empty')) {
                            console.log("Repository ".concat(owner, "/").concat(repo, " is empty. Initializing with README..."));
                            return [4 /*yield*/, this.initializeEmptyRepository(repository)];
                        }
                        else {
                            // If it's a different error, rethrow it
                            throw error_6;
                        }
                        return [4 /*yield*/, this.createCommit(commit, repository)];
                    case 10:
                        // Retry the commit after initialization
                        return [2 /*return*/, _b.sent()];
                    case 11: return [3 /*break*/, 12];
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_7 = _b.sent();
                        console.error('Error creating commit:', error_7);
                        throw error_7;
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    // New method to initialize an empty repository
    GitHubService.prototype.initializeEmptyRepository = function (repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, content, contentEncoded, response, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        console.log("Initializing empty repository: ".concat(owner, "/").concat(repo));
                        content = "# ".concat(repo, "\n      \nThis is a repository for the SwarmWeaver project.\n\n## About\n\nThis repository was automatically initialized by the SwarmWeaver system.\n");
                        contentEncoded = Buffer.from(content).toString('base64');
                        return [4 /*yield*/, this.octokit.repos.createOrUpdateFileContents({
                                owner: owner,
                                repo: repo,
                                path: 'README.md',
                                message: 'Initial commit: Add README',
                                content: contentEncoded,
                                branch: 'main'
                            })];
                    case 2:
                        response = _b.sent();
                        console.log("Repository ".concat(owner, "/").concat(repo, " initialized successfully!"));
                        return [2 /*return*/, response.data];
                    case 3:
                        error_8 = _b.sent();
                        console.error("Error initializing repository ".concat(owner, "/").concat(repo, ":"), error_8);
                        throw error_8;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Repositories
    GitHubService.prototype.getRepository = function (repository) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, response, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.octokit.repos.get({
                                owner: owner,
                                repo: repo
                            })];
                    case 2:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 3:
                        error_7 = _b.sent();
                        console.error("Error getting repository ".concat(owner, "/").concat(repo, ":"), error_7);
                        throw error_7;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // Branches
    GitHubService.prototype.createBranch = function (branchName, sourceBranch, repository) {
        if (sourceBranch === void 0) { sourceBranch = 'main'; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, owner, repo, sourceRef, sourceSha, response, error_branch;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = repository || this.defaultRepo, owner = _a.owner, repo = _a.repo;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        console.log("Creating branch ".concat(branchName, " from ").concat(sourceBranch, " in ").concat(owner, "/").concat(repo));
                        return [4 /*yield*/, this.octokit.git.getRef({
                                owner: owner,
                                repo: repo,
                                ref: "heads/".concat(sourceBranch)
                            })];
                    case 2:
                        sourceRef = _b.sent();
                        sourceSha = sourceRef.data.object.sha;
                        return [4 /*yield*/, this.octokit.git.createRef({
                                owner: owner,
                                repo: repo,
                                ref: "refs/heads/".concat(branchName),
                                sha: sourceSha
                            })];
                    case 3:
                        response = _b.sent();
                        console.log("Branch ".concat(branchName, " created successfully in ").concat(owner, "/").concat(repo));
                        return [2 /*return*/, response.data];
                    case 4:
                        error_branch = _b.sent();
                        // If the error is because the branch already exists, that's okay
                        if (error_branch.message && error_branch.message.includes('already exists')) {
                            console.log("Branch ".concat(branchName, " already exists in ").concat(owner, "/").concat(repo));
                            // Return the existing branch
                            return [2 /*return*/, this.octokit.git.getRef({
                                owner: owner,
                                repo: repo,
                                ref: "heads/".concat(branchName)
                            }).then(function (response) { return response.data; })];
                        }
                        // Try initializing the repository if it's empty
                        else if (error_branch.message && (error_branch.message.includes('Git Repository is empty') || error_branch.message.includes('Not Found'))) {
                            console.log("Repository ".concat(owner, "/").concat(repo, " might be empty. Attempting to initialize..."));
                            return [2 /*return*/, this.initializeEmptyRepository(repository)
                                .then(() => {
                                    console.log("Repository initialized. Retrying branch creation.");
                                    return this.createBranch(branchName, 'main', repository);
                                })
                                .catch(initError => {
                                    console.error("Error initializing repository:", initError);
                                    throw initError;
                                })];
                        }
                        else {
                            console.error("Error creating branch ".concat(branchName, " in ").concat(owner, "/").concat(repo, ":"), error_branch);
                            throw error_branch;
                        }
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return GitHubService;
}());
exports.GitHubService = GitHubService;
