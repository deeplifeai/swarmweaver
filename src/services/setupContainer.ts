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
  
  // Create and register the HandoffMediator (depends on stateManager)
  container.registerFactory('handoffMediator', () => {
    // Getting agents requires the orchestrator to be initialized first,
    // so we use a factory to defer creation until the agents are registered
    const orchestrator = container.resolve<AgentOrchestrator>('agentOrchestrator');
    return new HandoffMediator(orchestrator.getAgentRegistry(), stateManager);
  });
  
  // Create and register the AgentOrchestrator
  // Initially create it with an empty HandoffMediator
  const temporaryHandoffMediator = new HandoffMediator({}, stateManager);
  const agentOrchestrator = new AgentOrchestrator(
    slackService,
    aiService,
    temporaryHandoffMediator,
    stateManager,
    loopDetector,
    functionRegistry
  );
  container.register('agentOrchestrator', agentOrchestrator);
  
  // After orchestrator is registered, we can resolve the real handoffMediator
  const handoffMediator = container.resolve<HandoffMediator>('handoffMediator');
  
  // Update the orchestrator with the real handoffMediator
  agentOrchestrator.setHandoffMediator(handoffMediator);
  
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