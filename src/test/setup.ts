// Import OpenAI shim for Node.js environment
import 'openai/shims/node';

// Import setImmediate polyfill
import 'setimmediate';

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock console.error to reduce noise in test output
const originalError = console.error;
console.error = (...args) => {
  // Only log errors that aren't related to localStorage
  if (!args[0]?.includes('localStorage')) {
    originalError.call(console, ...args);
  }
}; 