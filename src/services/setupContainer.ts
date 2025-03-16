import { container } from './Container';
import { MemoryStateStorage, WorkflowStateManager } from './state/WorkflowStateManager';
import { HandoffMediator } from './agents/HandoffMediator';
import { LoopDetector } from './agents/LoopDetector';
import { FunctionRegistry } from './ai/FunctionRegistry';
import { estimateTokenCount, chunkText } from '@/utils/tokenManager';
import { SlackService } from './slack/SlackService';
import { AIService } from './ai/AIService';
import { config } from '@/config/config';
import { AgentOrchestrator } from './ai/AgentOrchestrator';
import { Agent, AgentRegistry } from '@/types/agents/Agent';

/**
 * Set up the application container with all services
 */
export const setupContainer = () => {
  // Register infrastructure services
  const stateStorage = new MemoryStateStorage();
  const stateManager = new WorkflowStateManager(stateStorage);
  const loopDetector = new LoopDetector();
  const functionRegistry = new FunctionRegistry();
  
  // Register core services
  const slackService = new SlackService();
  const aiService = new AIService();
  
  // Register function handlers with AIService
  aiService.setFunctionRegistry(functionRegistry);
  
  // Register these services in the container
  container.register('stateStorage', stateStorage);
  container.register('stateManager', stateManager);
  container.register('loopDetector', loopDetector);
  container.register('functionRegistry', functionRegistry);
  container.register('slackService', slackService);
  container.register('aiService', aiService);
  
  // Step 1: Initialize an empty agent registry
  const agents: AgentRegistry = {};
  
  // Step 2: Create orchestrator with placeholder for mediator
  const agentOrchestrator = new AgentOrchestrator(
    slackService,
    aiService,
    {} as HandoffMediator, // empty placeholder
    stateManager,
    loopDetector,
    functionRegistry
  );
  
  // Step 3: Register the orchestrator
  container.register('agentOrchestrator', agentOrchestrator);
  
  // Step 4: Initialize agents and register them with the orchestrator
  // This would be replaced with actual agent initialization logic
  // initializeAgents(agentOrchestrator);
  
  // Step 5: Create the real HandoffMediator with the agent registry from orchestrator
  const handoffMediator = new HandoffMediator(
    agentOrchestrator.getAgentRegistry(),
    stateManager
  );
  
  // Step 6: Update the orchestrator with the real mediator
  agentOrchestrator.setHandoffMediator(handoffMediator);
  
  // Step 7: Register the mediator in the container
  container.register('handoffMediator', handoffMediator);
  
  return container;
};

/**
 * Get a properly initialized container
 */
export const getContainer = () => {
  // If we need to check if the container is already set up
  // we could add a check here before calling setupContainer
  return setupContainer();
}; 