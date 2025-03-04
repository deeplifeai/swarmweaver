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
jest.mock('@/utils/encryption', () => ({
  encryptData: jest.fn(data => `encrypted_${data}`),
  decryptData: jest.fn(data => data.replace('encrypted_', ''))
}));

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Agent Store', () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAgentStore.getState().agents = [];
    useAgentStore.getState().nodes = [];
    useAgentStore.getState().edges = [];
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
    // Set API key
    useAgentStore.getState().setApiKey('openai', 'test-key');
    
    // Check that the key was saved in the store
    expect(useAgentStore.getState().apiKey.openai).toBe('test-key');
    
    // Check that the encryption was called
    expect(encryptData).toHaveBeenCalledWith('test-key', 'openai_salt');
    
    // Check that it was saved to localStorage
    const storedKeys = JSON.parse(localStorageMock.getItem('swarmweaver_api_keys') || '{}');
    expect(storedKeys.openai).toBe('encrypted_test-key');
    
    // Reset the store
    useAgentStore.getState().apiKey = { openai: '', perplexity: '' };
    
    // Initialize again (simulating a page reload)
    useAgentStore.getState().loadApiKeys();
    
    // Verify the key was decrypted
    expect(decryptData).toHaveBeenCalled();
    expect(useAgentStore.getState().apiKey.openai).toBe('test-key');
  });
}); 