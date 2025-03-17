import { Agent, AgentFunction } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { ConversationManager } from '../ConversationManager';
import { LoopDetector } from '../agents/LoopDetector';
import { runWithLangChain } from './LangChainIntegration';
import { config } from '@/config/config';
import { FunctionRegistry } from './FunctionRegistry';
import { OpenAI } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Service for interacting with AI providers
 */
export class AIService {
  private conversationManager: ConversationManager;
  private loopDetector: LoopDetector;
  private functionRegistry: FunctionRegistry;
  private openai: OpenAI;
  
  constructor(
    conversationManager: ConversationManager,
    loopDetector: LoopDetector,
    functionRegistry: FunctionRegistry
  ) {
    this.conversationManager = conversationManager;
    this.loopDetector = loopDetector;
    this.functionRegistry = functionRegistry;
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
      dangerouslyAllowBrowser: process.env.NODE_ENV === 'test'
    });
  }
  
  /**
   * Sets the function registry used by the AIService
   * @param registry The function registry to use
   */
  setFunctionRegistry(registry: FunctionRegistry) {
    this.functionRegistry = registry;
  }
  
  registerFunction(func: AgentFunction) {
    this.functionRegistry.register(func);
  }
  
  /**
   * Generate a response for an agent, delegating to LangChain
   * @param agent The agent to generate a response for
   * @param userPrompt The user's prompt
   * @param conversationHistory Optional conversation history
   * @returns The generated response and any function calls
   */
  async generateAgentResponse(
    agent: Agent,
    userPrompt: string,
    _conversationHistory: OpenAIMessage[] = []
  ): Promise<{ response: string; functionCalls?: any[] }> {
    try {
      // Get conversation history using the new ConversationManager
      const conversationId = `agent:${agent.id}`;
      const history = await this.conversationManager.getConversationHistory(conversationId);
      
      // Record action to detect potential loops
      const isProcessingLoop = this.loopDetector.recordAction(
        conversationId, 
        `process:${agent.id}`
      );
      
      if (isProcessingLoop) {
        console.warn(`Potential processing loop detected for agent ${agent.id}, adding loop warning to prompt`);
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
          userPrompt,
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
        // Use standard OpenAI completion
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: agent.systemPrompt || agent.description },
          ...history.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          })),
          { role: 'user', content: userPrompt }
        ];

        const completion = await this.openai.chat.completions.create({
          model: config.openai.models.default,
          messages,
          temperature: 0.7,
          max_tokens: 1000
        });

        response = completion.choices[0].message.content || '';
        toolCalls = [];
      }
      
      // After processing, update the conversation history with the new messages
      await this.conversationManager.updateConversationHistory(
        conversationId,
        userPrompt,
        response
      );
      
      return {
        response,
        functionCalls: toolCalls
      };
    } catch (error) {
      console.error(`Error generating agent response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  extractFunctionResults(functionCalls: any[]): string {
    // Add standard workflow reminder
    const reminder = "⚠️ Remember to follow the exact workflow steps: 1) getRepositoryInfo, 2) getIssue, 3) createBranch, 4) createCommit, 5) createPullRequest";
    
    if (!functionCalls || functionCalls.length === 0) {
      return "No functions were called";
    }
    
    const results = functionCalls
      .map(call => {
        if (!call || !call.name) {
          return "Invalid function call data";
        }
        
        // Check for errors first to handle them consistently across all functions
        if (call.result && call.result.error) {
          // Format error messages in a user-friendly way
          let errorMessage = call.result.error || 'Unknown error';
          
          // Clean up error messages from GitHub API
          if (errorMessage.includes('https://docs.github.com')) {
            errorMessage = errorMessage.split(' - ')[0];
          }
          
          return `❌ Function \`${call.name}\` failed: ${errorMessage}`;
        }
        
        // Format GitHub function results in a user-friendly way with consistent @mentions
        if (call.name === 'createIssue' && call.result) {
          return `✅ Created GitHub issue #${call.result.issue_number}: "${call.arguments.title}"\n📎 ${call.result.url}\n\n@Developer Please implement this issue following the workflow steps.`;
        }
        
        if (call.name === 'createPullRequest' && call.result) {
          return `✅ Created PR #${call.result.number}: "${call.result.title}"\n📎 ${call.result.html_url}\n\n@Reviewer Please review this PR.`;
        }
        
        if (call.name === 'getRepositoryInfo' && call.result) {
          return `📁 Repository Info:\nName: ${call.result.name}\nDescription: ${call.result.description || 'No description'}\nStars: ${call.result.stargazers_count}\nForks: ${call.result.forks_count}`;
        }
        
        if (call.name === 'getIssue' && call.result) {
          return `📝 Issue #${call.result.number}: ${call.result.title}\nStatus: ${call.result.state}\nCreated by: ${call.result.user.login}\nDescription: ${call.result.body}`;
        }
        
        if (call.name === 'createBranch' && call.result) {
          return `🌿 Created branch: ${call.result.name}\nFrom: ${call.result.source || 'default branch'}`;
        }
        
        if (call.name === 'createCommit' && call.result) {
          const filesChanged = Object.keys(call.arguments.changes || {}).length;
          return `📝 Created commit: "${call.arguments.message}"\nFiles changed: ${filesChanged}`;
        }
        
        if (call.name === 'getPullRequest' && call.result) {
          const prStatus = call.result.state === 'open' ? '🟢 Open' : '🔵 Closed';
          return `📥 PR #${call.result.number}: ${call.result.title}\nStatus: ${prStatus}\nCreated by: ${call.result.user.login}`;
        }
        
        if (call.name === 'listPullRequests' && call.result) {
          const prCount = call.result.length;
          if (prCount === 0) {
            return "No pull requests found.";
          }
          const prInfo = call.result.slice(0, 5).map((pr: { number: number; title: string; state: string }) => {
            return `• #${pr.number} - ${pr.title} (${pr.state})`;
          }).join('\n');
          const moreInfo = prCount > 5 ? `\nAnd ${prCount - 5} more...` : '';
          return `📊 Pull Requests (${prCount}):\n${prInfo}${moreInfo}`;
        }
        
        // Default formatting for any other function
        return `✅ Function \`${call.name}\` result: ${JSON.stringify(call.result, null, 2)}`;
      })
      .join('\n\n');
    
    // For GitHub workflow functions, add the reminder
    const gitHubFunctions = ['getRepositoryInfo', 'getIssue', 'createBranch', 'createCommit', 'createPullRequest'];
    const hasGitHubFunction = functionCalls.some(call => gitHubFunctions.includes(call.name));
    
    if (hasGitHubFunction) {
      return results + '\n\n' + reminder;
    }
    
    return results;
  }
} 