# SwarmWeaver Architecture Improvements

This document outlines the architectural improvements made to the SwarmWeaver AI agent orchestration system.

## Core Architecture Improvements

### 1. Workflow State Management

We've replaced the simple Map-based state storage with a proper state machine implementation using TypeScript discriminated unions:

```typescript
// Define the workflow state types using discriminated unions
export type WorkflowState = 
  | { stage: 'issue_created'; issueNumber: number }
  | { stage: 'branch_created'; issueNumber: number; branchName: string }
  | { stage: 'code_committed'; issueNumber: number; branchName: string }
  | { stage: 'pr_created'; issueNumber: number; branchName: string; prNumber: number }
  | { stage: 'pr_reviewed'; issueNumber: number; prNumber: number; approved: boolean }
  | { stage: 'pr_merged'; issueNumber: number; prNumber: number };
```

This approach provides several benefits:
- Type safety with TypeScript's discriminated unions
- Clear definition of what data each state requires
- Ability to add state-specific validation
- Support for multiple storage backends through the `StateStorage` interface

### 2. Centralized Handoff Logic

We've created a dedicated `HandoffMediator` class to centralize agent handoff logic:

```typescript
export class HandoffMediator {
  // ...
  
  async determineNextAgent(
    channelId: string,
    threadTs: string | null,
    message: AgentMessage
  ): Promise<Agent | null> {
    // First, check for explicit mentions (highest priority)
    // Then, use state-based routing
    // Finally, try keyword detection
  }
}
```

Benefits:
- Unified logic for determining the next agent
- Clear prioritization of routing methods
- Separation of concerns - handoff logic is separate from the orchestrator
- Easy to add new routing strategies

### 3. Infinite Loop Prevention

Added a dedicated `LoopDetector` class to prevent infinite loops:

```typescript
export class LoopDetector {
  private actionHistory: Map<string, ActionRecord[]> = new Map();
  private readonly MAX_SIMILAR_ACTIONS: number = 3;
  private readonly TIME_WINDOW_MS: number = 5 * 60 * 1000; // 5 minutes
  
  recordAction(conversationId: string, action: string): boolean {
    // Records actions and detects potential loops
  }
}
```

This helps prevent common issues with AI agents such as:
- Agents repeatedly performing the same actions
- Back-and-forth handoffs between agents with no progress
- Resource exhaustion from infinite loops

### 4. Enhanced Event System

Improved the event system with proper TypeScript typing:

```typescript
export type EventMap = {
  [EventType.MESSAGE_RECEIVED]: any;
  [EventType.MESSAGE_SENT]: any;
  [EventType.FUNCTION_CALLED]: FunctionCalledEvent;
  [EventType.FUNCTION_RESULT]: any;
  [EventType.AGENT_RESPONSE]: any;
  [EventType.AGENT_HANDOFF]: AgentHandoffEvent;
  [EventType.WORKFLOW_TRANSITION]: WorkflowTransitionEvent;
  [EventType.ERROR]: ErrorEvent;
}

// Enhanced EventEmitter with type safety
class TypedEventEmitter {
  // Type-safe event methods
}
```

Benefits:
- Type safety for events
- Easier debugging with well-defined event types
- Better developer experience with IDE autocompletion

### 5. Function Call Management

Implemented a robust `FunctionRegistry` for function call handling:

```typescript
export class FunctionRegistry {
  private functions: Map<string, AgentFunction> = new Map();
  
  register(func: AgentFunction): void { /* ... */ }
  registerAll(funcs: AgentFunction[]): void { /* ... */ }
  async execute(name: string, args: any, agentId: string): Promise<FunctionResult> { /* ... */ }
}
```

Key features:
- Centralized function registration
- Argument validation with JSON Schema
- Error handling and timeout management
- Event emission for tracking function calls

### 6. Token Optimization

Enhanced token management with caching and advanced text chunking:

```typescript
export class TokenManager {
  private shortenedPromptCache: Map<string, CachedPrompt> = new Map();
  
  async getOptimizedPrompt(systemPrompt: string, targetLength: number): Promise<string> { /* ... */ }
  chunkWithOverlap(text: string, maxTokens: number, overlapTokens: number = 100): string[] { /* ... */ }
}
```

Benefits:
- Reduced API costs by caching shortened prompts
- Better context preservation with overlapping chunks
- More efficient token usage

### 7. Dependency Injection

Implemented a proper dependency injection container:

```typescript
export class Container {
  private services: Map<string, any> = new Map();
  private factories: Map<string, () => any> = new Map();
  
  register<T>(name: string, instance: T): void { /* ... */ }
  registerFactory<T>(name: string, factory: () => T): void { /* ... */ }
  resolve<T>(name: string): T { /* ... */ }
}
```

This enables:
- Loose coupling between components
- Easier testing with mock services
- Better organization of service instantiation
- Explicit dependencies rather than implicit coupling

### 8. LangChain Integration

Added support for LangChain integration for more robust agent orchestration:

```typescript
export const createLangChainAgent = (
  agent: Agent,
  functionRegistry: FunctionRegistry,
  openAIApiKey: string
) => {
  // Creates a LangChain agent with tools derived from our function registry
}
```

Benefits:
- Leverage LangChain's agent frameworks
- Access to additional tools and capabilities
- More robust function calling mechanisms

## Applying These Improvements

To use these improvements:

1. Initialize the Container:
```typescript
const container = setupContainer();
```

2. Access services from the container:
```typescript
const orchestrator = container.resolve<AgentOrchestrator>('agentOrchestrator');
const stateManager = container.resolve<WorkflowStateManager>('stateManager');
```

3. Register agents with the orchestrator:
```typescript
orchestrator.registerAgent(myAgent);
```

4. Services will automatically use the improved architecture components.

## Compatibility

These improvements are designed to be backward compatible with existing code. The main interfaces remain the same, but the internal implementations are now more robust.

## Future Improvements

Future work could include:
- Adding persistent storage for workflow states
- Implementing a dashboard for monitoring agent activities
- Adding more sophisticated loop detection algorithms
- Supporting multiple LLM providers beyond OpenAI 