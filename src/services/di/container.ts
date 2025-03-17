import 'reflect-metadata';
import { container } from 'tsyringe';
import { AIService } from '../ai/AIService';
import { SlackService } from '../slack/SlackService';
import { HandoffMediator } from '../agents/HandoffMediator';
import { WorkflowStateManager } from '../state/WorkflowStateManager';
import { MemoryStateStorage } from '../state/WorkflowStateManager';
import { LoopDetector } from '../agents/LoopDetector';
import { FunctionRegistry } from '../ai/FunctionRegistry';
import { AgentOrchestrator } from '../ai/AgentOrchestrator';
import { LoggingService } from '../logging/LoggingService';
import { CacheFactory } from '../cache/CacheFactory';
import { ErrorHandler } from '../error/ErrorHandler';
import { LoggingServiceFactory } from '../logging/LoggingServiceFactory';
import { ILoggingService } from '../logging/LoggingServiceFactory';
import { ConversationManager } from '../ConversationManager';

// Register singleton services
container.registerSingleton('ErrorHandler', ErrorHandler);
container.registerSingleton('LoggingService', LoggingService);
container.registerSingleton('LoopDetector', LoopDetector);
container.registerSingleton('FunctionRegistry', FunctionRegistry);

// Register state storage
container.registerSingleton('StateStorage', MemoryStateStorage);

// Register state manager with dependency
container.registerSingleton('WorkflowStateManager', WorkflowStateManager);

// Register services with configuration
container.register('SlackService', {
  useFactory: () => new SlackService(
    container.resolve<ILoggingService>('LoggingService'),
    container.resolve<AgentOrchestrator>('AgentOrchestrator')
  )
});

// Register AIService with dependencies
container.register('AIService', {
  useFactory: (dependencyContainer) => {
    const conversationManager = dependencyContainer.resolve<ConversationManager>('ConversationManager');
    const loopDetector = dependencyContainer.resolve<LoopDetector>('LoopDetector');
    const functionRegistry = dependencyContainer.resolve<FunctionRegistry>('FunctionRegistry');
    return new AIService(conversationManager, loopDetector, functionRegistry);
  }
});

// Register cache service
container.register('CacheService', {
  useFactory: () => CacheFactory.getInstance()
});

// Register handoff mediator with dependencies
container.register('HandoffMediator', {
  useFactory: (dependencyContainer) => {
    const stateManager = dependencyContainer.resolve<WorkflowStateManager>('WorkflowStateManager');
    // Initially create with empty agent registry
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

// Register services
container.register('ICacheService', { useValue: CacheFactory.getInstance() });
container.register('ILoggingService', { useValue: LoggingServiceFactory.getInstance() });
container.register('ErrorHandler', { useValue: new ErrorHandler() });

// Initialize the container
export function initializeContainer(): void {
  // Resolve the update function to complete the initialization
  container.resolve('UpdateHandoffMediator');
}

export { container }; 