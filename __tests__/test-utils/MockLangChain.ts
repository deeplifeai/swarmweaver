import { Agent } from '../../src/types/agents/Agent';
import { FunctionRegistry } from '../../src/services/ai/FunctionRegistry';

/**
 * Mock LangChainExecutor class for testing
 */
export class MockLangChainExecutor {
  constructor(agent: Agent, functionRegistry: FunctionRegistry, openAIApiKey: string) {}
  
  /**
   * Mock implementation of run
   */
  run = jest.fn().mockImplementation(async (input: string) => {
    return {
      output: "This is a mock response from LangChain",
      toolCalls: [],
      error: false
    };
  });
}

/**
 * Mock implementation of createLangChainExecutor
 */
export function createMockLangChainExecutor(
  agent: Agent,
  functionRegistry: FunctionRegistry,
  openAIApiKey: string
): MockLangChainExecutor {
  return new MockLangChainExecutor(agent, functionRegistry, openAIApiKey);
}

/**
 * Mock implementation of runWithLangChain
 */
export async function mockRunWithLangChain(
  agent: Agent,
  functionRegistry: FunctionRegistry,
  input: string,
  openAIApiKey: string
) {
  const executor = new MockLangChainExecutor(agent, functionRegistry, openAIApiKey);
  return await executor.run(input);
} 