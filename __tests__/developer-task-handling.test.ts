import { jest } from '@jest/globals';
import { WorkflowState } from '../src/services/state/WorkflowStateManager';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { AIService } from '../src/services/ai/AIService';
import { SlackService } from '../src/services/slack/SlackService';
import { GitHubService } from '../src/services/github/GitHubService';
import { developerAgent, projectManagerAgent } from '../src/agents/AgentDefinitions';
import { setGitHubService } from '../src/services/github/GitHubFunctions';
import { MockAIService } from './test-utils/MockAIService';

// Mock dependencies
jest.mock('../src/services/slack/SlackService');
jest.mock('../src/services/ai/AIService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => {
      return new MockAIService();
    })
  };
});
jest.mock('../src/services/github/GitHubService');
jest.mock('../src/services/github/GitHubFunctions');
jest.mock('../src/utils/EventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn()
  },
  EventType: {
    MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
    ERROR: 'ERROR'
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
    // Setup a default mock response for generateAgentResponse
    mockAIService.generateAgentResponse.mockImplementation(async (agent, userMessage, conversationHistory = []) => {
      return {
        response: `Mock response from ${agent.name} (${agent.role}): ${userMessage.substring(0, 20)}...`,
        functionCalls: []
      };
    });
    mockAIService.extractFunctionResults.mockReturnValue('Function results');
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

    // Create mock agents
    const mockAgents = {
      'U08GYV9AU9M': { id: 'U08GYV9AU9M', name: 'ProjectManager', role: 'PROJECT_MANAGER' },
      'DEV001': { id: 'DEV001', name: 'Developer', role: 'DEVELOPER' }
    };

    // Create additional mock services
    const mockHandoffMediator = {
      registerOrchestrator: jest.fn(),
      handleAgentHandoff: jest.fn(),
      determineNextAgent: jest.fn().mockImplementation((channel: string, replyTs: string | null, message: any) => {
        // Type the message parameter properly
        if (message && message.mentions && message.mentions.length > 0) {
          return mockAgents[message.mentions[0]];
        }
        return null;
      }),
      // Add missing properties required by HandoffMediator interface
      agentsByRole: {
        DEVELOPER: [mockAgents['DEV001']],
        PROJECT_MANAGER: [mockAgents['U08GYV9AU9M']],
        CODE_REVIEWER: [],
        QA_TESTER: [],
        TECHNICAL_WRITER: [],
        SECURITY_ENGINEER: [],
        DEVOPS_ENGINEER: []
      },
      agents: mockAgents,
      stateManager: { getState: jest.fn().mockImplementation(() => Promise.resolve({ stage: 'issue_created', issueNumber: 1 } as WorkflowState)) },
      initializeAgentsByRole: jest.fn(),
      findAgentByMention: jest.fn(),
      findAgentByKeyword: jest.fn(),
      getAgentForState: jest.fn(),
      recordHandoff: jest.fn()
    } as any;

    const mockStateManager = {
      updateState: jest.fn(),
      getState: jest.fn(),
      getCurrentStage: jest.fn()
    };

    const mockLoopDetector = {
      checkForLoop: jest.fn(),
      recordHandoff: jest.fn(),
      recordAction: jest.fn().mockReturnValue(false)
    };

    const mockFunctionRegistry = {
      registerFunction: jest.fn(),
      getFunctionByName: jest.fn(),
      getAllFunctions: jest.fn(),
      getFunctionDefinitions: jest.fn().mockReturnValue([])
    };

    const mockTokenManager = {
      trackTokens: jest.fn(),
      getConversationTokenCount: jest.fn(),
      pruneConversation: jest.fn()
    };

    // Create the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(
      mockSlackService as any,
      mockAIService as any,
      mockHandoffMediator as any,
      mockStateManager as any,
      mockLoopDetector as any,
      mockFunctionRegistry as any
    );

    // Register the agents
    orchestrator.registerAgent(projectManagerAgent);
    orchestrator.registerAgent(developerAgent);
  });

  describe('Developer workflow', () => {
    it('should respond correctly to task assignments from Project Manager', async () => {
      const mockMessage = {
        id: '123456.789',
        timestamp: '2023-06-01T12:34:56.789Z',
        agentId: 'U08GYV9AU9M',
        content: '@Developer Can you implement the Fibonacci API endpoint described in issue #42?',
        channel: 'C12345CHANNEL',
        mentions: ['DEV001'],
        replyToMessageId: undefined
      };

      // Mock the AI response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: 'I will implement the Fibonacci API endpoint.',
        functionCalls: []
      });

      // Process the message
      await orchestrator.handleMessage(mockMessage);

      // Verify that the AI service was called with the developer agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalled();
      const callArgs = mockAIService.generateAgentResponse.mock.calls[0];
      expect(callArgs[0].id).toBe('DEV001');
      
      // Verify that the response was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C12345CHANNEL',
        text: expect.stringContaining('I will implement'),
        thread_ts: undefined,
        userId: 'DEV001'
      });
    });

    it('should follow the GitHub workflow for implementation tasks', async () => {
      // Message mentioning implementing a specific issue
      const message = {
        id: '123456.789',
        timestamp: '2023-06-01T12:34:56.789Z',
        agentId: 'U12345USER', // User's ID
        content: '@Developer Please implement issue #42 for the Fibonacci API endpoint.',
        channel: 'C12345CHANNEL',
        mentions: ['DEV001'], // Developer ID
        replyToMessageId: undefined
      };

      // Set up the mock repository info
      mockGitHubService.getRepositoryInfo.mockResolvedValue({
        name: 'test-repo',
        owner: { login: 'test-owner' },
        default_branch: 'main'
      });

      // Set up the mock issue response
      mockGitHubService.getIssue.mockResolvedValue({
        number: 42,
        title: 'Implement Fibonacci API endpoint',
        body: 'Create a REST API endpoint that returns Fibonacci sequence numbers.',
        state: 'open',
        user: { login: 'test-owner' }
      });

      // Mock the AI response - we expect the enhanced message to be passed to AI
      mockAIService.generateAgentResponse.mockImplementation((agent, userMessage, conversationHistory = []) => {
        // Verify the message enhancement happens in the Orchestrator
        expect(userMessage).toContain('Remember to first call getRepositoryInfo() and then getIssue({number: 42})');
        
        return Promise.resolve({
          response: "I'll implement the Fibonacci API endpoint by following the GitHub workflow.",
          functionCalls: [
            {
              name: 'getRepositoryInfo',
              arguments: {},
              result: {
                name: 'test-repo',
                owner: { login: 'test-owner' },
                default_branch: 'main'
              }
            },
            {
              name: 'getIssue',
              arguments: { number: 42 },
              result: {
                number: 42,
                title: 'Implement Fibonacci API endpoint',
                body: 'Create a REST API endpoint that returns Fibonacci sequence numbers.',
                state: 'open',
                user: { login: 'test-owner' }
              }
            }
          ]
        });
      });

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify that the function results were extracted
      expect(mockAIService.extractFunctionResults).toHaveBeenCalled();
      
      // Verify Slack message was sent with the AI response
      expect(mockSlackService.sendMessage).toHaveBeenCalled();
      expect(mockSlackService.sendMessage.mock.calls[0][0].text).toContain("I'll implement the Fibonacci API endpoint");
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