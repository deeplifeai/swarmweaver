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

// Polyfill for TextEncoder and TextDecoder which are needed by LangChain packages
const { TextEncoder, TextDecoder } = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for ReadableStream
const { Readable } = require('stream');
class MockReadableStream {
  constructor(options) {
    this.readable = new Readable(options);
  }
  
  getReader() {
    const reader = {
      read: async () => {
        return new Promise((resolve) => {
          this.readable.once('readable', () => {
            const chunk = this.readable.read();
            if (chunk === null) {
              resolve({ done: true });
            } else {
              resolve({ value: chunk, done: false });
            }
          });
          
          this.readable.once('end', () => {
            resolve({ done: true });
          });
        });
      },
      releaseLock: () => {},
      cancel: () => this.readable.destroy()
    };
    return reader;
  }
}

global.ReadableStream = MockReadableStream;

// Polyfill for fetch
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;

// Add OpenAI node shims
require('openai/shims/node'); 