import { Agent, AgentMessage, AgentRegistry } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { SlackMessage } from '@/types/slack/SlackTypes';
import { SlackService } from '@/services/slack/SlackService';
import { AIService } from '@/services/ai/AIService';
import { config } from '@/config/config';
import { eventBus, EventType } from '@/utils/EventBus';

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
      
      // Generate response from agent
      const { response, functionCalls } = await this.aiService.generateAgentResponse(
        agent,
        message.content,
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
} 