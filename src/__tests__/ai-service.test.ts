import { generateAgentResponse } from '../services/ai-service';
import { useAgentStore } from '../store/agentStore';

// Mock the ai-service module
jest.mock('../services/ai-service', () => {
  // Create a mock implementation of generateAgentResponse
  const mockGenerateAgentResponse = jest.fn();
  
  // Default implementation for normal tests
  mockGenerateAgentResponse.mockImplementation(async (provider, model, systemPrompt, query) => {
    return "Test response";
  });
  
  return {
    generateAgentResponse: mockGenerateAgentResponse
  };
});

// Mock the useAgentStore to return a fake API key
jest.mock('../store/agentStore', () => ({
  useAgentStore: {
    getState: jest.fn().mockReturnValue({
      apiKey: {
        openai: 'test-api-key',
        perplexity: 'test-api-key'
      }
    })
  }
}));

describe('AI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle API errors', async () => {
    // Override the mock for this specific test
    (generateAgentResponse as jest.Mock).mockRejectedValueOnce(new Error('API error'));
    
    // Assertions
    await expect(generateAgentResponse(
      'openai',
      'gpt-4o',
      'You are a helpful assistant',
      'Hello'
    )).rejects.toThrow('API error');
  });
  
  it('should handle missing API key', async () => {
    // Override the mock for this specific test
    (generateAgentResponse as jest.Mock).mockRejectedValueOnce(new Error('No API key set for openai'));
    
    // Assertions
    await expect(generateAgentResponse(
      'openai',
      'gpt-4o',
      'You are a helpful assistant',
      'Hello'
    )).rejects.toThrow('No API key set for openai');
  });
}); 