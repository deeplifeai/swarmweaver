import { jest } from '@jest/globals';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { AIService } from '../src/services/ai/AIService';
import { SlackService } from '../src/services/slack/SlackService';
import { GitHubService } from '../src/services/github/GitHubService';
import { eventBus, EventType } from '../src/utils/EventBus';
import { agents } from '../src/agents/AgentDefinitions';
import { setGitHubService } from '../src/services/github/GitHubFunctions';

// Mock dependencies
jest.mock('../src/services/slack/SlackService');
jest.mock('../src/services/ai/AIService');
jest.mock('../src/services/github/GitHubService');
jest.mock('../src/utils/EventBus', () => ({
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

describe('Slack GitHub Integration Tests', () => {
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
    mockGitHubService.createIssue = jest.fn().mockResolvedValue({
      number: 42,
      html_url: 'https://github.com/owner/repo/issues/42',
      title: 'Fibonacci API Endpoint',
      body: 'Implement an API endpoint that returns Fibonacci sequence values'
    } as unknown as never);

    // Set the mock GitHub service
    setGitHubService(mockGitHubService);

    // Create mock services for the required parameters
    const mockHandoffMediator = { handleAgentHandoff: jest.fn() } as any;
    const mockStateManager = { getWorkflowState: jest.fn(), updateWorkflowState: jest.fn() } as any;
    const mockLoopDetector = { detectLoop: jest.fn(), resetLoopCounter: jest.fn() } as any;
    const mockFunctionRegistry = { registerFunction: jest.fn(), getFunctions: jest.fn() } as any;
    const mockTokenManager = { 
      getOptimizedPrompt: jest.fn(), 
      estimateTokenCount: jest.fn(),
      chunkWithOverlap: jest.fn()
    } as any;

    // Create the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(
      mockSlackService, 
      mockAIService,
      mockHandoffMediator,
      mockStateManager,
      mockLoopDetector,
      mockFunctionRegistry,
      mockTokenManager
    );

    // Register the agents with the orchestrator
    agents.forEach(agent => {
      orchestrator.registerAgent(agent);
    });
  });

  describe('Project Manager creating issues', () => {
    it('should correctly create a GitHub issue based on a Slack message', async () => {
      // Set up mocks
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll create an issue for the Fibonacci API endpoint and assign it to the Developer.",
        functionCalls: [
          {
            name: 'createIssue',
            parameters: {
              title: 'Fibonacci API Endpoint',
              body: 'Implement an API endpoint that returns Fibonacci sequence values for a given index.\n\n## Assigned Agents\n- Developer',
              assignees: ['Developer'],
              labels: ['feature', 'api']
            },
            result: {
              success: true,
              issue_number: 42,
              url: 'https://github.com/owner/repo/issues/42',
              message: 'Issue #42 created successfully'
            }
          }
        ]
      });

      // Create a message for the project manager
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER I want to develop an API end point which for any integer input returns the value of the fibonacci sequence at that index. Create an issue and have DEVELOPER start working on it.',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Project Manager's Slack ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the AI service was called with the correct agent and enhanced message
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.generateAgentResponse.mock.calls[0];
      
      // Verify it was called with the project manager agent
      expect(callArgs[0].id).toBe('U08GYV9AU9M');
      expect(callArgs[0].role).toBe('PROJECT_MANAGER');
      
      // Verify the message was enhanced with the createIssue instruction
      expect(callArgs[1]).toContain('IMPORTANT: As a Project Manager, you should use the createIssue function');
      
      // Verify the response was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C12345CHANNEL',
        text: expect.stringContaining("I'll create an issue for the Fibonacci API endpoint"),
        thread_ts: undefined
      });
    });

    it('should handle the complete Fibonacci workflow with multiple agents', async () => {
      // Step 1: User sends a message to PROJECT_MANAGER
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll create an issue for implementing the Fibonacci API endpoint and assign it to our Developer.",
        functionCalls: [
          {
            name: 'createIssue',
            parameters: {
              title: 'Implement Fibonacci API Endpoint',
              body: 'Create an API endpoint that returns the Fibonacci sequence value at a given index.\n\n## Assigned Agents\n- Developer',
              assignees: ['Developer'],
              labels: ['feature']
            },
            result: {
              success: true,
              issue_number: 42,
              url: 'https://github.com/owner/repo/issues/42',
              message: 'Issue #42 created successfully'
            }
          }
        ]
      });

      const initialMessage = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER I want to develop an API end point which for any integer input returns the value of the fibonacci sequence at that index. Create an issue and have DEVELOPER start working on it.',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Project Manager's Slack ID
        replyToMessageId: undefined
      };

      // Process the initial message
      await orchestrator.handleMessage(initialMessage);

      // Verify the AI service was called with the PROJECT_MANAGER agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].role).toBe('PROJECT_MANAGER');
      
      // Verify a Slack message was sent
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(1);
      
      // Reset mocks for next step
      jest.clearAllMocks();
      
      // Step 2: Project Manager mentions the Developer in a follow-up message
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll implement the Fibonacci API endpoint as requested in issue #42.",
        functionCalls: []
      });

      const devAssignmentMessage = {
        id: '123456.790',
        timestamp: new Date().toISOString(),
        agentId: 'U08GYV9AU9M', // Project Manager
        content: '@user Developer, please implement the Fibonacci API endpoint in issue #42.',
        channel: 'C12345CHANNEL',
        mentions: ['DEV001'], // Developer's ID
        replyToMessageId: '123456.789'
      };

      // Process the developer assignment message
      await orchestrator.handleMessage(devAssignmentMessage);

      // Verify the AI service was called with the DEVELOPER agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].role).toBe('DEVELOPER');
      
      // Verify a Slack message was sent
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent ID handling with mixed role references', () => {
    it('should correctly handle messages with both Slack IDs and role references', async () => {
      // Set up mocks
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I understand you want to develop a Fibonacci API endpoint. I'll create an issue for this.",
        functionCalls: []
      });

      // Create a message mentioning PROJECT_MANAGER by role but using the correct Slack ID
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '<@U08GYV9AU9M> As the PROJECT_MANAGER, I want you to create an issue for a Fibonacci API endpoint.',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Project Manager's Slack ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the AI service was called with the correct agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.generateAgentResponse.mock.calls[0];
      
      // Verify it was called with the project manager agent
      expect(callArgs[0].id).toBe('U08GYV9AU9M');
      expect(callArgs[0].role).toBe('PROJECT_MANAGER');
    });

    it('should handle messages with multiple agent references but single Slack mention', async () => {
      // Set up mocks
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll create the Fibonacci API endpoint issue as the Project Manager.",
        functionCalls: []
      });

      // Create a message that mentions multiple roles but only has one Slack ID
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '<@U08GYV9AU9M> As PROJECT_MANAGER, create an issue for a Fibonacci API and have DEVELOPER implement it.',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Only Project Manager's Slack ID is mentioned
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the AI service was called with the correct agent (only PM, not Developer)
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      expect(mockAIService.generateAgentResponse.mock.calls[0][0].id).toBe('U08GYV9AU9M');
    });
  });
}); 