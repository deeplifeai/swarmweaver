import { create } from 'zustand';
import { Agent, AgentNode, AgentEdge, AgentExecutionResult, AIProvider, AIModel } from '@/types/agent';
import { saveAs } from 'file-saver';
import { encryptData, decryptData } from '@/utils/encryption';
import { toast } from 'sonner';
import { useState } from 'react';
import { responseCache } from '@/services/cacheService';

interface AgentState {
  agents: Agent[];
  nodes: AgentNode[];
  edges: AgentEdge[];
  executionResults: Record<string, AgentExecutionResult>;
  apiKey: {
    openai: string;
    perplexity: string;
  };
  cacheStats: {
    enabled: boolean;
    size: number;
  };
  
  // Agent CRUD actions
  addAgent: (agent: Omit<Agent, 'id'>) => void;
  updateAgent: (id: string, updates: Partial<Omit<Agent, 'id'>>) => void;
  removeAgent: (id: string) => void;
  
  // Canvas actions
  addNode: (node: Omit<AgentNode, 'id'>) => void;
  updateNode: (id: string, updates: Partial<Omit<AgentNode, 'id'>>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Omit<AgentEdge, 'id'>) => void;
  removeEdge: (id: string) => void;
  clearCanvas: () => void;
  clearAgents: () => void;
  
  // Canvas inputs/outputs
  addNodeInput: (nodeId: string, input: string) => void;
  setNodeOutput: (nodeId: string, output: string) => void;
  
  // Execution
  setExecutionResult: (result: AgentExecutionResult) => void;
  clearExecutionResults: () => void;
  
  // API Keys
  setApiKey: (provider: AIProvider, key: string) => void;
  loadApiKeys: () => { openai: string; perplexity: string };
  
  // Cache management
  clearResponseCache: () => void;
  toggleCacheEnabled: () => void;
  updateCacheStats: () => void;
  
  // Save functions
  saveAgentToLibrary: (node: AgentNode) => void;
  saveCanvasState: () => void;
  exportCanvasToFile: () => void;
  loadCanvasState: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

// Load API keys from localStorage on initialization
const loadApiKeys = (): { openai: string; perplexity: string } => {
  try {
    const storedKeys = localStorage.getItem('swarmweaver_api_keys');
    if (storedKeys) {
      const parsedKeys = JSON.parse(storedKeys);
      const decryptKey = (encryptedKey: string, salt: string): string => {
        try {
          const decoded = atob(encryptedKey);
          if (decoded.endsWith(salt)) {
            return decoded.slice(0, -salt.length);
          }
        } catch (error) {
          // If decoding fails, assume the key is stored in plain text
        }
        return encryptedKey; // assume plain text
      };
      return {
        openai: parsedKeys.openai ? decryptKey(parsedKeys.openai, 'openai_salt') : '',
        perplexity: parsedKeys.perplexity ? decryptKey(parsedKeys.perplexity, 'perplexity_salt') : ''
      };
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error);
  }
  return { openai: '', perplexity: '' };
};

// Save API keys to localStorage
const saveApiKeys = (keys: { openai: string; perplexity: string }) => {
  try {
    const encryptedKeys = {
      openai: keys.openai ? encryptData(keys.openai, 'openai_salt') : '',
      perplexity: keys.perplexity ? encryptData(keys.perplexity, 'perplexity_salt') : ''
    };
    localStorage.setItem('swarmweaver_api_keys', JSON.stringify(encryptedKeys));
  } catch (error) {
    console.error('Failed to save API keys to localStorage:', error);
  }
};

// Save/load canvas state from localStorage
const saveCanvasStateToLocalStorage = (state: { nodes: AgentNode[], edges: AgentEdge[], agents: Agent[] }) => {
  try {
    localStorage.setItem('swarmweaver_canvas_state', JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save canvas state to localStorage:', error);
  }
};

const loadCanvasStateFromLocalStorage = () => {
  try {
    const storedState = localStorage.getItem('swarmweaver_canvas_state');
    if (storedState) {
      return JSON.parse(storedState);
    }
  } catch (error) {
    console.error('Failed to load canvas state from localStorage:', error);
  }
  return { nodes: [], edges: [], agents: [] };
};

// Initialize with stored state
const initialState = loadCanvasStateFromLocalStorage();

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: initialState.agents || [],
  nodes: initialState.nodes || [],
  edges: initialState.edges || [],
  executionResults: {},
  apiKey: loadApiKeys(), // Initialize with stored keys
  cacheStats: { enabled: true, size: 0 },
  
  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, { ...agent, id: generateId() }]
  })),
  
  updateAgent: (id, updates) => set((state) => {
    // Update the agents
    const updatedAgents = state.agents.map((agent) => 
      agent.id === id ? { ...agent, ...updates } : agent
    );
    
    // If color was updated, also update all nodes that reference this agent
    if ('color' in updates) {
      const updatedNodes = state.nodes.map((node) => 
        node.data?.agentId === id 
          ? { ...node, data: { ...node.data, color: updates.color } } 
          : node
      );
      
      return {
        agents: updatedAgents,
        nodes: updatedNodes
      };
    }
    
    return {
      agents: updatedAgents
    };
  }),
  
  removeAgent: (id) => set((state) => ({
    agents: state.agents.filter((agent) => agent.id !== id)
  })),
  
  addNode: (node) => set((state) => ({
    nodes: [...state.nodes, { ...node, id: generateId() }]
  })),
  
  updateNode: (id, updates) => set((state) => ({
    nodes: state.nodes.map((node) => 
      node.id === id ? { ...node, ...updates } : node
    )
  })),
  
  removeNode: (id) => {
    console.log('Before removal:', get().nodes.length, 'nodes');
    set((state) => {
      const newState = {
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id)
      };
      console.log('After removal:', newState.nodes.length, 'nodes');
      return newState;
    });
    console.log('Final state after removal:', get().nodes.length, 'nodes');
  },
  
  clearCanvas: () => {
    set({ nodes: [], edges: [] });
    // Also clear the localStorage copy
    saveCanvasStateToLocalStorage({ 
      nodes: [], 
      edges: [], 
      agents: get().agents 
    });
    toast.success('Canvas cleared');
  },
  
  clearAgents: () => {
    set({ agents: [] });
    // Also clear the localStorage copy
    saveCanvasStateToLocalStorage({ 
      nodes: get().nodes, 
      edges: get().edges, 
      agents: [] 
    });
    toast.success('All saved agents cleared');
  },

  addEdge: (edge) => set((state) => {
    // Prevent duplicate edges and self-connections
    const isDuplicate = state.edges.some(
      (e) => e.source === edge.source && e.target === edge.target
    );
    
    if (isDuplicate || edge.source === edge.target) {
      return state;
    }

    return {
      edges: [...state.edges, { ...edge, id: `e-${generateId()}`, animated: true }]
    };
  }),
  
  removeEdge: (id) => set((state) => ({
    edges: state.edges.filter((edge) => edge.id !== id)
  })),
  
  addNodeInput: (nodeId, input) => set((state) => ({
    nodes: state.nodes.map((node) => 
      node.id === nodeId 
        ? { 
            ...node, 
            data: { 
              ...node.data, 
              inputs: [input]
            } 
          } 
        : node
    )
  })),
  
  setNodeOutput: (nodeId, output) => set((state) => ({
    nodes: state.nodes.map((node) => 
      node.id === nodeId 
        ? { 
            ...node, 
            data: { 
              ...node.data, 
              outputs: [...(node.data.outputs || []), output] 
            } 
          } 
        : node
    )
  })),
  
  setExecutionResult: (result) => set((state) => ({
    executionResults: { ...state.executionResults, [result.nodeId]: result }
  })),
  
  clearExecutionResults: () => set({ executionResults: {} }),
  
  setApiKey: (provider, key) => {
    set((state) => {
      // Create updated keys object with the new key
      const updatedKeys = { ...state.apiKey, [provider]: key };
      
      // Save to localStorage whenever keys are updated
      saveApiKeys(updatedKeys);
      
      console.info(`API key updated for ${provider}`);
      
      // Update the store state
      // This will trigger a state update that propagates to all components
      // that subscribe to the apiKey state
      return { apiKey: updatedKeys };
    });
    
    // Force a refresh of the store's state for components that directly access it
    // through getState() (not using React's state management)
    const refreshedKeys = useAgentStore.getState().apiKey;
    console.info(`API keys refreshed in store:`, 
      Object.keys(refreshedKeys).map(k => `${k}:${refreshedKeys[k] ? 'set' : 'not set'}`).join(', '));
  },
  
  loadApiKeys: () => {
    const keys = loadApiKeys();
    set({ apiKey: keys });
    return keys;
  },
  
  saveAgentToLibrary: (node: AgentNode) => {
    if (!node.data.agentId) {
      throw new Error('Node is not an agent');
    }

    const agent = get().agents.find(a => a.id === node.data.agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Create a new agent with the same configuration
    const newAgent = {
      name: `${agent.name} (Copy)`,
      systemPrompt: agent.systemPrompt,
      provider: agent.provider,
      model: agent.model,
      color: agent.color,
      savedToLibrary: true
    };

    // Add the agent to the store
    get().addAgent(newAgent);
    toast.success(`Agent "${agent.name}" saved to library`);
  },

  saveCanvasState: () => {
    const state = {
      nodes: get().nodes,
      edges: get().edges,
      agents: get().agents
    };
    
    saveCanvasStateToLocalStorage(state);
    toast.success('Canvas state saved to browser storage');
  },
  
  exportCanvasToFile: () => {
    const state = {
      nodes: get().nodes,
      edges: get().edges,
      agents: get().agents
    };
    
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    saveAs(blob, 'canvas-state.json');
  },
  
  loadCanvasState: () => {
    const storedState = loadCanvasStateFromLocalStorage();
    if (storedState) {
      set({
        nodes: storedState.nodes || [],
        edges: storedState.edges || [],
        agents: storedState.agents || []
      });
      return true;
    }
    return false;
  },

  clearResponseCache: () => {
    responseCache.clearCache();
    set((state) => ({
      cacheStats: {
        ...state.cacheStats,
        size: 0
      }
    }));
    toast.success('Response cache cleared');
  },

  toggleCacheEnabled: () => {
    set((state) => {
      const newEnabled = !state.cacheStats.enabled;
      responseCache.setEnabled(newEnabled);
      return {
        cacheStats: {
          ...state.cacheStats,
          enabled: newEnabled
        }
      };
    });
  },

  updateCacheStats: () => {
    set((state) => ({
      cacheStats: {
        enabled: responseCache.isEnabled(),
        size: responseCache.getCacheSize()
      }
    }));
  }
}));
