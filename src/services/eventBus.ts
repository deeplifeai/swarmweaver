import { EventEmitter } from 'events';
import { AgentRole } from '@/types/agents/Agent';

// Define event types
export enum EventType {
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_SENT = 'message_sent',
  FUNCTION_CALLED = 'function_called',
  FUNCTION_RESULT = 'function_result',
  AGENT_RESPONSE = 'agent_response',
  AGENT_HANDOFF = 'agent_handoff',
  WORKFLOW_TRANSITION = 'workflow_transition',
  ERROR = 'error'
}

// Define event payload types
export interface WorkflowTransitionEvent {
  from: AgentRole | string;
  to: AgentRole | string;
  channel: string;
  threadTs?: string;
  issueNumber?: number;
  prNumber?: number;
  previousStage?: string;
  newStage: string;
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

export interface FunctionCalledEvent {
  name: string;
  args: any;
  agentId: string;
  channelId: string;
  threadTs?: string;
}

export interface ErrorEvent {
  source: string;
  error: Error | unknown;
  message: string;
}

// Define type mapping for events
export type EventMap = {
  [EventType.MESSAGE_RECEIVED]: any;
  [EventType.MESSAGE_SENT]: any;
  [EventType.FUNCTION_CALLED]: FunctionCalledEvent;
  [EventType.FUNCTION_RESULT]: any;
  [EventType.AGENT_RESPONSE]: any;
  [EventType.AGENT_HANDOFF]: AgentHandoffEvent;
  [EventType.WORKFLOW_TRANSITION]: WorkflowTransitionEvent;
  [EventType.ERROR]: ErrorEvent;
}

// Enhanced EventEmitter with type safety
class TypedEventEmitter {
  private emitter = new EventEmitter();
  
  on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.on(event as string, listener as any);
    return this;
  }
  
  once<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.once(event as string, listener as any);
    return this;
  }
  
  off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): this {
    this.emitter.off(event as string, listener as any);
    return this;
  }
  
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return this.emitter.emit(event as string, payload);
  }
  
  setMaxListeners(n: number): this {
    this.emitter.setMaxListeners(n);
    return this;
  }
}

// Create and export the event bus instance
export const eventBus = new TypedEventEmitter();

// Make event bus more robust by adding error handling
eventBus.on(EventType.ERROR, (error) => {
  console.error('EventBus error:', error);
});

// Increase the maximum number of listeners to avoid warnings
eventBus.setMaxListeners(20); 