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

// Replace localStorage with mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

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

// Mock atob function which is used in loadApiKeys
global.atob = jest.fn((str) => {
  if (str === 'encrypted_test-key') {
    return 'test-keyopenai_salt'; // Simulate the format expected by decryptKey
  }
  return str;
});

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
    (global.atob as jest.Mock).mockClear();
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
    // Directly test the internal helper functions rather than the public API
    
    // First test encryption during saving
    useAgentStore.getState().setApiKey('openai', 'test-key');
    
    // Check that encryption was called with the correct arguments
    expect(encryptData).toHaveBeenCalledWith('test-key', 'openai_salt');
    
    // Check that the key was stored in localStorage properly
    const storedKeysJSON = localStorageMock.getItem('swarmweaver_api_keys');
    expect(storedKeysJSON).toBeTruthy();
    
    const storedKeys = JSON.parse(storedKeysJSON || '{}');
    expect(storedKeys.openai).toBe('encrypted_test-key');
    
    // Clear the state to simulate a fresh load
    useAgentStore.getState().apiKey = { openai: '', perplexity: '' };
    
    // Now test decryption during loading
    // We'll manually call the internal loadApiKeys function
    const keys = useAgentStore.getState().loadApiKeys();
    
    // Verify atob was called with the encrypted key
    expect(global.atob).toHaveBeenCalledWith('encrypted_test-key');
    
    // Check that the decrypted key is returned
    expect(keys.openai).toBe('test-key');
    
    // Verify the key is also set in the store state
    expect(useAgentStore.getState().apiKey.openai).toBe('test-key');
  });
}); 