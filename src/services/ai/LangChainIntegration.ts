import { AgentFunction, FunctionRegistry } from './FunctionRegistry';
import { Agent } from '@/types/agents/Agent';
import { ChatOpenAI } from "@langchain/openai";

/**
 * A simplified LangChain integration that adapts our codebase to use LangChain
 * while minimizing dependency on LangChain's specific types that may change
 */

// Define types for OpenAI function calling structure
interface FunctionDefinition {
  name: string;
  description: string;
  parameters: any;
}

// Define a generic type for LangChain response
interface AnyObject {
  [key: string]: any;
}

// LangChain's structure can be complex and variable
// We'll log the raw response and handle different possible structures
// to ensure we can always extract the tool calls and content

/**
 * Convert our function definitions to LangChain compatible format
 */
function convertFunctionsToLangChainFormat(functions: FunctionDefinition[]) {
  return functions.map(func => ({
    type: "function",
    function: {
      name: func.name,
      description: func.description,
      parameters: func.parameters || {}
    }
  }));
}

/**
 * Create a LangChain executor for an agent
 * This provides a simplified interface to interact with LangChain
 */
export class LangChainExecutor {
  private model: ChatOpenAI;
  private functions: FunctionDefinition[];
  private functionRegistry: FunctionRegistry;
  private agentId: string;
  private systemPrompt: string;

  constructor(agent: Agent, functionRegistry: FunctionRegistry, openAIApiKey: string) {
    this.model = new ChatOpenAI({
      modelName: "gpt-4",
      temperature: 0.7,
      openAIApiKey
    });
    
    this.functionRegistry = functionRegistry;
    this.functions = functionRegistry.getFunctionDefinitions() as FunctionDefinition[];
    this.agentId = agent.id;
    this.systemPrompt = agent.systemPrompt;
  }

  /**
   * Execute the agent with the given input
   */
  async run(input: string): Promise<{
    output: string;
    toolCalls: { name: string; arguments: string; result: string }[];
    error: boolean;
  }> {
    try {
      // Format messages for the model
      const messages = [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: input }
      ];
      
      // Prepare functions for the model
      const tools = convertFunctionsToLangChainFormat(this.functions);
      
      // Call the model with functions
      const rawResponse: AnyObject = await this.model.invoke(messages, {
        tools: tools,
        tool_choice: "auto"
      });

      // Add debug logging to see the raw response
      console.log('Debug - Raw model response:', JSON.stringify(rawResponse, null, 2));
      
      // Extract content from response
      let content = '';
      if (typeof rawResponse.content === 'string') {
        content = rawResponse.content;
      } else if (rawResponse.kwargs?.content) {
        content = rawResponse.kwargs.content;
      }
      
      // Handle function calls if any
      const toolResults = [];
      
      // Extract tool calls from different possible locations in the response
      let toolCalls: AnyObject[] = [];
      
      // Look in tool_calls property directly on the response object
      if (Array.isArray(rawResponse.tool_calls) && rawResponse.tool_calls.length > 0) {
        toolCalls = rawResponse.tool_calls;
        console.log('Found tool calls in rawResponse.tool_calls:', toolCalls);
      }
      // Look in kwargs.tool_calls
      else if (rawResponse.kwargs?.tool_calls && Array.isArray(rawResponse.kwargs.tool_calls)) {
        toolCalls = rawResponse.kwargs.tool_calls;
        console.log('Found tool calls in rawResponse.kwargs.tool_calls:', toolCalls);
      }
      // Look in additional_kwargs.tool_calls
      else if (rawResponse.additional_kwargs?.tool_calls && Array.isArray(rawResponse.additional_kwargs.tool_calls)) {
        toolCalls = rawResponse.additional_kwargs.tool_calls;
        console.log('Found tool calls in rawResponse.additional_kwargs.tool_calls:', toolCalls);
      }
      // Look in kwargs.additional_kwargs.tool_calls
      else if (rawResponse.kwargs?.additional_kwargs?.tool_calls && Array.isArray(rawResponse.kwargs.additional_kwargs.tool_calls)) {
        toolCalls = rawResponse.kwargs.additional_kwargs.tool_calls;
        console.log('Found tool calls in rawResponse.kwargs.additional_kwargs.tool_calls:', toolCalls);
      }
      
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          try {
            // Extract function name and arguments
            // Handle different possible structures
            let functionName;
            let functionArgs;
            
            if (toolCall.name) {
              // Direct name property
              functionName = toolCall.name;
              functionArgs = toolCall.args || {};
            } else if (toolCall.function && toolCall.function.name) {
              // Nested within function property
              functionName = toolCall.function.name;
              if (typeof toolCall.function.arguments === 'string') {
                try {
                  functionArgs = JSON.parse(toolCall.function.arguments);
                } catch (e) {
                  functionArgs = {};
                }
              } else {
                functionArgs = toolCall.function.arguments || {};
              }
            } else {
              console.warn('Unrecognized tool call format:', toolCall);
              continue;
            }
            
            console.log(`Executing function: ${functionName} with args:`, functionArgs);
            
            // Execute the function
            const result = await this.functionRegistry.execute(
              functionName, 
              functionArgs, 
              this.agentId
            );
            
            console.log(`Function result:`, result);
            
            // Record the result
            toolResults.push({
              name: functionName,
              arguments: JSON.stringify(functionArgs),
              result: JSON.stringify(result)
            });
          } catch (error: any) {
            console.error(`Error executing function:`, error);
            const name = 
              (toolCall.name) || 
              (toolCall.function && toolCall.function.name) || 
              "unknown";
              
            const args = JSON.stringify(
              (toolCall.args) || 
              (toolCall.function && toolCall.function.arguments ? 
                (typeof toolCall.function.arguments === 'string' ? 
                  toolCall.function.arguments : 
                  JSON.stringify(toolCall.function.arguments)) : 
                "{}")
            );
            
            toolResults.push({
              name,
              arguments: args,
              result: JSON.stringify({ error: error.message })
            });
          }
        }
      }
      
      // If content is empty but we have tool results, create a response summarizing the results
      if (!content && toolResults.length > 0) {
        content = `I've processed your request. Here are the results:`;
        
        for (const result of toolResults) {
          try {
            const parsedResult = JSON.parse(result.result);
            if (result.name === "getCurrentTime") {
              // Extract the time from the data object, not directly
              content += `\n\nThe current time is ${parsedResult.data.time}.`;
            } else if (result.name === "getWeather") {
              // Extract weather data from the data object, not directly
              content += `\n\nThe weather in ${parsedResult.data.location} is ${parsedResult.data.temperature}°C and ${parsedResult.data.conditions}.`;
            } else {
              content += `\n\n${result.name} returned: ${result.result}`;
            }
          } catch (e) {
            content += `\n\n${result.name} returned: ${result.result}`;
          }
        }
      }
      
      return {
        output: content || "No response generated",
        toolCalls: toolResults,
        error: false
      };
    } catch (error: any) {
      console.error("[LangChain] Error running executor:", error);
      return {
        output: `Error executing agent: ${error.message}`,
        toolCalls: [],
        error: true
      };
    }
  }
}

/**
 * Create a LangChain executor for an agent
 */
export function createLangChainExecutor(
  agent: Agent,
  functionRegistry: FunctionRegistry,
  openAIApiKey: string
): LangChainExecutor {
  return new LangChainExecutor(agent, functionRegistry, openAIApiKey);
}

/**
 * Run an agent with LangChain
 */
export async function runWithLangChain(
  agent: Agent,
  functionRegistry: FunctionRegistry,
  input: string,
  openAIApiKey: string
) {
  const executor = createLangChainExecutor(agent, functionRegistry, openAIApiKey);
  return executor.run(input);
} 