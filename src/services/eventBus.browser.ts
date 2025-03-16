import { AgentRole } from '@/types/agents/Agent';

// Browser-compatible event emitter
class BrowserEventEmitter {
  private handlers: Record<string, Function[]> = {};

  on(event: string, handler: Function): void {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }
    this.handlers[event].push(handler);
  }

  emit(event: string, data?: any): void {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  }
}

export enum EventType {
  AGENT_HANDOFF = 'agent_handoff',
  WORKFLOW_TRANSITION = 'workflow_transition',
  ERROR = 'error',
  AGENT_RESPONSE = 'agent_response',
  AGENT_REQUEST = 'agent_request'
}

export interface WorkflowTransitionEvent {
  channel: string;
  threadTs?: string;
  fromStage: string;
  toStage: string;
  issueNumber?: number;
  prNumber?: number;
  branchName?: string;
}

export interface AgentHandoffEvent {
  from: string;
  fromRole: AgentRole;
  to: string;
  toRole: AgentRole;
  channel: string;
  threadTs?: string;
  reason: string;
}

// Create a singleton event bus
export const eventBus = new BrowserEventEmitter(); 