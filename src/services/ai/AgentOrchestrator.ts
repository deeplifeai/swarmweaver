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
      console.log('Handling message:', message);

      // Special handling for messages coming directly from our bot
      if (message.agentId === 'B08GYV992H5') { // Bot ID
        console.log('Processing message from our own bot with mentions:', message.mentions);
        
        // Process each mentioned agent
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
            
            await this.processAgentRequest(agent, message);
          }
        }
        return;
      }

      // If the message is directly to the bot and specifies an agent role
      if (message.mentions.length === 1 && message.mentions[0] === 'U08GYV9AU9M') { // Bot ID
        // Try to detect if a specific agent role is mentioned in the content
        const agentRoleMatch = message.content.match(/\b(DEVELOPER|PROJECT_MANAGER|CODE_REVIEWER|QA_TESTER|TECHNICAL_WRITER|TEAM_LEADER)\b/i);
        
        if (agentRoleMatch) {
          const roleName = agentRoleMatch[1].toUpperCase();
          console.log(`Direct message to bot with specified role: ${roleName}`);
          
          // Find an agent with this role
          let targetAgent: Agent | undefined;
          for (const agentId in this.agents) {
            const agent = this.agents[agentId];
            if (agent.role === roleName || agent.role === roleName.replace(' ', '_')) {
              targetAgent = agent;
              break;
            }
          }
          
          if (targetAgent) {
            console.log(`Found agent with role ${roleName}: ${targetAgent.name} (${targetAgent.id})`);
            
            // Extract issue number if present
            const issueNumbers = this.extractIssueNumbers(message.content);
            if (issueNumbers.length > 0) {
              // Set the issue number in the GitHub workflow state
              setCurrentIssueNumber(issueNumbers[0]);
              console.log(`Set current issue number to ${issueNumbers[0]}`);
            }
            
            await this.processAgentRequest(targetAgent, message);
            return;
          }
        }
      }
      
      // Original behavior - check if the message mentions any of our registered agents
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
      console.log(`Processing request for agent ${agent.name} (${agent.id}) with role ${agent.role}`);
      
      // Get or create conversation history
      const conversationId = this.getConversationId(message.channel, message.replyToMessageId);
      const history = this.getConversationHistory(conversationId);
      
      // Extract issue number from message if possible
      let enhancedMessage = message.content;
      const issueNumbers = this.extractIssueNumbers(message.content);
      
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
          enhancedMessage = `${targetAgentPrompt}\n\nMessage: ${message.content}`;
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

Each step must be completed in this exact order. DO NOT SKIP ANY STEPS.`;
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