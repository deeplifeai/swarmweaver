import { EventEmitter } from 'events';
import { eventBus, EventType, WorkflowTransitionEvent } from '@/services/eventBus';
import { AgentRole } from '@/types/agents/Agent';

// Define the workflow state types using discriminated unions
export type WorkflowState = 
  | { stage: 'issue_created'; issueNumber: number }
  | { stage: 'branch_created'; issueNumber: number; branchName: string }
  | { stage: 'code_committed'; issueNumber: number; branchName: string }
  | { stage: 'pr_created'; issueNumber: number; branchName: string; prNumber: number }
  | { stage: 'pr_reviewed'; issueNumber: number; prNumber: number; approved: boolean }
  | { stage: 'pr_merged'; issueNumber: number; prNumber: number };

// Define a generic state storage interface
export interface StateStorage {
  getState(key: string): Promise<WorkflowState | null>;
  setState(key: string, state: WorkflowState): Promise<void>;
  deleteState(key: string): Promise<void>;
}

// In-memory implementation for development and testing
export class MemoryStateStorage implements StateStorage {
  private storage = new Map<string, WorkflowState>();

  async getState(key: string): Promise<WorkflowState | null> {
    return this.storage.get(key) || null;
  }

  async setState(key: string, state: WorkflowState): Promise<void> {
    this.storage.set(key, state);
  }

  async deleteState(key: string): Promise<void> {
    this.storage.delete(key);
  }
}

// Main state manager class
export class WorkflowStateManager {
  constructor(private storage: StateStorage) {}

  // Get conversation key based on channel and thread
  private getConversationKey(channelId: string, threadTs: string | null): string {
    return threadTs ? `${channelId}-${threadTs}` : channelId;
  }

  // Get the current state for a conversation
  async getState(channelId: string, threadTs: string | null): Promise<WorkflowState | null> {
    const key = this.getConversationKey(channelId, threadTs);
    return this.storage.getState(key);
  }

  // Update the state for a conversation
  async setState(
    channelId: string, 
    threadTs: string | null, 
    state: WorkflowState,
    fromRole?: AgentRole,
    toRole?: AgentRole
  ): Promise<void> {
    const key = this.getConversationKey(channelId, threadTs);
    
    // Get previous state for transition event
    const previousState = await this.getState(channelId, threadTs);
    
    // Save the new state
    await this.storage.setState(key, state);
    
    // Emit a workflow transition event
    eventBus.emit(EventType.WORKFLOW_TRANSITION, {
      from: fromRole || 'unknown',
      to: toRole || 'unknown',
      channel: channelId,
      threadTs: threadTs || undefined,
      issueNumber: 'issueNumber' in state ? state.issueNumber : undefined,
      prNumber: 'prNumber' in state ? state.prNumber : undefined,
      previousStage: previousState?.stage,
      newStage: state.stage
    } as WorkflowTransitionEvent);
  }

  // Reset the state for a conversation
  async resetState(channelId: string, threadTs: string | null): Promise<void> {
    const key = this.getConversationKey(channelId, threadTs);
    await this.storage.deleteState(key);
  }
  
  // Check if the current state allows a transition to the next state
  async canTransition(
    channelId: string, 
    threadTs: string | null, 
    targetStage: WorkflowState['stage']
  ): Promise<boolean> {
    const currentState = await this.getState(channelId, threadTs);
    
    // If no current state, only allow transition to issue_created
    if (!currentState) {
      return targetStage === 'issue_created';
    }
    
    // Define valid transitions
    const validTransitions: Record<WorkflowState['stage'], WorkflowState['stage'][]> = {
      'issue_created': ['branch_created'],
      'branch_created': ['code_committed'],
      'code_committed': ['pr_created'],
      'pr_created': ['pr_reviewed'],
      'pr_reviewed': ['pr_merged', 'code_committed'], // Allow going back to coding if review fails
      'pr_merged': ['issue_created'] // Start a new cycle
    };
    
    return validTransitions[currentState.stage].includes(targetStage);
  }
  
  // Get available next states from current state
  async getAvailableTransitions(
    channelId: string, 
    threadTs: string | null
  ): Promise<WorkflowState['stage'][]> {
    const currentState = await this.getState(channelId, threadTs);
    
    if (!currentState) {
      return ['issue_created'];
    }
    
    const validTransitions: Record<WorkflowState['stage'], WorkflowState['stage'][]> = {
      'issue_created': ['branch_created'],
      'branch_created': ['code_committed'],
      'code_committed': ['pr_created'],
      'pr_created': ['pr_reviewed'],
      'pr_reviewed': ['pr_merged', 'code_committed'],
      'pr_merged': ['issue_created']
    };
    
    return validTransitions[currentState.stage];
  }
} 