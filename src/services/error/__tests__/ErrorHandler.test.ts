import 'reflect-metadata';
import { ErrorHandler, AppError, ErrorType } from '../ErrorHandler';
import { container } from 'tsyringe';
import { jest } from '@jest/globals';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

describe('Error Handler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // Clear the container before each test
    container.clearInstances();
    
    // Register the ErrorHandler
    container.register('ErrorHandler', { useClass: ErrorHandler });
    
    // Get a new instance for each test
    errorHandler = container.resolve<ErrorHandler>('ErrorHandler');
  });

  describe('Error Types', () => {
    it('should handle network errors', () => {
      const error = AppError.network(
        'Connection failed',
        { source: 'test', operation: 'networkTest' },
        new Error('ECONNREFUSED')
      );

      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.retryable).toBe(true);
      expect(error.message).toBe('Connection failed');
      expect(error.context.source).toBe('test');
      expect(error.context.operation).toBe('networkTest');
    });

    it('should handle API errors', () => {
      const error = AppError.api(
        'API request failed',
        { source: 'test', operation: 'apiTest' },
        new Error('500 Internal Server Error'),
        true
      );

      expect(error.type).toBe(ErrorType.API);
      expect(error.retryable).toBe(true);
      expect(error.message).toBe('API request failed');
    });

    it('should handle validation errors', () => {
      const error = AppError.validation(
        'Invalid input',
        { source: 'test', operation: 'validationTest' },
        new Error('Invalid email format')
      );

      expect(error.type).toBe(ErrorType.VALIDATION);
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Invalid input');
    });

    it('should handle authentication errors', () => {
      const error = new AppError(
        'Authentication failed',
        ErrorType.AUTHENTICATION,
        { source: 'test', operation: 'authTest' },
        new Error('401 Unauthorized')
      );

      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Authentication failed');
    });
  });

  describe('Retry Mechanism', () => {
    let realSetTimeout: typeof setTimeout;
    let realDateNow: typeof Date.now;
    let currentTime: number;

    beforeEach(() => {
      realSetTimeout = global.setTimeout;
      realDateNow = Date.now;
      currentTime = 0;

      // Mock setTimeout to execute immediately and advance our fake timer
      global.setTimeout = ((fn: Function, ms: number) => {
        currentTime += ms;
        fn();
        return null as any;
      }) as typeof setTimeout;

      // Mock Date.now to return our controlled time
      Date.now = () => currentTime;
    });

    afterEach(() => {
      global.setTimeout = realSetTimeout;
      Date.now = realDateNow;
    });

    it('should successfully retry on transient errors', async () => {
      let attempts = 0;
      const result = await errorHandler.withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw AppError.network(
              'Temporary network issue',
              { source: 'test', operation: 'retryTest' }
            );
          }
          return 'Success!';
        },
        {
          maxRetries: 3,
          initialDelay: 100,
          maxDelay: 1000
        }
      );

      expect(result).toBe('Success!');
      expect(attempts).toBe(3);
    });

    it('should respect maximum retry attempts', async () => {
      let attempts = 0;
      await expect(errorHandler.withRetry(
        async () => {
          attempts++;
          throw AppError.network(
            'Network issue',
            { source: 'test', operation: 'maxRetriesTest' }
          );
        },
        {
          maxRetries: 2,
          initialDelay: 100
        }
      )).rejects.toThrow('Network issue');

      expect(attempts).toBe(3); // Initial attempt + 2 retries
    });

    it('should differentiate between retryable and non-retryable errors', async () => {
      let attempts = 0;
      await expect(errorHandler.withRetry(
        async () => {
          attempts++;
          throw AppError.validation(
            'Invalid input',
            { source: 'test', operation: 'retryableTest' }
          );
        },
        {
          maxRetries: 3,
          initialDelay: 100
        }
      )).rejects.toThrow('Invalid input');

      expect(attempts).toBe(1); // Should not retry validation errors
    });

    it('should implement exponential backoff with jitter', async () => {
      let attempts = 0;
      const delays: number[] = [];

      // Set a fixed jitter factor for deterministic testing
      errorHandler.setJitterFactor(0.1); // 10% fixed jitter

      await expect(errorHandler.withRetry(
        async () => {
          attempts++;
          if (attempts > 1) {
            delays.push(currentTime);
          }
          throw AppError.network(
            'Network issue',
            { source: 'test', operation: 'backoffTest' }
          );
        },
        {
          maxRetries: 2,
          initialDelay: 100,
          maxDelay: 1000,
          backoffFactor: 2
        }
      )).rejects.toThrow('Network issue');

      expect(attempts).toBe(3);
      expect(delays.length).toBe(2);

      // With 10% fixed jitter:
      // First delay should be exactly 100ms * 1.1 = 110ms
      // Second delay should be exactly 200ms * 1.1 = 220ms
      const [firstDelay, secondDelay] = delays;
      
      expect(firstDelay).toBeCloseTo(110, 5); // Exactly 100ms * 1.1
      expect(secondDelay).toBeCloseTo(330, 5); // 110ms + 220ms
      
      // Verify exponential increase
      expect(secondDelay).toBeGreaterThan(firstDelay);
    });
  });

  describe('Error Normalization', () => {
    it('should create AppError with proper context', () => {
      const error = new AppError(
        'Unknown error',
        ErrorType.UNKNOWN,
        { source: 'test', operation: 'normalizeTest' }
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(ErrorType.UNKNOWN);
      expect(error.context.source).toBe('test');
      expect(error.context.operation).toBe('normalizeTest');
      expect(error.context.timestamp).toBeInstanceOf(Date);
    });

    it('should preserve original error context', () => {
      const originalError = new Error('Original error');
      const appError = AppError.api(
        'API error',
        { source: 'test', operation: 'contextTest' },
        originalError
      );

      expect(appError.originalError).toBe(originalError);
      expect(appError.context.source).toBe('test');
      expect(appError.context.operation).toBe('contextTest');
    });

    it('should merge additional context with existing context', () => {
      const baseContext = { source: 'test', operation: 'mergeTest' };
      const appError = AppError.api(
        'API error',
        baseContext
      );

      // Create a new error with merged context
      const updatedError = new AppError(
        appError.message,
        appError.type,
        { ...appError.context, additionalInfo: 'extra context' },
        appError.originalError,
        appError.retryable
      );

      expect(updatedError.context.source).toBe('test');
      expect(updatedError.context.operation).toBe('mergeTest');
      expect(updatedError.context.additionalInfo).toBe('extra context');
    });
  });
}); 