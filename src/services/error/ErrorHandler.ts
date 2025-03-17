import { singleton } from 'tsyringe';
import { LoggingServiceFactory } from '../logging/LoggingServiceFactory';

/**
 * Error types for categorization
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  INTERNAL = 'INTERNAL',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error context for additional information
 */
export interface ErrorContext {
  source: string;
  operation: string;
  data?: any;
  timestamp?: Date;
  [key: string]: any;
}

/**
 * Application error class with enhanced context
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly context: ErrorContext;
  public readonly originalError?: Error;
  public readonly retryable: boolean;
  
  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    context: ErrorContext,
    originalError?: Error,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = {
      ...context,
      timestamp: context.timestamp || new Date()
    };
    this.originalError = originalError;
    this.retryable = retryable;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
  
  /**
   * Create a network error
   */
  static network(message: string, context: ErrorContext, originalError?: Error): AppError {
    return new AppError(
      message,
      ErrorType.NETWORK,
      context,
      originalError,
      true // Network errors are typically retryable
    );
  }
  
  /**
   * Create an API error
   */
  static api(message: string, context: ErrorContext, originalError?: Error, retryable: boolean = false): AppError {
    return new AppError(
      message,
      ErrorType.API,
      context,
      originalError,
      retryable
    );
  }
  
  /**
   * Create a validation error
   */
  static validation(message: string, context: ErrorContext, originalError?: Error): AppError {
    return new AppError(
      message,
      ErrorType.VALIDATION,
      context,
      originalError,
      false // Validation errors are not retryable
    );
  }
  
  /**
   * Create a rate limit error
   */
  static rateLimit(message: string, context: ErrorContext, originalError?: Error): AppError {
    return new AppError(
      message,
      ErrorType.RATE_LIMIT,
      context,
      originalError,
      true // Rate limit errors are retryable after a delay
    );
  }
  
  /**
   * Create a timeout error
   */
  static timeout(message: string, context: ErrorContext, originalError?: Error): AppError {
    return new AppError(
      message,
      ErrorType.TIMEOUT,
      context,
      originalError,
      true // Timeout errors are typically retryable
    );
  }
}

/**
 * Options for retry mechanism
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrorTypes?: ErrorType[];
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryableErrorTypes: [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.RATE_LIMIT
  ]
};

/**
 * Global error handler service
 */
@singleton()
export class ErrorHandler {
  private logger = LoggingServiceFactory.getInstance();
  private jitterFactor: number = 0.1; // Default to 0.1 (10% jitter)

  /**
   * Set a fixed jitter factor for testing
   * @param factor The fixed jitter factor to use (0 to 1)
   */
  public setJitterFactor(factor: number): void {
    this.jitterFactor = factor;
  }

  /**
   * Handle an error
   * @param error Error object or message
   * @param context Additional context
   */
  public handleError(error: Error | string, context?: any): void {
    const errorMessage = error instanceof Error ? error.message : error;
    this.logger.error(errorMessage, { context, stack: error instanceof Error ? error.stack : undefined });
  }

  /**
   * Handle an error and return a user-friendly message
   * @param error Error object or message
   * @param context Additional context
   * @returns User-friendly error message
   */
  public handleErrorWithMessage(error: Error | string, context?: any): string {
    this.handleError(error, context);
    return 'An unexpected error occurred. Please try again later.';
  }

  /**
   * Convert any error to an AppError
   * @param error Original error
   * @param context Additional context
   * @returns Normalized AppError
   */
  private normalizeError(error: Error | AppError, context?: Partial<ErrorContext>): AppError {
    if (error instanceof AppError) {
      // Create a new AppError with merged context if additional context is provided
      if (context) {
        return new AppError(
          error.message,
          error.type,
          { ...error.context, ...context },
          error.originalError,
          error.retryable
        );
      }
      return error;
    }
    
    // Determine error type based on message and properties
    let errorType = ErrorType.UNKNOWN;
    let retryable = false;
    
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('connection') || 
        errorMessage.includes('econnrefused') || errorMessage.includes('econnreset')) {
      errorType = ErrorType.NETWORK;
      retryable = true;
    } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      errorType = ErrorType.TIMEOUT;
      retryable = true;
    } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || 
               errorMessage.includes('429')) {
      errorType = ErrorType.RATE_LIMIT;
      retryable = true;
    } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      errorType = ErrorType.NOT_FOUND;
    } else if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      errorType = ErrorType.AUTHENTICATION;
    } else if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
      errorType = ErrorType.AUTHORIZATION;
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      errorType = ErrorType.VALIDATION;
    }
    
    return new AppError(
      error.message,
      errorType,
      {
        source: 'unknown',
        operation: 'unknown',
        ...context,
        timestamp: new Date()
      },
      error,
      retryable
    );
  }
  
  /**
   * Execute a function with automatic retries for transient errors
   * @param fn Function to execute
   * @param options Retry options
   * @returns Result of the function
   */
  public async withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const retryOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retryOptions.maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Determine if we should retry
        const appError = this.normalizeError(lastError);
        const shouldRetry = attempt <= retryOptions.maxRetries && 
                           (appError.retryable || 
                            (retryOptions.retryableErrorTypes && 
                             retryOptions.retryableErrorTypes.includes(appError.type)));
        
        if (!shouldRetry) {
          this.handleError(appError, { 
            retryAttempt: attempt - 1,
            maxRetries: retryOptions.maxRetries
          });
          throw appError;
        }
        
        // Calculate backoff delay with jitter
        const delay = Math.min(
          retryOptions.initialDelay * Math.pow(retryOptions.backoffFactor, attempt - 1),
          retryOptions.maxDelay
        );
        const jitteredDelay = delay * (1 + this.jitterFactor); // Fixed jitter for testing
        
        this.logger.warn(`Retry attempt ${attempt}/${retryOptions.maxRetries} after ${Math.round(jitteredDelay)}ms`, {
          errorType: appError.type,
          errorMessage: appError.message,
          retryAttempt: attempt,
          maxRetries: retryOptions.maxRetries,
          delay: Math.round(jitteredDelay)
        });
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
    
    // This should never happen due to the throw in the loop
    throw lastError || new Error('Unexpected error in retry mechanism');
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler(); 