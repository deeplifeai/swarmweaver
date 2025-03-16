import { Agent, AgentRole } from '@/types/agents/Agent';
import { agents, codeReviewerAgent } from './AgentDefinitions';
import { GitHubService } from '@/services/github/GitHubService';

// Use the sendMessage function from the SlackService mock
const { sendMessage, mentionUser } = require('../services/slack/SlackService');

// Track workflow state per channel/thread
interface WorkflowState {
  currentStage: 'issue_created' | 'branch_created' | 'code_committed' | 'pr_created' | 'pr_reviewed' | 'pr_merged';
  issueNumber?: number;
  branchName?: string;
  prNumber?: number;
  lastExecutedFunction?: string;
  handoffCompleted?: boolean;
}

// Map to store workflow state by channel/thread
const workflowStateMap = new Map<string, WorkflowState>();

// Get the state key based on channel and thread
const getStateKey = (channelId: string, threadTs: string | null): string => {
  return threadTs ? `${channelId}-${threadTs}` : channelId;
};

// Get workflow state for a channel/thread, create if doesn't exist
const getWorkflowState = (channelId: string, threadTs: string | null): WorkflowState => {
  const key = getStateKey(channelId, threadTs);
  
  if (!workflowStateMap.has(key)) {
    workflowStateMap.set(key, { currentStage: 'issue_created' });
  }
  
  return workflowStateMap.get(key)!;
};

// Update workflow state for a channel/thread
const updateWorkflowState = (
  channelId: string, 
  threadTs: string | null, 
  updates: Partial<WorkflowState>
): WorkflowState => {
  const key = getStateKey(channelId, threadTs);
  const currentState = getWorkflowState(channelId, threadTs);
  const newState = { ...currentState, ...updates };
  
  // Log state transitions for debugging
  console.log(`Workflow state transition: ${currentState.currentStage} -> ${newState.currentStage || currentState.currentStage}`);
  
  workflowStateMap.set(key, newState);
  return newState;
};

// Find agent by ID
const findAgentById = (agentId: string): Agent | undefined => {
  return agents.find(agent => agent.id === agentId);
};

// Reset workflow state (useful for testing)
export const resetWorkflowState = (channelId: string, threadTs: string | null) => {
  const key = getStateKey(channelId, threadTs);
  workflowStateMap.delete(key);
};

// Handle GitHub function responses, including error cases
export const handleGitHubResponse = async (
  response: any, 
  channelId: string, 
  threadTs: string | null,
  agentId: string
) => {
  const agent = findAgentById(agentId);
  
  if (!agent) {
    return;
  }

  // Track the function execution
  const currentState = getWorkflowState(channelId, threadTs);
  currentState.lastExecutedFunction = response.functionName;
  
  // Handle createPullRequest response
  if (response.functionName === 'createPullRequest') {
    // If successful PR creation
    if (response.success) {
      // Update workflow state to indicate PR is created
      const state = updateWorkflowState(channelId, threadTs, { 
        currentStage: 'pr_created', 
        prNumber: response.data.number,
        handoffCompleted: false  // Will be set to true after sending handoff message
      });
      
      // Send handoff message to CodeReviewer
      await sendMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `I've created a pull request: ${response.data.html_url}\n\nNow, ${mentionUser(codeReviewerAgent.id)}, could you please review this PR?`,
        userId: agentId
      });
      
      // Mark handoff as complete to prevent multiple handoffs
      updateWorkflowState(channelId, threadTs, { handoffCompleted: true });
        
      return true; // Indicate successful handoff
    } 
    // If PR already exists
    else if (response.error && response.error.includes('A pull request already exists')) {
      // Extract the branch name from the error message
      const branchNameMatch = response.error.match(/exists for .*:(.*?)[."]/);
      const branchName = branchNameMatch ? branchNameMatch[1] : 'the branch';
      
      // Update workflow state
      const state = updateWorkflowState(channelId, threadTs, { 
        currentStage: 'pr_created',
        handoffCompleted: false
      });
      
      // Send handoff message to CodeReviewer
      await sendMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `I notice a pull request already exists for ${branchName}. ${mentionUser(codeReviewerAgent.id)}, could you please review this existing PR?`,
        userId: agentId
      });
      
      // Mark handoff as complete to prevent multiple handoffs
      updateWorkflowState(channelId, threadTs, { handoffCompleted: true });
        
      return true; // Indicate successful handoff
    }
  }
  
  // Handle createIssue response for tracking issue numbers
  if (response.functionName === 'createIssue' && response.success) {
    updateWorkflowState(channelId, threadTs, {
      currentStage: 'issue_created',
      issueNumber: response.data.issue_number
    });
  }
  
  // Handle createBranch response
  if (response.functionName === 'createBranch' && response.success) {
    updateWorkflowState(channelId, threadTs, {
      currentStage: 'branch_created',
      branchName: response.data.name || response.arguments.name
    });
  }
  
  // Handle createCommit response
  if (response.functionName === 'createCommit' && response.success) {
    updateWorkflowState(channelId, threadTs, {
      currentStage: 'code_committed'
    });
  }
  
  return false; // No handoff occurred by default
};

// Main message handler interface
export interface Message {
  text: string;
  userId: string;
  channelId: string;
  ts: string;
  mentions: string[];
  threadTs: string | null;
}

// Main message handler function
export const handleMessage = async (message: Message) => {
  // Process the message and route to appropriate agent handlers
  const { channelId, threadTs, mentions, userId } = message;
  
  // Get current workflow state for this thread
  const workflowState = getWorkflowState(channelId, threadTs);
  
  // Process message for each mentioned agent
  for (const agentId of mentions) {
    const agent = findAgentById(agentId);
    
    if (!agent) continue;
    
    // If Developer mentioned but PR already created, redirect to CodeReviewer
    if (agent.role === AgentRole.DEVELOPER && workflowState.currentStage === 'pr_created' && !message.text.includes('review')) {
      await sendMessage({
        channel: channelId,
        thread_ts: threadTs,
        text: `I notice that a pull request has already been created for this task. ${mentionUser(codeReviewerAgent.id)}, could you please review the PR?`,
        userId: agentId
      });
      
      // Skip further developer processing
      continue;
    }
    
    // Handle other specific workflow states and transitions as needed
    
    // Return the current workflow state for the Orchestrator to use
    return workflowState;
  }
  
  // Default return if no specific handling occurred
  return workflowState;
}; 