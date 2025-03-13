// @ts-ignore
import { jest } from '@jest/globals';
import { developerAgent } from '@/agents/AgentDefinitions';
import { AgentOrchestrator } from '@/services/ai/AgentOrchestrator';
import { AIService } from '@/services/ai/AIService';
import { SlackService } from '@/services/slack/SlackService';
import { githubService } from '@/services/github/GitHubService';

// Define interface for SlackMessage to fix typing issues
interface SlackMessage {
  channel: string;
  text: string;
  thread_ts?: string;
  [key: string]: any;
}

// Mock all dependencies
jest.mock('@/services/github/GitHubService', () => ({
  githubService: {
    getRepository: jest.fn(),
    getIssue: jest.fn(),
    createBranch: jest.fn(),
    createCommit: jest.fn(),
    createPullRequest: jest.fn(),
    branchExists: jest.fn()
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

describe('GitHub Workflow Integration Tests', () => {
  let mockSlackService: any;
  let mockAIService: any;
  let orchestrator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mocks with any type to avoid TypeScript errors
    mockSlackService = new SlackService() as any;
    mockSlackService.sendMessage = jest.fn().mockReturnValue(Promise.resolve(true));

    mockAIService = new AIService() as any;
    mockAIService.generateAgentResponse = jest.fn();
    mockAIService.extractFunctionResults = jest.fn().mockReturnValue('Function results');

    // Set up the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(mockSlackService, mockAIService);
    
    // Register the developer agent
    orchestrator.registerAgent(developerAgent);

    // Mock GitHub service functions
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

    (githubService.getIssue as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 42,
      title: 'Implement new feature',
      body: 'This is a test issue',
      html_url: 'https://github.com/user/test-repo/issues/42',
      state: 'open',
      assignees: [],
      labels: []
    }));

    (githubService.branchExists as jest.Mock).mockImplementation(() => Promise.resolve(false));

    (githubService.createBranch as jest.Mock).mockImplementation(() => Promise.resolve({
      ref: 'refs/heads/feature-42',
      object: { sha: 'test-sha' }
    }));

    (githubService.createCommit as jest.Mock).mockImplementation(() => Promise.resolve({
      sha: 'commit-sha-123'
    }));

    (githubService.createPullRequest as jest.Mock).mockImplementation(() => Promise.resolve({
      number: 123,
      html_url: 'https://github.com/user/test-repo/pull/123'
    }));
  });

  describe('Complete GitHub workflow', () => {
    it.skip('should enhance message with issue number and follow complete workflow', async () => {
      // Setup test data
      const message = {
        channel: 'C123',
        content: 'Hey @Developer, please implement issue #42',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Simulate AI responses that follow the correct workflow
      mockAIService.generateAgentResponse.mockResolvedValue({
        response: 'I will implement issue #42',
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
            name: 'getIssue',
            args: { number: 42 },
            result: {
              success: true,
              number: 42,
              title: 'Implement new feature',
              body: 'This is a test issue'
            }
          },
          {
            name: 'createBranch',
            args: { name: 'feature-42', source: 'main' },
            result: {
              success: true,
              message: 'Branch feature-42 created successfully'
            }
          },
          {
            name: 'createCommit',
            args: {
              message: 'Implement feature #42',
              files: [{ path: 'test.js', content: 'console.log("test");' }],
              branch: 'feature-42'
            },
            result: {
              success: true,
              message: 'Commit created successfully'
            }
          },
          {
            name: 'createPullRequest',
            args: {
              title: 'Implement new feature',
              body: 'Fixes #42',
              head: 'feature-42',
              base: 'main'
            },
            result: {
              success: true,
              message: 'Pull request #123 created successfully'
            }
          }
        ]
      });

      // Invoke the function we're testing
      await (orchestrator as any).handleMessage(message);

      // Assertions to verify the correct workflow was followed
      expect(mockAIService.generateAgentResponse).toHaveBeenCalled();

      // Check that the message was enhanced with the issue number instruction
      const aiServiceArgs = mockAIService.generateAgentResponse.mock.calls[0];
      expect(aiServiceArgs[1]).toContain('issue #42');
      expect(aiServiceArgs[1]).toContain('IMPORTANT');
      expect(aiServiceArgs[1]).toContain('Remember to first call getIssue');

      // Check that the message was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('I will implement issue #42'),
        thread_ts: 'T123'
      });
    });

    it.skip('should handle errors in the workflow and provide proper error messages', async () => {
      // Setup test data
      const message = {
        channel: 'C123',
        content: 'Hey @Developer, please implement issue #42 but skip branch creation',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Simulate branch error
      (githubService.branchExists as jest.Mock).mockImplementation(() => Promise.reject(new Error('Branch does not exist')));

      // Simulate AI responses that skip the branch creation step
      mockAIService.generateAgentResponse.mockResolvedValue({
        response: 'I will implement issue #42',
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
            name: 'getIssue',
            args: { number: 42 },
            result: {
              success: true,
              number: 42,
              title: 'Implement new feature',
              body: 'This is a test issue'
            }
          },
          // Notice: missing createBranch step!
          {
            name: 'createCommit',
            args: {
              message: 'Implement feature #42',
              files: [{ path: 'test.js', content: 'console.log("test");' }],
              branch: 'feature-42'
            },
            result: {
              success: false,
              error: '⚠️ IMPORTANT: You must create a branch before committing to it. Please call createBranch({name: "feature-42"}) first, then retry your commit.'
            }
          }
        ]
      });

      // Invoke the function we're testing
      await (orchestrator as any).handleMessage(message);

      // Check that the error response includes proper error messages
      expect(mockAIService.extractFunctionResults).toHaveBeenCalled();
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining('⚠️ IMPORTANT'),
        thread_ts: 'T123'
      });
    });
  });
}); 