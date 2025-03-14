// Global setup for Jest tests
require("reflect-metadata");

// ES Module export-compatible mock for OpenAI
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

// Setup localStorage for Node.js environment
if (typeof localStorage === 'undefined') {
  global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
    length: 0
  };
}

// Mock for tsyringe container to support dependency injection in tests
jest.mock('tsyringe', () => {
  const actual = jest.requireActual('tsyringe');
  
  // Create a test container with mocked dependencies
  const testContainer = {
    resolve: jest.fn().mockImplementation((token) => {
      // Default mock implementations for common services
      if (token === 'ErrorHandler') {
        return {
          handleError: jest.fn(),
          withRetry: jest.fn((fn) => fn()) // Just execute the function directly
        };
      }
      
      if (token === 'LoggingService') {
        return {
          error: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          trace: jest.fn()
        };
      }
      
      // Return empty mock objects for other services
      return {};
    }),
    register: jest.fn(),
    registerSingleton: jest.fn()
  };
  
  return {
    ...actual,
    container: testContainer,
    singleton: () => () => {},
    injectable: () => () => {},
    inject: () => () => {}
  };
}); 