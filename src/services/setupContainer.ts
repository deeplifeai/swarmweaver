import { container } from 'tsyringe';
import { MemoryStateStorage } from './state/WorkflowStateManager';
import { WorkflowStateManager } from './state/WorkflowStateManager';
import { LoopDetector } from './agents/LoopDetector';
import { FunctionRegistry } from './ai/FunctionRegistry';
import { SlackService } from './slack/SlackService';
import { AIService } from './ai/AIService';
import { AgentOrchestrator } from './ai/AgentOrchestrator';
import { ILoggingService } from './logging/LoggingServiceFactory';
import { LoggingService } from './logging/LoggingService';
import { ErrorHandler } from './error/ErrorHandler';
import { HandoffMediator } from './agents/HandoffMediator';
import { ConversationManager } from './ConversationManager';

/**
 * Sets up the dependency injection container with all required services
 */
export function setupContainer() {
  // Register singleton services
  container.registerSingleton('ErrorHandler', ErrorHandler);
  container.registerSingleton('LoggingService', LoggingService);
  container.registerSingleton('LoopDetector', LoopDetector);
  container.registerSingleton('FunctionRegistry', FunctionRegistry);
  container.registerSingleton('StateStorage', MemoryStateStorage);
  container.registerSingleton('WorkflowStateManager', WorkflowStateManager);
  container.registerSingleton('ConversationManager', ConversationManager);

  // Register services with configuration
  container.register('SlackService', {
    useFactory: () => new SlackService(
      container.resolve<ILoggingService>('LoggingService'),
      container.resolve<AgentOrchestrator>('AgentOrchestrator')
    )
  });

  container.register('AIService', {
    useFactory: (dependencyContainer) => {
      const conversationManager = dependencyContainer.resolve<ConversationManager>('ConversationManager');
      const loopDetector = dependencyContainer.resolve<LoopDetector>('LoopDetector');
      const functionRegistry = dependencyContainer.resolve<FunctionRegistry>('FunctionRegistry');
      return new AIService(conversationManager, loopDetector, functionRegistry);
    }
  });

  // Register handoff mediator with dependencies
  container.register('HandoffMediator', {
    useFactory: (dependencyContainer) => {
      const stateManager = dependencyContainer.resolve<WorkflowStateManager>('WorkflowStateManager');
      return new HandoffMediator({}, stateManager);
    }
  });

  // Register agent orchestrator with dependencies
  container.register('AgentOrchestrator', {
    useFactory: (dependencyContainer) => {
      const slackService = dependencyContainer.resolve<SlackService>('SlackService');
      const aiService = dependencyContainer.resolve<AIService>('AIService');
      const handoffMediator = dependencyContainer.resolve<HandoffMediator>('HandoffMediator');
      const stateManager = dependencyContainer.resolve<WorkflowStateManager>('WorkflowStateManager');
      const loopDetector = dependencyContainer.resolve<LoopDetector>('LoopDetector');
      const functionRegistry = dependencyContainer.resolve<FunctionRegistry>('FunctionRegistry');
      
      return new AgentOrchestrator(
        slackService,
        aiService,
        handoffMediator,
        stateManager,
        loopDetector,
        functionRegistry
      );
    }
  });

  // Update handoff mediator with agent registry after orchestrator is created
  container.register('UpdateHandoffMediator', {
    useFactory: (dependencyContainer) => {
      const handoffMediator = dependencyContainer.resolve<HandoffMediator>('HandoffMediator');
      const orchestrator = dependencyContainer.resolve<AgentOrchestrator>('AgentOrchestrator');
      
      // Update the handoff mediator with the agent registry
      orchestrator.setHandoffMediator(handoffMediator);
      
      return true;
    }
  });

  // Initialize the container
  container.resolve('UpdateHandoffMediator');
}

/**
 * Get a properly initialized container
 */
export const getContainer = () => {
  // If we need to check if the container is already set up
  // we could add a check here before calling setupContainer
  return setupContainer();
}; 