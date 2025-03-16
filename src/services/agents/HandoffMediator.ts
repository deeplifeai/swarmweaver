import { Agent, AgentMessage, AgentRegistry, AgentRole } from '@/types/agents/Agent';
import { WorkflowState, WorkflowStateManager } from '@/services/state/WorkflowStateManager';
import { eventBus, EventType } from '@/services/eventBus';

// Debug flag for detailed handoff logging
const DEBUG_HANDOVER = process.env.DEBUG_HANDOVER === 'true';

export class HandoffMediator {
  private agentsByRole: Record<AgentRole, Agent[]> = {
    DEVELOPER: [],
    CODE_REVIEWER: [],
    PROJECT_MANAGER: [],
    QA_TESTER: [],
    TECHNICAL_WRITER: [],
    TEAM_LEADER: []
  };

  constructor(
    private agents: AgentRegistry,
    private stateManager: WorkflowStateManager
  ) {
    this.initializeAgentsByRole();
  }

  // Initialize agents by role for quick lookup
  private initializeAgentsByRole(): void {
    Object.values(this.agents).forEach(agent => {
      if (this.agentsByRole[agent.role]) {
        this.agentsByRole[agent.role].push(agent);
      }
    });
  }

  // Determine the next agent based on workflow state and message content
  async determineNextAgent(
    channelId: string,
    threadTs: string | null,
    message: AgentMessage
  ): Promise<Agent | null> {
    // First, check for explicit mentions (highest priority)
    const explicitAgent = this.findAgentByMention(message);
    if (explicitAgent) {
      if (DEBUG_HANDOVER) {
        console.log(`[HANDOFF] Explicit mention found for: ${explicitAgent.name}`);
      }
      return explicitAgent;
    }

    // If no explicit mention, use state-based routing
    const currentState = await this.stateManager.getState(channelId, threadTs);
    if (currentState) {
      const stateBasedAgent = await this.getAgentForState(currentState);
      if (stateBasedAgent) {
        if (DEBUG_HANDOVER) {
          console.log(`[HANDOFF] State-based routing to: ${stateBasedAgent.name} for state: ${currentState.stage}`);
        }
        return stateBasedAgent;
      }
    }

    // If no state-based routing, try keyword detection
    const keywordAgent = this.findAgentByKeyword(message.content);
    if (keywordAgent) {
      if (DEBUG_HANDOVER) {
        console.log(`[HANDOFF] Keyword-based routing to: ${keywordAgent.name}`);
      }
      return keywordAgent;
    }

    // No appropriate agent found
    return null;
  }

  // Find agent by explicit mentions in message
  private findAgentByMention(message: AgentMessage): Agent | null {
    // Check explicit mentions array
    if (message.mentions && message.mentions.length > 0) {
      for (const mentionId of message.mentions) {
        const agent = this.agents[mentionId];
        if (agent) {
          return agent;
        }
      }
    }

    // Check for @ mentions in content
    const mentionRegex = /@([A-Za-z]+)/g;
    const mentions = Array.from(message.content.matchAll(mentionRegex), m => m[1]);

    if (mentions.length > 0) {
      for (const mention of mentions) {
        const mentionLower = mention.toLowerCase();
        
        // Find agent by name (case insensitive)
        const matchedAgent = Object.values(this.agents).find(
          agent => agent.name.toLowerCase() === mentionLower
        );
        
        if (matchedAgent) {
          return matchedAgent;
        }
      }
    }

    return null;
  }

  // Find agent by role-specific keywords in message
  private findAgentByKeyword(content: string): Agent | null {
    const contentLower = content.toLowerCase();
    
    // Role keyword mapping
    const roleKeywords: Record<AgentRole, string[]> = {
      DEVELOPER: ['developer', 'develop', 'code', 'implement', 'bug', 'fix'],
      CODE_REVIEWER: ['review', 'pr', 'pull request', 'approve', 'request changes'],
      PROJECT_MANAGER: ['plan', 'issue', 'manage', 'schedule', 'track'],
      QA_TESTER: ['test', 'quality', 'qa', 'verify', 'validation'],
      TECHNICAL_WRITER: ['document', 'doc', 'documentation', 'write', 'explain'],
      TEAM_LEADER: []
    };

    // Check each role's keywords
    for (const [role, keywords] of Object.entries(roleKeywords)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          // Find an agent with this role
          const agentsForRole = this.agentsByRole[role as AgentRole];
          if (agentsForRole && agentsForRole.length > 0) {
            return agentsForRole[0]; // Return the first agent with this role
          }
        }
      }
    }

    return null;
  }

  // Get appropriate agent based on current workflow state
  private async getAgentForState(state: WorkflowState): Promise<Agent | null> {
    // State to role mapping
    const stateToRole: Record<WorkflowState['stage'], AgentRole | ((state: WorkflowState) => AgentRole)> = {
      'issue_created': AgentRole.DEVELOPER,
      'branch_created': AgentRole.DEVELOPER,
      'code_committed': AgentRole.DEVELOPER,
      'pr_created': AgentRole.CODE_REVIEWER,
      'pr_reviewed': (state) => {
        // Type narrowing to safely access the 'approved' property
        if (state.stage === 'pr_reviewed' && state.approved) {
          return AgentRole.DEVELOPER;
        }
        return AgentRole.PROJECT_MANAGER;
      },
      'pr_merged': AgentRole.PROJECT_MANAGER
    };

    const targetRoleOrFn = stateToRole[state.stage];
    const targetRole = typeof targetRoleOrFn === 'function' ? targetRoleOrFn(state) : targetRoleOrFn;
    const agentsForRole = this.agentsByRole[targetRole];
    
    if (agentsForRole && agentsForRole.length > 0) {
      return agentsForRole[0]; // Return the first agent with this role
    }
    
    return null;
  }

  // Record a handoff event
  async recordHandoff(
    fromAgentId: string,
    toAgentId: string,
    channelId: string,
    threadTs: string | null,
    reason: string
  ): Promise<void> {
    const fromAgent = this.agents[fromAgentId];
    const toAgent = this.agents[toAgentId];
    
    if (fromAgent && toAgent) {
      if (DEBUG_HANDOVER) {
        console.log(`[HANDOFF] From ${fromAgent.name} to ${toAgent.name}: ${reason}`);
      }
      
      // Emit handoff event
      eventBus.emit(EventType.AGENT_HANDOFF, {
        from: fromAgent.id,
        fromRole: fromAgent.role,
        to: toAgent.id,
        toRole: toAgent.role,
        channel: channelId,
        threadTs: threadTs || undefined,
        reason
      });
    }
  }
} 