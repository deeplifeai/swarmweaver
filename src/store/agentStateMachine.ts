import { createMachine, assign } from 'xstate';
import { Agent, AgentNode, AgentEdge, AgentExecutionResult, AIProvider, AIModel } from '@/types/agent';
import { saveAs } from 'file-saver';
import { encryptData, decryptData } from '@/utils/encryption';
import { responseCache } from '@/services/cacheService';
import { nanoid } from 'nanoid';

// Type definitions for the state context
interface AgentContext {
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
  processingApiCalls: Record<string, Promise<string>>;
}

// State machine events
type AgentEvent =
  | { type: 'ADD_AGENT'; agent: Omit<Agent, 'id'> }
  | { type: 'UPDATE_AGENT'; id: string; updates: Partial<Omit<Agent, 'id'>> }
  | { type: 'REMOVE_AGENT'; id: string }
  | { type: 'ADD_NODE'; node: Omit<AgentNode, 'id'> }
  | { type: 'UPDATE_NODE'; id: string; updates: Partial<Omit<AgentNode, 'id'>> }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'ADD_EDGE'; edge: Omit<AgentEdge, 'id'> }
  | { type: 'REMOVE_EDGE'; id: string }
  | { type: 'CLEAR_CANVAS' }
  | { type: 'CLEAR_AGENTS' }
  | { type: 'ADD_NODE_INPUT'; nodeId: string; input: string }
  | { type: 'SET_NODE_OUTPUT'; nodeId: string; output: string }
  | { type: 'SET_EXECUTION_RESULT'; result: AgentExecutionResult }
  | { type: 'CLEAR_EXECUTION_RESULTS' }
  | { type: 'SET_API_KEY'; provider: AIProvider; key: string }
  | { type: 'LOAD_API_KEYS' }
  | { type: 'CLEAR_RESPONSE_CACHE' }
  | { type: 'TOGGLE_CACHE_ENABLED' }
  | { type: 'UPDATE_CACHE_STATS' }
  | { type: 'SET_PROCESSING_API_CALLS'; processingCalls: Record<string, Promise<string>> }
  | { type: 'SAVE_AGENT_TO_LIBRARY'; node: AgentNode }
  | { type: 'SAVE_CANVAS_STATE' }
  | { type: 'EXPORT_CANVAS_TO_FILE' }
  | { type: 'LOAD_CANVAS_STATE' };

// Helper functions
const generateId = () => nanoid(7);

const loadApiKeys = (): { openai: string; perplexity: string } => {
  try {
    const encryptedOpenAIKey = localStorage.getItem('openai-key');
    const encryptedPerplexityKey = localStorage.getItem('perplexity-key');

    const openaiSalt = localStorage.getItem('openai-salt');
    const perplexitySalt = localStorage.getItem('perplexity-salt');

    const decryptKey = (encryptedKey: string, salt: string): string => {
      if (!encryptedKey || !salt) return '';
      try {
        return decryptData(encryptedKey, salt);
      } catch (e) {
        console.error('Failed to decrypt key:', e);
        return '';
      }
    };

    return {
      openai: encryptedOpenAIKey && openaiSalt ? decryptKey(encryptedOpenAIKey, openaiSalt) : '',
      perplexity: encryptedPerplexityKey && perplexitySalt ? decryptKey(encryptedPerplexityKey, perplexitySalt) : ''
    };
  } catch (e) {
    console.error('Failed to load API keys:', e);
    return { openai: '', perplexity: '' };
  }
};

const saveApiKeys = (keys: { openai: string; perplexity: string }) => {
  try {
    if (keys.openai) {
      const openaiSalt = nanoid(16);
      localStorage.setItem('openai-salt', openaiSalt);
      localStorage.setItem('openai-key', encryptData(keys.openai, openaiSalt));
    }

    if (keys.perplexity) {
      const perplexitySalt = nanoid(16);
      localStorage.setItem('perplexity-salt', perplexitySalt);
      localStorage.setItem('perplexity-key', encryptData(keys.perplexity, perplexitySalt));
    }
  } catch (e) {
    console.error('Failed to save API keys:', e);
  }
};

const saveCanvasStateToLocalStorage = (state: { nodes: AgentNode[], edges: AgentEdge[], agents: Agent[] }) => {
  try {
    localStorage.setItem('canvas-state', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save canvas state:', e);
  }
};

const loadCanvasStateFromLocalStorage = () => {
  try {
    const storedState = localStorage.getItem('canvas-state');
    return storedState ? JSON.parse(storedState) : null;
  } catch (e) {
    console.error('Failed to load canvas state:', e);
    return null;
  }
};

// Create the XState machine
export const agentMachine = createMachine<AgentContext, AgentEvent>(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgBsB7CAMzAAs9qQ9qBiAFQFEAFAUQH0AZAA4A7AE5RddgDZ1egMwBWTQF8jCtFjyESFGvUSoArupFbde-UUJHipPVQVEN3Pb2z6TJgiN6gAB6IALoARgpKquoARtbGZpY2dgBOvn5RAQI8ZvrxPEYKDAImZmLpAe7W0U7mUABuNMgANgAOVACGagCOGdnSwkR6QZrVPjZOLm5MHlFA-k5A-sOVKpRjsZnGHsw+JvoxUf40xjQqTtMWFQq0-kB9U8aEtX6rtZEBXHvxXnX+jU3qPcFQOYeKbHLZLEIqbZbUxbC6dHp9PrIYajCbjADiKzCb2SYOsvTMcLMY06FXOlVqDXuzTajHQmG65mcWHMznU6i0plszDsIVxrF0WMmBPJMPc51ym0CtIhbPMlhulnyBGKJnKL2iMTheJxP2J8VJ6lprXanR6GBQGW6OVyHV13VQWTVlEyWQIjnQTnCZOZwzcJvc6mSzHCZKuR1uYxZ5kqlytWZi1uFY7Q6XR6vUwyEGXxGhDDkZ6FpNCnNSgAoknASDQEDWB3OdYExaeUSY6KvZKiTLPEYnWYrJp7M4DhFVWqNVqdZ79SgIGoGjQhiNxpMZnNUAs4ZFZAGFCkYsv0kJK2ZuGK8GQJNEvd0aBYQ+msSY6z3nBotB4KRoMKJQQP0DpiBQTDpvmhZYLQLDlhAmS9HBPSHGMZjOoSgJQXE-z6MKy60MBL4OlBMEzkKoFLCB55ZmYTbxE0cJeJCIz-v0rCYbWjbNm2Vpdt2nYrN2MDqPhYIUV4IymN8oFzKYZgGAQVhaGeOnvAQRlLiBiQnM23LYTM2GSTEAGJJeTGJKcxnKKiw0e6UT0WYZDmDYdjGKYvEWAA5HojFAuJvQSaMUxoAAjJkGCWVMUxGJYaFQVpFi8UF-G0OpvnCahIVhRFNoxiKGZ0pSFiZfYFi3lYUBRbF8UJeAyWpel9KZdljHdSFPX9RmvXVtViFRTW1mWAGxkZQNrW1qEDgRAoTRoDQjQJXa9RrAgIZmJMxlBMZrYOYm1g6U5HSOK4rhJGYXhdL4fj+CMx2JKd53RZdN3XXA93pYV2VnRV4WRWZ0V-XtZVrTwO0BWs-aLHsGZ6e53W7bFfEnScfmhcyNmrJAAwxKkKNsOj91vZ95UVVV+lXXVj0PRMPT9T0QA */
    id: 'agentMachine',
    initial: 'idle',
    predictableActionArguments: true,
    context: {
      agents: [],
      nodes: [],
      edges: [],
      executionResults: {},
      apiKey: { openai: '', perplexity: '' },
      cacheStats: { enabled: true, size: 0 },
      processingApiCalls: {}
    },
    states: {
      idle: {
        on: {
          ADD_AGENT: {
            actions: 'addAgent'
          },
          UPDATE_AGENT: {
            actions: 'updateAgent'
          },
          REMOVE_AGENT: {
            actions: 'removeAgent'
          },
          ADD_NODE: {
            actions: 'addNode'
          },
          UPDATE_NODE: {
            actions: 'updateNode'
          },
          REMOVE_NODE: {
            actions: 'removeNode'
          },
          ADD_EDGE: {
            actions: 'addEdge'
          },
          REMOVE_EDGE: {
            actions: 'removeEdge'
          },
          CLEAR_CANVAS: {
            actions: 'clearCanvas'
          },
          CLEAR_AGENTS: {
            actions: 'clearAgents'
          },
          ADD_NODE_INPUT: {
            actions: 'addNodeInput'
          },
          SET_NODE_OUTPUT: {
            actions: 'setNodeOutput'
          },
          SET_EXECUTION_RESULT: {
            actions: 'setExecutionResult'
          },
          CLEAR_EXECUTION_RESULTS: {
            actions: 'clearExecutionResults'
          },
          SET_API_KEY: {
            actions: 'setApiKey'
          },
          LOAD_API_KEYS: {
            actions: 'loadApiKeys'
          },
          CLEAR_RESPONSE_CACHE: {
            actions: 'clearResponseCache'
          },
          TOGGLE_CACHE_ENABLED: {
            actions: 'toggleCacheEnabled'
          },
          UPDATE_CACHE_STATS: {
            actions: 'updateCacheStats'
          },
          SET_PROCESSING_API_CALLS: {
            actions: 'setProcessingApiCalls'
          },
          SAVE_AGENT_TO_LIBRARY: {
            actions: 'saveAgentToLibrary'
          },
          SAVE_CANVAS_STATE: {
            actions: 'saveCanvasState'
          },
          EXPORT_CANVAS_TO_FILE: {
            actions: 'exportCanvasToFile'
          },
          LOAD_CANVAS_STATE: {
            actions: 'loadCanvasState'
          }
        }
      }
    }
  },
  {
    actions: {
      addAgent: assign({
        agents: (context, event) => {
          if (event.type !== 'ADD_AGENT') return context.agents;
          return [...context.agents, { ...event.agent, id: generateId() }];
        }
      }),
      updateAgent: assign({
        agents: (context, event) => {
          if (event.type !== 'UPDATE_AGENT') return context.agents;
          return context.agents.map(agent => 
            agent.id === event.id ? { ...agent, ...event.updates } : agent
          );
        }
      }),
      removeAgent: assign({
        agents: (context, event) => {
          if (event.type !== 'REMOVE_AGENT') return context.agents;
          return context.agents.filter(agent => agent.id !== event.id);
        }
      }),
      addNode: assign({
        nodes: (context, event) => {
          if (event.type !== 'ADD_NODE') return context.nodes;
          return [...context.nodes, { ...event.node, id: generateId() }];
        }
      }),
      updateNode: assign({
        nodes: (context, event) => {
          if (event.type !== 'UPDATE_NODE') return context.nodes;
          return context.nodes.map(node => 
            node.id === event.id ? { ...node, ...event.updates } : node
          );
        }
      }),
      removeNode: assign({
        nodes: (context, event) => {
          if (event.type !== 'REMOVE_NODE') return context.nodes;
          return context.nodes.filter(node => node.id !== event.id);
        },
        edges: (context, event) => {
          if (event.type !== 'REMOVE_NODE') return context.edges;
          return context.edges.filter(
            edge => edge.source !== event.id && edge.target !== event.id
          );
        }
      }),
      addEdge: assign({
        edges: (context, event) => {
          if (event.type !== 'ADD_EDGE') return context.edges;
          return [...context.edges, { ...event.edge, id: generateId() }];
        }
      }),
      removeEdge: assign({
        edges: (context, event) => {
          if (event.type !== 'REMOVE_EDGE') return context.edges;
          return context.edges.filter(edge => edge.id !== event.id);
        }
      }),
      clearCanvas: assign({
        nodes: () => [],
        edges: () => [],
        executionResults: () => ({})
      }),
      clearAgents: assign({
        agents: (context) => context.agents.filter(agent => agent.savedToLibrary)
      }),
      addNodeInput: assign({
        nodes: (context, event) => {
          if (event.type !== 'ADD_NODE_INPUT') return context.nodes;
          return context.nodes.map(node => {
            if (node.id === event.nodeId) {
              const inputs = node.data.inputs || [];
              return {
                ...node,
                data: {
                  ...node.data,
                  inputs: [...inputs, event.input]
                }
              };
            }
            return node;
          });
        }
      }),
      setNodeOutput: assign({
        nodes: (context, event) => {
          if (event.type !== 'SET_NODE_OUTPUT') return context.nodes;
          return context.nodes.map(node => {
            if (node.id === event.nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  output: event.output
                }
              };
            }
            return node;
          });
        }
      }),
      setExecutionResult: assign({
        executionResults: (context, event) => {
          if (event.type !== 'SET_EXECUTION_RESULT') return context.executionResults;
          return {
            ...context.executionResults,
            [event.result.nodeId]: event.result
          };
        }
      }),
      clearExecutionResults: assign({
        executionResults: () => ({})
      }),
      setApiKey: assign({
        apiKey: (context, event) => {
          if (event.type !== 'SET_API_KEY') return context.apiKey;
          const newKeys = {
            ...context.apiKey,
            [event.provider]: event.key
          };
          saveApiKeys(newKeys);
          return newKeys;
        }
      }),
      loadApiKeys: assign({
        apiKey: () => loadApiKeys()
      }),
      clearResponseCache: () => {
        responseCache.clearCache();
      },
      toggleCacheEnabled: assign({
        cacheStats: (context) => {
          const newEnabled = !context.cacheStats.enabled;
          responseCache.setEnabled(newEnabled);
          return {
            ...context.cacheStats,
            enabled: newEnabled
          };
        }
      }),
      updateCacheStats: assign({
        cacheStats: (context) => ({
          ...context.cacheStats,
          size: responseCache.getCacheSize()
        })
      }),
      setProcessingApiCalls: assign({
        processingApiCalls: (context, event) => {
          if (event.type !== 'SET_PROCESSING_API_CALLS') return context.processingApiCalls;
          return event.processingCalls;
        }
      }),
      saveAgentToLibrary: (context, event) => {
        if (event.type !== 'SAVE_AGENT_TO_LIBRARY') return;
        const node = event.node;
        if (!node.data.agentId) {
          throw new Error('Node is not an agent');
        }
  
        const agent = context.agents.find(a => a.id === node.data.agentId);
        if (!agent) {
          throw new Error('Agent not found');
        }
  
        // Instead of using context directly, this would typically dispatch another ADD_AGENT event
        // But for simplicity, we're showing the functional part
      },
      saveCanvasState: (context) => {
        const state = {
          nodes: context.nodes,
          edges: context.edges,
          agents: context.agents
        };
        
        saveCanvasStateToLocalStorage(state);
      },
      exportCanvasToFile: (context) => {
        const state = {
          nodes: context.nodes,
          edges: context.edges,
          agents: context.agents
        };
        
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        saveAs(blob, 'canvas-state.json');
      },
      loadCanvasState: assign((context) => {
        const storedState = loadCanvasStateFromLocalStorage();
        if (storedState) {
          return {
            ...context,
            nodes: storedState.nodes || [],
            edges: storedState.edges || [],
            agents: storedState.agents || []
          };
        }
        return context;
      })
    }
  }
); 