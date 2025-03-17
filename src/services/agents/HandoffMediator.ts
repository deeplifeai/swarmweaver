import { Agent, AgentMessage, AgentRegistry, AgentRole } from '@/types/agents/Agent';
import { WorkflowState, WorkflowStateManager } from '@/services/state/WorkflowStateManager';
import { eventBus, EventType } from '@/services/eventBus';

// Debug flag for detailed handoff logging
const DEBUG_HANDOVER = process.env.DEBUG_HANDOVER === 'true';

// Track agent availability status
interface AgentStatus {
  available: boolean;
  lastAssignedTime: number;
  currentLoad: number;
}

// Load balancing strategies
type LoadBalancingStrategy = 'round-robin' | 'least-recently-used';

export class HandoffMediator {
  private agentsByRole: Record<AgentRole, Agent[]> = {
    DEVELOPER: [],
    CODE_REVIEWER: [],
    PROJECT_MANAGER: [],
    QA_TESTER: [],
    TECHNICAL_WRITER: [],
    TEAM_LEADER: []
  };
  
  // Track status of each agent
  private agentStatus: Map<string, AgentStatus> = new Map();
  
  // Load balancing strategy - currently Round-Robin and Least Recently Used
  private readonly LOAD_BALANCING_STRATEGY: LoadBalancingStrategy = 'least-recently-used';

  constructor(
    private agents: AgentRegistry,
    private stateManager: WorkflowStateManager
  ) {
    this.initializeAgentsByRole();
    this.initializeAgentStatus();
  }

  // Initialize agents by role for quick lookup
  public initializeAgentsByRole(): void {
    Object.values(this.agents).forEach(agent => {
      if (this.agentsByRole[agent.role]) {
        this.agentsByRole[agent.role].push(agent);
      }
    });
  }
  
  // Initialize status tracking for all agents
  private initializeAgentStatus(): void {
    Object.values(this.agents).forEach(agent => {
      this.agentStatus.set(agent.id, {
        available: true,
        lastAssignedTime: 0,
        currentLoad: 0
      });
    });
  }
  
  // Mark an agent as busy when assigned a task
  markAgentBusy(agentId: string): void {
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.lastAssignedTime = Date.now();
      status.currentLoad += 1;
    }
  }
  
  // Mark an agent as available when task is completed
  markAgentAvailable(agentId: string): void {
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.currentLoad = Math.max(0, status.currentLoad - 1);
    }
  }
  
  // Set agent availability status explicitly
  setAgentAvailability(agentId: string, isAvailable: boolean): void {
    const status = this.agentStatus.get(agentId);
    if (status) {
      status.available = isAvailable;
      
      if (DEBUG_HANDOVER) {
        console.log(`[HANDOFF] Agent ${agentId} availability set to ${isAvailable}`);
      }
    }
  }
  
  // Check if an agent is available
  isAgentAvailable(agentId: string): boolean {
    const status = this.agentStatus.get(agentId);
    return status ? (status.available && status.currentLoad < 3) : false;
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
      // Check if mentioned agent is available
      if (this.isAgentAvailable(explicitAgent.id)) {
        if (DEBUG_HANDOVER) {
          console.log(`[HANDOFF] Explicit mention found for: ${explicitAgent.name}`);
        }
        this.markAgentBusy(explicitAgent.id);
        return explicitAgent;
      } else {
        if (DEBUG_HANDOVER) {
          console.log(`[HANDOFF] Mentioned agent ${explicitAgent.name} is busy, looking for alternatives`);
        }
        // If explicitly mentioned agent is busy, try to find another agent with the same role
        const alternateAgent = this.findAvailableAgentByRole(explicitAgent.role);
        if (alternateAgent) {
          if (DEBUG_HANDOVER) {
            console.log(`[HANDOFF] Routing to alternate agent with same role: ${alternateAgent.name}`);
          }
          this.markAgentBusy(alternateAgent.id);
          return alternateAgent;
        }
        
        // If no alternates available, return null
        return null;
      }
    }

    // If no explicit mention, use state-based routing
    const currentState = await this.stateManager.getState(channelId, threadTs);
    if (currentState) {
      const stateBasedAgent = await this.getAgentForState(currentState);
      if (stateBasedAgent && this.isAgentAvailable(stateBasedAgent.id)) {
        if (DEBUG_HANDOVER) {
          console.log(`[HANDOFF] State-based routing to: ${stateBasedAgent.name} for state: ${currentState.stage}`);
        }
        this.markAgentBusy(stateBasedAgent.id);
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
  public findAgentByMention(message: AgentMessage): Agent | null {
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
  public findAgentByKeyword(content: string): Agent | null {
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
          // Find an available agent with this role
          const availableAgent = this.findAvailableAgentByRole(role as AgentRole);
          if (availableAgent) {
            this.markAgentBusy(availableAgent.id);
            return availableAgent;
          }
          
          // If no available agents, continue to next role
          break;
        }
      }
    }

    return null;
  }
  
  // Find an available agent with the specified role using load balancing
  private findAvailableAgentByRole(role: AgentRole): Agent | null {
    const agentsForRole = this.agentsByRole[role];
    if (!agentsForRole || agentsForRole.length === 0) {
      return null;
    }
    
    // Filter to only available agents
    const availableAgents = agentsForRole.filter(
      agent => this.isAgentAvailable(agent.id)
    );
    
    if (availableAgents.length === 0) {
      // If no available agents, return null to let the caller decide what to do
      return null;
    }
    
    if (availableAgents.length === 1) {
      return availableAgents[0];
    }
    
    // Apply load balancing strategy
    if (this.LOAD_BALANCING_STRATEGY === 'least-recently-used') {
      // Sort by last assigned time (oldest first)
      availableAgents.sort((a, b) => {
        const statusA = this.agentStatus.get(a.id);
        const statusB = this.agentStatus.get(b.id);
        
        if (!statusA || !statusB) {
          return 0;
        }
        
        return statusA.lastAssignedTime - statusB.lastAssignedTime;
      });
      
      return availableAgents[0];
    } else {
      // Default to round-robin - just pick the first available agent
      return availableAgents[0];
    }
  }

  // Get appropriate agent for the current workflow state
  public async getAgentForState(state: WorkflowState): Promise<Agent | null> {
    // Map workflow stages to agent roles
    const stageToRole: Record<WorkflowState['stage'], AgentRole> = {
      'issue_created': AgentRole.DEVELOPER,
      'branch_created': AgentRole.DEVELOPER,
      'code_committed': AgentRole.DEVELOPER,
      'pr_created': AgentRole.CODE_REVIEWER,
      'pr_reviewed': AgentRole.DEVELOPER, // If review needs changes
      'pr_merged': AgentRole.PROJECT_MANAGER
    };
    
    const role = stageToRole[state.stage];
    if (!role) {
      return null;
    }
    
    // Find an available agent with this role
    return this.findAvailableAgentByRole(role);
  }
  
  /**
   * Record a handoff from one agent to another
   * @param fromAgentId The agent ID that initiated the handoff
   * @param toAgentId The agent ID that is receiving the handoff
   * @param channelId The Slack channel ID where the handoff occurred
   * @param threadTs The thread timestamp, if in a thread
   * @param reason The reason for the handoff
   */
  public async recordHandoff(
    fromAgentId: string,
    toAgentId: string,
    channelId: string,
    threadTs: string | null,
    reason: string
  ): Promise<void> {
    if (DEBUG_HANDOVER) {
      console.log(`[HANDOFF] ${fromAgentId} -> ${toAgentId} in ${channelId}${threadTs ? ' (thread)' : ''}: ${reason}`);
    }
    
    // Get agents to determine their roles
    const fromAgent = this.agents[fromAgentId];
    const toAgent = this.agents[toAgentId];
    
    // Emit handoff event for logging and monitoring
    eventBus.emit(EventType.AGENT_HANDOFF, {
      from: fromAgentId,
      to: toAgentId,
      fromRole: fromAgent?.role || AgentRole.DEVELOPER,
      toRole: toAgent?.role || AgentRole.DEVELOPER,
      channel: channelId,
      threadTs: threadTs || undefined,
      reason
    });
    
    // Mark the receiving agent as busy
    this.markAgentBusy(toAgentId);
    
    // Could update state if needed based on the handoff
    // await this.stateManager.setState(channelId, threadTs, {...});
  }
  
  // Get agent load statistics for monitoring
  getAgentStats(): Record<string, { available: boolean, load: number, lastAssigned: number }> {
    const stats: Record<string, { available: boolean, load: number, lastAssigned: number }> = {};
    
    for (const [agentId, status] of this.agentStatus.entries()) {
      stats[agentId] = {
        available: status.available,
        load: status.currentLoad,
        lastAssigned: status.lastAssignedTime
      };
    }
    
    return stats;
  }
} 