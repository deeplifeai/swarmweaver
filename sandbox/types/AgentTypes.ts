/**
 * Types for Agent-related entities in the sandbox environment
 */

export interface AgentMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
  name?: string;
  function_calls?: AgentFunctionCall[];
}

export interface AgentFunctionCall {
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface Agent {
  name: string;
  description: string;
  systemPrompt: string;
  functions?: AgentFunction[];
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface AgentResponse {
  content: string;
  function_calls?: AgentFunctionCall[];
} 