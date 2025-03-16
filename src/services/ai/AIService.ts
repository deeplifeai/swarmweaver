import { 
  OpenAIMessage, 
  OpenAIFunctionDefinition, 
  OpenAITool 
} from '@/types/openai/OpenAITypes';
import { config } from '@/config/config';
import { Agent, AgentFunction, AgentRole } from '@/types/agents/Agent';
import { FunctionRegistry } from './FunctionRegistry';
import { LangChainExecutor, createLangChainExecutor } from './LangChainIntegration';

/**
 * AIService acts as a thin wrapper around the LangChain integration,
 * delegating all AI model interactions to a single integration point.
 */
export class AIService {
  private functionRegistry: FunctionRegistry;
  private executorCache: Map<string, LangChainExecutor> = new Map();
  
  constructor() {
    this.functionRegistry = new FunctionRegistry();
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
   * @param userMessage The user's message
   * @param conversationHistory Optional conversation history
   * @returns The generated response and any function calls
   */
  async generateAgentResponse(
    agent: Agent, 
    userMessage: string, 
    conversationHistory: OpenAIMessage[] = []
  ): Promise<{ response: string; functionCalls: any[] }> {
    try {
      console.log(`Generating response for agent ${agent.name} with role ${agent.role}`);
      
      // Create an executor or get from cache
      let executor = this.executorCache.get(agent.id);
      if (!executor) {
        executor = createLangChainExecutor(
          agent,
          this.functionRegistry,
          config.openai.apiKey
        );
        this.executorCache.set(agent.id, executor);
      }
      
      // Process conversation history if provided
      // This would need to be handled by incorporating it into the prompt or
      // using LangChain's memory capabilities
      
      // Run the executor
      const result = await executor.run(userMessage);
      
      // Convert LangChain tool calls to our format for compatibility
      const functionCalls = result.toolCalls.map(toolCall => ({
        name: toolCall.name,
        arguments: JSON.parse(toolCall.arguments),
        result: JSON.parse(toolCall.result)
      }));
      
      return {
        response: result.output,
        functionCalls
      };
    } catch (error) {
      console.error('Error generating agent response:', error);
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
          const prInfo = call.result.slice(0, 5).map((pr) => {
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
  
  /**
   * Generate simple text using LangChain
   * @param provider The provider to use (currently only OpenAI supported)
   * @param model The model to use
   * @param systemPrompt The system prompt
   * @param userPrompt The user's prompt
   * @returns The generated text
   */
  async generateText(
    provider: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    try {
      // Create a minimal dummy agent for text generation
      const dummyAgent: Agent = {
        id: 'text-generation',
        name: 'Text Generator',
        role: AgentRole.DEVELOPER,
        systemPrompt: systemPrompt,
        functions: [],
        description: 'Text generation agent',
        personality: 'Helpful and concise'
      };
      
      // Create executor for the dummy agent
      const executor = createLangChainExecutor(
        dummyAgent,
        this.functionRegistry,
        config.openai.apiKey
      );
      
      // Run the executor
      const result = await executor.run(userPrompt);
      
      return result.output;
    } catch (error) {
      console.error('Error in text generation:', error);
      return `Error generating text: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
} 