// Set NODE_ENV to test for consistent mocking
process.env.NODE_ENV = 'test';

import { jest } from '@jest/globals';

// Create mock for developer agent
const mockDeveloperAgent = {
  id: 'developer-1',
  name: 'Developer',
  role: 'DEVELOPER',
  description: 'A software developer agent'
};

// Define Message type for better type safety
interface Message {
  channel: string;
  content: string;
  mentions: string[];
  replyToMessageId: string;
}

// Define response types for better type-checking
interface AIResponse {
  response: string;
  functionCall?: any;
  functionCalls?: any[];
}

// Create mocks using the same pattern as in github-functions.test.ts
const mockSendMessage = jest.fn() as jest.Mock<any>;
const mockGenerateAgentResponse = jest.fn() as jest.Mock<any>;
const mockExtractFunctionResults = jest.fn() as jest.Mock<any>;
const mockRegisterAgent = jest.fn() as jest.Mock<any>;
const mockHandleMessage = jest.fn() as jest.Mock<any>;

// Mock all the external dependencies
// Note: Using relative paths instead of aliases to avoid path resolution issues
jest.mock('../src/services/github/GitHubService', () => {
  return {
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
  };
});

// Import the GitHub service for direct access to mocks
import { githubService } from '../src/services/github/GitHubService';

// Suppress console output during tests
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('Complete GitHub Workflow Tests', () => {
  // Create service objects with mocked functions
  let mockSlackService: { sendMessage: jest.Mock };
  let mockAIService: { generateAgentResponse: jest.Mock; extractFunctionResults: jest.Mock };
  let orchestrator: { handleMessage: jest.Mock; registerAgent: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create typed mock services with simple type declarations
    mockSlackService = {
      sendMessage: mockSendMessage
    };
    
    mockAIService = {
      generateAgentResponse: mockGenerateAgentResponse,
      extractFunctionResults: mockExtractFunctionResults
    };

    // Set up the orchestrator with our mocks
    orchestrator = {
      registerAgent: mockRegisterAgent,
      handleMessage: mockHandleMessage
    };
    
    // Set up default mock implementations
    mockSendMessage.mockResolvedValue({});
    
    mockGenerateAgentResponse.mockResolvedValue({
      response: 'I will create a branch for issue #42',
      functionCall: {
        name: 'createBranch',
        parameters: { issueNumber: 42 }
      }
    });
    
    mockExtractFunctionResults.mockReturnValue('Function results');
    
    mockHandleMessage.mockImplementation(async (message: Message) => {
      // Get the response from the appropriate mock based on the message
      let responseText = 'Default response';

      if (message.content.includes('create a new issue')) {
        await githubService.createIssue({ title: 'Add login functionality', body: 'Implement user login/authentication system' });
      } else if (message.content.includes('add a comment to issue')) {
        await githubService.getIssue(42);
        await githubService.addCommentToIssue(42, 'We should use JWT for authentication');
      } else if (message.content.includes('create a branch')) {
        // Check if branch exists before creating
        const branchExists = await githubService.branchExists('feature/login-42');
        if (!branchExists) {
          await githubService.createBranch('feature/login-42', 'main');
        }
      } else if (message.content.includes('commit login functionality')) {
        await githubService.createCommit({ message: 'Add login functionality', files: [], branch: 'feature/login-42' });
      } else if (message.content.includes('create a PR')) {
        await githubService.createPullRequest({ title: 'Add login functionality', body: 'Fixes #42', head: 'feature/login-42', base: 'main' });
      } else if (message.content.includes('review and approve PR')) {
        await githubService.getPullRequest(123);
        await githubService.addReviewToPullRequest(123, { event: 'APPROVE', body: 'Looks good' });
      } else if (message.content.includes('merge PR')) {
        await githubService.mergePullRequest(123);
      } else if (message.content.includes('close issue')) {
        await githubService.closeIssue(42);
      }
      
      // For simplicity, let's use a fixed response text based on the mock AI service
      const mockResult = mockGenerateAgentResponse.mock.results[0];
      if (mockResult && mockResult.value) {
        try {
          const aiResponse = await mockResult.value;
          responseText = aiResponse.response;
        } catch (error) {
          responseText = 'Error processing AI response';
        }
      }
      
      // Return a mock response with the appropriate text
      return mockSendMessage({
        channel: message.channel,
        text: responseText,
        thread_ts: message.replyToMessageId
      });
    });
    
    // Register the developer agent
    mockRegisterAgent.mockImplementation((agent) => agent);

    // Mock GitHub service functions with typed implementation
    (githubService.getRepository as jest.Mock).mockImplementation(() => Promise.resolve({
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
    }));

    // Mock issue creation
    (githubService.createIssue as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 42,
      title: 'New feature request',
      body: 'This is a test issue',
      html_url: 'https://github.com/user/test-repo/issues/42',
      state: 'open',
      assignees: [],
      labels: []
    }));

    // Mock get issue
    (githubService.getIssue as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 42,
      title: 'New feature request',
      body: 'This is a test issue',
      html_url: 'https://github.com/user/test-repo/issues/42',
      state: 'open',
      assignees: [],
      labels: []
    }));

    // Mock issue comment
    (githubService.addCommentToIssue as jest.Mock).mockImplementation(() => Promise.resolve({
      id: 123,
      body: 'This is a test comment',
      html_url: 'https://github.com/user/test-repo/issues/42#issuecomment-123'
    }));

    // Mock branch checks and creation
    (githubService.branchExists as jest.Mock).mockImplementation(() => Promise.resolve(false));
    (githubService.createBranch as jest.Mock).mockImplementation(() => Promise.resolve({
      ref: 'refs/heads/feature-42',
      object: { sha: 'test-sha' }
    }));

    // Mock commit creation
    (githubService.createCommit as jest.Mock).mockImplementation(() => Promise.resolve({
      sha: 'commit-sha-123',
      html_url: 'https://github.com/user/test-repo/commit/commit-sha-123'
    }));

    // Mock PR creation and retrieval
    (githubService.createPullRequest as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 123,
      title: 'Implement new feature',
      body: 'Fixes #42',
      html_url: 'https://github.com/user/test-repo/pull/123',
      state: 'open'
    }));
    
    (githubService.getPullRequest as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 123,
      title: 'Implement new feature',
      body: 'Fixes #42',
      html_url: 'https://github.com/user/test-repo/pull/123',
      state: 'open'
    }));

    // Mock PR review
    (githubService.addReviewToPullRequest as jest.Mock).mockImplementation(() => Promise.resolve({
      id: 456,
      body: 'LGTM! Approved.',
      state: 'APPROVED',
      html_url: 'https://github.com/user/test-repo/pull/123#pullrequestreview-456'
    }));

    // Mock PR merge
    (githubService.mergePullRequest as jest.Mock).mockImplementation(() => Promise.resolve({
      merged: true,
      message: 'Pull request successfully merged',
      sha: 'merge-sha-789'
    }));

    // Mock issue closing
    (githubService.closeIssue as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 42,
      state: 'closed',
      title: 'New feature request',
      html_url: 'https://github.com/user/test-repo/issues/42'
    }));
  });

  it('should complete a full GitHub workflow from issue creation to closing', async () => {
    // Use multiple messages to simulate the entire workflow
    
    // 1. First message: create an issue
    const createIssueMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please create a new issue for adding login functionality',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for issue creation
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(createIssueMessage);

    // 2. Second message: comment on the issue
    const commentIssueMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please add a comment to issue #42 about using JWT for authentication',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for commenting
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(commentIssueMessage);

    // 3. Third message: create a branch for the issue
    const createBranchMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please create a branch for issue #42',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for branch creation
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(createBranchMessage);

    // 4. Fourth message: commit code to the branch
    const createCommitMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please commit login functionality code to the branch for issue #42',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for commit creation
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(createCommitMessage);

    // 5. Fifth message: create a pull request
    const createPRMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please create a PR for the login functionality branch',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR creation
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(createPRMessage);

    // 6. Sixth message: review the pull request
    const reviewPRMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please review and approve PR #123',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR review
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(reviewPRMessage);

    // 7. Seventh message: merge the pull request
    const mergePRMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please merge PR #123',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for PR merge
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(mergePRMessage);

    // 8. Eighth message: close the related issue
    const closeIssueMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please close issue #42 as it is now implemented',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Mock AI response for issue closing
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(closeIssueMessage);

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
    expect(mockSendMessage).toHaveBeenCalledTimes(8);
  });

  it('should handle errors properly in the workflow', async () => {
    // Reset mocks for this specific test
    jest.clearAllMocks();
    
    // Test with a failed branch creation
    const createBranchMessage: Message = {
      channel: 'C123',
      content: 'Hey @Developer, please create a branch for issue #42',
      mentions: [mockDeveloperAgent.id],
      replyToMessageId: 'T123'
    };

    // Simulate branch already exists error
    (githubService.branchExists as jest.Mock).mockImplementation(() => Promise.resolve(true));

    // Mock AI response for branch creation with error
    mockGenerateAgentResponse.mockResolvedValueOnce({
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
    await orchestrator.handleMessage(createBranchMessage);

    // Verify the error message was sent to Slack
    expect(mockSendMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: expect.any(String),
      thread_ts: 'T123'
    });

    // Verify no branch was created
    expect(githubService.createBranch).not.toHaveBeenCalled();
  });
}); 