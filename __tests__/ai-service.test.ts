import { generateAgentResponse } from '../src/services/ai-service';

// Ensure that localStorage is available (if running in Node, you might need a polyfill)
// For simplicity, we assume a jsdom environment or that global.localStorage is defined

describe('generateAgentResponse caching', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should cache responses between calls with identical parameters', async () => {
    const provider = 'openai';
    const model = 'gpt-4o';
    const systemPrompt = 'Test system prompt';
    const query = 'Test query';

    // First call should invoke the original function and store the result in localStorage
    const response1 = await generateAgentResponse(provider, model, systemPrompt, query);

    // Second call should retrieve the response from cache
    const response2 = await generateAgentResponse(provider, model, systemPrompt, query);

    expect(response1).toEqual(response2);
  });

  it('should persist cache across calls simulating separate sessions', async () => {
    const provider = 'openai';
    const model = 'gpt-4o';
    const systemPrompt = 'Persistent system prompt';
    const query = 'Persistent query';

    // Call once to set the cache
    const firstResponse = await generateAgentResponse(provider, model, systemPrompt, query);
    
    // Simulate a new session by not clearing localStorage and calling again
    const secondResponse = await generateAgentResponse(provider, model, systemPrompt, query);

    expect(firstResponse).toEqual(secondResponse);
  });
});
