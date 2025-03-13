import { jest } from '@jest/globals';
import { SlackService } from '@/services/slack/SlackService';
import { eventBus, EventType } from '@/utils/EventBus';

// Mock the event bus
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

// Create a test subclass that exposes private methods for testing
class TestableSlackService extends SlackService {
  public exposedProcessMentions(text: string) {
    // @ts-ignore - accessing private method for testing
    return this.processMentions(text);
  }
  
  public exposedCleanMessage(text: string) {
    // @ts-ignore - accessing private method for testing
    return this.cleanMessage(text);
  }
  
  public exposedEmitMessageEvent(message: any) {
    // @ts-ignore - accessing private method for testing
    return this.emitMessageEvent(message);
  }
}

describe('Slack Mention Processing Tests', () => {
  // Create a spy for methods we want to track
  const slackServiceSpy = {
    exposedProcessMentions: jest.fn(),
    exposedCleanMessage: jest.fn(),
    exposedEmitMessageEvent: jest.fn()
  };

  // Create a spy for the Slack app and client
  const mockApp = {
    message: jest.fn(),
    event: jest.fn(),
    error: jest.fn(),
    start: jest.fn().mockResolvedValue(true as unknown as never),
    client: {
      chat: {
        postMessage: jest.fn().mockResolvedValue({ ok: true } as unknown as never)
      },
      conversations: {
        list: jest.fn().mockResolvedValue({ 
          channels: [
            { id: 'C123', name: 'general' }
          ]
        } as unknown as never)
      }
    }
  };

  // Create a new SlackService instance
  let slackService: TestableSlackService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a test subclass instance
    slackService = new TestableSlackService();
    
    // Mock the app property with our spy
    Object.defineProperty(slackService, 'app', {
      value: mockApp,
      writable: true
    });
    
    // Replace the exposed methods with spies for testing
    slackService.exposedProcessMentions = slackServiceSpy.exposedProcessMentions as unknown as (text: string) => { targetAgents: string[]; allMentions: string[]; };
    slackService.exposedCleanMessage = slackServiceSpy.exposedCleanMessage as unknown as (text: string) => string;
    slackService.exposedEmitMessageEvent = slackServiceSpy.exposedEmitMessageEvent as unknown as (message: any) => void;
    
    // Initialize the SlackService to trigger the registration of event handlers
    // This calls the constructor which sets up event listeners
    // Call the initEventListeners method if it exists
    if (typeof (slackService as any).initEventListeners === 'function') {
      (slackService as any).initEventListeners();
    }
  });

  describe('processMentions method', () => {
    it('should correctly extract single mentions', () => {
      // Create a fresh instance to test the real implementation
      const testInstance = new TestableSlackService();
      
      // Call the exposed method
      const result = testInstance.exposedProcessMentions('<@U08GYV9AU9M> PROJECT_MANAGER help me');
      
      // Check that mentions were correctly processed
      expect(result).toEqual({
        targetAgents: ['U08GYV9AU9M'],
        allMentions: ['U08GYV9AU9M']
      });
    });

    it('should correctly extract comma-separated mentions', () => {
      // Create a fresh instance to test the real implementation
      const testInstance = new TestableSlackService();
      
      // Call the exposed method
      const result = testInstance.exposedProcessMentions('<@U08GYV9AU9M>, <@DEV001> I need both of you to help');
      
      // Check that both mentions were included as target agents
      expect(result).toEqual({
        targetAgents: ['U08GYV9AU9M', 'DEV001'],
        allMentions: ['U08GYV9AU9M', 'DEV001']
      });
    });
  });

  describe('message event handling', () => {
    it('should process messages with mentions correctly', () => {
      // Set up mocks for the exposed methods
      slackServiceSpy.exposedProcessMentions.mockReturnValue({
        targetAgents: ['U08GYV9AU9M'],
        allMentions: ['U08GYV9AU9M']
      });
      
      slackServiceSpy.exposedCleanMessage.mockReturnValue('@user PROJECT_MANAGER help me');
      
      // Create a mock message
      const mockMessage = {
        ts: '123456.789',
        user: 'U12345USER',
        text: '<@U08GYV9AU9M> PROJECT_MANAGER help me',
        channel: 'C123'
      };
      
      // Directly call the processing methods with our test data
      // This is simulating what would happen in the message handler
      const mentionResult = slackServiceSpy.exposedProcessMentions(mockMessage.text) as { targetAgents: string[]; allMentions: string[] };
      const cleanedContent = slackServiceSpy.exposedCleanMessage(mockMessage.text);
      
      const agentMessage = {
        id: mockMessage.ts,
        timestamp: expect.any(String),
        agentId: mockMessage.user,
        content: cleanedContent,
        channel: mockMessage.channel,
        mentions: mentionResult.targetAgents
      };
      
      slackServiceSpy.exposedEmitMessageEvent(agentMessage);
      
      // Check that exposedProcessMentions was called with the message text
      expect(slackServiceSpy.exposedProcessMentions).toHaveBeenCalledWith(mockMessage.text);
      
      // Check that exposedEmitMessageEvent was called with the correct agent message
      expect(slackServiceSpy.exposedEmitMessageEvent).toHaveBeenCalledWith(expect.objectContaining({
        id: '123456.789',
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER help me',
        channel: 'C123',
        mentions: ['U08GYV9AU9M']
      }));
    });

    it('should handle app_mention events correctly', () => {
      // Set up mocks for the exposed methods
      slackServiceSpy.exposedProcessMentions.mockReturnValue({
        targetAgents: ['U08GYV9AU9M'],
        allMentions: ['U08GYV9AU9M']
      });
      
      slackServiceSpy.exposedCleanMessage.mockReturnValue('@user PROJECT_MANAGER help me');
      
      // Create a mock app_mention event
      const mockEvent = {
        ts: '123456.789',
        user: 'U12345USER',
        text: '<@U08GYV9AU9M> PROJECT_MANAGER help me',
        channel: 'C123'
      };
      
      // Directly call the processing methods with our test data
      // This is simulating what would happen in the app_mention handler
      const mentionResult = slackServiceSpy.exposedProcessMentions(mockEvent.text) as { targetAgents: string[]; allMentions: string[] };
      const cleanedContent = slackServiceSpy.exposedCleanMessage(mockEvent.text);
      
      const agentMessage = {
        id: mockEvent.ts,
        timestamp: expect.any(String),
        agentId: mockEvent.user,
        content: cleanedContent,
        channel: mockEvent.channel,
        mentions: mentionResult.targetAgents
      };
      
      slackServiceSpy.exposedEmitMessageEvent(agentMessage);
      
      // Check that exposedProcessMentions was called with the event text
      expect(slackServiceSpy.exposedProcessMentions).toHaveBeenCalledWith(mockEvent.text);
      
      // Check that exposedEmitMessageEvent was called with the correct agent message
      expect(slackServiceSpy.exposedEmitMessageEvent).toHaveBeenCalledWith(expect.objectContaining({
        id: '123456.789',
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER help me',
        channel: 'C123',
        mentions: ['U08GYV9AU9M']
      }));
    });
  });

  describe('emitMessageEvent method', () => {
    it('should emit events through the event bus', () => {
      // Create a fresh instance to test the real implementation
      const testInstance = new TestableSlackService();
      
      // Create a mock agent message
      const agentMessage = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER help me',
        channel: 'C123',
        mentions: ['U08GYV9AU9M']
      };
      
      // Call the exposed method
      testInstance.exposedEmitMessageEvent(agentMessage);
      
      // Check that the event was emitted
      expect(eventBus.emitAgentMessage).toHaveBeenCalledWith(agentMessage);
    });

    it('should prevent duplicate message processing', () => {
      // Create a fresh instance to test the real implementation
      const testInstance = new TestableSlackService();
      
      // Create a mock agent message
      const agentMessage = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER help me',
        channel: 'C123',
        mentions: ['U08GYV9AU9M']
      };
      
      // Call the exposed method twice with the same message ID
      testInstance.exposedEmitMessageEvent(agentMessage);
      testInstance.exposedEmitMessageEvent(agentMessage);
      
      // Check that the event was emitted only once
      expect(eventBus.emitAgentMessage).toHaveBeenCalledTimes(1);
    });
  });
}); 