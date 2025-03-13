import { OpenAIFunctionDefinition } from '../openai/OpenAITypes';

export enum AgentRole {
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  DEVELOPER = 'DEVELOPER',
  CODE_REVIEWER = 'CODE_REVIEWER',
  QA_TESTER = 'QA_TESTER',
  TECHNICAL_WRITER = 'TECHNICAL_WRITER',
  TEAM_LEADER = 'TEAM_LEADER'
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  avatar?: string;
  description: string;
  personality: string;
  systemPrompt: string;
  functions: OpenAIFunctionDefinition[];
  repository?: string;
}

export interface AgentMessage {
  id: string;
  timestamp: string;
  agentId: string;
  content: string;
  channel: string;
  mentions: string[];
  replyToMessageId?: string;
}

export interface AgentFunction {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any, agentId: string) => Promise<any>;
}

export type AgentRegistry = Record<string, Agent>; 