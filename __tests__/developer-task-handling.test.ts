import { jest } from '@jest/globals';
import { AgentOrchestrator } from '@/services/ai/AgentOrchestrator';
import { AIService } from '@/services/ai/AIService';
import { SlackService } from '@/services/slack/SlackService';
import { GitHubService } from '@/services/github/GitHubService';
import { developerAgent, projectManagerAgent } from '@/agents/AgentDefinitions';
import { setGitHubService } from '@/services/github/GitHubFunctions';

// Mock dependencies
jest.mock('@/services/slack/SlackService');
jest.mock('@/services/ai/AIService');
jest.mock('@/services/github/GitHubService');
jest.mock('@/utils/EventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn(),
    emitAgentMessage: jest.fn()
  },
  EventType: {
    AGENT_MESSAGE: 'AGENT_MESSAGE',
    ERROR: 'ERROR',
    AGENT_MESSAGE_RECEIVED: 'AGENT_MESSAGE_RECEIVED'
  }
}));

describe('Developer Task Handling Tests', () => {
  let mockSlackService: any;
  let mockAIService: any;
  let mockGitHubService: any;
  let orchestrator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockSlackService = new SlackService() as any;
    mockSlackService.sendMessage = jest.fn().mockResolvedValue(true as unknown as never);

    mockAIService = new AIService() as any;
    mockAIService.generateAgentResponse = jest.fn();
    mockAIService.extractFunctionResults = jest.fn().mockReturnValue('Function results');
    mockAIService.registerFunction = jest.fn();

    mockGitHubService = new GitHubService() as any;
    mockGitHubService.getRepositoryInfo = jest.fn().mockResolvedValue({
      name: 'test-repo',
      owner: { login: 'test-owner' },
      default_branch: 'main'
    } as unknown as never);
    
    mockGitHubService.getIssue = jest.fn().mockResolvedValue({
      number: 42,
      title: 'Implement Fibonacci API',
      body: 'Implement an API endpoint that returns Fibonacci sequence values',
      state: 'open',
      html_url: 'https://github.com/test-owner/test-repo/issues/42'
    } as unknown as never);
    
    mockGitHubService.createBranch = jest.fn().mockResolvedValue({
      name: 'feature-fibonacci-api',
      commit: { sha: 'abc123' }
    } as unknown as never);
    
    mockGitHubService.createCommit = jest.fn().mockResolvedValue({
      sha: 'def456',
      html_url: 'https://github.com/test-owner/test-repo/commit/def456'
    } as unknown as never);
    
    mockGitHubService.createPullRequest = jest.fn().mockResolvedValue({
      number: 43,
      html_url: 'https://github.com/test-owner/test-repo/pull/43'
    } as unknown as never);

    // Set the mock GitHub service
    setGitHubService(mockGitHubService);

    // Create the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(mockSlackService, mockAIService);

    // Register the agents
    orchestrator.registerAgent(projectManagerAgent);
    orchestrator.registerAgent(developerAgent);
  });

  describe('Developer workflow', () => {
    it('should respond correctly to task assignments from Project Manager', async () => {
      // Developer responds to a task from the Project Manager
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll implement the Fibonacci API endpoint right away. Let me start by looking at the issue details.",
        functionCalls: []
      });

      // Message from Project Manager to Developer
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U08GYV9AU9M', // Project Manager's ID
        content: '@user Developer, please implement the Fibonacci API endpoint described in issue #42.',
        channel: 'C12345CHANNEL',
        mentions: ['DEV001'], // Developer ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify that the AI service was called with the developer agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].id).toBe('DEV001');
      
      // Verify that the response was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockSlackService.sendMessage.mock.calls[0][0].text).toContain("I'll implement the Fibonacci API endpoint");
    });

    it('should follow the GitHub workflow for implementation tasks', async () => {
      // Set up a mock developer response that follows the GitHub workflow
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll implement the Fibonacci API endpoint for issue #42.",
        functionCalls: [
          {
            name: 'getRepositoryInfo',
            parameters: {},
            result: {
              name: 'test-repo',
              owner: { login: 'test-owner' },
              default_branch: 'main'
            }
          },
          {
            name: 'getIssue',
            parameters: { number: 42 },
            result: {
              number: 42,
              title: 'Implement Fibonacci API Endpoint',
              body: 'Create an API endpoint that returns the Fibonacci sequence value at a given index.',
              state: 'open'
            }
          },
          {
            name: 'createBranch',
            parameters: { name: 'feature-fibonacci-api' },
            result: {
              name: 'feature-fibonacci-api',
              commit: { sha: 'abc123' }
            }
          },
          {
            name: 'createCommit',
            parameters: {
              message: 'Implement Fibonacci API endpoint',
              branch: 'feature-fibonacci-api',
              files: [
                {
                  path: 'api/fibonacci.js',
                  content: '// Fibonacci API implementation\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nmodule.exports = { fibonacci };'
                }
              ]
            },
            result: {
              sha: 'def456',
              html_url: 'https://github.com/test-owner/test-repo/commit/def456'
            }
          },
          {
            name: 'createPullRequest',
            parameters: {
              title: 'Implement Fibonacci API endpoint',
              body: 'This PR implements the Fibonacci API endpoint as described in issue #42.',
              head: 'feature-fibonacci-api',
              base: 'main'
            },
            result: {
              number: 43,
              html_url: 'https://github.com/test-owner/test-repo/pull/43'
            }
          }
        ]
      });

      // Message referencing the issue number
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U08GYV9AU9M', // Project Manager's ID
        content: '@user Developer, please implement issue #42 for the Fibonacci API endpoint.',
        channel: 'C12345CHANNEL',
        mentions: ['DEV001'], // Developer ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the enhanced message contains the instruction about getting issue details
      expect(mockAIService.generateAgentResponse.mock.calls[0][1]).toContain('Remember to first call getRepositoryInfo() and then getIssue({number: 42})');
      
      // Verify that the function results were extracted
      expect(mockAIService.extractFunctionResults).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ name: 'getRepositoryInfo' }),
        expect.objectContaining({ name: 'getIssue' }),
        expect.objectContaining({ name: 'createBranch' }),
        expect.objectContaining({ name: 'createCommit' }),
        expect.objectContaining({ name: 'createPullRequest' })
      ]));
      
      // Verify that the response was sent to Slack with the function results
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C12345CHANNEL',
        text: expect.stringContaining("I'll implement the Fibonacci API endpoint"),
        thread_ts: undefined
      });
    });
  });

  describe('Developer with correct Slack ID', () => {
    it('should update the Developer agent ID to match Slack and verify correct routing', async () => {
      // Update the Developer's ID to a Slack-style ID
      developerAgent.id = 'U09DEVAGENT';
      
      // Re-register the agent with the new ID
      orchestrator.registerAgent(developerAgent);
      
      // Set up a mock response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll implement the Fibonacci API endpoint right away.",
        functionCalls: []
      });

      // Create a message targeting the Developer by Slack ID
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U08GYV9AU9M', // Project Manager's ID
        content: '@user I need you to implement a Fibonacci API endpoint.',
        channel: 'C12345CHANNEL',
        mentions: ['U09DEVAGENT'], // Developer's Slack ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify that the AI service was called with the developer agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].id).toBe('U09DEVAGENT');
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].role).toBe('DEVELOPER');
      
      // Verify that the response was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
}); 