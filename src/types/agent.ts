export type AIModel = 
  // OpenAI models
  | 'gpt-4.5-preview' 
  | 'gpt-4o' 
  | 'o1-mini' 
  | 'o3-mini' 
  // Perplexity models
  | 'sonar-deep-research'
  | 'sonar-reasoning-pro'
  | 'sonar-reasoning'
  | 'sonar-pro'
  | 'sonar';

export type AIProvider = 'openai' | 'perplexity';

export interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  provider: AIProvider;
  model: AIModel;
  color: string;
  savedToLibrary?: boolean;
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
