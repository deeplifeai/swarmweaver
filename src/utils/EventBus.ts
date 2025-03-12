import { EventEmitter } from 'events';
import { AgentMessage } from '@/types/agents/Agent';

/**
 * Event types used in the application
 */
export enum EventType {
  AGENT_MESSAGE = 'agent_message',
  SLACK_MESSAGE = 'slack_message',
  ERROR = 'error'
}

/**
 * EventBus for communication between services
 * Uses Node.js EventEmitter for pub/sub pattern
 */
class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to avoid warning
    this.emitter.setMaxListeners(20);
  }

  /**
   * Subscribe to an event
   * @param event Event type to subscribe to
   * @param listener Callback function to execute when event is emitted
   */
  on(event: EventType, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener); // Return unsubscribe function
  }

  /**
   * Emit an event
   * @param event Event type to emit
   * @param args Arguments to pass to listeners
   */
  emit(event: EventType, ...args: any[]) {
    this.emitter.emit(event, ...args);
  }

  /**
   * Subscribe to an event once
   * @param event Event type to subscribe to
   * @param listener Callback function to execute when event is emitted
   */
  once(event: EventType, listener: (...args: any[]) => void) {
    this.emitter.once(event, listener);
  }

  /**
   * Unsubscribe from an event
   * @param event Event type to unsubscribe from
   * @param listener Callback function to remove
   */
  off(event: EventType, listener: (...args: any[]) => void) {
    this.emitter.off(event, listener);
  }

  /**
   * Helper method to emit an agent message event
   * @param message The agent message to emit
   */
  emitAgentMessage(message: AgentMessage) {
    this.emit(EventType.AGENT_MESSAGE, message);
  }
}

// Export a singleton instance
export const eventBus = new EventBus(); 