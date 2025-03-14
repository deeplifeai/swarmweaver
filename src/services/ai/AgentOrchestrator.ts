import { Agent, AgentMessage, AgentRegistry } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { SlackMessage } from '@/types/slack/SlackTypes';
import { SlackService } from '@/services/slack/SlackService';
import { AIService } from '@/services/ai/AIService';
import { config } from '@/config/config';
import { eventBus, EventType } from '@/utils/EventBus';
import { setCurrentIssueNumber, setIssueNumber } from '../github/GitHubFunctions';

// Debug flag for AgentHandover
const DEBUG_HANDOVER = process.env.DEBUG_HANDOVER === 'true';

/**
 * AgentHandover class manages the transitions between agents
 * based on message content and @mentions
 */
class AgentHandover {
  private agents: AgentRegistry;
  private memory: {
    conversations: Record<string, { 
      messages: Array<{ 
        content: string; 
        agentId: string;
        channel: string;
        timestamp: Date;
      }>,
      activeAgent: string | null
    }>
  };

  constructor(agents: AgentRegistry) {
    this.agents = agents;
    this.memory = { conversations: {} };
  }

  /**
   * Determine which agent should handle a message
   */
  determineHandover(message: AgentMessage, conversationId: string): string | null {
    // First prioritize explicit mentions in the message's mentions array
    if (message.mentions && message.mentions.length > 0) {
      // Check if any of the mentions correspond to a valid agent ID
      for (const mentionId of message.mentions) {
        if (this.agents[mentionId]) {
          if (DEBUG_HANDOVER) {
            console.log(`[HANDOVER] Using explicit mention from mentions array: ${mentionId} (${this.agents[mentionId].name})`);
          }
          return mentionId;
        }
      }
    }
    
    // If no valid agent IDs in the mentions array, check for @name mentions in the content
    const mentionRegex = /@([A-Za-z]+)/g;
    const mentions = Array.from(message.content.matchAll(mentionRegex), m => m[1]);
    
    if (DEBUG_HANDOVER) {
      console.log(`[HANDOVER] Detected mentions in content: ${JSON.stringify(mentions)}`);
    }
    
    // Check for explicit @mentions in the message
    if (mentions.length > 0) {
      // Find agent by name (case insensitive)
      for (const mention of mentions) {
        const mentionLower = mention.toLowerCase();
        const agentIds = Object.keys(this.agents);
        
        for (const agentId of agentIds) {
          const agent = this.agents[agentId];
          if (agent.name.toLowerCase() === mentionLower) {
            if (DEBUG_HANDOVER) {
              console.log(`[HANDOVER] Found agent by name mention: ${agent.name} (${agent.id})`);
            }
            return agent.id;
          }
        }
      }
    }
    
    // If no explicit mentions, check if we can determine the target from context
    // Get the conversation memory
    const conversation = this.memory.conversations[conversationId];
    if (conversation && conversation.activeAgent) {
      // Return the current active agent (continue the conversation)
      return conversation.activeAgent;
    }
    
    // If all else fails, check for role keywords in the message
    const roleKeywords = {
      'developer': 'DEVELOPER',
      'develop': 'DEVELOPER',
      'code': 'DEVELOPER',
      'implement': 'DEVELOPER',
      'bug': 'DEVELOPER',
      'review': 'CODE_REVIEWER',
      'pr': 'CODE_REVIEWER',
      'quality': 'QA_TESTER',
      'test': 'QA_TESTER',
      'doc': 'TECHNICAL_WRITER',
      'plan': 'PROJECT_MANAGER',
      'issue': 'PROJECT_MANAGER',
      'manage': 'PROJECT_MANAGER',
    };
    
    // Check if any role keywords are in the message
    const messageLower = message.content.toLowerCase();
    for (const [keyword, role] of Object.entries(roleKeywords)) {
      if (messageLower.includes(keyword)) {
        // Find an agent with this role
        const agentIds = Object.keys(this.agents);
        for (const agentId of agentIds) {
          const agent = this.agents[agentId];
          if (agent.role === role) {
            if (DEBUG_HANDOVER) {
              console.log(`[HANDOVER] Determined agent by keyword '${keyword}': ${agent.name} (${agent.id})`);
            }
            return agent.id;
          }
        }
      }
    }
    
    // No suitable agent found
    return null;
  }

  /**
   * Record a message in the conversation memory
   */
  recordMessage(message: AgentMessage, conversationId: string, handledByAgentId?: string): void {
    // Initialize conversation if it doesn't exist
    if (!this.memory.conversations[conversationId]) {
      this.memory.conversations[conversationId] = {
        messages: [],
        activeAgent: null
      };
    }
    
    // Add message to conversation history
    this.memory.conversations[conversationId].messages.push({
      content: message.content,
      agentId: message.agentId,
      channel: message.channel,
      timestamp: new Date()
    });
    
    // Update active agent if provided
    if (handledByAgentId) {
      this.memory.conversations[conversationId].activeAgent = handledByAgentId;
      if (DEBUG_HANDOVER) {
        console.log(`[HANDOVER] Updated active agent for conversation ${conversationId}: ${handledByAgentId}`);
      }
    }
  }

  /**
   * Get conversation context for an agent
   */
  getConversationContext(conversationId: string, limit: number = 5): string {
    const conversation = this.memory.conversations[conversationId];
    if (!conversation || conversation.messages.length === 0) {
      return '';
    }
    
    // Get the last N messages
    const recentMessages = conversation.messages.slice(-limit);
    
    // Format them into a string
    return recentMessages.map(msg => {
      const agentName = this.getAgentNameById(msg.agentId) || 'Unknown';
      return `${agentName}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Get agent name by ID
   */
  private getAgentNameById(agentId: string): string | null {
    const agent = this.agents[agentId];
    return agent ? agent.name : null;
  }
}

export class AgentOrchestrator {
  private slackService: SlackService;
  private aiService: AIService;
  private agents: AgentRegistry = {};
  private conversations: Record<string, OpenAIMessage[]> = {};
  private handover: AgentHandover;
  
  constructor(slackService: SlackService, aiService: AIService) {
    this.slackService = slackService;
    this.aiService = aiService;
    this.handover = new AgentHandover({});
    
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
    // Also update the handover class with the new agent registry
    this.handover = new AgentHandover(this.agents);
    console.log(`Agent registered: ${agent.name} (${agent.role})`);
  }
  
  async handleMessage(message: AgentMessage) {
    try {
      console.log('Handling message:', message);
      const conversationId = this.getConversationId(message.channel, message.replyToMessageId);

      // Special handling for messages coming directly from our bot
      if (message.agentId === 'B08GYV992H5') { // Bot ID
        console.log('Processing message from our own bot with mentions:', message.mentions);
        
        // Process each mentioned agent using the handover system
        for (const mentionId of message.mentions) {
          const agent = this.getAgentById(mentionId);
          
          if (agent) {
            console.log(`Bot message mentions agent: ${agent.name} (${agent.id})`);
            
            // Extract issue number if present
            const issueNumbers = this.extractIssueNumbers(message.content);
            if (issueNumbers.length > 0) {
              // Set the issue number in the GitHub workflow state
              setCurrentIssueNumber(issueNumbers[0]);
              console.log(`Set current issue number to ${issueNumbers[0]} for bot-triggered workflow`);
            }
            
            // Record this message in the handover system
            this.handover.recordMessage(message, conversationId, agent.id);
            await this.processAgentRequest(agent, message, conversationId);
          }
        }
        // Return after processing bot message to avoid duplicate processing through the handover system
        return;
      }

      // Use the handover system to determine which agent should handle the message
      const targetAgentId = this.handover.determineHandover(message, conversationId);
      if (targetAgentId) {
        const agent = this.getAgentById(targetAgentId);
        if (agent) {
          console.log(`Handover determined target agent: ${agent.name} (${agent.id})`);
          
          // Extract issue number if present
          const issueNumbers = this.extractIssueNumbers(message.content);
          if (issueNumbers.length > 0) {
            // Set the issue number in the GitHub workflow state
            setCurrentIssueNumber(issueNumbers[0]);
            console.log(`Set current issue number to ${issueNumbers[0]}`);
          }
          
          // Record this message in the handover system
          this.handover.recordMessage(message, conversationId, targetAgentId);
          await this.processAgentRequest(agent, message, conversationId);
          return;
        }
      }
      
      // If no target determined through handover, fall back to original behavior
      // checking @mentions directly
      for (const mentionId of message.mentions) {
        const agent = this.getAgentById(mentionId);
        
        if (agent) {
          // Extract issue number if present
          const issueNumbers = this.extractIssueNumbers(message.content);
          if (issueNumbers.length > 0) {
            // Set the issue number in the GitHub workflow state
            setCurrentIssueNumber(issueNumbers[0]);
            console.log(`Set current issue number to ${issueNumbers[0]}`);
          }
          
          // Record this message in the handover system
          this.handover.recordMessage(message, conversationId, agent.id);
          await this.processAgentRequest(agent, message, conversationId);
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
  
  private async processAgentRequest(agent: Agent, message: AgentMessage, conversationId?: string) {
    try {
      console.log(`Processing request for agent ${agent.name} (${agent.id}) with role ${agent.role}`);
      
      // Get or create conversation history
      const convoId = conversationId || this.getConversationId(message.channel, message.replyToMessageId);
      const history = this.getConversationHistory(convoId);
      
      // Get conversation context from the handover system
      const conversationContext = this.handover.getConversationContext(convoId);
      
      // Extract issue number from message if possible
      let enhancedMessage = message.content;
      const issueNumbers = this.extractIssueNumbers(message.content);
      
      // If we have conversation context, add it to the message
      if (conversationContext) {
        enhancedMessage = `--- Previous Conversation Context ---\n${conversationContext}\n\n--- Current Message ---\n${enhancedMessage}`;
      }
      
      // If the message is from our bot (agent-to-agent communication)
      // Format the message to make it clear it's coming from another agent
      if (message.agentId === 'B08GYV992H5') { // Bot ID
        console.log('Processing agent-to-agent communication');
        
        // Check which agent role is being addressed
        let targetAgentPrompt = '';
        if (agent.role === 'DEVELOPER') {
          if (issueNumbers.length > 0) {
            targetAgentPrompt = `You've been asked to work on issue #${issueNumbers[0]}. Please follow the GitHub workflow steps exactly.`;
          } else {
            targetAgentPrompt = 'Another agent is requesting your assistance as a Developer.';
          }
        } else if (agent.role === 'CODE_REVIEWER') {
          targetAgentPrompt = 'You have been requested to review a pull request.';
        } else if (agent.role === 'PROJECT_MANAGER') {
          targetAgentPrompt = 'Your attention is needed as the Project Manager.';
        }
        
        // If we determined a specific prompt, use it
        if (targetAgentPrompt) {
          enhancedMessage = `${targetAgentPrompt}\n\nMessage: ${enhancedMessage}`;
        }
      }
      
      // Special handling for Developer agent when asked to work on an issue
      if (agent.role === 'DEVELOPER' && issueNumbers.length > 0) {
        // Check if this is a direct command to work on an issue
        const isDirectCommand = message.content.match(/\b(start|work|implement)\b.*\b(issue|#)\s*\d+\b/i);
        
        if (isDirectCommand || message.agentId === 'B08GYV992H5') { // Direct command or from bot
          console.log(`Direct command to Developer to work on issue #${issueNumbers[0]}`);
          enhancedMessage = `I need you to implement issue #${issueNumbers[0]}. 
          
IMPORTANT: Follow these exact steps in order:
1. First call getRepositoryInfo()
2. Then call getIssue({number: ${issueNumbers[0]}})
3. Create a branch with createBranch()
4. Commit your changes with createCommit()
5. Create a pull request with createPullRequest()

Each step must be completed in this exact order. DO NOT SKIP ANY STEPS.

REFLECTION PROTOCOL: After each step, reflect on what you've accomplished and what the next step should be. Always use explicit @mentions when handoff to another agent is needed.`;
        } else {
          // Add explicit instruction to get the issue if mentions issue numbers
          enhancedMessage += `\n\nIMPORTANT: The message mentions issue #${issueNumbers[0]}. Remember to first call getRepositoryInfo() and then getIssue({number: ${issueNumbers[0]}}) to get details about this issue before implementation.`;
        }
      } else if (issueNumbers.length > 0) {
        // For non-developer agents, add explicit instruction to get the issue if mentions issue numbers
        enhancedMessage += `\n\nIMPORTANT: The message mentions issue #${issueNumbers[0]}. Remember to first call getRepositoryInfo() and then getIssue({number: ${issueNumbers[0]}}) to get details about this issue before implementation.`;
      }
      
      if (agent.role === 'PROJECT_MANAGER' && message.content.toLowerCase().includes('create an issue')) {
        enhancedMessage += `\n\nIMPORTANT: As a Project Manager, you should use the createIssue function to create a GitHub issue for this task. After creating the issue, you should mention the Developer to assign them the task by adding "@Developer" to your message.`;
      }
      
      // Add a reminder about how to properly mention other agents in the workflow
      enhancedMessage += `\n\nIMPORTANT REMINDER: If you need another agent to perform a task after you, make sure to explicitly mention them with their name preceded by @ (e.g., @Developer, @ProjectManager). This is required for them to receive the task.`;
      
      // Add reflection protocol
      enhancedMessage += `\n\nREFLECTION PROTOCOL: After completing your task, reflect on what you've accomplished and explicitly state what the next step in the workflow should be. Always use @mentions to indicate which agent should take the next action.`;
      
      // Generate response from agent
      const { response, functionCalls } = await this.aiService.generateAgentResponse(
        agent,
        enhancedMessage,
        history
      );
      
      // Format any function call results
      let fullResponse = response;
      
      if (functionCalls.length > 0) {
        let functionResults = this.aiService.extractFunctionResults(functionCalls);
        
        // Check if this is a GitHub workflow related function
        const isGitHubWorkflowFunction = functionCalls.some(call => 
          ['createIssue', 'getRepositoryInfo', 'getIssue', 'createBranch', 'createCommit', 'createPullRequest'].includes(call.name)
        );
        
        // If it's a GitHub workflow function, add a reminder about the next agent in the workflow
        if (isGitHubWorkflowFunction && agent.role === 'PROJECT_MANAGER') {
          functionResults += '\n\n@Developer Remember to follow the exact workflow steps: 1) getRepositoryInfo, 2) getIssue, 3) createBranch, 4) createCommit, 5) createPullRequest';
        } else if (isGitHubWorkflowFunction && response.includes('pull request')) {
          functionResults += '\n\n@CodeReviewer Please review this PR when you have a chance.';
        }
        
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
      this.updateConversationHistory(convoId, message.content, fullResponse);
      
      // Record the response in the handover system
      const botMessage: AgentMessage = {
        id: `bot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: 'B08GYV992H5',
        content: fullResponse,
        channel: message.channel,
        mentions: this.extractMentionsFromResponse(fullResponse),
        replyToMessageId: message.replyToMessageId
      };
      this.handover.recordMessage(botMessage, convoId);
      
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
  
  private extractMentionsFromResponse(response: string): string[] {
    const mentionRegex = /@([A-Za-z]+)/g;
    const mentions = Array.from(response.matchAll(mentionRegex), m => m[1]);
    
    // Convert mentions to agent IDs
    const mentionIds: string[] = [];
    for (const mention of mentions) {
      const mentionLower = mention.toLowerCase();
      const agentIds = Object.keys(this.agents);
      
      for (const agentId of agentIds) {
        const agent = this.agents[agentId];
        if (agent.name.toLowerCase() === mentionLower) {
          mentionIds.push(agent.id);
          break;
        }
      }
    }
    
    return mentionIds;
  }
  
  private getAgentById(id: string): Agent | undefined {
    const agent = this.agents[id];
    
    if (!agent) {
      console.warn(`No agent found with ID: ${id}`);
      console.log('Available agent IDs:', Object.keys(this.agents));
    } else {
      console.log(`Found agent: ${agent.name} (${agent.role}) with ID: ${id}`);
    }
    
    return agent;
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
} 