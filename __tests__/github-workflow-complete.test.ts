import { jest } from '@jest/globals';
import { developerAgent } from '@/agents/AgentDefinitions';
import { AgentOrchestrator } from '@/services/ai/AgentOrchestrator';
import { AIService } from '@/services/ai/AIService';
import { SlackService } from '@/services/slack/SlackService';
import { githubService } from '@/services/github/GitHubService';

// Mock all dependencies
jest.mock('@/services/github/GitHubService', () => ({
  githubService: {
    getRepository: jest.fn(),
    getIssue: jest.fn(),
    createIssue: jest.fn(),
    addCommentToIssue: jest.fn(),
    createBranch: jest.fn(),
    branchExists: jest.fn(),
    createCommit: jest.fn(),
    createPullRequest: jest.fn(),
    getPullRequest: jest.fn(),
    addReviewToPullRequest: jest.fn(),
    mergePullRequest: jest.fn(),
    closeIssue: jest.fn()
  }
}));

jest.mock('@/services/slack/SlackService');
jest.mock('@/services/ai/AIService');

// Create mock event bus
jest.mock('@/utils/EventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn()
  },
  EventType: {
    AGENT_MESSAGE: 'AGENT_MESSAGE',
    ERROR: 'ERROR'
  }
}));

describe('Complete GitHub Workflow Tests', () => {
  let mockSlackService: jest.Mocked<SlackService>;
  let mockAIService: jest.Mocked<AIService>;
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mocks
    mockSlackService = new SlackService() as any;
    mockSlackService.sendMessage = jest.fn().mockResolvedValue(true);

    mockAIService = new AIService() as any;
    mockAIService.generateAgentResponse = jest.fn();
    mockAIService.extractFunctionResults = jest.fn().mockReturnValue('Function results');

    // Set up the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(mockSlackService, mockAIService);
    
    // Register the developer agent
    (orchestrator as any).registerAgent(developerAgent);

    // Mock GitHub service functions
    (githubService.getRepository as jest.Mock).mockResolvedValue({
      name: 'test-repo',
      full_name: 'user/test-repo',
      description: 'Test repository',
      html_url: 'https://github.com/user/test-repo',
      default_branch: 'main',
      open_issues_count: 5,
      forks_count: 2,
      stargazers_count: 10,
      created_at: '2023-01-01',
      updated_at: '2023-05-01'
    });

    // Mock issue creation
    (githubService.createIssue as jest.Mock).mockResolvedValue({
      number: 42,
      title: 'New feature request',
      body: 'This is a test issue',
      html_url: 'https://github.com/user/test-repo/issues/42',
      state: 'open',
      assignees: [],
      labels: []
    });

    // Mock get issue
    (githubService.getIssue as jest.Mock).mockResolvedValue({
      number: 42,
      title: 'New feature request',
      body: 'This is a test issue',
      html_url: 'https://github.com/user/test-repo/issues/42',
      state: 'open',
      assignees: [],
      labels: []
    });

    // Mock issue comment
    (githubService.addCommentToIssue as jest.Mock).mockResolvedValue({
      id: 123,
      body: 'This is a test comment',
      html_url: 'https://github.com/user/test-repo/issues/42#issuecomment-123'
    });

    // Mock branch checks and creation
    (githubService.branchExists as jest.Mock).mockResolvedValue(false);
    (githubService.createBranch as jest.Mock).mockResolvedValue({
      ref: 'refs/heads/feature-42',
      object: { sha: 'test-sha' }
    });

    // Mock commit creation
    (githubService.createCommit as jest.Mock).mockResolvedValue({
      sha: 'commit-sha-123',
      html_url: 'https://github.com/user/test-repo/commit/commit-sha-123'
    });

    // Mock PR creation and retrieval
    (githubService.createPullRequest as jest.Mock).mockResolvedValue({
      number: 123,
      title: 'Implement new feature',
      body: 'Fixes #42',
      html_url: 'https://github.com/user/test-repo/pull/123',
      state: 'open'
    });
    
    (githubService.getPullRequest as jest.Mock).mockResolvedValue({
      number: 123,
      title: 'Implement new feature',
      body: 'Fixes #42',
      html_url: 'https://github.com/user/test-repo/pull/123',
      state: 'open'
    });

    // Mock PR review
    (githubService.addReviewToPullRequest as jest.Mock).mockResolvedValue({
      id: 456,
      body: 'LGTM! Approved.',
      state: 'APPROVED',
      html_url: 'https://github.com/user/test-repo/pull/123#pullrequestreview-456'
    });

    // Mock PR merge
    (githubService.mergePullRequest as jest.Mock).mockResolvedValue({
      merged: true,
      message: 'Pull request successfully merged',
      sha: 'merge-sha-789'
    });

    // Mock issue closing
    (githubService.closeIssue as jest.Mock).mockResolvedValue({
      number: 42,
      state: 'closed',
      title: 'New feature request',
      html_url: 'https://github.com/user/test-repo/issues/42'
    });
  });

  it('should complete a full GitHub workflow from issue creation to closing', async () => {
    // Use multiple messages to simulate the entire workflow
    
    // 1. First message: create an issue
    const createIssueMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please create a new issue for adding login functionality',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for issue creation
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will create a new issue for adding login functionality',
      functionCalls: [
        {
          name: 'getRepositoryInfo',
          args: {},
          result: {
            success: true,
            repository: {
              name: 'test-repo',
              full_name: 'user/test-repo',
              default_branch: 'main'
            }
          }
        },
        {
          name: 'createIssue',
          args: { 
            title: 'Add login functionality', 
            body: 'Implement user login/authentication system for the application' 
          },
          result: {
            success: true,
            number: 42,
            title: 'Add login functionality',
            body: 'Implement user login/authentication system for the application',
            html_url: 'https://github.com/user/test-repo/issues/42'
          }
        }
      ]
    });

    // Invoke the handler for issue creation
    await (orchestrator as any).handleMessage(createIssueMessage);

    // 2. Second message: comment on the issue
    const commentIssueMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please add a comment to issue #42 about using JWT for authentication',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for commenting
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will add a comment about JWT authentication to issue #42',
      functionCalls: [
        {
          name: 'getIssue',
          args: { number: 42 },
          result: {
            success: true,
            number: 42,
            title: 'Add login functionality',
            body: 'Implement user login/authentication system for the application'
          }
        },
        {
          name: 'addCommentToIssue',
          args: { 
            issueNumber: 42, 
            comment: 'We should use JWT for authentication as it provides stateless token-based security.'
          },
          result: {
            success: true,
            id: 123,
            body: 'We should use JWT for authentication as it provides stateless token-based security.',
            html_url: 'https://github.com/user/test-repo/issues/42#issuecomment-123'
          }
        }
      ]
    });

    // Invoke the handler for issue commenting
    await (orchestrator as any).handleMessage(commentIssueMessage);

    // 3. Third message: create a branch for the issue
    const createBranchMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please create a branch for issue #42',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for branch creation
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will create a branch for issue #42',
      functionCalls: [
        {
          name: 'getRepositoryInfo',
          args: {},
          result: {
            success: true,
            repository: {
              name: 'test-repo',
              full_name: 'user/test-repo',
              default_branch: 'main'
            }
          }
        },
        {
          name: 'branchExists',
          args: { name: 'feature/login-42' },
          result: {
            success: true,
            exists: false
          }
        },
        {
          name: 'createBranch',
          args: { name: 'feature/login-42', source: 'main' },
          result: {
            success: true,
            ref: 'refs/heads/feature/login-42',
            object: { sha: 'test-sha' }
          }
        }
      ]
    });

    // Invoke the handler for branch creation
    await (orchestrator as any).handleMessage(createBranchMessage);

    // 4. Fourth message: commit code to the branch
    const createCommitMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please commit login functionality code to the branch for issue #42',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for commit creation
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will commit login functionality code to the branch for issue #42',
      functionCalls: [
        {
          name: 'createCommit',
          args: {
            branch: 'feature/login-42',
            message: 'Add login functionality for issue #42',
            files: [
              { 
                path: 'src/services/auth/LoginService.ts', 
                content: 'export class LoginService {\n  login(username: string, password: string) {\n    // Implementation\n    return { success: true, token: "jwt-token" };\n  }\n}' 
              }
            ]
          },
          result: {
            success: true,
            sha: 'commit-sha-123',
            html_url: 'https://github.com/user/test-repo/commit/commit-sha-123'
          }
        }
      ]
    });

    // Invoke the handler for commit creation
    await (orchestrator as any).handleMessage(createCommitMessage);

    // 5. Fifth message: create a pull request
    const createPRMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please create a PR for the login functionality branch',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR creation
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will create a PR for the login functionality branch',
      functionCalls: [
        {
          name: 'createPullRequest',
          args: {
            title: 'Add login functionality',
            body: 'Implements user authentication with JWT as requested in issue #42',
            head: 'feature/login-42',
            base: 'main'
          },
          result: {
            success: true,
            number: 123,
            title: 'Add login functionality',
            body: 'Implements user authentication with JWT as requested in issue #42',
            html_url: 'https://github.com/user/test-repo/pull/123'
          }
        }
      ]
    });

    // Invoke the handler for PR creation
    await (orchestrator as any).handleMessage(createPRMessage);

    // 6. Sixth message: review the pull request
    const reviewPRMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please review and approve PR #123',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR review
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will review and approve PR #123',
      functionCalls: [
        {
          name: 'getPullRequest',
          args: { number: 123 },
          result: {
            success: true,
            number: 123,
            title: 'Add login functionality',
            body: 'Implements user authentication with JWT as requested in issue #42'
          }
        },
        {
          name: 'addReviewToPullRequest',
          args: {
            pullNumber: 123,
            event: 'APPROVE',
            body: 'Code looks good. Implementation matches the requirements in issue #42.'
          },
          result: {
            success: true,
            id: 456,
            body: 'Code looks good. Implementation matches the requirements in issue #42.',
            state: 'APPROVED'
          }
        }
      ]
    });

    // Invoke the handler for PR review
    await (orchestrator as any).handleMessage(reviewPRMessage);

    // 7. Seventh message: merge the pull request
    const mergePRMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please merge PR #123',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR merge
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will merge PR #123',
      functionCalls: [
        {
          name: 'mergePullRequest',
          args: { number: 123 },
          result: {
            success: true,
            merged: true,
            message: 'Pull request successfully merged'
          }
        }
      ]
    });

    // Invoke the handler for PR merge
    await (orchestrator as any).handleMessage(mergePRMessage);

    // 8. Eighth message: close the related issue
    const closeIssueMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please close issue #42 as it is now implemented',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for issue closing
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will close issue #42',
      functionCalls: [
        {
          name: 'closeIssue',
          args: { number: 42 },
          result: {
            success: true,
            number: 42,
            state: 'closed'
          }
        }
      ]
    });

    // Invoke the handler for issue closing
    await (orchestrator as any).handleMessage(closeIssueMessage);

    // Verify all steps were called
    expect(githubService.createIssue).toHaveBeenCalled();
    expect(githubService.getIssue).toHaveBeenCalled();
    expect(githubService.addCommentToIssue).toHaveBeenCalled();
    expect(githubService.branchExists).toHaveBeenCalled();
    expect(githubService.createBranch).toHaveBeenCalled();
    expect(githubService.createCommit).toHaveBeenCalled();
    expect(githubService.createPullRequest).toHaveBeenCalled();
    expect(githubService.getPullRequest).toHaveBeenCalled();
    expect(githubService.addReviewToPullRequest).toHaveBeenCalled();
    expect(githubService.mergePullRequest).toHaveBeenCalled();
    expect(githubService.closeIssue).toHaveBeenCalled();

    // Verify the success messages were sent to Slack
    expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(8);
  });

  it('should handle errors properly in the workflow', async () => {
    // Test with a failed branch creation
    const createBranchMessage = {
      channel: 'C123',
      content: 'Hey @Developer, please create a branch for issue #42',
      mentions: [developerAgent.id],
      replyToMessageId: 'T123'
    };

    // Simulate branch already exists error
    (githubService.branchExists as jest.Mock).mockResolvedValueOnce(true);

    // Mock AI response for branch creation with error
    mockAIService.generateAgentResponse.mockResolvedValueOnce({
      response: 'I will create a branch for issue #42',
      functionCalls: [
        {
          name: 'getRepositoryInfo',
          args: {},
          result: {
            success: true,
            repository: {
              name: 'test-repo',
              full_name: 'user/test-repo',
              default_branch: 'main'
            }
          }
        },
        {
          name: 'branchExists',
          args: { name: 'feature/login-42' },
          result: {
            success: true,
            exists: true,
            message: 'Branch feature/login-42 already exists'
          }
        }
      ]
    });

    // Invoke the handler
    await (orchestrator as any).handleMessage(createBranchMessage);

    // Verify the error message was sent to Slack
    expect(mockSlackService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'C123',
      text: expect.stringContaining('I will create a branch for issue #42'),
      thread_ts: 'T123'
    }));

    // Verify no branch was created
    expect(githubService.createBranch).not.toHaveBeenCalled();
  });
}); 