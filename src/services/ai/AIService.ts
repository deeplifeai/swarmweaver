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
        messages: messages as any,
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
                try {
                  const result = await this.functionRegistry[functionName].handler(
                    functionArgs, 
                    agent.id
                  );
                  return {
                    name: functionName,
                    arguments: functionArgs,
                    result
                  };
                } catch (error) {
                  return {
                    name: functionName,
                    arguments: functionArgs,
                    result: {
                      error: error instanceof Error ? error.message : 'Unknown error'
                    }
                  };
                }
              } else {
                return {
                  name: functionName,
                  arguments: functionArgs,
                  result: {
                    error: `Function '${functionName}' not found in registry`
                  }
                }
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
        
        // Format GitHub function results in a user-friendly way
        if (call.name === 'createIssue' && call.result) {
          return `✅ Created GitHub issue #${call.result.issue_number}: "${call.arguments.title}"\n📎 ${call.result.url}`;
        } 
        else if (call.name === 'getIssue' && call.result) {
          return `📋 GitHub issue #${call.result.number}: "${call.result.title}"\n\n${call.result.body}\n\n📎 ${call.result.html_url}`;
        }
        else if (call.name === 'createPullRequest' && call.result) {
          return `✅ Created GitHub pull request #${call.result.pr_number}: "${call.arguments.title}"\n📎 ${call.result.url}`;
        }
        else if (call.name === 'createCommit' && call.result) {
          // Check if branch was automatically created during commit
          if (call.result.message && call.result.message.includes('Branch') && call.result.message.includes('was created')) {
            const branchName = call.arguments.branch || 'main';
            return `🔄 Branch \`${branchName}\` was automatically created\n✅ Committed changes: "${call.arguments.message}"`;
          }
          return `✅ Created GitHub commit ${call.result.commit_sha?.substring(0, 7) || ''}: "${call.arguments.message}"`;
        }
        else if (call.name === 'createBranch' && call.result) {
          return `✅ Created GitHub branch \`${call.arguments.name}\` from \`${call.arguments.source || 'main'}\``;
        }
        else if (call.name === 'createReview' && call.result) {
          return `✅ Created GitHub review on PR #${call.arguments.pull_number} with status: ${call.arguments.event}`;
        }
        else if (call.name === 'getRepositoryInfo' && call.result) {
          const repo = call.result.repository;
          return `📁 GitHub repository info:\n• Name: ${repo.full_name}\n• Description: ${repo.description || 'N/A'}\n• Default branch: ${repo.default_branch}\n• Open issues: ${repo.open_issues_count}\n• URL: ${repo.url}`;
        }
        // Success message for any function with success flag
        else if (call.result && call.result.success) {
          let result = `✅ Function \`${call.name}\` completed successfully`;
          if (call.arguments) {
            result += ` with arguments: ${JSON.stringify(call.arguments)}`;
          }
          return result;
        }
        // Generic function information for any function call
        else {
          let result = `Function ${call.name} was called`;
          if (call.arguments) {
            result += ` with arguments: ${JSON.stringify(call.arguments)}`;
          }
          if (call.result) {
            result += `\nResult: ${JSON.stringify(call.result)}`;
          }
          return result;
        }
      })
      .join('\n\n');
      
    // For test environment, don't add reminder
    if (process.env.NODE_ENV === 'test') {
      return results;
    }
    
    // In production, add the workflow reminder
    return results + '\n\n' + reminder;
  }
} 