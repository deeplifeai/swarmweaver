// Mock the logging service
const mockLog = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

jest.mock('../src/services/logging/LoggingService', () => ({
  log: mockLog,
  LoggingService: jest.fn().mockImplementation(() => ({
    error: mockLog.error,
    warn: mockLog.warn,
    info: mockLog.info,
    debug: mockLog.debug
  }))
}));

import { ErrorHandler, AppError, ErrorType } from '../src/services/error/ErrorHandler';
import { LoggingService } from '../src/services/logging/LoggingService';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    errorHandler = new ErrorHandler();
  });
  
  describe('handleError', () => {
    it('should handle a standard Error and normalize it', () => {
      // Arrange
      const error = new Error('Test error');
      const context = { source: 'test', operation: 'handleErrorTest' };
      
      // Act
      errorHandler.handleError(error, context);
      
      // Assert
      expect(mockLog.error).toHaveBeenCalled();
      const logArgs = mockLog.error.mock.calls[0];
      expect(logArgs[0]).toContain('Test error');
      expect(logArgs[1].context.source).toBe('test');
      expect(logArgs[1].context.operation).toBe('handleErrorTest');
    });
    
    it('should handle an AppError directly', () => {
      // Arrange
      const error = new AppError(
        'Test validation error',
        ErrorType.VALIDATION,
        { source: 'test', operation: 'validateData' }
      );
      
      // Act
      errorHandler.handleError(error);
      
      // Assert
      expect(mockLog.error).toHaveBeenCalled();
      const logArgs = mockLog.error.mock.calls[0];
      expect(logArgs[0]).toContain('VALIDATION');
      expect(logArgs[0]).toContain('Test validation error');
      expect(logArgs[1].errorType).toBe(ErrorType.VALIDATION);
      expect(logArgs[1].context.source).toBe('test');
      expect(logArgs[1].context.operation).toBe('validateData');
    });
    
    it('should merge additional context with existing AppError context', () => {
      // Arrange
      const error = new AppError(
        'Test error',
        ErrorType.API,
        { source: 'test', operation: 'apiCall' }
      );
      const additionalContext = { 
        requestId: '12345',
        endpoint: '/api/data'
      };
      
      // Act
      errorHandler.handleError(error, additionalContext);
      
      // Assert
      expect(mockLog.error).toHaveBeenCalled();
      const logArgs = mockLog.error.mock.calls[0];
      expect(logArgs[1].context.source).toBe('test');
      expect(logArgs[1].context.operation).toBe('apiCall');
      expect(logArgs[1].context.requestId).toBe('12345');
      expect(logArgs[1].context.endpoint).toBe('/api/data');
    });
  });
  
  describe('withRetry', () => {
    it('should retry a function until it succeeds', async () => {
      // Arrange
      let attempts = 0;
      const fn = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new AppError(
            'Network error',
            ErrorType.NETWORK,
            { source: 'test', operation: 'testRetry' },
            undefined,
            true
          );
        }
        return 'success';
      });
      
      // Act
      const result = await errorHandler.withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffFactor: 1.5
      });
      
      // Assert
      expect(fn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
      expect(mockLog.warn).toHaveBeenCalledTimes(2); // Warning logs for each retry
    });
    
    it('should stop retrying after max attempts and throw the last error', async () => {
      // Arrange
      const fn = jest.fn().mockImplementation(() => {
        throw new AppError(
          'Persistent error',
          ErrorType.API,
          { source: 'test', operation: 'testMaxRetries' },
          undefined,
          true
        );
      });
      
      // Act & Assert
      await expect(errorHandler.withRetry(fn, {
        maxRetries: 2,
        initialDelay: 10,
        maxDelay: 100
      })).rejects.toThrow('Persistent error');
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial try + 2 retries
      expect(mockLog.warn).toHaveBeenCalledTimes(2); // Warning logs for each retry
      expect(mockLog.error).toHaveBeenCalledTimes(1); // Error log when all retries fail
    });
    
    it('should not retry if error is not retryable', async () => {
      // Arrange
      const fn = jest.fn().mockImplementation(() => {
        throw new AppError(
          'Validation error',
          ErrorType.VALIDATION, // Not a retryable error type
          { source: 'test', operation: 'validate' },
          undefined,
          false // Explicitly not retryable
        );
      });
      
      // Act & Assert
      await expect(errorHandler.withRetry(fn)).rejects.toThrow('Validation error');
      
      expect(fn).toHaveBeenCalledTimes(1); // Only called once, no retries
      expect(mockLog.warn).not.toHaveBeenCalled(); // No retry warnings
      expect(mockLog.error).toHaveBeenCalledTimes(1); // Error log for the failure
    });
    
    it('should respect retryableErrorTypes option', async () => {
      // Arrange
      const fn = jest.fn().mockImplementation(() => {
        throw new AppError(
          'Timeout error',
          ErrorType.TIMEOUT,
          { source: 'test', operation: 'timeoutOperation' }
        );
      });
      
      // Act & Assert
      await expect(errorHandler.withRetry(fn, {
        maxRetries: 2,
        retryableErrorTypes: [ErrorType.NETWORK] // TIMEOUT not included
      })).rejects.toThrow('Timeout error');
      
      expect(fn).toHaveBeenCalledTimes(1); // Only called once, no retries
    });
  });
  
  describe('AppError', () => {
    it('should create errors with factory methods', () => {
      // Network error
      const networkError = AppError.network(
        'Connection failed',
        { source: 'test', operation: 'connect' }
      );
      expect(networkError.type).toBe(ErrorType.NETWORK);
      expect(networkError.retryable).toBe(true);
      
      // API error (not retryable by default)
      const apiError = AppError.api(
        'API failed',
        { source: 'test', operation: 'apiCall' }
      );
      expect(apiError.type).toBe(ErrorType.API);
      expect(apiError.retryable).toBe(false);
      
      // API error (explicitly retryable)
      const retryableApiError = AppError.api(
        'API rate limited',
        { source: 'test', operation: 'apiCall' },
        undefined,
        true
      );
      expect(retryableApiError.type).toBe(ErrorType.API);
      expect(retryableApiError.retryable).toBe(true);
      
      // Validation error
      const validationError = AppError.validation(
        'Invalid input',
        { source: 'test', operation: 'validate', data: { field: 'email' } }
      );
      expect(validationError.type).toBe(ErrorType.VALIDATION);
      expect(validationError.retryable).toBe(false);
      expect(validationError.context.data.field).toBe('email');
    });
  });
}); 