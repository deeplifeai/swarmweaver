import { jest } from '@jest/globals';
import { eventBus, EventType } from '../src/utils/EventBus';
import { AgentRole } from '../src/types/agents/Agent';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { agents } from '../src/agents/AgentDefinitions';
import { SlackService } from '../src/services/slack/SlackService';

// Mock dependencies
jest.mock('../src/services/slack/SlackService');
jest.mock('../src/services/ai/AIService');
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

describe('Agent Slack ID Management Tests', () => {
  let mockSlackService: any;
  let mockAIService: any;
  let orchestrator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock services
    mockSlackService = new SlackService() as any;
    mockSlackService.sendMessage = jest.fn().mockReturnValue(Promise.resolve(true));

    mockAIService = {
      generateAgentResponse: jest.fn().mockResolvedValue({
        response: 'Mock response',
        functionCalls: []
      } as unknown as never),
      extractFunctionResults: jest.fn().mockReturnValue(''),
      registerFunction: jest.fn()
    };

    // Create additional mock services
    const mockHandoffMediator = {
      registerOrchestrator: jest.fn(),
      handleAgentHandoff: jest.fn(),
      agentsByRole: {
        DEVELOPER: [],
        CODE_REVIEWER: [],
        PROJECT_MANAGER: [],
        QA_TESTER: [],
        TECHNICAL_WRITER: [],
        SECURITY_ENGINEER: [],
        DEVOPS_ENGINEER: []
      },
      agents: {},
      stateManager: {},
      initializeAgentsByRole: jest.fn(),
      determineNextAgent: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
      recordHandoff: jest.fn(),
      findAgentByMention: jest.fn(),
      findAgentByKeyword: jest.fn(),
      getAgentForState: jest.fn()
    };

    const mockStateManager = {
      updateState: jest.fn(),
      getState: jest.fn(),
      getCurrentStage: jest.fn()
    };

    const mockLoopDetector = {
      checkForLoop: jest.fn(),
      recordHandoff: jest.fn()
    };

    const mockFunctionRegistry = {
      registerFunction: jest.fn(),
      getFunctionByName: jest.fn(),
      getAllFunctions: jest.fn()
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
  });

  describe('Agent registration', () => {
    it('should register agents with their correct Slack IDs', () => {
      // Register all the predefined agents
      agents.forEach(agent => {
        orchestrator.registerAgent(agent);
      });

      // Get the registered agents (accessing private property for testing)
      const registeredAgents = (orchestrator as any).agents;

      // Check if Project Manager agent is registered with the correct Slack ID
      const projectManagerId = 'U08GYV9AU9M'; // This should match the ID in AgentDefinitions.ts
      expect(registeredAgents[projectManagerId]).toBeDefined();
      expect(registeredAgents[projectManagerId].role).toBe(AgentRole.PROJECT_MANAGER);
      
      // Verify all agents are registered
      expect(Object.keys(registeredAgents).length).toBe(agents.length);
    });
  });

  describe('Message handling', () => {
    beforeEach(() => {
      // Register all agents before each test
      agents.forEach(agent => {
        orchestrator.registerAgent(agent);
      });
    });

    it('should correctly identify and route messages to agents by Slack ID', async () => {
      // Create a message mentioning the Project Manager by Slack ID
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER', // Some user ID
        content: '@user PROJECT_MANAGER I want to develop an API endpoint which returns Fibonacci sequence values',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Project Manager Slack ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the AI service was called with the correct agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      
      const callArgs = mockAIService.generateAgentResponse.mock.calls[0];
      expect(callArgs[0].id).toBe('U08GYV9AU9M');
      expect(callArgs[0].role).toBe(AgentRole.PROJECT_MANAGER);
      
      // Verify a response was sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should handle messages with invalid agent IDs gracefully', async () => {
      // Create a message mentioning a non-existent agent ID
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: 'Hey @NonExistentAgent, can you help me?',
        channel: 'C12345CHANNEL',
        mentions: ['INVALID_ID'],
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify no AI service calls were made
      expect(mockAIService.generateAgentResponse).not.toHaveBeenCalled();
      
      // Verify no responses were sent to Slack
      expect(mockSlackService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('User-to-agent ID mapping', () => {
    it('should use the getAgentById method to find agents by their Slack ID', () => {
      // Register all agents
      agents.forEach(agent => {
        orchestrator.registerAgent(agent);
      });

      // Use the private method to look up an agent (accessing private method for testing)
      const agent = (orchestrator as any).getAgentById('U08GYV9AU9M');
      
      // Verify the correct agent was found
      expect(agent).toBeDefined();
      expect(agent.role).toBe(AgentRole.PROJECT_MANAGER);
      expect(agent.name).toBe('ProjectManager');
    });
    
    it('should return undefined when looking up an invalid agent ID', () => {
      // Register all agents
      agents.forEach(agent => {
        orchestrator.registerAgent(agent);
      });

      // Use the private method to look up a non-existent agent
      const agent = (orchestrator as any).getAgentById('INVALID_ID');
      
      // Verify no agent was found
      expect(agent).toBeUndefined();
    });
  });

  describe('Role-based message processing', () => {
    beforeEach(() => {
      // Register all agents before each test
      agents.forEach(agent => {
        orchestrator.registerAgent(agent);
      });
    });

    it('should enhance messages for PROJECT_MANAGER when they include "create an issue"', async () => {
      // Create a message for the Project Manager about creating an issue
      const message = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER I want to develop an API endpoint which for any integer input returns the value of the fibonacci sequence at that index. Create an issue and have DEVELOPER start working on it.',
        channel: 'C12345CHANNEL',
        mentions: ['U08GYV9AU9M'], // Project Manager Slack ID
        replyToMessageId: undefined
      };

      // Process the message
      await orchestrator.handleMessage(message);

      // Verify the AI service was called with enhanced message
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledTimes(1);
      
      const callArgs = mockAIService.generateAgentResponse.mock.calls[0];
      expect(callArgs[1]).toContain('IMPORTANT: As a Project Manager, you should use the createIssue function');
      expect(callArgs[1]).toContain('mention the Developer to assign them the task');
    });
  });
}); 