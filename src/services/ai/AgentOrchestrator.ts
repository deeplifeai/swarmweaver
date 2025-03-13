import { Agent, AgentMessage, AgentRegistry } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { SlackMessage } from '@/types/slack/SlackTypes';
import { SlackService } from '@/services/slack/SlackService';
import { AIService } from '@/services/ai/AIService';
import { config } from '@/config/config';
import { eventBus, EventType } from '@/utils/EventBus';
import { setCurrentIssueNumber, setIssueNumber } from '../github/GitHubFunctions';

export class AgentOrchestrator {
  private slackService: SlackService;
  private aiService: AIService;
  private agents: AgentRegistry = {};
  private conversations: Record<string, OpenAIMessage[]> = {};
  
  constructor(slackService: SlackService, aiService: AIService) {
    this.slackService = slackService;
    this.aiService = aiService;
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Subscribe to agent messages from Slack via EventBus
    eventBus.on(EventType.AGENT_MESSAGE, (message: AgentMessage) => {
      this.handleMessage(message).catch(error => {
        console.error('Error handling agent message:', error);
        eventBus.emit(EventType.ERROR, { 
          source: 'AgentOrchestrator', 
          error, 
          message: 'Failed to handle agent message' 
        });
      });
    });

    // Subscribe to error events for logging
    eventBus.on(EventType.ERROR, (error) => {
      console.error(`[${error.source}] Error:`, error.message || error.error);
    });
  }
  
  registerAgent(agent: Agent) {
    this.agents[agent.id] = agent;
    console.log(`Agent registered: ${agent.name} (${agent.role})`);
  }
  
  async handleMessage(message: AgentMessage) {
    try {
      // Check if the message mentions any of our agents
      for (const mentionId of message.mentions) {
        const agent = this.getAgentById(mentionId);
        
        if (agent) {
          await this.processAgentRequest(agent, message);
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
      eventBus.emit(EventType.ERROR, { 
        source: 'AgentOrchestrator', 
        error, 
        message: 'Failed to handle message' 
      });
    }
  }
  
  private async processAgentRequest(agent: Agent, message: AgentMessage) {
    try {
      // Get or create conversation history
      const conversationId = this.getConversationId(message.channel, message.replyToMessageId);
      const history = this.getConversationHistory(conversationId);
      
      // Extract issue number from message if possible
      let enhancedMessage = message.content;
      const issueNumbers = this.extractIssueNumbers(message.content);
      if (issueNumbers.length > 0) {
        // Add explicit instruction to get the issue if message mentions issue numbers
        enhancedMessage = `${message.content}\n\nIMPORTANT: The message mentions issue #${issueNumbers[0]}. Remember to first call getRepositoryInfo() and then getIssue({number: ${issueNumbers[0]}}) to get details about this issue before implementation.`;
      }
      
      // Generate response from agent
      const { response, functionCalls } = await this.aiService.generateAgentResponse(
        agent,
        enhancedMessage,
        history
      );
      
      // Format any function call results
      let fullResponse = response;
      
      if (functionCalls.length > 0) {
        const functionResults = this.aiService.extractFunctionResults(functionCalls);
        fullResponse += '\n\n' + functionResults;
      }
      
      // Send the response back to Slack
      const slackMessage: SlackMessage = {
        channel: message.channel,
        text: fullResponse,
        thread_ts: message.replyToMessageId
      };
      
      await this.slackService.sendMessage(slackMessage);
      
      // Update conversation history
      this.updateConversationHistory(conversationId, message.content, fullResponse);
    } catch (error) {
      console.error(`Error processing request for agent ${agent.name}:`, error);
      eventBus.emit(EventType.ERROR, { 
        source: 'AgentOrchestrator', 
        error, 
        message: `Failed to process request for agent ${agent.name}` 
      });
      
      // Send error message back to Slack
      const errorMessage: SlackMessage = {
        channel: message.channel,
        text: `I encountered an error processing your request: ${error.message}`,
        thread_ts: message.replyToMessageId
      };
      
      await this.slackService.sendMessage(errorMessage);
    }
  }
  
  private getAgentById(id: string): Agent | undefined {
    return this.agents[id];
  }
  
  private getConversationId(channel: string, threadTs?: string): string {
    return `${channel}:${threadTs || 'main'}`;
  }
  
  private getConversationHistory(conversationId: string): OpenAIMessage[] {
    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = [];
    }
    
    return this.conversations[conversationId];
  }
  
  private updateConversationHistory(conversationId: string, userMessage: string, assistantMessage: string) {
    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = [];
    }
    
    this.conversations[conversationId].push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage }
    );
    
    // Limit conversation history (last 10 messages)
    if (this.conversations[conversationId].length > 10) {
      this.conversations[conversationId] = this.conversations[conversationId].slice(-10);
    }
  }
  
  // Extract issue numbers from a message
  private extractIssueNumbers(content: string): number[] {
    const issueRegex = /#(\d+)\b|\bissue\s*#?(\d+)\b/gi;
    const matches = Array.from(content.matchAll(issueRegex));
    
    return matches
      .map(match => parseInt(match[1] || match[2], 10))
      .filter(num => !isNaN(num));
  }

  // Determine which agent should handle a message based on content
  private determineAgentFromContent(content: string): Agent | null {
    console.log('Determining agent from content:', content);
    
    // 1. Check for explicit role references like "As the PROJECT_MANAGER" or "PROJECT_MANAGER,"
    const rolePrefixes = [
      { pattern: /\b(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)\b/i, group: 1 },
      { pattern: /As the (PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)/i, group: 1 },
      { pattern: /(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER),/i, group: 1 },
      { pattern: /@(PROJECT[_\s]MANAGER|DEVELOPER|CODE[_\s]REVIEWER|QA[_\s]TESTER|TECHNICAL[_\s]WRITER)/i, group: 1 },
    ];

    for (const { pattern, group } of rolePrefixes) {
      const match = content.match(pattern);
      if (match) {
        const roleName = match[group].replace(/\s/g, '_').toUpperCase();
        console.log(`Found explicit role mention: ${roleName}`);
        
        // Find an agent with this role
        const agentEntries = Object.entries(this.agents);
        for (const [id, agent] of agentEntries) {
          if (agent.role === roleName) {
            return agent;
          }
        }
      }
    }

    // 2. Default to first agent as fallback if no specific role is detected
    const agentEntries = Object.entries(this.agents);
    if (agentEntries.length > 0) {
      return agentEntries[0][1];
    }
    
    return null;
  }

  private async handleAgentMessage(message: AgentMessage) {
    // Extract mentions from the message
    if (!message.mentions || message.mentions.length === 0) {
      console.log('No mentions in message, ignoring');
      return;
    }
    
    console.log('Agent message received:', JSON.stringify(message, null, 2));
    eventBus.emit(EventType.AGENT_MESSAGE_RECEIVED, message);
    
    // Check if this is a message with specific agent mentions
    if (message.mentions.length === 1) {
      console.log('Message with mentions targeting only first agent:', message.mentions[0]);
      
      // Determine which agent to use for this message
      const agent = this.determineAgentFromContent(message.content);
      if (agent) {
        // Extract issue numbers from the message
        const issueNumbers = this.extractIssueNumbers(message.content);
        if (issueNumbers.length > 0) {
          console.log(`Extracted issue #${issueNumbers[0]} from message content`);
          
          // Set the current issue number in the GitHubFunctions workflow state
          setCurrentIssueNumber(issueNumbers[0]);
        }
        
        return this.processAgentRequest(agent, message);
      }
    }
    
    // If we can't determine which agent to use, pick the first one mentioned
    const firstMentionedAgent = this.agents[message.mentions[0]];
    if (firstMentionedAgent) {
      return this.processAgentRequest(firstMentionedAgent, message);
    }
    
    console.log('No valid agent found for mentions:', message.mentions);
  }
} 