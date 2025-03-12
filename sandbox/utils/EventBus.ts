import { EventEmitter } from 'events';

/**
 * EventBus - A simple event bus for communication between components
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    console.log('🚌 EventBus initialized');
  }

  /**
   * Subscribe to an event
   * @param event Event name
   * @param listener Callback function
   */
  subscribe(event: string, listener: (...args: any[]) => void) {
    this.on(event, listener);
    return () => this.unsubscribe(event, listener);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param listener Callback function
   */
  unsubscribe(event: string, listener: (...args: any[]) => void) {
    this.off(event, listener);
  }

  /**
   * Publish an event with data
   * @param event Event name
   * @param data Event data
   */
  publish(event: string, ...data: any[]) {
    this.emit(event, ...data);
  }
}

// Create a singleton instance
const eventBus = new EventBus();

// Export the singleton
export default eventBus;

// Common event names
export const EVENTS = {
  SLACK_MESSAGE: 'slack:message',
  SLACK_REACTION: 'slack:reaction',
  GITHUB_ISSUE_CREATED: 'github:issue:created',
  GITHUB_PR_CREATED: 'github:pr:created',
  GITHUB_PR_REVIEWED: 'github:pr:reviewed',
  AGENT_RESPONSE: 'agent:response',
  FUNCTION_CALLED: 'function:called',
  FUNCTION_RESULT: 'function:result',
}; 