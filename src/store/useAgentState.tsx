import { useSelector } from '@xstate/react';
import { interpret } from 'xstate';
import { agentMachine } from './agentStateMachine';
import React, { createContext, useContext } from 'react';
import { InterpreterFrom } from 'xstate';
import { toast } from 'sonner';

// Create a context for the XState service
type AgentService = InterpreterFrom<typeof agentMachine>;
const AgentServiceContext = createContext<AgentService | null>(null);

// Create a provider component
export const AgentServiceProvider = ({ children }: { children: React.ReactNode }) => {
  const [service] = React.useState(() => 
    interpret(agentMachine).start()
  );
  
  return (
    <AgentServiceContext.Provider value={service}>
      {children}
    </AgentServiceContext.Provider>
  );
};

// Hook to access the agent service
export const useAgentService = () => {
  const service = useContext(AgentServiceContext);
  if (!service) {
    throw new Error('useAgentService must be used within an AgentServiceProvider');
  }
  return service;
};

// Hook to use the agent state
export const useAgentState = () => {
  const service = useAgentService();
  
  // Return an object with all the state values and functions to send events
  return {
    // State values
    agents: useSelector(service, state => state.context.agents),
    nodes: useSelector(service, state => state.context.nodes),
    edges: useSelector(service, state => state.context.edges),
    executionResults: useSelector(service, state => state.context.executionResults),
    apiKey: useSelector(service, state => state.context.apiKey),
    cacheStats: useSelector(service, state => state.context.cacheStats),
    processingApiCalls: useSelector(service, state => state.context.processingApiCalls),
    
    // Action functions
    addAgent: (agent: any) => {
      service.send({ type: 'ADD_AGENT', agent });
      toast.success(`Agent "${agent.name}" created`);
    },
    updateAgent: (id: string, updates: any) => {
      service.send({ type: 'UPDATE_AGENT', id, updates });
    },
    removeAgent: (id: string) => {
      service.send({ type: 'REMOVE_AGENT', id });
      toast.success('Agent removed');
    },
    addNode: (node: any) => {
      service.send({ type: 'ADD_NODE', node });
    },
    updateNode: (id: string, updates: any) => {
      service.send({ type: 'UPDATE_NODE', id, updates });
    },
    removeNode: (id: string) => {
      service.send({ type: 'REMOVE_NODE', id });
    },
    addEdge: (edge: any) => {
      service.send({ type: 'ADD_EDGE', edge });
    },
    removeEdge: (id: string) => {
      service.send({ type: 'REMOVE_EDGE', id });
    },
    clearCanvas: () => {
      service.send({ type: 'CLEAR_CANVAS' });
      toast.success('Canvas cleared');
    },
    clearAgents: () => {
      service.send({ type: 'CLEAR_AGENTS' });
      toast.success('Agents cleared (except library agents)');
    },
    addNodeInput: (nodeId: string, input: string) => {
      service.send({ type: 'ADD_NODE_INPUT', nodeId, input });
    },
    setNodeOutput: (nodeId: string, output: string) => {
      service.send({ type: 'SET_NODE_OUTPUT', nodeId, output });
    },
    setExecutionResult: (result: any) => {
      service.send({ type: 'SET_EXECUTION_RESULT', result });
    },
    clearExecutionResults: () => {
      service.send({ type: 'CLEAR_EXECUTION_RESULTS' });
    },
    setApiKey: (provider: any, key: string) => {
      service.send({ type: 'SET_API_KEY', provider, key });
      toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} API key updated`);
    },
    loadApiKeys: () => {
      service.send({ type: 'LOAD_API_KEYS' });
      return useSelector(service, state => state.context.apiKey);
    },
    clearResponseCache: () => {
      service.send({ type: 'CLEAR_RESPONSE_CACHE' });
      toast.success('Response cache cleared');
    },
    toggleCacheEnabled: () => {
      service.send({ type: 'TOGGLE_CACHE_ENABLED' });
      const enabled = useSelector(service, state => state.context.cacheStats.enabled);
      toast.success(`Cache ${enabled ? 'enabled' : 'disabled'}`);
    },
    updateCacheStats: () => {
      service.send({ type: 'UPDATE_CACHE_STATS' });
    },
    setProcessingApiCalls: (processingCalls: Record<string, Promise<string>>) => {
      service.send({ type: 'SET_PROCESSING_API_CALLS', processingCalls });
    },
    saveAgentToLibrary: (node: any) => {
      service.send({ type: 'SAVE_AGENT_TO_LIBRARY', node });
      toast.success('Agent saved to library');
    },
    saveCanvasState: () => {
      service.send({ type: 'SAVE_CANVAS_STATE' });
      toast.success('Canvas state saved to browser storage');
    },
    exportCanvasToFile: () => {
      service.send({ type: 'EXPORT_CANVAS_TO_FILE' });
    },
    loadCanvasState: () => {
      service.send({ type: 'LOAD_CANVAS_STATE' });
      const result = !!useSelector(service, state => state.context.nodes.length);
      if (result) {
        toast.success('Canvas state loaded from browser storage');
      }
      return result;
    }
  };
}; 