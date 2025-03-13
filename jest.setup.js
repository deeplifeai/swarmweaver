// Global setup for Jest tests
jest.mock('openai', () => {
  const mockOpenAIInstance = {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'This is a test response',
              tool_calls: [{
                type: 'function',
                function: {
                  name: 'testFunction',
                  arguments: JSON.stringify({ param1: 'value1', param2: 'value2' })
                }
              }]
            }
          }]
        })
      }
    }
  };

  return {
    default: function() {
      return mockOpenAIInstance;
    }
  };
}); 