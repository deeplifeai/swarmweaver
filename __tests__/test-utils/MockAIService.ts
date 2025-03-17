import { Agent } from '../../src/types/agents/Agent';
import { OpenAIMessage } from '../../src/types/openai/OpenAITypes';
import { FunctionRegistry } from '../../src/services/ai/FunctionRegistry';

/**
 * Mock implementation of AIService for testing
 */
export class MockAIService {
  private functionRegistry: FunctionRegistry;
  
  constructor() {
    this.functionRegistry = new FunctionRegistry();
    
    // Pre-configure the mocks with default implementations
    this.generateAgentResponse.mockImplementation(
      async (
        agent: Agent, 
        userMessage: string, 
        conversationHistory: OpenAIMessage[] = []
      ) => {
        return {
          response: `Mock response from ${agent.name} (${agent.role}): ${userMessage.substring(0, 20)}...`,
          functionCalls: []
        };
      }
    );
    
    this.extractFunctionResults.mockImplementation(
      (functionCalls: any[]) => {
        if (!functionCalls || functionCalls.length === 0) {
          return "No functions were called";
        }
        
        return functionCalls
          .map(call => `Function ${call.name} was called with ${JSON.stringify(call.arguments)}`)
          .join('\n');
      }
    );
  }
  
  setFunctionRegistry(registry: FunctionRegistry) {
    this.functionRegistry = registry;
  }
  
  registerFunction(func: any) {
    this.functionRegistry.register(func);
  }
  
  /**
   * Mock implementation of generateAgentResponse that can be used in tests
   */
  generateAgentResponse = jest.fn();
  
  /**
   * Mock implementation of extractFunctionResults
   */
  extractFunctionResults = jest.fn();
  
  /**
   * Mock implementation of generateText
   */
  generateText = jest.fn().mockImplementation(
    async (
      provider: string,
      model: string,
      systemPrompt: string,
      userPrompt: string
    ) => {
      return "Mock generated text";
    }
  );
} 