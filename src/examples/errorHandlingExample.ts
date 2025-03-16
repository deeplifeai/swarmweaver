import { container } from '../services/di/container';
import { ErrorHandler, AppError, ErrorType } from '../services/error/ErrorHandler';
import { log } from '../services/logging/LoggingService';

/**
 * Example demonstrating how to use the error handling system
 */
async function errorHandlingExample() {
  // Get the error handler from the container
  const errorHandler = container.resolve<ErrorHandler>('ErrorHandler');
  
  log.info('Starting error handling example');
  
  // Example 1: Basic error handling
  try {
    throw new Error('This is a basic error');
  } catch (error) {
    // The error handler will normalize any error to an AppError
    errorHandler.handleError(error, {
      source: 'errorHandlingExample',
      operation: 'example1'
    });
  }
  
  // Example 2: Using AppError directly
  try {
    throw new AppError(
      'This is a validation error',
      ErrorType.VALIDATION,
      {
        source: 'errorHandlingExample',
        operation: 'example2',
        data: { field: 'username', value: '' }
      }
    );
  } catch (error) {
    errorHandler.handleError(error);
  }
  
  // Example 3: Using retry mechanism
  try {
    await errorHandler.withRetry(
      async () => {
        // Simulate a network error on first attempt
        const randomValue = Math.random();
        log.info(`Retry attempt with random value: ${randomValue}`);
        
        if (randomValue < 0.7) {
          throw new AppError(
            'Network connection failed',
            ErrorType.NETWORK,
            {
              source: 'errorHandlingExample',
              operation: 'example3'
            },
            null,
            true // This error is retryable
          );
        }
        
        return 'Success after retry!';
      },
      {
        maxRetries: 5,
        initialDelay: 100, // 100ms
        maxDelay: 1000, // 1 second
        backoffFactor: 2
      }
    );
    
    log.info('Retry mechanism succeeded');
  } catch (error) {
    log.error('Retry mechanism failed after all attempts');
    errorHandler.handleError(error);
  }
  
  // Example 4: Using factory methods
  try {
    // Simulate an API call
    const apiCall = async () => {
      throw AppError.api(
        'API rate limit exceeded',
        {
          source: 'errorHandlingExample',
          operation: 'apiCall',
          endpoint: '/api/data'
        },
        new Error('429 Too Many Requests'),
        true // This error is retryable
      );
    };
    
    await apiCall();
  } catch (error) {
    errorHandler.handleError(error);
  }
  
  log.info('Error handling example completed');
}

// Export the example function
export { errorHandlingExample }; 