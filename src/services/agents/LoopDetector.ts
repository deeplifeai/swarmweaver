import { eventBus, EventType } from '@/services/eventBus';

interface ActionRecord {
  action: string;
  timestamp: number;
}

/**
 * LoopDetector class monitors agent actions to detect and prevent infinite loops
 */
export class LoopDetector {
  private actionHistory: Map<string, ActionRecord[]> = new Map();
  private readonly MAX_SIMILAR_ACTIONS: number = 3;
  private readonly TIME_WINDOW_MS: number = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Record an agent action and check if it's forming a potential loop
   * @param conversationId Unique identifier for the conversation
   * @param action Description of the action being performed
   * @returns Boolean indicating if a potential loop was detected
   */
  recordAction(conversationId: string, action: string): boolean {
    const key = conversationId;
    
    if (!this.actionHistory.has(key)) {
      this.actionHistory.set(key, []);
    }
    
    const history = this.actionHistory.get(key)!;
    const now = Date.now();
    
    // Remove old actions outside time window
    const recentHistory = history.filter(h => now - h.timestamp < this.TIME_WINDOW_MS);
    
    // Count similar actions within the time window
    const similarActions = recentHistory.filter(h => h.action === action).length;
    
    // Record this action
    recentHistory.push({ action, timestamp: now });
    this.actionHistory.set(key, recentHistory);
    
    // Check if we're in a potential loop
    const loopDetected = similarActions >= this.MAX_SIMILAR_ACTIONS;
    
    if (loopDetected) {
      this.reportLoop(conversationId, action, similarActions);
    }
    
    return loopDetected;
  }
  
  /**
   * Report a detected loop to the event system
   */
  private reportLoop(conversationId: string, action: string, count: number): void {
    console.warn(`[LOOP-DETECTOR] Potential loop detected in conversation ${conversationId}: 
      Action "${action}" was performed ${count} times in the last ${this.TIME_WINDOW_MS / 1000 / 60} minutes.`);
    
    eventBus.emit(EventType.ERROR, {
      source: 'LoopDetector',
      error: new Error(`Potential infinite loop detected: ${action}`),
      message: `Action "${action}" was performed ${count} times in a short period. This may indicate an infinite loop.`
    });
  }
  
  /**
   * Reset the action history for a conversation
   * @param conversationId Unique identifier for the conversation
   */
  resetHistory(conversationId: string): void {
    this.actionHistory.delete(conversationId);
  }
  
  /**
   * Get the time window used for loop detection
   */
  getTimeWindow(): number {
    return this.TIME_WINDOW_MS;
  }
  
  /**
   * Get the maximum allowed similar actions before considering it a loop
   */
  getMaxSimilarActions(): number {
    return this.MAX_SIMILAR_ACTIONS;
  }
} 