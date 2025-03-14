import { App, LogLevel } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { SlackMessage as SlackAPIMessage, SlackChannel as SlackAPIChannel } from '@/types/slack/SlackTypes';
import { AgentMessage } from '@/types/agents/Agent';
import { config } from '@/config/config';
import { eventBus, EventType } from '@/services/eventBus';

// Our internal SlackMessage interface
export interface SlackMessage {
  channel: string;
  threadTs?: string;
  text: string;
  userId: string;
}

export interface SlackChannel {
  id: string;
  name: string;
}

export function mentionUser(userId: string): string {
  return `<@${userId}>`;
}

export class SlackService {
  private app: App;
  private client: WebClient;
  private mentionRegex = /<@([A-Z0-9]+)>/g;
  private processedMessageIds = new Set<string>(); // Track processed message IDs
  private apiKey: string;
  private static instance: SlackService;
  
  constructor() {
    this.apiKey = config.slack.botToken;
    
    if (SlackService.instance) {
      return SlackService.instance;
    }
    
    SlackService.instance = this;
    
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
        
        // First, check for direct role mentions in the message (e.g., "DEVELOPER start working on issue 21")
        const directRoleMention = this.processDirectRoleMention(messageText);
        if (directRoleMention) {
          console.log('Direct role mention detected:', directRoleMention);
          
          // Process message with direct role mention
          const agentMessage: AgentMessage = {
            id: message.ts as string,
            timestamp: new Date().toISOString(),
            agentId: message.user as string,
            content: messageText,
            channel: message.channel as string,
            // Always include the bot ID to ensure the message is processed
            mentions: ['U08GYV9AU9M'], // Bot ID
            // Only include thread_ts if it exists in the message
            replyToMessageId: 'thread_ts' in message ? message.thread_ts as string : undefined
          };
          
          // Emit message event for agent orchestration using EventBus
          this.emitMessageEvent(agentMessage);
          return;
        }
        
        // If no direct role mention, proceed with regular mention processing
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
      eventBus.emit(EventType.ERROR, { 
        source: 'SlackService', 
        error,
        message: error.message || 'An error occurred in Slack service'
      });
    });
  }
  
  async start() {
    console.log('Starting Slack service...');
    this.app.start(config.port)
      .then(() => {
        console.log(`⚡️ Slack Bolt app is running on port ${config.port}`);
      })
      .catch((error) => {
        console.error('Error starting Slack app:', error);
        eventBus.emit(EventType.ERROR, { source: 'SlackService', error, message: 'Failed to start Slack app' });
      });
  }
  
  async sendMessage(message: SlackMessage | SlackAPIMessage): Promise<void> {
    try {
      console.log(`Sending message to channel ${message.channel}: ${message.text}`);
      
      // Convert SlackAPIMessage to our internal format if needed
      const internalMessage: SlackMessage = {
        channel: message.channel,
        text: message.text,
        // Handle different property names between interfaces
        threadTs: 'threadTs' in message ? message.threadTs : ('thread_ts' in message ? message.thread_ts : undefined),
        // Add a default userId if not present
        userId: 'userId' in message ? message.userId : 'system'
      };
      
      // Check for agent name mentions (e.g., @Developer)
      const mentionedAgents = this.extractAgentNameMentions(internalMessage.text);
      
      // Emit message event using the EventBus
      eventBus.emit(EventType.MESSAGE_SENT, internalMessage);
      
      // If agent mentions are detected, emit an AgentMessage as well
      if (mentionedAgents.length > 0) {
        const agentMessage = {
          id: new Date().getTime().toString(),
          timestamp: new Date().toISOString(),
          agentId: internalMessage.userId,
          content: internalMessage.text,
          channel: internalMessage.channel,
          mentions: mentionedAgents,
          replyToMessageId: internalMessage.threadTs
        };
        
        // Emit agent message event
        eventBus.emit(EventType.MESSAGE_RECEIVED, agentMessage);
      }
      
      // Actually send the message to Slack
      await this.client.chat.postMessage({
        channel: internalMessage.channel,
        text: internalMessage.text,
        thread_ts: internalMessage.threadTs,
        blocks: ('blocks' in message) ? message.blocks : undefined,
        attachments: ('attachments' in message) ? message.attachments : undefined
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
  
  /**
   * Process an outgoing message that contains agent mentions
   * This bypasses the need to receive our own messages back from Slack
   */
  private processOutgoingMessageWithMentions(text: string): string[] {
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
    
    // Also check for agent references by name (e.g., "@Developer")
    const agentNameMentions = this.extractAgentNameMentions(text);
    allMentions.push(...agentNameMentions);
    
    if (allMentions.length === 0) {
      return { targetAgents: [], allMentions: [] };
    }
    
    // Check if this is a comma-separated list of mentions
    // Look for pattern like "<@U1234>, <@U5678>" near the start of the message
    const commaPattern = new RegExp(`^(.*?<@[A-Z0-9]+>\\s*,\\s*<@[A-Z0-9]+>).*$`);
    const commaPatternMatch = text.match(commaPattern);
    
    if (commaPatternMatch) {
      // This is a comma-separated list, all mentions are target agents
      targetAgents.push(...allMentions);
      console.log('Message with comma-separated mentions targeting:', targetAgents);
    } else {
      // Not a comma-separated list, only the first mention is the target agent
      // If we have mentions, use the first one as the target
      if (allMentions.length > 0) {
        targetAgents.push(allMentions[0]);
        console.log('Message with mention targeting agent:', targetAgents);
      }
    }
    
    return { targetAgents, allMentions };
  }
  
  /**
   * Extract mentions by agent name (e.g., "@Developer") and map them to agent IDs
   */
  private extractAgentNameMentions(text: string): string[] {
    // Define patterns for agent names, e.g., @Developer, @CodeReviewer, etc.
    // This regex now handles variations like @ Developer, @Developer, etc.
    const agentNameRegex = /@\s*(Developer|ProjectManager|CodeReviewer|QATester|TechnicalWriter|TeamLeader)\b/gi;
    const matches = Array.from(text.matchAll(agentNameRegex));
    
    // Map agent names to their corresponding IDs
    // This mapping should ideally come from a configuration or be more dynamic
    const agentNameToId: Record<string, string> = {
      'Developer': 'DEV001',
      'ProjectManager': 'U08GYV9AU9M',
      'CodeReviewer': 'CR001',
      'QATester': 'QA001',
      'TechnicalWriter': 'TW001',
      'TeamLeader': 'TL001'
    };
    
    // Extract matches and map to IDs
    return matches
      .map(match => {
        const agentName = match[1].trim();
        const agentId = agentNameToId[agentName];
        if (agentId) {
          console.log(`Found agent name mention: @${agentName} -> ${agentId}`);
        }
        return agentId;
      })
      .filter(id => id !== undefined);
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
    // Clean the message but preserve agent mentions
    // First, replace all <@USERID> mentions with @user
    let cleanedText = text.replace(this.mentionRegex, '@user');
    
    // Now explicitly preserve @Developer, @ProjectManager etc. mentions
    // This regex matches and captures agent references
    const agentReferenceRegex = /@\s*(Developer|ProjectManager|CodeReviewer|QATester|TechnicalWriter|TeamLeader)\b/gi;
    
    // Replace any existing agent mentions with standardized format
    cleanedText = cleanedText.replace(agentReferenceRegex, match => {
      // Get the agent name (removing the @ and any whitespace)
      const agentName = match.substring(1).trim();
      // Return in standardized format
      return `@${agentName}`;
    });
    
    return cleanedText;
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
    console.log('Handling message:', message);
    eventBus.emit(EventType.MESSAGE_RECEIVED, message);
  }

  /**
   * Process direct role mentions in a message (e.g., "DEVELOPER start working on issue 21")
   */
  private processDirectRoleMention(text: string): boolean {
    // Check for direct role mentions (e.g., "DEVELOPER", "PROJECT_MANAGER", etc.)
    const rolePattern = /\b(DEVELOPER|PROJECT[_\s]MANAGER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER|TEAM[_\s]LEADER)\b/i;
    const roleMatch = text.match(rolePattern);
    
    // Also check for issue numbers
    const issuePattern = /\b(?:issue|#)[\s]?(\d+)\b/i;
    const issueMatch = text.match(issuePattern);
    
    // Both a role and an issue number should be present for a direct command
    return !!(roleMatch && issueMatch);
  }
}

interface MessageOptions {
  channelId: string;
  threadTs: string | null;
  text: string;
  userId: string;
  blocks?: any[];
}

/**
 * Send a message to a Slack channel
 */
export const sendMessage = async (options: MessageOptions): Promise<void> => {
  // In a real implementation, this would use the Slack API
  // For now, we'll just implement a stub for testing
  console.log(`Sending message to channel ${options.channelId} from user ${options.userId}: ${options.text}`);
  
  return Promise.resolve();
};

/**
 * Parse mentions from a Slack message
 */
export const parseMentions = (text: string): string[] => {
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
};

/**
 * Get the display name for a user
 */
export const getUserDisplayName = async (userId: string): Promise<string> => {
  // This would normally fetch user info from Slack API
  // For now, let's return a placeholder
  return `User ${userId}`;
};

/**
 * Post a reaction to a message
 */
export const addReaction = async (
  channelId: string,
  timestamp: string,
  reaction: string
): Promise<void> => {
  console.log(`Adding reaction ${reaction} to message at ${timestamp} in channel ${channelId}`);
  
  return Promise.resolve();
}; 