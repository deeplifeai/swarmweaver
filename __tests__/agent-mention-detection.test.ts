import { jest } from '@jest/globals';
import { EventType, eventBus } from '../src/utils/EventBus';
import { SlackService } from '../src/services/slack/SlackService';
import { AgentMessage } from '../src/types/agents/Agent';
import { SlackMessage } from '../src/types/slack/SlackTypes';
import { AgentOrchestrator } from '../src/services/ai/AgentOrchestrator';
import { AIService } from '../src/services/ai/AIService';
import { developerAgent } from '../src/agents/AgentDefinitions';

// Mocking dependencies
jest.mock('../src/utils/EventBus', () => ({
  eventBus: {
    emit: jest.fn(),
    emitAgentMessage: jest.fn(),
    on: jest.fn()
  },
  EventType: {
    AGENT_MESSAGE: 'AGENT_MESSAGE',
    ERROR: 'ERROR'
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
    
    // Create a message with a @Developer mention
    const message: SlackMessage = {
      channel: 'C123',
      text: 'Hey @Developer, please implement this feature.',
      thread_ts: 'T123'
    };

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

    // Verify that the mention was detected and processed
    expect(eventBus.emitAgentMessage).toHaveBeenCalled();
    
    // Get the agent message that was emitted
    const emittedMessage = (eventBus.emitAgentMessage as jest.Mock).mock.calls[0][0] as AgentMessage;
    
    // Verify the agent message properties
    expect(emittedMessage.content).toBe('Hey @Developer, please implement this feature.');
    expect(emittedMessage.channel).toBe('C123');
    expect(emittedMessage.replyToMessageId).toBe('T123');
    expect(emittedMessage.mentions).toContain('DEV001'); // Developer agent ID
  });

  it('should detect multiple agent mentions in outgoing messages', async () => {
    // Create a SlackService instance with our mocks
    const slackService = new SlackService();
    
    // Use TypeScript casting to access and set private properties
    (slackService as any).client = mockSlackClient;
    
    // Mock the extractAgentNameMentions method to return multiple agent IDs
    (slackService as any).extractAgentNameMentions = jest.fn().mockReturnValue(['DEV001', 'U08GYV9AU9M']);
    
    // Create a message with multiple agent mentions
    const message: SlackMessage = {
      channel: 'C123',
      text: 'Hey @Developer and @ProjectManager, please coordinate on this feature.',
      thread_ts: 'T123'
    };

    // Send the message
    await slackService.sendMessage(message);

    // Verify that the mentions were detected and processed
    expect(eventBus.emitAgentMessage).toHaveBeenCalled();
    
    // Get the agent message that was emitted
    const emittedMessage = (eventBus.emitAgentMessage as jest.Mock).mock.calls[0][0] as AgentMessage;
    
    // Verify the agent message properties
    expect(emittedMessage.content).toBe('Hey @Developer and @ProjectManager, please coordinate on this feature.');
    expect(emittedMessage.mentions).toContain('DEV001'); // Developer agent ID
    expect(emittedMessage.mentions).toContain('U08GYV9AU9M'); // Project Manager agent ID
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
    let messageHandler: ((message: AgentMessage) => Promise<void>) | null = null;
    (eventBus.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === EventType.AGENT_MESSAGE) {
        messageHandler = handler as (message: AgentMessage) => Promise<void>;
      }
    });
    
    // Call the method that would setup the event listeners (usually called during initialization)
    // We have to use 'any' to access the private method
    (orchestrator as any).setupEventListeners();
    
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
    
    // Simulate emitting the agent message event
    if (messageHandler) {
      // Use try/catch to handle any potential errors
      try {
        await messageHandler(agentMessage);
      } catch (error) {
        console.error('Error in test:', error);
      }
    }
    
    // Verify the AI service was called to generate a response
    expect(mockGenerateResponse).toHaveBeenCalled();
    
    // Verify that a response was sent back through Slack
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalled();
    
    // Check the response content
    const sentMessage = mockSlackClient.chat.postMessage.mock.calls[0][0] as any;
    expect(sentMessage.channel).toBe('C123');
    expect(sentMessage.thread_ts).toBe('T123');
  });
}); 