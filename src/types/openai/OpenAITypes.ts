export interface OpenAIFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface OpenAIFunctionCall {
  name: string;
  arguments: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: OpenAIFunctionCall;
}

export interface OpenAIToolChoice {
  type: 'function';
  function: {
    name: string;
  };
}

export interface OpenAITool {
  type: 'function';
  function: OpenAIFunctionDefinition;
} 