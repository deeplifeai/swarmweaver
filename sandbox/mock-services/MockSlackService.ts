import { SlackMessage, SlackChannel } from '../types/SlackTypes';
import { AgentMessage } from '../types/AgentTypes';
import eventBus, { EVENTS } from '../utils/EventBus';
import chalk from 'chalk';
import readline from 'readline';

/**
 * MockSlackService - Simulates Slack messaging for testing
 * without requiring an actual Slack connection
 */
export class MockSlackService {
  private channels: SlackChannel[] = [];
  private messages: Record<string, SlackMessage[]> = {};
  private rl: readline.Interface;
  private botUserId = 'B01MOCKBOT';
  private currentUser = {
    id: 'U01MOCKUSER',
    name: 'mockuser'
  };

  constructor() {
    // Initialize with default channels
    this.channels = [
      { id: 'C01GENERAL', name: 'general' },
      { id: 'C02DEV', name: 'development' },
      { id: 'C03RANDOM', name: 'random' }
    ];
    
    // Initialize message store
    this.channels.forEach(channel => {
      this.messages[channel.id] = [];
    });
    
    console.log(chalk.cyan('🤖 MockSlackService initialized'));
    console.log(chalk.gray('Available channels: ' + this.channels.map(ch => ch.name).join(', ')));
    
    // Set up readline interface for CLI
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.setupCLI();
  }
  
  /**
   * Set up the command line interface for user interaction
   */
  private setupCLI() {
    console.log(chalk.yellow('\n--- Mock Slack CLI ---'));
    console.log(chalk.gray('Send messages in format: @agent_name your message here'));
    console.log(chalk.gray('Send to multiple agents: @agent1, @agent2 your message here'));
    console.log(chalk.gray('Or type "channel <name>" to switch channels'));
    console.log(chalk.gray('Type "exit" to quit\n'));
    
    let currentChannel = this.channels[0];
    console.log(chalk.green(`Current channel: #${currentChannel.name}`));
    
    this.rl.on('line', (input) => {
      // Handle channel switching
      if (input.startsWith('channel ')) {
        const channelName = input.substring(8).trim();
        const channel = this.channels.find(ch => ch.name === channelName);
        
        if (channel) {
          currentChannel = channel;
          console.log(chalk.green(`Switched to channel: #${channel.name}`));
        } else {
          console.log(chalk.red(`Channel #${channelName} not found`));
        }
        return;
      }
      
      // Handle exit command
      if (input === 'exit') {
        console.log(chalk.yellow('Exiting Mock Slack CLI'));
        this.rl.close();
        process.exit(0);
        return;
      }
      
      // Process message
      const message = this.createMessage(input, currentChannel.id);
      
      // Store and emit the message
      this.messages[currentChannel.id].push(message);
      
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] ${this.currentUser.name}: ${message.text}`));
      
      // Process mentions and emit to the event bus for agent processing
      const mentionResult = this.processMentions(message.text);
      if (mentionResult.targetAgents.length > 0) {
        message.mentions = mentionResult.targetAgents;
        
        // Log which agents will receive the message
        console.log(chalk.gray(`Message will be sent to: ${message.mentions.join(', ')}`));
        
        // Emit the message to the event bus for agent processing
        eventBus.publish(EVENTS.SLACK_MESSAGE, message);
      }
    });
  }
  
  /**
   * Create a SlackMessage object from input text
   */
  private createMessage(text: string, channelId: string): SlackMessage {
    return {
      text,
      user: this.currentUser.id,
      ts: Date.now().toString(),
      channel: channelId
    };
  }
  
  /**
   * Process mentions in a message and determine target agents
   * Rules:
   * 1. If mentions are comma-separated (e.g. "@agent1, @agent2"), message goes to both
   * 2. Otherwise, only the first mentioned agent receives the message
   */
  private processMentions(text: string): { 
    targetAgents: string[],
    allMentions: string[] 
  } {
    const mentionRegex = /@([a-zA-Z_]+)/g;
    const allMentions: string[] = [];
    const targetAgents: string[] = [];
    let match;
    
    // Extract all mentions
    while ((match = mentionRegex.exec(text)) !== null) {
      allMentions.push(match[1]);
    }
    
    if (allMentions.length === 0) {
      return { targetAgents: [], allMentions: [] };
    }
    
    // Check if this is a comma-separated list of mentions
    // Look for pattern like "@agent1, @agent2" near the start of the message
    const commaPatternRegex = /^(.*?@[a-zA-Z_]+\s*,\s*@[a-zA-Z_]+).*$/;
    const commaPatternMatch = text.match(commaPatternRegex);
    
    if (commaPatternMatch) {
      // This is a comma-separated list, get all mentions
      // Extract all agents from the beginning part that has comma-separated mentions
      const commaSeparatedPart = commaPatternMatch[1];
      let commaMatch;
      const commaRegex = /@([a-zA-Z_]+)/g;
      
      while ((commaMatch = commaRegex.exec(commaSeparatedPart)) !== null) {
        targetAgents.push(commaMatch[1]);
      }
    } else {
      // Not comma-separated, just use the first mention
      targetAgents.push(allMentions[0]);
    }
    
    return { targetAgents, allMentions };
  }
  
  /**
   * Extract mentions from a message
   * Format: @agent_name
   */
  private extractMentions(text: string): string[] {
    const mentionRegex = /@([a-zA-Z_]+)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }
  
  /**
   * Clean a message by removing mentions
   */
  private cleanMessage(text: string): string {
    return text.replace(/@([a-zA-Z_]+)/g, '').trim();
  }
  
  /**
   * Send a response message from the bot
   */
  sendMessage(channelId: string, text: string, thread_ts?: string): SlackMessage {
    const message: SlackMessage = {
      text,
      user: this.botUserId,
      ts: Date.now().toString(),
      channel: channelId,
      thread_ts
    };
    
    this.messages[channelId].push(message);
    
    // Display in CLI
    const channel = this.channels.find(ch => ch.id === channelId);
    console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] [BOT] in #${channel?.name || channelId}: ${text}`));
    
    return message;
  }
  
  /**
   * Process an agent response and send it as a Slack message
   */
  processAgentResponse(agentName: string, response: AgentMessage, originalMessage: SlackMessage): void {
    const responseText = `@${agentName}: ${response.content}`;
    this.sendMessage(originalMessage.channel, responseText, originalMessage.ts);
    
    // Process any function calls in the response
    if (response.function_calls && response.function_calls.length > 0) {
      response.function_calls.forEach(fcall => {
        const functionText = `[Function call] ${fcall.name}(${JSON.stringify(fcall.arguments)})`;
        this.sendMessage(originalMessage.channel, functionText, originalMessage.ts);
        
        // Emit function call event
        eventBus.publish(EVENTS.FUNCTION_CALLED, fcall, originalMessage);
      });
    }
  }
} 