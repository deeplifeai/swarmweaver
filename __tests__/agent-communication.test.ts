import { jest } from '@jest/globals';
import { developerAgent, teamLeaderAgent } from '../src/agents/AgentDefinitions';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { AIService } from '../src/services/ai/AIService';
import { SlackService } from '../src/services/slack/SlackService';
import { eventBus, EventType } from '../src/utils/EventBus';

jest.mock('../src/services/slack/SlackService');
jest.mock('../src/services/ai/AIService');
jest.mock('../src/utils/EventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn()
  },
  EventType: {
    AGENT_MESSAGE: 'AGENT_MESSAGE',
    ERROR: 'ERROR'
  }
}));

describe('Agent Communication Tests', () => {
  let mockSlackService: any;
  let mockAIService: any;
  let orchestrator: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mocks
    mockSlackService = new SlackService() as any;
    mockSlackService.sendMessage = jest.fn().mockReturnValue(Promise.resolve(true));

    mockAIService = new AIService() as any;
    mockAIService.generateAgentResponse = jest.fn();
    mockAIService.extractFunctionResults = jest.fn().mockReturnValue('Function results');

    // Create mock agents
    const mockAgents = {
      'U08GYV9AU9M': { id: 'U08GYV9AU9M', name: 'ProjectManager', role: 'PROJECT_MANAGER' },
      'DEV001': { id: 'DEV001', name: 'Developer', role: 'DEVELOPER' }
    };

    // Create mock services for the required parameters
    const mockHandoffMediator = {
      handleAgentHandoff: jest.fn(),
      determineNextAgent: jest.fn().mockImplementation((channel: string, replyTs: string | null, message: any) => {
        if (message && message.mentions && message.mentions.length > 0) {
          return mockAgents[message.mentions[0]];
        }
        return null;
      }),
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
      stateManager: { 
        getState: jest.fn().mockResolvedValue({ stage: 'issue_created', issueNumber: 42 }) 
      },
      initializeAgentsByRole: jest.fn(),
      findAgentByMention: jest.fn(),
      findAgentByKeyword: jest.fn(),
      getAgentForState: jest.fn(),
      recordHandoff: jest.fn()
    } as any;
    const mockStateManager = { getWorkflowState: jest.fn(), updateWorkflowState: jest.fn() } as any;
    const mockLoopDetector = {
      checkForLoop: jest.fn(),
      recordHandoff: jest.fn(),
      recordAction: jest.fn().mockReturnValue(false)
    } as any;
    const mockFunctionRegistry = { registerFunction: jest.fn(), getFunctions: jest.fn() } as any;
    const mockTokenManager = { 
      getOptimizedPrompt: jest.fn(), 
      estimateTokenCount: jest.fn(),
      chunkWithOverlap: jest.fn()
    } as any;

    // Set up the orchestrator with our mocks
    orchestrator = new AgentOrchestrator(
      mockSlackService as any,
      mockAIService as any,
      mockHandoffMediator as any,
      mockStateManager as any,
      mockLoopDetector as any,
      mockFunctionRegistry as any
    );
    
    // Register the agents
    (orchestrator as any).registerAgent(teamLeaderAgent);
    (orchestrator as any).registerAgent(developerAgent);
  });

  describe('Direct agent communication', () => {
    it('should allow team leader to instruct developer and get a response', async () => {
      // 1. Team leader sends a message to the developer
      const leaderMessage = {
        channel: 'C123',
        content: 'Hey @Developer, I need you to create a login page by next week',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Mock AI response from developer
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll start working on the login page right away. Can you provide any specific requirements for the authentication flow?",
        functionCalls: []
      });

      // Process the team leader's message
      await (orchestrator as any).handleMessage(leaderMessage);

      // Verify that the AI service was called with the developer agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        developerAgent,
        expect.any(String),
        expect.any(Object)
      );

      // Verify that the response was sent back to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining("I'll start working on the login page"),
        thread_ts: 'T123'
      });

      // 2. Developer responds to team leader
      const developerResponseMessage = {
        channel: 'C123',
        content: 'Hey @TeamLeader, I\'ve analyzed the login page requirements. I think we should use JWT for authentication. What do you think?',
        mentions: [teamLeaderAgent.id],
        replyToMessageId: 'T123'
      };

      // Mock AI response from team leader
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "That's a good choice. Please proceed with JWT authentication and make sure to implement proper token expiration and refresh mechanisms.",
        functionCalls: []
      });

      // Process the developer's response
      await (orchestrator as any).handleMessage(developerResponseMessage);

      // Verify that the AI service was called with the team leader agent
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        teamLeaderAgent,
        expect.any(String),
        expect.any(Object)
      );

      // Verify that the team leader's response was sent back to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledWith({
        channel: 'C123',
        text: expect.stringContaining("That's a good choice"),
        thread_ts: 'T123'
      });
    });

    it('should include message history context when agents communicate', async () => {
      // Set up message history in the orchestrator
      const messageHistory = [
        {
          id: 'msg1',
          channel: 'C123',
          content: 'Hey @Developer, can you help with implementing OAuth?',
          sender: 'U789', // Team leader user ID
          timestamp: '1620000000.000100',
          mentions: [developerAgent.id]
        }
      ];
      
      // Add message history to the orchestrator
      (orchestrator as any).messageHistory = messageHistory;

      // New message in the conversation
      const newMessage = {
        channel: 'C123',
        content: 'Hey @Developer, any progress on the OAuth implementation?',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123',
        sender: 'U789' // Team leader user ID
      };

      // Mock AI response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I've made good progress on the OAuth implementation. I've set up the authorization endpoints and integrated with the identity provider.",
        functionCalls: []
      });

      // Process the message
      await (orchestrator as any).handleMessage(newMessage);

      // Check that the AI service was called with context that includes message history
      const aiServiceCall = mockAIService.generateAgentResponse.mock.calls[0];
      expect(aiServiceCall[1]).toContain('OAuth'); // The prompt should include context from the previous message
      
      // Verify the response was sent
      expect(mockSlackService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Agent communication through different routing methods', () => {
    it('should route messages through direct mentions', async () => {
      const directMentionMessage = {
        channel: 'C123',
        content: 'Hey @Developer, can you review this PR?',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Mock AI response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll review the PR right away.",
        functionCalls: []
      });

      // Process the direct mention message
      await (orchestrator as any).handleMessage(directMentionMessage);

      // Verify developer agent was called
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        developerAgent,
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should route messages through event bus', async () => {
      // Create a message event that matches the AgentMessage interface
      const messageEvent = {
        id: 'msg123',
        timestamp: '1620000000.000100',
        agentId: 'user123',
        content: 'Can you review this PR?',
        channel: 'C123',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Set up a handler for the event
      let eventHandler: Function | null = null;
      (eventBus.on as jest.Mock).mockImplementation((event, handler) => {
        if (event === EventType.AGENT_MESSAGE) {
          eventHandler = handler as Function;
        }
      });

      // Call setupEventListeners instead of initialize
      (orchestrator as any).setupEventListeners();

      // Mock AI response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll review the PR right away.",
        functionCalls: []
      });

      // Simulate emitting the event
      if (eventHandler) {
        await eventHandler(messageEvent);
      }

      // Verify developer agent was called
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        developerAgent,
        expect.any(String),
        expect.any(Object)
      );

      // Verify response was sent
      expect(mockSlackService.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Multi-agent workflows', () => {
    it('should handle complex workflows between team leader and developer', async () => {
      // Step 1: Team leader assigns a task
      const assignTaskMessage = {
        channel: 'C123',
        content: 'Hey @Developer, we need to create a new feature for user profile management. Can you start by designing the database schema?',
        mentions: [developerAgent.id],
        replyToMessageId: 'T123'
      };

      // Mock developer's response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "I'll start designing the database schema for user profile management. I'll focus on creating tables for user data, profile information, and preferences.",
        functionCalls: []
      });

      // Process the team leader's message
      await (orchestrator as any).handleMessage(assignTaskMessage);

      // Verify developer agent was called
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        developerAgent,
        expect.any(String),
        expect.any(Object)
      );

      // Step 2: Developer provides an update
      const updateMessage = {
        channel: 'C123',
        content: 'Hey @TeamLeader, I\'ve completed the database schema design for user profiles. It includes tables for basic info, preferences, and privacy settings. Should I proceed with implementing the API?',
        mentions: [teamLeaderAgent.id],
        replyToMessageId: 'T123'
      };

      // Mock team leader's response
      mockAIService.generateAgentResponse.mockResolvedValueOnce({
        response: "Great work on the database schema! Yes, please proceed with the API implementation. Make sure to include endpoints for fetching, updating, and deleting user profiles. Also, ensure proper validation and error handling.",
        functionCalls: []
      });

      // Process the developer's update message
      await (orchestrator as any).handleMessage(updateMessage);

      // Verify team leader agent was called
      expect(mockAIService.generateAgentResponse).toHaveBeenCalledWith(
        teamLeaderAgent,
        expect.any(String),
        expect.any(Object)
      );

      // Verify that the correct responses were sent to Slack
      expect(mockSlackService.sendMessage).toHaveBeenCalledTimes(2);
      
      // The first call should be the developer's response
      expect(mockSlackService.sendMessage.mock.calls[0][0].text).toContain("I'll start designing the database schema");
      
      // The second call should be the team leader's response
      expect(mockSlackService.sendMessage.mock.calls[1][0].text).toContain("Great work on the database schema");
    });
  });
}); 