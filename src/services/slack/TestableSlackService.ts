import { EventEmitter } from 'events';
import { config } from '@/config/config';

// Define message interface without conflicting with the one in SlackService
export interface TestableSlackMessage {
  channel: string;
  threadTs?: string;
  text: string;
  userId: string;
}

export function mentionUser(userId: string): string {
  return `<@${userId}>`;
}

// Simple event types for testing
export enum TestEventType {
  MESSAGE_SENT = 'message_sent'
}

// Create a local event bus for testing
export const testEventBus = new EventEmitter();

export class TestableSlackService {
  private apiKey: string;
  private static instance: TestableSlackService;
  
  constructor() {
    this.apiKey = config.slack.botToken || 'test-token';
    
    if (TestableSlackService.instance) {
      return TestableSlackService.instance;
    }
    
    TestableSlackService.instance = this;
  }
  
  async start(): Promise<void> {
    console.log('Starting test Slack service...');
    return Promise.resolve();
  }
  
  async sendMessage(message: TestableSlackMessage): Promise<void> {
    try {
      console.log(`[TEST] Sending message to channel ${message.channel}: ${message.text}`);
      
      // Emit an event for testing
      testEventBus.emit(TestEventType.MESSAGE_SENT, {
        message,
        timestamp: new Date().toISOString()
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
  
  processOutgoingMessageWithMentions(text: string): string[] {
    // Extract mentions from text
    const mentions: string[] = [];
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      // In a real implementation, would look up the user ID
      mentions.push(mentionedName);
    }
    
    return mentions;
  }
} 