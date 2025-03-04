import { generateAgentResponse } from '../services/ai-service';
import { AIProvider, AIModel } from '@/types/agent';
import { useAgentStore } from '@/store/agentStore';

// Mock the fetch API
global.fetch = jest.fn();

// Mock Zustand store
jest.mock('@/store/agentStore', () => ({
  useAgentStore: {
    getState: jest.fn().mockReturnValue({
      apiKey: { openai: 'test-key', perplexity: 'test-key' }
    })
  }
}));

describe('AI Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call OpenAI API correctly', async () => {
    // Setup mock response
    const mockResponse = {
      choices: [{ message: { content: 'Test response' } }]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    // Call the function
    const result = await generateAgentResponse(
      'openai',
      'gpt-4o',
      'You are a helpful assistant',
      'Hello'
    );

    // Assertions
    expect(result).toBe('Test response');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-key'
        }),
        body: expect.stringContaining('gpt-4o')
      })
    );
  });

  it('should handle API errors', async () => {
    // Setup mock error response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });

    // Assertions
    await expect(generateAgentResponse(
      'openai',
      'gpt-4o',
      'You are a helpful assistant',
      'Hello'
    )).rejects.toThrow('OpenAI API error: Invalid API key');
  });

  it('should handle missing API key', async () => {
    // Override the mock to return no API key
    (useAgentStore.getState as jest.Mock).mockReturnValueOnce({
      apiKey: { openai: '', perplexity: '' }
    });

    // Assertions
    await expect(generateAgentResponse(
      'openai',
      'gpt-4o',
      'You are a helpful assistant',
      'Hello'
    )).rejects.toThrow('No API key set for openai');
  });
}); 