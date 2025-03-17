import { AIService } from '../AIService';
import { Agent, AgentRole, AgentFunction } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';
import { FunctionRegistry } from '../FunctionRegistry';
import { ConversationManager } from '../../ConversationManager';
import { LoopDetector } from '../../agents/LoopDetector';

// Mock config
jest.mock('@/config/config', () => ({
  config: {
    openai: {
      apiKey: 'sk-test-1234567890abcdef1234567890abcdef',
      models: {
        default: 'gpt-4',
        assistant: 'gpt-4'
      }
    },
    features: {
      useLangChain: true
    }
  }
}));

// Mock OpenAI
jest.mock('openai', () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Mock response',
                function_calls: []
              }
            }
          ]
        })
      }
    }
  }));
  return { OpenAI: MockOpenAI };
});

// Mock LangChain integration
jest.mock('../LangChainIntegration', () => {
  const mockExecutor = {
    run: jest.fn().mockResolvedValue({
      output: 'Mock response',
      toolCalls: [],
      error: false
    })
  };

  return {
    createLangChainExecutor: jest.fn().mockReturnValue(mockExecutor),
    runWithLangChain: jest.fn().mockResolvedValue({
      output: 'Mock response',
      toolCalls: [],
      error: false
    })
  };
});

describe('AI Service', () => {
  let aiService: AIService;
  let mockFunctionRegistry: FunctionRegistry;
  let mockConversationManager: ConversationManager;
  let mockLoopDetector: LoopDetector;
  
  const mockAgent: Agent = {
    id: 'test-agent',
    name: 'TestAgent',
    role: AgentRole.DEVELOPER,
    description: 'A test agent',
    personality: 'Helpful and friendly',
    systemPrompt: 'You are a test agent',
    functions: []
  };

  const mockFunction: AgentFunction = {
    name: 'testFunction',
    description: 'A test function',
    parameters: {
      param1: { type: 'string', description: 'First parameter' },
      param2: { type: 'string', description: 'Second parameter' }
    },
    handler: jest.fn().mockResolvedValue({ result: 'success' })
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Create mock dependencies
    mockConversationManager = {
      getConversationHistory: jest.fn().mockResolvedValue([]),
      updateConversationHistory: jest.fn().mockResolvedValue(undefined)
    } as unknown as ConversationManager;

    mockLoopDetector = {
      recordAction: jest.fn().mockReturnValue(false)
    } as unknown as LoopDetector;

    mockFunctionRegistry = new FunctionRegistry();
    
    // Create a new instance of AIService for each test
    aiService = new AIService(
      mockConversationManager,
      mockLoopDetector,
      mockFunctionRegistry
    );

    // Reset the LangChain executor mock
    const { createLangChainExecutor } = require('../LangChainIntegration');
    createLangChainExecutor.mockReturnValue({
      run: jest.fn().mockResolvedValue({
        output: 'Mock response',
        toolCalls: [],
        error: false
      })
    });
  });

  describe('Response Generation', () => {
    it('should generate agent response with function calls', async () => {
      const conversationHistory: OpenAIMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ];

      const result = await aiService.generateAgentResponse(
        mockAgent,
        'Test message',
        conversationHistory
      );

      expect(result).toHaveProperty('response', 'Mock response');
      expect(result).toHaveProperty('functionCalls');
      expect(Array.isArray(result.functionCalls)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Mock the LangChain executor to throw an error
      const { runWithLangChain } = require('../LangChainIntegration');
      runWithLangChain.mockRejectedValueOnce(new Error('API Error'));

      await expect(aiService.generateAgentResponse(
        mockAgent,
        'Test message',
        []
      )).rejects.toThrow('API Error');
    });
  });

  describe('Function Registration', () => {
    it('should register functions correctly', () => {
      aiService.registerFunction(mockFunction);
      
      // Verify the function was registered by checking if it's in the function registry
      expect(mockFunctionRegistry.getFunctionDefinitions()).toContainEqual(
        expect.objectContaining({
          name: 'testFunction',
          description: 'A test function'
        })
      );
    });

    it('should handle function registration errors', () => {
      const invalidFunction = {
        ...mockFunction,
        name: '' // Invalid empty name
      };

      // Mock the function registry to throw an error
      mockFunctionRegistry.register = jest.fn().mockImplementation(() => {
        throw new Error('Invalid function name');
      });

      expect(() => aiService.registerFunction(invalidFunction)).toThrow('Invalid function name');
    });
  });
}); 