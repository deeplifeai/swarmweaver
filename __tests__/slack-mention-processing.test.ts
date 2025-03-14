import { jest } from '@jest/globals';
import { SlackService } from '../src/services/slack/SlackService';
import { eventBus, EventType } from '../src/services/eventBus';

// Mock the event bus
jest.mock('../src/services/eventBus', () => ({
  eventBus: {
    on: jest.fn(),
    emit: jest.fn(),
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

// Create a test subclass that exposes private methods for testing
class TestableSlackService extends SlackService {
  public exposedProcessMentions(text: string) {
    // Get access to the private method implementation
    return this['processMentions'](text);
  }
  
  public exposedCleanMessage(text: string) {
    // Get access to the private method implementation
    return this['cleanMessage'](text);
  }
  
  public exposedEmitMessageEvent(message: any) {
    // Get access to the private method implementation
    return this['emitMessageEvent'](message);
  }
}

describe('Slack Mention Processing Tests', () => {
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
    
    // Initialize the SlackService to trigger the registration of event handlers
    // Call the initEventListeners method if it exists
    if (typeof (slackService as any).initEventListeners === 'function') {
      (slackService as any).initEventListeners();
    }
  });

  describe('processMentions method', () => {
    it('should correctly extract single mentions', () => {
      // Call the exposed method directly on our instance
      const result = slackService.exposedProcessMentions('<@U08GYV9AU9M> PROJECT_MANAGER help me');
      
      // Check that mentions were correctly processed
      expect(result).toEqual({
        targetAgents: ['U08GYV9AU9M'],
        allMentions: ['U08GYV9AU9M']
      });
    });

    it('should correctly extract comma-separated mentions', () => {
      // Call the exposed method directly on our instance
      const result = slackService.exposedProcessMentions('<@U08GYV9AU9M>, <@DEV001> I need both of you to help');
      
      // Check that both mentions were included as target agents
      expect(result).toEqual({
        targetAgents: ['U08GYV9AU9M', 'DEV001'],
        allMentions: ['U08GYV9AU9M', 'DEV001']
      });
    });
  });

  describe('message event handling', () => {
    beforeEach(() => {
      // Reset the eventBus.emit mock before each test
      (eventBus.emit as jest.Mock).mockClear();
      // Reset the processedMessageIds set to ensure a clean state for each test
      (slackService as any).processedMessageIds = new Set();
    });
    
    it('should process messages with mentions correctly', () => {
      // Create a mock message
      const mockMessage = {
        ts: '123456.789',
        user: 'U12345USER',
        text: '<@U08GYV9AU9M> PROJECT_MANAGER help me',
        channel: 'C123'
      };
      
      // Get the result of processMentions for testing
      const mentionResult = slackService.exposedProcessMentions(mockMessage.text);
      const cleanedContent = slackService.exposedCleanMessage(mockMessage.text);
      
      // Create an agent message to pass to emitMessageEvent
      const agentMessage = {
        id: mockMessage.ts,
        timestamp: new Date().toISOString(),
        agentId: mockMessage.user,
        content: cleanedContent,
        channel: mockMessage.channel,
        mentions: mentionResult.targetAgents
      };
      
      // Call emitMessageEvent with our agent message
      slackService.exposedEmitMessageEvent(agentMessage);
      
      // Check that eventBus.emit was called with MESSAGE_RECEIVED and the agent message
      expect(eventBus.emit).toHaveBeenCalledWith(
        EventType.MESSAGE_RECEIVED,
        expect.objectContaining({
          id: '123456.789',
          agentId: 'U12345USER',
          content: expect.any(String),
          channel: 'C123',
          mentions: ['U08GYV9AU9M']
        })
      );
    });

    it('should handle app_mention events correctly', async () => {
      // Create a mock app_mention event
      const mockEvent = {
        type: 'app_mention',
        user: 'U12345USER',
        text: '<@B12345BOT> PROJECT_MANAGER help me',
        ts: '123456.789',
        channel: 'C123',
        event_ts: '123456.789'
      };

      // Mock the processMentions method to return a specific result
      const mockMentionResult = {
        targetAgents: ['U08GYV9AU9M'],
        cleanedText: 'PROJECT_MANAGER help me'
      };
      
      (slackService as any).processMentions = jest.fn().mockReturnValue(mockMentionResult);
      (slackService as any).cleanMessage = jest.fn().mockReturnValue('PROJECT_MANAGER help me');
      
      // Create a mock event handler function
      const mockEventHandler = jest.fn();
      
      // Simulate the app_mention event by directly calling the event handler
      // that would be registered with app.event('app_mention', handler)
      const eventHandler = (slackService as any).app.event.mock.calls.find(
        call => call[0] === 'app_mention'
      )?.[1];
      
      if (eventHandler) {
        // Call the event handler with the mock event
        await eventHandler({ event: mockEvent, say: mockEventHandler });
        
        // Check that eventBus.emit was called with the correct agent message
        expect(eventBus.emit).toHaveBeenCalledWith(
          EventType.MESSAGE_RECEIVED,
          expect.objectContaining({
            id: '123456.789',
            agentId: 'U12345USER',
            content: 'PROJECT_MANAGER help me',
            channel: 'C123',
            mentions: ['U08GYV9AU9M']
          })
        );
      } else {
        fail('No event handler registered for app_mention events');
      }
    });
  });

  describe('emitMessageEvent method', () => {
    beforeEach(() => {
      // Reset the eventBus.emit mock before each test
      (eventBus.emit as jest.Mock).mockClear();
      
      // Reset the processedMessageIds set to ensure clean state for each test
      (slackService as any).processedMessageIds = new Set();
    });
    
    it('should emit events through the event bus', () => {
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
      slackService.exposedEmitMessageEvent(agentMessage);
      
      // Check that the event was emitted
      expect(eventBus.emit).toHaveBeenCalledWith(EventType.MESSAGE_RECEIVED, expect.anything());
    });

    it('should prevent duplicate message processing', () => {
      // Create a mock agent message
      const agentMessage = {
        id: '123456.789',
        timestamp: new Date().toISOString(),
        agentId: 'U12345USER',
        content: '@user PROJECT_MANAGER help me',
        channel: 'C123',
        mentions: ['U08GYV9AU9M']
      };
      
      // Call the exposed method twice with the same message id
      slackService.exposedEmitMessageEvent(agentMessage);
      slackService.exposedEmitMessageEvent(agentMessage);
      
      // Check that the event was emitted only once
      expect(eventBus.emit).toHaveBeenCalledTimes(1);
    });
  });
}); 