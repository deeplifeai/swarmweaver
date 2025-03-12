import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { SlackMessage, SlackChannel } from '@/types/slack/SlackTypes';
import { AgentMessage } from '@/types/agents/Agent';
import { config } from '@/config/config';
import { eventBus, EventType } from '@/utils/EventBus';

export class SlackService {
  private app: App;
  private client: WebClient;
  private mentionRegex = /<@([A-Z0-9]+)>/g;
  private processedMessageIds = new Set<string>(); // Track processed message IDs
  
  constructor() {
    this.app = new App({
      token: config.slack.botToken,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken,
      logLevel: LogLevel.DEBUG
    });
    
    this.client = this.app.client;
    
    // Initialize event listeners
    this.initEventListeners();
  }
  
  private initEventListeners() {
    // Listen for message events
    this.app.message(async ({ message, say }) => {
      // Only process regular messages with text (not ephemeral, app messages, etc)
      if (message.subtype === undefined && 'text' in message && 'user' in message) {
        const messageText = message.text || '';
        const mentionResult = this.processMentions(messageText);
        
        if (mentionResult.targetAgents.length > 0) {
          // Process message with mentions
          const agentMessage: AgentMessage = {
            id: message.ts as string,
            timestamp: new Date().toISOString(),
            agentId: message.user as string,
            content: this.cleanMessage(messageText),
            channel: message.channel as string,
            mentions: mentionResult.targetAgents,
            // Only include thread_ts if it exists in the message
            replyToMessageId: 'thread_ts' in message ? message.thread_ts as string : undefined
          };
          
          // Emit message event for agent orchestration using EventBus
          this.emitMessageEvent(agentMessage);
        }
      }
    });

    // Handle app_mention events (direct mentions of the bot)
    this.app.event('app_mention', async ({ event, say }) => {
      const mentionResult = this.processMentions(event.text || '');
      
      if (mentionResult.targetAgents.length > 0) {
        const agentMessage: AgentMessage = {
          id: event.ts as string,
          timestamp: new Date().toISOString(),
          agentId: event.user as string,
          content: this.cleanMessage(event.text || ''),
          channel: event.channel as string,
          mentions: mentionResult.targetAgents,
          // Only include thread_ts if it exists in the event
          replyToMessageId: 'thread_ts' in event ? event.thread_ts as string : undefined
        };
        
        this.emitMessageEvent(agentMessage);
      }
    });

    // Error handler
    this.app.error(async (error) => {
      console.error('Slack app error:', error);
      eventBus.emit(EventType.ERROR, { source: 'SlackService', error });
    });
  }
  
  start() {
    this.app.start(config.port)
      .then(() => {
        console.log(`⚡️ Slack Bolt app is running on port ${config.port}`);
      })
      .catch((error) => {
        console.error('Error starting Slack app:', error);
        eventBus.emit(EventType.ERROR, { source: 'SlackService', error, message: 'Failed to start Slack app' });
      });
  }
  
  async sendMessage(message: SlackMessage): Promise<any> {
    try {
      const response = await this.client.chat.postMessage({
        channel: message.channel,
        text: message.text,
        thread_ts: message.thread_ts,
        blocks: message.blocks,
        attachments: message.attachments
      });
      
      return response;
    } catch (error) {
      console.error('Error sending Slack message:', error);
      eventBus.emit(EventType.ERROR, { source: 'SlackService', error, message: 'Failed to send message' });
      throw error;
    }
  }
  
  async getChannels(): Promise<SlackChannel[]> {
    try {
      const response = await this.client.conversations.list();
      
      if (response.channels) {
        return response.channels
          .filter(channel => channel.id && channel.name)
          .map(channel => ({
            id: channel.id as string,
            name: channel.name as string
          }));
      }
      
      return [];
    } catch (error) {
      console.error('Error getting channels:', error);
      eventBus.emit(EventType.ERROR, { source: 'SlackService', error, message: 'Failed to get channels' });
      throw error;
    }
  }
  
  /**
   * Process mentions in a message and determine target agents
   * Rules:
   * 1. If mentions are comma-separated (e.g. "<@U1234>, <@U5678>"), message goes to both agents
   * 2. Otherwise, only the first mentioned agent receives the message
   */
  private processMentions(text: string): {
    targetAgents: string[];
    allMentions: string[];
  } {
    const allMentions: string[] = [];
    const targetAgents: string[] = [];
    
    // Reset regex
    this.mentionRegex.lastIndex = 0;
    
    // Extract all mentions
    let match;
    while ((match = this.mentionRegex.exec(text)) !== null) {
      allMentions.push(match[1]);
    }
    
    if (allMentions.length === 0) {
      return { targetAgents: [], allMentions: [] };
    }
    
    // Check if this is a comma-separated list of mentions
    // Look for pattern like "<@U1234>, <@U5678>" near the start of the message
    const commaPattern = new RegExp(`^(.*?<@[A-Z0-9]+>\\s*,\\s*<@[A-Z0-9]+>).*$`);
    const commaPatternMatch = text.match(commaPattern);
    
    if (commaPatternMatch) {
      // This is a comma-separated list, get all mentions in the comma-separated part
      const commaSeparatedPart = commaPatternMatch[1];
      
      // Find all mentions in the comma-separated part
      const commaRegex = /<@([A-Z0-9]+)>/g;
      let commaMatch;
      
      while ((commaMatch = commaRegex.exec(commaSeparatedPart)) !== null) {
        targetAgents.push(commaMatch[1]);
      }
      
      console.log('Message with comma-separated mentions targeting:', targetAgents);
    } else {
      // Not comma-separated, just use the first mention
      targetAgents.push(allMentions[0]);
      console.log('Message with mentions targeting only first agent:', targetAgents[0]);
    }
    
    return { targetAgents, allMentions };
  }
  
  /**
   * Extract all mentions from a message text
   */
  private extractMentions(text: string): string[] {
    const mentions: string[] = [];
    
    // Reset regex
    this.mentionRegex.lastIndex = 0;
    
    let match;
    while ((match = this.mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }
  
  /**
   * Clean message text by replacing mention formats
   */
  private cleanMessage(text: string): string {
    // Remove the mention format <@USERID> and replace with @user
    return text.replace(this.mentionRegex, '@user');
  }
  
  /**
   * Emit message event to the event bus
   */
  private emitMessageEvent(message: AgentMessage) {
    // Check if we've already processed this message
    if (this.processedMessageIds.has(message.id)) {
      console.log(`Skipping duplicate message processing for ID: ${message.id}`);
      return;
    }
    
    // Add this message ID to our processed set
    this.processedMessageIds.add(message.id);
    
    // Implement a simple cleanup to prevent memory leaks
    // Keep the set size under control by removing older entries when it gets too large
    if (this.processedMessageIds.size > 1000) {
      const oldestEntries = Array.from(this.processedMessageIds).slice(0, 500);
      oldestEntries.forEach(id => this.processedMessageIds.delete(id));
    }
    
    // Emit event using EventBus
    console.log('Agent message received:', message);
    eventBus.emitAgentMessage(message);
  }
} 