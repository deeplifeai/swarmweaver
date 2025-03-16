import { singleton } from 'tsyringe';
import { log } from '../logging/LoggingService';

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
 * Centralized error handling service
 */
@singleton()
export class ErrorHandler {
  /**
   * Handle an error with logging and optional reporting
   * @param error Error to handle
   * @param context Additional context
   */
  public handleError(error: Error | AppError, context?: Partial<ErrorContext>): void {
    const appError = this.normalizeError(error, context);
    
    // Log the error with context
    log.error(`[${appError.type}] ${appError.message}`, {
      errorType: appError.type,
      context: appError.context,
      stack: appError.stack,
      originalError: appError.originalError ? {
        message: appError.originalError.message,
        stack: appError.originalError.stack
      } : undefined
    });
    
    // Here you could add additional error reporting to external services
    // like Sentry, Datadog, etc.
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
        const jitteredDelay = delay * (0.8 + Math.random() * 0.4); // Add 20% jitter
        
        log.warn(`Retry attempt ${attempt}/${retryOptions.maxRetries} after ${Math.round(jitteredDelay)}ms`, {
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