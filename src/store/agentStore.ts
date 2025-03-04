import { create } from 'zustand';
import { Agent, AgentNode, AgentEdge, AgentExecutionResult, AIProvider, AIModel } from '@/types/agent';

interface AgentState {
  agents: Agent[];
  nodes: AgentNode[];
  edges: AgentEdge[];
  executionResults: Record<string, AgentExecutionResult>;
  apiKey: {
    openai: string;
    perplexity: string;
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
  
  // Canvas inputs/outputs
  addNodeInput: (nodeId: string, input: string) => void;
  setNodeOutput: (nodeId: string, output: string) => void;
  
  // Execution
  setExecutionResult: (result: AgentExecutionResult) => void;
  clearExecutionResults: () => void;
  
  // API Keys
  setApiKey: (provider: AIProvider, key: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  nodes: [],
  edges: [],
  executionResults: {},
  apiKey: {
    openai: '',
    perplexity: '',
  },
  
  addAgent: (agent) => set((state) => ({
    agents: [...state.agents, { ...agent, id: generateId() }]
  })),
  
  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map((agent) => 
      agent.id === id ? { ...agent, ...updates } : agent
    )
  })),
  
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
  
  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((node) => node.id !== id),
    edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id)
  })),
  
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
        ? { ...node, data: { ...node.data, inputs: [...node.data.inputs, input] } } 
        : node
    )
  })),
  
  setNodeOutput: (nodeId, output) => set((state) => ({
    nodes: state.nodes.map((node) => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, outputs: [...node.data.outputs, output] } } 
        : node
    )
  })),
  
  setExecutionResult: (result) => set((state) => ({
    executionResults: { ...state.executionResults, [result.nodeId]: result }
  })),
  
  clearExecutionResults: () => set({ executionResults: {} }),
  
  setApiKey: (provider, key) => set((state) => ({
    apiKey: { ...state.apiKey, [provider]: key }
  })),
  
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
      color: agent.color
    };

    get().addAgent(newAgent);
  },

  saveCanvasState: () => {
    const state = {
      nodes: get().nodes,
      edges: get().edges,
      agents: get().agents
    };
    
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    saveAs(blob, 'canvas-state.json');
  },
}));
