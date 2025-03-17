import { MockLangChainExecutor, createMockLangChainExecutor, mockRunWithLangChain } from '../test-utils/MockLangChain';

// Export the mock classes and functions with the same names as the original module
export const LangChainExecutor = MockLangChainExecutor;
export const createLangChainExecutor = createMockLangChainExecutor;
export const runWithLangChain = mockRunWithLangChain; 