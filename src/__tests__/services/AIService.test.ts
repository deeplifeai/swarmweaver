import { AIService } from '@/services/ai/AIService';
import { Agent, AgentRole, AgentFunction } from '@/types/agents/Agent';
import { OpenAIMessage } from '@/types/openai/OpenAITypes';

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'This is a test response',
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: 'testFunction',
                      arguments: JSON.stringify({ param1: 'value1', param2: 'value2' })
                    }
                  }
                ]
              }
            }
          ]
        })
      }
    }
  }));
});

// Mock config
jest.mock('@/config/config', () => ({
  config: {
    openai: {
      apiKey: 'mock-api-key',
      model: 'gpt-4o'
    }
  }
}));

describe('AIService', () => {
  let aiService: AIService;
  const mockFunction: AgentFunction = {
    name: 'testFunction',
    description: 'A test function',
    parameters: {
      param1: { type: 'string', description: 'First parameter' },
      param2: { type: 'string', description: 'Second parameter' }
    },
    handler: jest.fn().mockResolvedValue({ result: 'success' })
  };

  const mockAgent: Agent = {
    id: 'test-agent',
    name: 'TestAgent',
    role: AgentRole.DEVELOPER,
    description: 'A test agent',
    personality: 'Helpful and friendly',
    systemPrompt: 'You are a test agent',
    functions: [
      {
        name: 'testFunction',
        description: 'A test function',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'First parameter' },
            param2: { type: 'string', description: 'Second parameter' }
          },
          required: ['param1', 'param2']
        }
      }
    ]
  };

  const mockConversationHistory: OpenAIMessage[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
    aiService.registerFunction(mockFunction);
  });

  describe('generateAgentResponse', () => {
    it('should generate a response with function calls', async () => {
      const result = await aiService.generateAgentResponse(
        mockAgent,
        'Test message',
        mockConversationHistory
      );

      expect(result).toHaveProperty('response', 'This is a test response');
      expect(result).toHaveProperty('functionCalls');
      expect(result.functionCalls.length).toBe(1);
      expect(result.functionCalls[0]).toHaveProperty('name', 'testFunction');
      expect(result.functionCalls[0]).toHaveProperty('arguments', { param1: 'value1', param2: 'value2' });
      expect(result.functionCalls[0]).toHaveProperty('result', { result: 'success' });
    });
  });

  describe('extractFunctionResults', () => {
    it('should format function results as a readable string', () => {
      const functionCalls = [
        {
          name: 'testFunction',
          arguments: { param1: 'value1', param2: 'value2' },
          result: { result: 'success' }
        }
      ];

      const result = aiService.extractFunctionResults(functionCalls);
      expect(result).toContain('Function testFunction was called');
      expect(result).toContain('{"param1":"value1","param2":"value2"}');
      expect(result).toContain('{"result":"success"}');
    });
  });

  describe('registerFunction', () => {
    it('should register a function that can be called later', async () => {
      const newFunction: AgentFunction = {
        name: 'anotherFunction',
        description: 'Another test function',
        parameters: {
          param: { type: 'string', description: 'A parameter' }
        },
        handler: jest.fn().mockResolvedValue({ anotherResult: 'success' })
      };

      aiService.registerFunction(newFunction);

      // Create a mock with tool_calls for the new function
      const mockOpenAI = require('openai');
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: 'Another test response',
                    tool_calls: [
                      {
                        type: 'function',
                        function: {
                          name: 'anotherFunction',
                          arguments: JSON.stringify({ param: 'test' })
                        }
                      }
                    ]
                  }
                }
              ]
            })
          }
        }
      }));

      const result = await aiService.generateAgentResponse(
        mockAgent,
        'Another test message',
        []
      );

      expect(newFunction.handler).toHaveBeenCalledWith({ param: 'test' }, 'test-agent');
    });
  });
}); 