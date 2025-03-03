
export type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online';

export type AIProvider = 'openai' | 'perplexity';

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  provider: AIProvider;
  model: AIModel;
  color: string;
}

export interface AgentNode {
  id: string;
  type: 'agent' | 'output';
  position: {
    x: number;
    y: number;
  };
  data: {
    agentId?: string;
    label: string;
    inputs: string[];
    outputs: string[];
    color?: string;
  };
}

export interface AgentEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}

export interface AgentExecutionResult {
  nodeId: string;
  output: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}
