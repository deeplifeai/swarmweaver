import { eventBus, EventType } from '@/services/eventBus';

interface ActionRecord {
  action: string;
  timestamp: number;
}

interface ConversationStatus {
  actions: ActionRecord[];
  lastSuccessTime: number;
}

/**
 * LoopDetector class monitors agent actions to detect and prevent infinite loops
 * with improved robustness for handling successful completions and cleanup
 */
export class LoopDetector {
  private conversationStatuses: Map<string, ConversationStatus> = new Map();
  private readonly MAX_SIMILAR_ACTIONS: number = 3;
  private readonly TIME_WINDOW_MS: number = 5 * 60 * 1000; // 5 minutes
  private readonly CLEANUP_INTERVAL_MS: number = 60 * 60 * 1000; // 1 hour
  private readonly SUCCESS_RESET_WINDOW_MS: number = 10 * 60 * 1000; // 10 minutes
  
  constructor() {
    // Set up periodic cleanup to prevent memory leaks
    this.setupCleanupInterval();
  }
  
  /**
   * Set up periodic cleanup of old conversation data
   */
  private setupCleanupInterval(): void {
    setInterval(() => {
      this.pruneOldConversations();
    }, this.CLEANUP_INTERVAL_MS);
  }
  
  /**
   * Remove old conversations that haven't been active
   */
  pruneOldConversations(): void {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [conversationId, status] of this.conversationStatuses.entries()) {
      // If no activity for twice the window time, remove the conversation
      const mostRecentAction = status.actions.reduce(
        (latest, action) => Math.max(latest, action.timestamp),
        0
      );
      
      if (now - mostRecentAction > this.TIME_WINDOW_MS * 2) {
        this.conversationStatuses.delete(conversationId);
        prunedCount++;
      }
    }
    
    if (prunedCount > 0) {
      console.log(`[LOOP-DETECTOR] Pruned ${prunedCount} inactive conversations`);
    }
  }
  
  /**
   * Record an agent action and check if it's forming a potential loop
   * @param conversationId Unique identifier for the conversation
   * @param action Description of the action being performed
   * @returns Boolean indicating if a potential loop was detected
   */
  recordAction(conversationId: string, action: string): boolean {
    if (!this.conversationStatuses.has(conversationId)) {
      this.conversationStatuses.set(conversationId, {
        actions: [],
        lastSuccessTime: 0
      });
    }
    
    const status = this.conversationStatuses.get(conversationId)!;
    const now = Date.now();
    
    // Auto-reset if it's been a while since the last loop was detected
    // This handles the case where a previous loop was detected but then
    // resolved naturally after some time
    if (now - status.lastSuccessTime > this.SUCCESS_RESET_WINDOW_MS) {
      // Only auto-reset if there were previously recorded actions
      if (status.actions.length > 0) {
        this.markWorkflowSuccess(conversationId);
        console.log(`[LOOP-DETECTOR] Auto-reset for conversation ${conversationId} after idle period`);
      }
    }
    
    // Remove old actions outside time window
    status.actions = status.actions.filter(h => now - h.timestamp < this.TIME_WINDOW_MS);
    
    // Count similar actions within the time window
    const similarActions = status.actions.filter(h => h.action === action).length;
    
    // Record this action
    status.actions.push({ action, timestamp: now });
    
    // Check if we're in a potential loop
    const loopDetected = similarActions >= this.MAX_SIMILAR_ACTIONS;
    
    if (loopDetected) {
      this.reportLoop(conversationId, action, similarActions);
    }
    
    return loopDetected;
  }
  
  /**
   * Mark a workflow step as successfully completed
   * This helps distinguish between repeated attempts vs normal workflow execution
   * @param conversationId Unique identifier for the conversation
   * @param action Optional specific action to mark as successful
   */
  markWorkflowSuccess(conversationId: string, action?: string): void {
    if (!this.conversationStatuses.has(conversationId)) {
      return;
    }
    
    const status = this.conversationStatuses.get(conversationId)!;
    status.lastSuccessTime = Date.now();
    
    // If specific action provided, remove only those actions
    if (action) {
      status.actions = status.actions.filter(a => a.action !== action);
      console.log(`[LOOP-DETECTOR] Cleared action history for "${action}" in conversation ${conversationId}`);
    } else {
      // Otherwise clear all actions
      status.actions = [];
      console.log(`[LOOP-DETECTOR] Cleared all action history for conversation ${conversationId}`);
    }
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
    this.conversationStatuses.delete(conversationId);
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
  
  /**
   * Get detailed status information for a conversation
   * @param conversationId Unique identifier for the conversation
   */
  getConversationStatus(conversationId: string): ConversationStatus | null {
    return this.conversationStatuses.get(conversationId) || null;
  }
} 