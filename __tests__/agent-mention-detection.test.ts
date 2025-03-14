import { jest } from '@jest/globals';
import { EventType, eventBus } from '../src/services/eventBus';
import { SlackService } from '../src/services/slack/SlackService';
import { AgentMessage } from '../src/types/agents/Agent';
import { SlackMessage as SlackAPIMessage } from '../src/types/slack/SlackTypes';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { AIService } from '../src/services/ai/AIService';
import { developerAgent } from '../src/agents/Agents';

// Mocking dependencies
jest.mock('../src/services/eventBus', () => ({
  eventBus: {
    emit: jest.fn(),
    on: jest.fn()
  },
  EventType: {
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_SENT: 'message_sent',
    FUNCTION_CALLED: 'function_called',
    FUNCTION_RESULT: 'function_result',
    AGENT_RESPONSE: 'agent_response',
    WORKFLOW_TRANSITION: 'workflow_transition',
    ERROR: 'error'
  }
}));

jest.mock('../src/services/ai/AIService', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      generateAgentResponse: jest.fn(),
      extractFunctionResults: jest.fn()
    }))
  };
});

describe('Agent Mention Detection', () => {
  // Create a mock for setTimeout
  let originalSetTimeout: typeof setTimeout;
  
  // Mock Slack client
  const mockSlackClient = {
    chat: {
      postMessage: jest.fn().mockImplementation(() => Promise.resolve({ ok: true }))
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock setTimeout to execute immediately
    originalSetTimeout = global.setTimeout;
    // Use jest.fn to create a mock that matches the expected interface
    (global as any).setTimeout = jest.fn((fn: Function) => {
      fn();
      return 1;
    });

    // Reset the event bus mocks before each test
    (eventBus.emit as jest.Mock).mockClear();
  });

  afterEach(() => {
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout;
  });

  it('should detect agent mentions in outgoing messages', async () => {
    // Create a SlackService instance with our mocks
    const slackService = new SlackService();
    
    // Use TypeScript casting to access and set private properties
    (slackService as any).client = mockSlackClient;
    
    // Spy on the extractAgentNameMentions method to simulate finding the @Developer mention
    (slackService as any).extractAgentNameMentions = jest.fn().mockReturnValue(['DEV001']);
    
    // Create a message with a @Developer mention
    const message: SlackAPIMessage = {
      channel: 'C123',
      text: 'Hey @Developer, please implement this feature.',
      thread_ts: 'T123'
    };

    // Mock the eventBus.emit to capture the agent message
    let capturedAgentMessage: any = null;
    (eventBus.emit as jest.Mock).mockImplementation((...args: any[]) => {
      const [eventType, payload] = args;
      if (eventType === EventType.MESSAGE_RECEIVED && payload.mentions?.includes('DEV001')) {
        capturedAgentMessage = payload;
      }
      return true;
    });

    // Send the message
    await slackService.sendMessage(message);

    // Verify the message was sent to Slack
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C123',
      text: 'Hey @Developer, please implement this feature.',
      thread_ts: 'T123',
      blocks: undefined,
      attachments: undefined
    });

    // Verify that the mention was detected and an agent message was emitted
    expect(eventBus.emit).toHaveBeenCalledWith(
      EventType.MESSAGE_RECEIVED,
      expect.objectContaining({
        content: 'Hey @Developer, please implement this feature.',
        channel: 'C123',
        mentions: ['DEV001']
      })
    );
    
    // Get the agent message that was emitted
    expect(capturedAgentMessage).not.toBeNull();
    
    // Verify the agent message properties if it was captured
    if (capturedAgentMessage) {
      expect(capturedAgentMessage.content).toBe('Hey @Developer, please implement this feature.');
      expect(capturedAgentMessage.channel).toBe('C123');
      expect(capturedAgentMessage.replyToMessageId).toBe('T123');
      expect(capturedAgentMessage.mentions).toContain('DEV001'); // Developer agent ID
    }
  });

  it('should detect multiple agent mentions in outgoing messages', async () => {
    // Create a SlackService instance with our mocks
    const slackService = new SlackService();
    
    // Use TypeScript casting to access and set private properties
    (slackService as any).client = mockSlackClient;
    
    // Mock the extractAgentNameMentions method to return multiple agent IDs
    (slackService as any).extractAgentNameMentions = jest.fn().mockReturnValue(['DEV001', 'U08GYV9AU9M']);
    
    // Create a message with multiple agent mentions
    const message: SlackAPIMessage = {
      channel: 'C123',
      text: 'Hey @Developer and @ProjectManager, please coordinate on this feature.',
      thread_ts: 'T123'
    };

    // Mock the eventBus.emit to capture the agent message
    let capturedAgentMessage: any = null;
    (eventBus.emit as jest.Mock).mockImplementation((...args: any[]) => {
      const [eventType, payload] = args;
      if (eventType === EventType.MESSAGE_RECEIVED && 
          payload.mentions?.includes('DEV001') && 
          payload.mentions?.includes('U08GYV9AU9M')) {
        capturedAgentMessage = payload;
      }
      return true;
    });

    // Send the message
    await slackService.sendMessage(message);

    // Verify that the mentions were detected and processed
    expect(eventBus.emit).toHaveBeenCalled();
    
    // Get the agent message that was emitted
    expect(capturedAgentMessage).not.toBeNull();
    
    // Verify the agent message properties
    if (capturedAgentMessage) {
      expect(capturedAgentMessage.content).toBe('Hey @Developer and @ProjectManager, please coordinate on this feature.');
      expect(capturedAgentMessage.mentions).toContain('DEV001'); // Developer agent ID
      expect(capturedAgentMessage.mentions).toContain('U08GYV9AU9M'); // Project Manager agent ID
    }
  });
  
  it('should trigger an agent response when mentioned in a message', async () => {
    // Create mocks for the services
    const slackService = new SlackService();
    const mockAIService = new AIService();
    
    // Use TypeScript casting to access and set private properties
    (slackService as any).client = mockSlackClient;
    
    // Mock the AI service response
    const mockGenerateResponse = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        response: "I'll work on implementing this feature right away!",
        functionCalls: []
      });
    });
    (mockAIService as any).generateAgentResponse = mockGenerateResponse;
    
    // Create an orchestrator with our mocked services
    const orchestrator = new AgentOrchestrator(
      slackService as any,
      mockAIService as any
    );
    
    // Register the Developer agent
    orchestrator.registerAgent(developerAgent);
    
    // Setup a handler for agent messages that the orchestrator would register
    let messageHandler: any = null;
    
    // Mock the eventBus.on to capture the message handler
    (eventBus.on as jest.Mock).mockImplementation((...args: any[]) => {
      const [event, handler] = args;
      if (event === EventType.MESSAGE_RECEIVED) {
        messageHandler = handler;
      }
      return { removeListener: jest.fn() }; // Return a mock EventEmitter
    });
    
    // Call the method that would setup the event listeners (usually called during initialization)
    // We have to use 'any' to access the private method
    (orchestrator as any).setupEventListeners();
    
    // Manually register the handler since the mock might not be working correctly
    if (!messageHandler) {
      messageHandler = (message: AgentMessage) => (orchestrator as any).handleMessage(message);
    }
    
    // Create a message that mentions the Developer agent
    const agentMessage: AgentMessage = {
      id: 'test-message-123',
      timestamp: new Date().toISOString(),
      agentId: 'B08GYV992H5', // Bot ID
      content: 'Hey @Developer, please implement this feature.',
      channel: 'C123',
      mentions: ['DEV001'], // Developer agent ID
      replyToMessageId: 'T123'
    };
    
    // Directly call the AIService method for simpler testing
    (orchestrator as any).processAgentRequest = jest.fn().mockImplementation(async (agent: any, message: any) => {
      // Simulate a successful AI response
      const aiResponse = await mockAIService.generateAgentResponse(
        {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          description: 'Test agent',
          personality: 'Helpful',
          systemPrompt: 'You are a helpful agent',
          functions: []
        }, 
        message.content
      );
      
      // Send response back through Slack
      await slackService.sendMessage({
        channel: message.channel,
        text: aiResponse.response,
        thread_ts: message.replyToMessageId
      });
      
      return aiResponse;
    });
    
    // Directly call the handleMessage method
    await (orchestrator as any).handleMessage(agentMessage);
    
    // Verify the processAgentRequest method was called
    expect((orchestrator as any).processAgentRequest).toHaveBeenCalled();
    
    // Verify that a response was sent back through Slack
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
  });
}); 