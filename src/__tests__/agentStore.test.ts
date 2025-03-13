import { useAgentStore } from '../store/agentStore';
import { encryptData, decryptData } from '@/utils/encryption';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    }
  };
})();

// Mock encryption utils
jest.mock('@/utils/encryption', () => {
  return {
    encryptData: jest.fn((data, salt) => `encrypted_${data}`),
    decryptData: jest.fn((data, salt) => {
      if (typeof data === 'string' && data.startsWith('encrypted_')) {
        return data.replace('encrypted_', '');
      }
      return data;
    })
  };
});

// Replace localStorage with mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Agent Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAgentStore.getState().agents = [];
    useAgentStore.getState().nodes = [];
    useAgentStore.getState().edges = [];
    useAgentStore.getState().apiKey = { openai: '', perplexity: '' };
    // Reset mock counters
    (encryptData as jest.Mock).mockClear();
    (decryptData as jest.Mock).mockClear();
  });

  it('should add an agent', () => {
    const agent = {
      name: 'Test Agent',
      systemPrompt: 'You are a test',
      provider: 'openai' as const,
      model: 'gpt-4o' as const,
      color: '#000000'
    };

    useAgentStore.getState().addAgent(agent);
    
    const agents = useAgentStore.getState().agents;
    expect(agents.length).toBe(1);
    expect(agents[0].name).toBe('Test Agent');
    expect(agents[0].id).toBeDefined();
  });

  it('should update an agent', () => {
    // Add an agent first
    const agent = {
      name: 'Test Agent',
      systemPrompt: 'You are a test',
      provider: 'openai' as const,
      model: 'gpt-4o' as const,
      color: '#000000'
    };

    useAgentStore.getState().addAgent(agent);
    const agents = useAgentStore.getState().agents;
    const agentId = agents[0].id;
    
    // Now update it
    useAgentStore.getState().updateAgent(agentId, { name: 'Updated Agent' });
    
    expect(useAgentStore.getState().agents[0].name).toBe('Updated Agent');
  });

  it('should save and load API keys securely', () => {
    // Set up localStorage with an encrypted key
    localStorageMock.setItem('swarmweaver_api_keys', JSON.stringify({
      openai: 'encrypted_test-key',
      perplexity: ''
    }));
    
    // Make sure store is clear
    useAgentStore.getState().apiKey = { openai: '', perplexity: '' };
    
    // Access to call the loadApiKeys directly
    const originalLoadApiKeys = useAgentStore.getState().loadApiKeys;
    
    // Mock implementation to track calls
    const mockLoadApiKeys = jest.fn().mockImplementation(() => {
      const result = originalLoadApiKeys();
      // The result should reflect the decrypted value
      expect(result.openai).toBe('test-key');
      return result;
    });
    
    // Replace the implementation 
    useAgentStore.getState().loadApiKeys = mockLoadApiKeys;
    
    // Call loadApiKeys
    const keys = useAgentStore.getState().loadApiKeys();
    
    // Verify expected interactions
    expect(mockLoadApiKeys).toHaveBeenCalled();
    expect(decryptData).toHaveBeenCalled();
    expect(keys.openai).toBe('test-key');
    
    // Test setting a new key
    useAgentStore.getState().setApiKey('openai', 'new-test-key');
    
    // Check that the key was saved in the store
    expect(useAgentStore.getState().apiKey.openai).toBe('new-test-key');
    
    // Check that the encryption was called
    expect(encryptData).toHaveBeenCalledWith('new-test-key', 'openai_salt');
    
    // Check that it was saved to localStorage
    const storedKeys = JSON.parse(localStorageMock.getItem('swarmweaver_api_keys') || '{}');
    expect(storedKeys.openai).toBe('encrypted_new-test-key');
    
    // Restore original function
    useAgentStore.getState().loadApiKeys = originalLoadApiKeys;
  });
}); 