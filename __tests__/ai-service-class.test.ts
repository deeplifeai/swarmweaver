import { AIService } from '../src/services/ai-service';
import { ErrorHandler, AppError, ErrorType } from '../src/services/error/ErrorHandler';
import { CacheFactory } from '../src/services/cache/CacheFactory';

// Mock the dependencies
jest.mock('../src/services/error/ErrorHandler');
jest.mock('../src/services/cache/CacheFactory');
jest.mock('../src/services/logging/LoggingService');
jest.mock('../src/store/agentStore');

describe('AIService class', () => {
  let aiService: AIService;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let mockCacheService: any;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup error handler mock
    mockErrorHandler = {
      handleError: jest.fn(),
      withRetry: jest.fn().mockImplementation(async (fn) => fn())
    } as unknown as jest.Mocked<ErrorHandler>;
    
    // Setup cache mock
    mockCacheService = {
      getCachedResponse: jest.fn().mockResolvedValue(null),
      cacheResponse: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockReturnValue(true),
      setEnabled: jest.fn()
    };
    
    // Mock the getInstance method of CacheFactory
    (CacheFactory.getInstance as jest.Mock).mockReturnValue(mockCacheService);
    
    // Create the AIService instance with mocked error handler
    aiService = new AIService(mockErrorHandler);
    
    // Mock callProviderAPI method
    aiService['callProviderAPI'] = jest.fn().mockResolvedValue('Test response');
  });
  
  describe('generateAgentResponse', () => {
    it('should use cached response when available', async () => {
      // Setup
      const cachedResponse = 'Cached response';
      mockCacheService.getCachedResponse.mockResolvedValue(cachedResponse);
      
      // Execute
      const response = await aiService.generateAgentResponse(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      
      // Verify
      expect(response).toBe(cachedResponse);
      expect(mockCacheService.getCachedResponse).toHaveBeenCalledWith(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      expect(aiService['callProviderAPI']).not.toHaveBeenCalled();
      expect(mockCacheService.cacheResponse).not.toHaveBeenCalled();
    });
    
    it('should call the API and cache the response when no cache hit', async () => {
      // Setup
      const apiResponse = 'API response';
      (aiService['callProviderAPI'] as jest.Mock).mockResolvedValue(apiResponse);
      
      // Execute
      const response = await aiService.generateAgentResponse(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      
      // Verify
      expect(response).toBe(apiResponse);
      expect(mockCacheService.getCachedResponse).toHaveBeenCalled();
      expect(aiService['callProviderAPI']).toHaveBeenCalledWith(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      expect(mockCacheService.cacheResponse).toHaveBeenCalledWith(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello',
        apiResponse
      );
    });
    
    it('should use the error handler withRetry method', async () => {
      // Execute
      await aiService.generateAgentResponse(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      
      // Verify
      expect(mockErrorHandler.withRetry).toHaveBeenCalledTimes(1);
    });
    
    it('should not cache error responses', async () => {
      // Setup
      const errorResponse = '[Error: Something went wrong]';
      (aiService['callProviderAPI'] as jest.Mock).mockResolvedValue(errorResponse);
      
      // Execute
      const response = await aiService.generateAgentResponse(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      );
      
      // Verify
      expect(response).toBe(errorResponse);
      expect(mockCacheService.cacheResponse).not.toHaveBeenCalled();
    });
  });
  
  describe('Error handling', () => {
    it('should convert regular errors to AppErrors', async () => {
      // Setup
      const originalError = new Error('Network error');
      (aiService['callProviderAPI'] as jest.Mock).mockRejectedValue(originalError);
      
      // Replace the withRetry implementation to capture the error transformation
      mockErrorHandler.withRetry.mockImplementationOnce(async (fn) => {
        try {
          return await fn();
        } catch (error) {
          // Verify the error was transformed to an AppError
          expect(error).toBeInstanceOf(AppError);
          if (error instanceof AppError) {
            expect(error.message).toBe('Network error');
            expect(error.context.source).toBe('ai-service');
          }
          throw error;
        }
      });
      
      // Execute & Assert
      await expect(aiService.generateAgentResponse(
        'openai',
        'gpt-4',
        'You are a helpful assistant',
        'Hello'
      )).rejects.toThrow();
    });
    
    it('should identify retryable errors correctly', () => {
      // Network errors should be retryable
      expect(aiService['isRetryableError'](new Error('network connection failed'))).toBe(true);
      
      // Timeout errors should be retryable
      expect(aiService['isRetryableError'](new Error('operation timed out'))).toBe(true);
      
      // Rate limit errors should be retryable
      expect(aiService['isRetryableError'](new Error('429 too many requests'))).toBe(true);
      
      // Validation errors should not be retryable
      expect(aiService['isRetryableError'](new Error('invalid parameter'))).toBe(false);
      
      // Null/undefined should not be retryable
      expect(aiService['isRetryableError'](null)).toBe(false);
      expect(aiService['isRetryableError'](undefined)).toBe(false);
    });
  });
}); 