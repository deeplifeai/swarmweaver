import { eventBus, EventType, FunctionCalledEvent } from '@/services/eventBus';
import { validate as validateJsonSchema } from 'jsonschema';

// Define the function structure
export interface AgentFunction {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  handler: (args: any, agentId: string, channelId?: string, threadTs?: string) => Promise<any>;
}

// Function execution result
export interface FunctionResult {
  success: boolean;
  functionName: string;
  arguments: any;
  data?: any;
  error?: string;
}

/**
 * FunctionRegistry manages registration and execution of agent functions
 * with validation and error handling
 */
export class FunctionRegistry {
  private functions: Map<string, AgentFunction> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  
  /**
   * Register a function with the registry
   * @param func Function definition to register
   */
  register(func: AgentFunction): void {
    if (this.functions.has(func.name)) {
      console.warn(`Function '${func.name}' is being overwritten in the registry`);
    }
    
    this.functions.set(func.name, func);
  }
  
  /**
   * Register multiple functions at once
   * @param funcs Array of function definitions
   */
  registerAll(funcs: AgentFunction[]): void {
    funcs.forEach(func => this.register(func));
  }
  
  /**
   * Get all registered functions
   * @returns Map of registered functions
   */
  getAllFunctions(): Map<string, AgentFunction> {
    return this.functions;
  }
  
  /**
   * Get function definitions in OpenAI format
   * @returns Array of function definitions
   */
  getFunctionDefinitions(): any[] {
    return Array.from(this.functions.values()).map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }));
  }
  
  /**
   * Execute a function with validation and error handling
   * @param name Function name
   * @param args Function arguments
   * @param agentId ID of the agent calling the function
   * @param channelId Slack channel ID
   * @param threadTs Slack thread timestamp
   * @returns Function execution result
   */
  async execute(
    name: string, 
    args: any, 
    agentId: string,
    channelId?: string,
    threadTs?: string
  ): Promise<FunctionResult> {
    // Standard result object with function name and arguments
    const result: FunctionResult = {
      success: false,
      functionName: name,
      arguments: args
    };
    
    try {
      // Check if function exists
      const func = this.functions.get(name);
      if (!func) {
        throw new Error(`Function '${name}' not found in registry`);
      }
      
      // Validate arguments against function schema
      const validationResult = validateJsonSchema(args, func.parameters);
      if (!validationResult.valid) {
        const errors = validationResult.errors.map(err => err.stack).join(', ');
        throw new Error(`Invalid arguments for function '${name}': ${errors}`);
      }
      
      // Emit function called event
      eventBus.emit(EventType.FUNCTION_CALLED, {
        name,
        args,
        agentId,
        channelId: channelId || '',
        threadTs
      } as FunctionCalledEvent);
      
      // Execute with timeout
      const data = await Promise.race([
        func.handler(args, agentId, channelId, threadTs),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Function execution timed out')), this.DEFAULT_TIMEOUT)
        )
      ]);
      
      // Set success result
      result.success = true;
      result.data = data;
      
      return result;
    } catch (error: any) {
      // Handle error case
      console.error(`Error executing function '${name}':`, error);
      
      result.success = false;
      result.error = error.message || 'Unknown error occurred';
      
      // Emit error event
      eventBus.emit(EventType.ERROR, {
        source: 'FunctionRegistry',
        error,
        message: `Error executing function '${name}': ${error.message}`
      });
      
      return result;
    }
  }
} 