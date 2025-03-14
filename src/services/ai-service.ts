import { AIModel, AIProvider } from '@/types/agent';
import { useAgentStore } from '@/store/agentStore';
import { calculateMaxOutputTokens, getMaxCompletionTokens, estimateTokenCount, getModelContextSize } from '@/utils/tokenManager';
import { processWithChunkedStrategy } from './optimizationService';
import { CacheFactory } from './cache/CacheFactory';
import { ErrorHandler, AppError, ErrorType } from './error/ErrorHandler';
import { log } from './logging/LoggingService';
import { singleton, inject } from 'tsyringe';

// Add a validation function to check for common input issues
function validateInput(input: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if input appears to be truncated
  if (input.endsWith('...') || input.endsWith('…')) {
    issues.push('Input appears to be truncated (ends with ellipsis)');
  }
  
  // Check for input that's too short
  if (input.trim().length < 5) {
    issues.push('Input is too short (less than 5 characters)');
  }
  
  // Check for incomplete JSON or markdown code blocks
  const openCodeBlocks = (input.match(/```[a-z]*\n/g) || []).length;
  const closeCodeBlocks = (input.match(/```\s*\n/g) || []).length;
  if (openCodeBlocks > closeCodeBlocks) {
    issues.push(`Input contains unclosed code blocks (${openCodeBlocks} opening vs ${closeCodeBlocks} closing)`);
  }
  
  // Check for unbalanced parentheses or brackets that might indicate truncation
  const openParens = (input.match(/\(/g) || []).length;
  const closeParens = (input.match(/\)/g) || []).length;
  if (Math.abs(openParens - closeParens) > 2) {
    issues.push(`Input has unbalanced parentheses (${openParens} opening vs ${closeParens} closing)`);
  }
  
  const openBrackets = (input.match(/\{/g) || []).length;
  const closeBrackets = (input.match(/\}/g) || []).length;
  if (Math.abs(openBrackets - closeBrackets) > 2) {
    issues.push(`Input has unbalanced curly braces (${openBrackets} opening vs ${closeBrackets} closing)`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Service for interacting with AI providers
 */
@singleton()
export class AIService {
  constructor(
    @inject('ErrorHandler') private errorHandler: ErrorHandler
  ) {}

  /**
   * Generate a response from an AI agent with caching and error handling
   */
  async generateAgentResponse(provider: string, model: any, systemPrompt: string, query: string): Promise<string> {
    // Get the cache service from the factory
    const cacheService = CacheFactory.getInstance();
    
    // Add logging to track how many cache hits/misses we're getting
    log.debug(`API Request - Provider: ${provider}, Model: ${model}, System prompt length: ${systemPrompt?.length || 0}, Query length: ${query?.length || 0}`);
    
    // Check if we have a cached response
    const cached = await cacheService.getCachedResponse(
      provider as AIProvider,
      model as AIModel,
      systemPrompt,
      query
    );
    
    if (cached) {
      // Validate cached response - must be non-empty and not an error
      if (cached.length > 0 && !cached.startsWith('[Error:') && !cached.startsWith('[ERROR::')) {
        log.info("✅ Using cached response");
        return cached;
      } else {
        log.info("⚠️ Found invalid cached response, ignoring it");
      }
    }
    
    log.info("❌ Cache miss - making API call");
    
    // If not cached, call the original function with retry logic
    return this.errorHandler.withRetry(
      async () => {
        try {
          const response = await this.callProviderAPI(provider, model, systemPrompt, query);
          
          // Only cache valid responses
          if (response && response.length > 0 && !response.startsWith('[Error:') && !response.startsWith('[ERROR::')) {
            await cacheService.cacheResponse(
              provider as AIProvider,
              model as AIModel,
              systemPrompt,
              query,
              response
            );
          }
          
          return response;
        } catch (error) {
          // Convert to AppError for better handling
          throw AppError.api(
            error instanceof Error ? error.message : String(error),
            {
              source: 'ai-service',
              operation: 'generateAgentResponse',
              provider,
              model,
              systemPromptLength: systemPrompt?.length || 0,
              queryLength: query?.length || 0
            },
            error instanceof Error ? error : undefined,
            this.isRetryableError(error)
          );
        }
      },
      {
        maxRetries: 3,
        retryableErrorTypes: [
          ErrorType.NETWORK,
          ErrorType.TIMEOUT,
          ErrorType.RATE_LIMIT
        ]
      }
    );
  }

  /**
   * Determine if an error is retryable based on its message
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Check for common retryable error patterns
    return (
      message.includes('timeout') ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('503') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('socket')
    );
  }

  /**
   * Call the appropriate API based on the provider
   */
  private async callProviderAPI(provider: string, model: any, systemPrompt: string, query: string): Promise<string> {
    // Get the API key from the store
    const apiKey = useAgentStore.getState().apiKey[provider];
    if (!apiKey) {
      throw new AppError(
        `No API key set for ${provider}`,
        ErrorType.AUTHENTICATION,
        {
          source: 'ai-service',
          operation: 'callProviderAPI',
          provider
        }
      );
    }
    
    // Choose the appropriate API call based on provider
    if (provider === 'openai') {
      return this.callOpenAI(apiKey, model, systemPrompt, query);
    } else if (provider === 'perplexity') {
      return this.callPerplexity(apiKey, model, systemPrompt, query);
    } else {
      throw new AppError(
        `Unsupported provider: ${provider}`,
        ErrorType.VALIDATION,
        {
          source: 'ai-service',
          operation: 'callProviderAPI',
          provider
        }
      );
    }
  }

  /**
   * Call the OpenAI API
   */
  private async callOpenAI(
    apiKey: string,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    if (!apiKey) {
      throw new AppError(
        'OpenAI API key is required',
        ErrorType.AUTHENTICATION,
        {
          source: 'ai-service',
          operation: 'callOpenAI',
          model
        }
      );
    }

    let isTryingFallbackParameters = false;

    const tryCall = async (useAlternativeParameter = false) => {
      try {
        // Get the estimated token count of the entire input
        const estimatedSystemTokens = estimateTokenCount(systemPrompt || '');
        const estimatedUserTokens = estimateTokenCount(userPrompt || '');
        const totalEstimatedTokens = estimatedSystemTokens + estimatedUserTokens;
        
        // Get the model's context size
        const modelContextSize = getModelContextSize(model);
        
        // Check if we need to use chunked processing
        // More proactive checks to determine when chunking is needed:
        // 1. If the input is very large (over 10k chars) - as before
        // 2. If the estimated tokens are over 60% of the model's context window
        // 3. If the user prompt is complex (contains lots of code blocks or is very large)
        const useChunking = 
          userPrompt.length > 10000 || 
          totalEstimatedTokens > modelContextSize * 0.6 ||
          (userPrompt.length > 6000 && (userPrompt.includes("```") || userPrompt.includes("code")));
        
        if (useChunking) {
          log.info(`Using chunked processing strategy: Input is large (${userPrompt.length} chars, ~${totalEstimatedTokens} tokens, model context: ${modelContextSize})`);
          return processWithChunkedStrategy('openai', model, systemPrompt, userPrompt, apiKey);
        }

        // Log the request information
        log.info(`Calling OpenAI API with model: ${model}`);
        
        // Calculate appropriate max_tokens based on input size and model
        const maxOutputTokens = calculateMaxOutputTokens(systemPrompt, userPrompt, model);
        const maxAllowedCompletionTokens = getMaxCompletionTokens(model);
        log.info(`Calculated max output tokens: ${maxOutputTokens} (model limit: ${maxAllowedCompletionTokens})`);
        
        // Base payload with required parameters
        const payload = {
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ],
          max_tokens: Math.min(maxOutputTokens, maxAllowedCompletionTokens),
          temperature: useAlternativeParameter ? 0.2 : 0.7,
          top_p: useAlternativeParameter ? 0.1 : 1,
          frequency_penalty: useAlternativeParameter ? 0.5 : 0,
          presence_penalty: useAlternativeParameter ? 0.5 : 0
        };
        
        // Make the API call
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
          const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
          
          throw new Error(`OpenAI API error: ${errorMessage}`);
        }
        
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        if (!content) {
          throw new Error('Empty response from OpenAI API');
        }
        
        return content;
      } catch (error) {
        // Handle errors more robustly based on error message content
        if (!isTryingFallbackParameters) {
          const errorMsg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          
          // If we get a content policy violation or similar, try with more conservative parameters
          if (errorMsg.includes('content policy') || 
              errorMsg.includes('violat') || 
              errorMsg.includes('inappropriate') || 
              errorMsg.includes('harmful')) {
            
            log.warn('Content policy issue detected, retrying with more conservative parameters');
            isTryingFallbackParameters = true;
            return tryCall(true);
          }
        }
        
        throw new AppError(
          error instanceof Error ? error.message : String(error),
          ErrorType.API,
          {
            source: 'ai-service',
            operation: 'callOpenAI',
            model,
            useAlternativeParameter
          },
          error instanceof Error ? error : undefined,
          true // Most OpenAI errors are retryable
        );
      }
    };
    
    return tryCall();
  }

  /**
   * Call the Perplexity API
   */
  private async callPerplexity(
    apiKey: string,
    model: AIModel,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    if (!apiKey) {
      throw new AppError(
        'Perplexity API key is required',
        ErrorType.AUTHENTICATION,
        {
          source: 'ai-service',
          operation: 'callPerplexity',
          model
        }
      );
    }

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Failed to parse error response' } }));
        const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
        
        throw new Error(`Perplexity API error: ${errorMessage}`);
      }
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      if (!error) {
        throw new Error('Network error when calling Perplexity API');
      }
      throw new AppError(
        error instanceof Error ? error.message : String(error),
        ErrorType.API,
        {
          source: 'ai-service',
          operation: 'callPerplexity',
          model
        },
        error instanceof Error ? error : undefined,
        true // Most Perplexity errors are retryable
      );
    }
  }
}

// Export a function to get the AIService instance for backward compatibility
let aiServiceInstance: AIService | null = null;

export async function generateAgentResponse(provider: string, model: any, systemPrompt: string, query: string): Promise<string> {
  if (!aiServiceInstance) {
    // Dynamically import to avoid circular dependencies
    const { container } = await import('./di/container');
    aiServiceInstance = container.resolve(AIService);
  }
  return aiServiceInstance.generateAgentResponse(provider, model, systemPrompt, query);
}
