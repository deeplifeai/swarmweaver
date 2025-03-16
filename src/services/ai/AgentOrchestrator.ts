import { Agent, AgentMessage, AgentRegistry } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { SlackService } from '@/services/slack/SlackService';
import { AIService } from '@/services/ai/AIService';
import { eventBus, EventType } from '@/services/eventBus';
import { HandoffMediator } from '../agents/HandoffMediator';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { LoopDetector } from '../agents/LoopDetector';
import { FunctionRegistry } from './FunctionRegistry';
import { estimateTokenCount, chunkText } from '../../utils/tokenManager';
import { runWithLangChain } from './LangChainIntegration';
import { config } from '@/config/config';
import { ConversationManager } from '../ConversationManager';

/**
 * AgentOrchestrator coordinates AI agents, handling messages and orchestrating handoffs.
 * It serves as the central controller for agent interactions.
 */
export class AgentOrchestrator {
  private slackService: SlackService;
  private aiService: AIService;
  private agents: AgentRegistry = {};
  private conversations: Record<string, OpenAIMessage[]> = {};
  private handoffMediator: HandoffMediator;
  private stateManager: WorkflowStateManager;
  private loopDetector: LoopDetector;
  private functionRegistry: FunctionRegistry;
  private conversationManager: ConversationManager;
  
  constructor(
    slackService: SlackService, 
    aiService: AIService,
    handoffMediator: HandoffMediator,
    stateManager: WorkflowStateManager,
    loopDetector: LoopDetector,
    functionRegistry: FunctionRegistry
  ) {
    this.slackService = slackService;
    this.aiService = aiService;
    this.handoffMediator = handoffMediator;
    this.stateManager = stateManager;
    this.loopDetector = loopDetector;
    this.functionRegistry = functionRegistry;
    
    // Initialize the conversation manager
    this.conversationManager = new ConversationManager(aiService);
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Subscribe to agent messages from Slack via EventBus
    eventBus.on(EventType.MESSAGE_RECEIVED, (message: AgentMessage) => {
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
    
    // Subscribe to function call results
    eventBus.on(EventType.FUNCTION_RESULT, async (result) => {
      // Process function results and potentially trigger state transitions
      if (result.success) {
        this.handleFunctionResult(result);
      }
    });
  }
  
  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: Agent) {
    this.agents[agent.id] = agent;
    console.log(`Agent registered: ${agent.name} (${agent.role})`);
  }
  
  /**
   * Handle incoming messages from any source
   */
  async handleMessage(message: AgentMessage) {
    try {
      console.log('Handling message:', message);
      const conversationId = this.getConversationId(message.channel, message.replyToMessageId);

      // Record action to detect potential loops
      const isPotentialLoop = this.loopDetector.recordAction(
        conversationId, 
        `message:${message.agentId || 'user'}`
      );
      
      if (isPotentialLoop) {
        console.warn('Potential message loop detected, proceeding with caution');
        // We could add additional safeguards here based on the loop detection
      }

      // Determine which agent should handle this message
      const targetAgent = await this.handoffMediator.determineNextAgent(
        message.channel,
        message.replyToMessageId || null,
        message
      );
      
      if (targetAgent) {
        console.log(`Routing message to agent: ${targetAgent.name} (${targetAgent.id})`);
        
        // Process the message with the selected agent
        await this.processAgentRequest(targetAgent, message, conversationId);
      } else {
        console.log('No suitable agent found for message');
        
        // Fallback to default agent or send a helpful response
        await this.slackService.sendMessage({
          channel: message.channel,
          thread_ts: message.replyToMessageId,
          text: "I'm not sure which agent should handle this request. Could you please tag a specific agent or clarify your request?",
          userId: "SYSTEM"
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }
  
  /**
   * Process a message with a specific agent
   */
  private async processAgentRequest(agent: Agent, message: AgentMessage, conversationId?: string) {
    // Get conversation ID if not provided
    if (!conversationId) {
      conversationId = this.getConversationId(message.channel, message.replyToMessageId);
    }
    
    // Get conversation history using the new ConversationManager
    const conversationHistory = await this.conversationManager.getConversationHistory(conversationId);
    
    // Format the message for the AI service
    const userMessage: OpenAIMessage = {
      role: 'user',
      content: message.content
    };
    
    // Prepare the agent's system prompt, potentially optimizing it
    const systemPrompt = agent.systemPrompt;
    
    try {
      // Record action to detect potential loops
      const isProcessingLoop = this.loopDetector.recordAction(
        conversationId, 
        `process:${agent.id}`
      );
      
      if (isProcessingLoop) {
        console.warn(`Potential processing loop detected for agent ${agent.id}, adding loop warning to prompt`);
        // Could modify the prompt here to warn about potential loops
      }
      
      // Use the new LangChain integration for advanced capabilities
      const useLangChain = config.features?.useLangChain === true;
      
      let response: string;
      let toolCalls: any[] = [];
      
      if (useLangChain) {
        console.log(`Using LangChain for agent ${agent.id}`);
        const result = await runWithLangChain(
          agent,
          this.functionRegistry,
          message.content,
          config.openai.apiKey
        );
        
        response = result.output;
        toolCalls = result.toolCalls;
        
        // If there were tool calls, append their results to the response
        if (toolCalls && toolCalls.length > 0) {
          const toolResults = toolCalls.map(call => 
            `Function ${call.name} was called with ${call.arguments} and returned: ${call.result}`
          ).join('\n\n');
          
          response += `\n\n--- Function Call Results ---\n${toolResults}`;
        }
      } else {
        // Use the standard AIService - pass the agent object
        const aiResponse = await this.aiService.generateAgentResponse(
          agent,
          systemPrompt,
          [...conversationHistory, userMessage]
        );
        
        // Extract the response text from the AI response
        response = typeof aiResponse === 'string' 
          ? aiResponse 
          : aiResponse.response || 'No response generated';
      }
      
      // After processing, update the conversation history with the new messages
      await this.conversationManager.updateConversationHistory(
        conversationId,
        message.content,
        response
      );
      
      // Send response to Slack
      await this.slackService.sendMessage({
        channel: message.channel,
        thread_ts: message.replyToMessageId,
        text: response,
        userId: agent.id
      });
      
      // Check for mentions to other agents in the response
      const mentionedAgents = this.extractMentionsFromResponse(response);
      if (mentionedAgents.length > 0) {
        // Record handoff in the mediator
        for (const mentionedAgentId of mentionedAgents) {
          const mentionedAgent = this.getAgentById(mentionedAgentId);
          if (mentionedAgent) {
            await this.handoffMediator.recordHandoff(
              agent.id,
              mentionedAgentId,
              message.channel,
              message.replyToMessageId || null,
              'Explicit mention in response'
            );
          }
        }
      }
    } catch (error) {
      console.error(`Error processing request for agent ${agent.id}:`, error);
      
      // Send error message to Slack
      await this.slackService.sendMessage({
        channel: message.channel,
        thread_ts: message.replyToMessageId,
        text: `I encountered an error processing your request: ${error.message}`,
        userId: agent.id
      });
      
      // Emit error event
      eventBus.emit(EventType.ERROR, {
        source: 'AgentOrchestrator.processAgentRequest',
        error,
        message: `Error processing request for agent ${agent.id}`
      });
    }
  }
  
  /**
   * Handle results from function calls, updating state as needed
   */
  private async handleFunctionResult(result: any) {
    try {
      const { functionName, channelId, threadTs, agentId, success, data } = result;
      
      // Define state changes based on function calls
      if (success) {
        switch (functionName) {
          case 'createIssue':
            await this.stateManager.setState(
              channelId,
              threadTs || null,
              { stage: 'issue_created', issueNumber: data.issue_number }
            );
            break;
          
          case 'createBranch':
            const currentState = await this.stateManager.getState(channelId, threadTs || null);
            if (currentState && currentState.stage === 'issue_created') {
              await this.stateManager.setState(
                channelId,
                threadTs || null,
                { 
                  stage: 'branch_created', 
                  issueNumber: currentState.issueNumber, 
                  branchName: data.name || result.arguments.name 
                }
              );
            }
            break;
          
          case 'createCommit':
            const branchState = await this.stateManager.getState(channelId, threadTs || null);
            if (branchState && 
                (branchState.stage === 'branch_created' || branchState.stage === 'code_committed')) {
              await this.stateManager.setState(
                channelId,
                threadTs || null,
                { 
                  stage: 'code_committed', 
                  issueNumber: branchState.issueNumber, 
                  branchName: branchState.branchName 
                }
              );
            }
            break;
          
          case 'createPullRequest':
            const commitState = await this.stateManager.getState(channelId, threadTs || null);
            if (commitState && commitState.stage === 'code_committed') {
              await this.stateManager.setState(
                channelId,
                threadTs || null,
                { 
                  stage: 'pr_created', 
                  issueNumber: commitState.issueNumber, 
                  branchName: commitState.branchName,
                  prNumber: data.number 
                }
              );
              
              // Trigger handoff to code reviewer
              const developer = this.getAgentById(agentId);
              const codeReviewer = this.getAgentByRole('CODE_REVIEWER');
              
              if (developer && codeReviewer) {
                await this.handoffMediator.recordHandoff(
                  developer.id,
                  codeReviewer.id,
                  channelId,
                  threadTs || null,
                  'PR created, handing off to code reviewer'
                );
                
                // Send handoff message
                await this.slackService.sendMessage({
                  channel: channelId,
                  thread_ts: threadTs,
                  text: `I've created a pull request: ${data.html_url}\n\nNow, <@${codeReviewer.id}>, could you please review this PR?`,
                  userId: agentId
                });
              }
            }
            break;
            
          // Add other function results handling as needed
        }
      }
    } catch (error) {
      console.error('Error handling function result:', error);
      eventBus.emit(EventType.ERROR, {
        source: 'AgentOrchestrator.handleFunctionResult',
        error,
        message: 'Error handling function result'
      });
    }
  }
  
  /**
   * Extract mentioned agents from a response message
   */
  private extractMentionsFromResponse(response: string): string[] {
    const mentionRegex = /<@([A-Z0-9]+)>/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(response)) !== null) {
      const agentId = match[1];
      if (this.agents[agentId]) {
        mentions.push(agentId);
      }
    }
    
    return mentions;
  }
  
  /**
   * Get an agent by ID
   */
  private getAgentById(id: string): Agent | undefined {
    return this.agents[id];
  }
  
  /**
   * Get an agent by role
   */
  private getAgentByRole(role: string): Agent | undefined {
    return Object.values(this.agents).find(agent => agent.role === role);
  }
  
  /**
   * Get conversation ID for a channel and thread
   */
  private getConversationId(channel: string, threadTs: string | null): string {
    return threadTs ? `${channel}:${threadTs}` : channel;
  }
  
  /**
   * Get the agent registry
   */
  getAgentRegistry(): AgentRegistry {
    return this.agents;
  }
  
  /**
   * Set a new handoff mediator
   */
  setHandoffMediator(mediator: HandoffMediator): void {
    this.handoffMediator = mediator;
  }
} 