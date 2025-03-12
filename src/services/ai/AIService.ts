import OpenAI from 'openai';
import { 
  OpenAIMessage, 
  OpenAIFunctionDefinition, 
  OpenAITool 
} from '@/types/openai/OpenAITypes';
import { config } from '@/config/config';
import { Agent, AgentFunction } from '@/types/agents/Agent';

export class AIService {
  private openai: OpenAI;
  private functionRegistry: Record<string, AgentFunction> = {};
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }
  
  registerFunction(func: AgentFunction) {
    this.functionRegistry[func.name] = func;
  }
  
  async generateAgentResponse(
    agent: Agent, 
    userMessage: string, 
    conversationHistory: OpenAIMessage[] = []
  ): Promise<{ response: string; functionCalls: any[] }> {
    try {
      // Create the system message with agent's persona
      const systemMessage: OpenAIMessage = {
        role: 'system',
        content: agent.systemPrompt
      };
      
      // Add the user message
      const userOpenAIMessage: OpenAIMessage = {
        role: 'user',
        content: userMessage
      };
      
      // Prepare the full conversation history
      const messages: OpenAIMessage[] = [
        systemMessage,
        ...conversationHistory,
        userOpenAIMessage
      ];
      
      // Prepare functions for the agent
      const tools: OpenAITool[] = agent.functions.map(func => ({
        type: 'function',
        function: func
      }));
      
      // Call the OpenAI API
      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined
      });
      
      const responseMessage = response.choices[0].message;
      let functionCalls: any[] = [];
      
      // Process any function calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        functionCalls = await Promise.all(
          responseMessage.tool_calls.map(async (toolCall) => {
            if (toolCall.type === 'function') {
              const functionName = toolCall.function.name;
              const functionArgs = JSON.parse(toolCall.function.arguments);
              
              if (this.functionRegistry[functionName]) {
                const result = await this.functionRegistry[functionName].handler(
                  functionArgs, 
                  agent.id
                );
                return {
                  name: functionName,
                  arguments: functionArgs,
                  result
                };
              }
            }
            return null;
          })
        );
        
        // Filter out null results
        functionCalls = functionCalls.filter(call => call !== null);
      }
      
      return {
        response: responseMessage.content || '',
        functionCalls
      };
    } catch (error) {
      console.error('Error generating agent response:', error);
      throw error;
    }
  }
  
  extractFunctionResults(functionCalls: any[]): string {
    return functionCalls
      .map(call => {
        // Check for errors first to handle them consistently across all functions
        if (call.result && !call.result.success) {
          // Format error messages in a user-friendly way
          let errorMessage = call.result.error || 'Unknown error';
          
          // Clean up error messages from GitHub API
          if (errorMessage.includes('https://docs.github.com')) {
            errorMessage = errorMessage.split(' - ')[0];
          }
          
          return `❌ Function \`${call.name}\` failed: ${errorMessage}`;
        }
        
        // Format GitHub function results in a user-friendly way
        if (call.name === 'createIssue' && call.result.success) {
          return `✅ Created GitHub issue #${call.result.issue_number}: "${call.arguments.title}"\n📎 ${call.result.url}`;
        } 
        else if (call.name === 'createPullRequest' && call.result.success) {
          return `✅ Created GitHub pull request #${call.result.pr_number}: "${call.arguments.title}"\n📎 ${call.result.url}`;
        }
        else if (call.name === 'createCommit' && call.result.success) {
          return `✅ Created GitHub commit ${call.result.commit_sha.substring(0, 7)}: "${call.arguments.message}"`;
        }
        else if (call.name === 'createBranch' && call.result.success) {
          return `✅ Created GitHub branch \`${call.arguments.name}\` from \`${call.arguments.source || 'main'}\``;
        }
        else if (call.name === 'createReview' && call.result.success) {
          return `✅ Created GitHub review on PR #${call.arguments.pull_number} with status: ${call.arguments.event}`;
        }
        else if (call.name === 'getRepositoryInfo' && call.result.success) {
          const repo = call.result.repository;
          return `📁 GitHub repository info:\n• Name: ${repo.full_name}\n• Description: ${repo.description || 'N/A'}\n• Default branch: ${repo.default_branch}\n• Open issues: ${repo.open_issues_count}\n• URL: ${repo.url}`;
        }
        // Success message for other functions
        else if (call.result.success) {
          return `✅ Function \`${call.name}\` completed successfully`;
        }
        // Default format - should rarely be used due to error and success handling above
        else {
          return `Function \`${call.name}\` was called`;
        }
      })
      .join('\n\n');
  }
} 